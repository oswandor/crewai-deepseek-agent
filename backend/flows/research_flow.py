"""Flow de investigación con estado AG-UI y una superficie A2UI controlada."""

from __future__ import annotations

import asyncio
import json
from typing import Literal
from uuid import uuid4

from ag_ui.core import EventType
from ag_ui_a2ui_toolkit import (
    create_surface,
    update_components,
    update_data_model,
    wrap_as_operations_envelope,
)
from ag_ui_crewai import CopilotKitState, copilotkit_emit_state, copilotkit_emit_tool_result
from ag_ui_crewai.events import BridgedTextMessageChunkEvent, BridgedToolCallChunkEvent
from crewai.events import crewai_event_bus
from crewai.flow.flow import Flow, start
from pydantic import BaseModel, Field

from backend.agents.research_crew import ResearchCrew


class ResearchStep(BaseModel):
    """Una etapa breve, pensada para mostrarse como progreso en la interfaz."""

    id: str
    label: str
    status: Literal["pending", "active", "complete", "error"]


class ResearchState(CopilotKitState):
    """Estado serializable y compartido entre el Flow y el cliente."""

    topic: str = ""
    report: str = ""
    error: str = ""
    steps: list[ResearchStep] = Field(default_factory=list)
    # Preferencia por request enviada por el cliente en ``forwardedProps``.
    # ``exclude=True`` evita que vuelva en los snapshots de estado: el cliente
    # AG-UI hace echo de ``state`` en cada run y pisaría el valor nuevo.
    use_web_search: bool = Field(default=True, exclude=True)


class ResearchFlow(Flow[ResearchState]):
    """Adapta el Crew secuencial a un Flow con estado y UI declarativa."""

    @start()
    async def research(self) -> str:
        topic = self._latest_user_message().strip()
        self.state.topic = topic
        self.state.error = ""
        self.state.report = ""
        self.state.steps = (
            [
                ResearchStep(id="search", label="Buscando fuentes en la web", status="active"),
                ResearchStep(id="synthesis", label="Preparando el resumen", status="pending"),
            ]
            if self.state.use_web_search
            else [ResearchStep(id="synthesis", label="Preparando el resumen", status="active")]
        )
        await copilotkit_emit_state(self.state)

        if not topic:
            self.state.error = "No recibí una pregunta para investigar."
            self.state.steps[0].status = "error"
            await copilotkit_emit_state(self.state)
            return self.state.error

        try:
            # El Crew sigue siendo dueño de las llamadas MCP a SearXNG. Se ejecuta
            # fuera del bucle async para que los snapshots de estado continúen
            # viajando por AG-UI sin bloquear el servidor.
            result = await asyncio.to_thread(
                lambda: ResearchCrew().crew(use_web_search=self.state.use_web_search).kickoff(inputs={"tema": topic})
            )
            report = str(getattr(result, "raw", result)).strip()
        except Exception as error:
            self.state.error = str(error)
            for step in self.state.steps:
                step.status = "error"
            await copilotkit_emit_state(self.state)
            raise

        self.state.report = report
        for step in self.state.steps:
            step.status = "complete"
        await copilotkit_emit_state(self.state)
        self._emit_assistant_text(report)
        await self._emit_research_brief()
        return report

    def _emit_assistant_text(self, report: str) -> None:
        """Persiste y transmite el resultado con el mismo ID de mensaje.

        El snapshot terminal de un Flow es autoritativo. Si el mensaje solo se
        transmite como chunk, ese snapshot lo elimina del chat al finalizar.
        """

        message_id = f"research-answer-{uuid4().hex}"
        self.state.messages.append({
            "id": message_id,
            "role": "assistant",
            "content": report,
        })
        crewai_event_bus.emit(
            self,
            BridgedTextMessageChunkEvent(
                type=EventType.TEXT_MESSAGE_CHUNK,
                message_id=message_id,
                role="assistant",
                delta=report,
            ),
        )

    def _latest_user_message(self) -> str:
        """Extrae el último texto del usuario del historial AG-UI."""

        for message in reversed(self.state.messages):
            if isinstance(message, dict) and message.get("role") == "user":
                content = message.get("content", "")
                if isinstance(content, str):
                    return content
            role = getattr(message, "role", None)
            content = getattr(message, "content", "")
            if role == "user" and isinstance(content, str):
                return content
        return ""

    async def _emit_research_brief(self) -> None:
        """Emite un resultado de herramienta con operaciones A2UI v0.9."""

        surface_id = f"research-{uuid4().hex}"
        tool_call_id = f"a2ui-{uuid4().hex}"
        summary = self.state.report.replace("\n", " ").strip()[:320]
        compact_topic = self.state.topic.replace("\n", " ").strip()
        if len(compact_topic) > 120:
            compact_topic = f"{compact_topic[:117].rstrip()}…"
        data = {"topic": compact_topic, "summary": summary}
        operations = [
            create_surface(surface_id, "research-catalog"),
            update_components(
                surface_id,
                [{
                    "id": "root",
                    "component": "ResearchBrief",
                    "topic": {"path": "/topic"},
                    "summary": {"path": "/summary"},
                }],
            ),
            update_data_model(surface_id, data),
        ]

        crewai_event_bus.emit(
            self,
            BridgedToolCallChunkEvent(
                type=EventType.TOOL_CALL_CHUNK,
                tool_call_id=tool_call_id,
                tool_call_name="render_research_brief",
                delta=json.dumps({"topic": self.state.topic}),
            ),
        )
        await copilotkit_emit_tool_result(tool_call_id, wrap_as_operations_envelope(operations))
