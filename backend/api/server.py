"""FastAPI application exposing the research crew over AG-UI."""

import sys

# CrewAI and FastMCP emit Unicode symbols; use UTF-8 in legacy Windows terminals.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

from ag_ui_crewai.endpoint import add_crewai_flow_fastapi_endpoint
from fastapi import FastAPI

from backend.flows.research_flow import ResearchFlow

app = FastAPI(title="CrewAI Research API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# El Flow conserva el Crew/MCP de SearXNG y añade snapshots de estado + A2UI.
add_crewai_flow_fastapi_endpoint(app, flow=ResearchFlow(), path="/research/")
