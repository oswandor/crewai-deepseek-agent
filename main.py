"""CLI entry point using the same crew as the web API."""

import argparse
import sys

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

from backend.agents.research_crew import ResearchCrew


def main() -> None:

    parser = argparse.ArgumentParser(
        description="Investiga un tema web con CrewAI, MCP y SearXNG."
    )
    parser.add_argument(
        "tema",
        nargs="?",
        default="novedades recientes en inteligencia artificial generativa",
        help="Tema que se investigará (por defecto, novedades recientes de IA).",
    )
    args = parser.parse_args()
    crew = ResearchCrew().crew()
    resultado = crew.kickoff(inputs={"tema": args.tema})
    print("\n--- Resultado ---")
    print(resultado)


if __name__ == "__main__":
    main()
