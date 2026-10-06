import pytest
from fastapi.testclient import TestClient

from backend.agents.research_crew import ResearchCrew


def test_research_crew_exposes_agui_factory() -> None:
    wrapper = ResearchCrew()
    assert wrapper.name == "research"
    assert callable(wrapper.crew)


def test_missing_openrouter_key_has_actionable_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="Falta OPENROUTER_API_KEY"):
        ResearchCrew().crew()


def test_health_and_agui_route() -> None:
    from backend.api.server import app

    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}
    assert any(route.path == "/research/" and "POST" in route.methods for route in app.routes)


def test_research_endpoint_returns_agui_stream_for_resume_rejection() -> None:
    from backend.api.server import app

    response = TestClient(app).post(
        "/research/",
        json={
            "threadId": "test-thread",
            "runId": "test-run",
            "messages": [],
            "resume": [{"interruptId": "unsupported", "status": "resolved"}],
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")


def test_forwarded_web_search_flag_reaches_flow_state() -> None:
    from ag_ui_crewai.endpoint import crewai_prepare_inputs

    from backend.flows.research_flow import ResearchState

    merged = crewai_prepare_inputs(
        state={"topic": "", "report": "", "error": "", "steps": []},
        messages=[],
        tools=[],
        context=[],
        forwarded_props={"useWebSearch": False},
    )
    state = ResearchState(**{key: value for key, value in merged.items() if key in ResearchState.model_fields})
    assert state.use_web_search is False
    # El flag no debe viajar en los snapshots: el cliente hace echo de ``state``
    # y pisaría el valor nuevo del toggle en la siguiente ejecución.
    assert "use_web_search" not in state.model_dump()


def test_web_search_disabled_skips_searxng_requirements(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("SEARXNG_URL", "http://127.0.0.1:9")
    crew = ResearchCrew().crew(use_web_search=False)
    assert crew.tasks and "sin ninguna búsqueda web" in crew.tasks[0].description


def test_web_search_enabled_requires_searxng(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("SEARXNG_URL", "http://127.0.0.1:9")
    with pytest.raises(RuntimeError, match="SearXNG"):
        ResearchCrew().crew()
