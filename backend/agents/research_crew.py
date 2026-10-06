"""Factory for the shared CLI and AG-UI research crew."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from crewai import Agent, Crew, LLM, Process, Task
from crewai.mcp import MCPServerStdio
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# The backend owns provider secrets. Prefer the project-wide .env for existing
# installs, then support backend/.env for the separated frontend/backend layout.
# `override=False` keeps an explicitly exported environment variable authoritative.
for env_file in (PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"):
    if env_file.is_file():
        load_dotenv(env_file, override=False)


class ResearchCrew:
    """A named CrewAI crew compatible with ag-ui-crewai's adapter."""

    name = "research"

    def crew(self, use_web_search: bool = True) -> Crew:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError(
                "Falta OPENROUTER_API_KEY. Configúrala en el archivo .env del proyecto."
            )

        searxng_url = os.getenv("SEARXNG_URL", "http://localhost:8080").rstrip("/")
        searxng = None
        if use_web_search:
            if not shutil.which("uvx"):
                raise RuntimeError("No se encontró uvx en PATH. Instala uv y vuelve a abrir la terminal.")
            try:
                with urlopen(searxng_url, timeout=5) as response:
                    if response.status >= 400:
                        raise RuntimeError(f"SearXNG respondió con HTTP {response.status}.")
            except (URLError, TimeoutError, OSError) as error:
                raise RuntimeError(
                    f"No se pudo conectar con SearXNG en {searxng_url}. "
                    "Inícialo con 'docker compose up -d' y verifica que esté disponible."
                ) from error
            searxng = MCPServerStdio(
                command="uvx",
                args=["--from", "searxng-mcp[mcp]", "searxng-mcp"],
                env={"SEARXNG_URL": searxng_url, "PYTHONIOENCODING": "utf-8" , "SEARXNG_MCP_TIMEOUT": "30",},
            )

        llm = LLM(
            model="openrouter/deepseek/deepseek-v4.1-flash",
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        researcher = Agent(
            role="Investigador web" if use_web_search else "Analista",
            goal=(
                "Investigar temas actuales usando SearXNG y comunicar hallazgos con fuentes."
                if use_web_search
                else "Responder preguntas con tu conocimiento interno, sin búsqueda web."
            ),
            backstory=(
                "Eres un investigador cuidadoso. Consultas la búsqueda web disponible, "
                "contrastas los resultados y distingues los hechos de la incertidumbre."
                if use_web_search
                else "Eres un analista cuidadoso. Respondes con tu conocimiento interno, "
                "aclaras cuando un dato puede estar desactualizado y distingues los hechos "
                "de la incertidumbre."
            ),
            llm=llm,
            mcps=[searxng] if searxng else [],
            verbose=False,
        )
        task = Task(
            description=(
                (
                    "Investiga con la herramienta web_search de SearXNG el siguiente tema: {tema}. "
                    "Haz las búsquedas necesarias, contrasta fuentes oficiales o primarias y "
                    "resume los hallazgos en español. Si la solicitud pide estadísticas, salarios, "
                    "comparaciones, rankings o evolución temporal, incluye al menos una tabla "
                    "Markdown con cifras, unidad, periodo/año y grupo comparado; explica quiénes "
                    "ganan más, las diferencias importantes y las limitaciones de los datos. "
                    "Distingue salario promedio, mediana, mínimo e ingreso del hogar cuando las "
                    "fuentes usen conceptos distintos. Nunca combines cifras de años o definiciones "
                    "diferentes sin advertirlo. Indica fechas de publicación cuando estén disponibles. "
                    "Termina con un máximo de cinco fuentes realmente utilizadas, cada una con título "
                    "y URL exacta. No inventes datos ni enlaces."
                )
                if use_web_search
                else (
                    "Responde en español la siguiente pregunta usando únicamente tu conocimiento "
                    "interno, sin ninguna búsqueda web: {tema}. Estructura la respuesta con secciones "
                    "claras y, si hay datos comparables relevantes, tablas Markdown. Aclara al inicio "
                    "que la respuesta se basa en tu conocimiento interno sin búsqueda web y menciona "
                    "tu fecha de corte de conocimiento. Señala explícitamente qué información podría "
                    "estar desactualizada. No inventes datos, cifras ni enlaces."
                )
            ),
            expected_output=(
                "Un informe completo en español, con secciones claras, tablas Markdown cuando "
                "haya datos comparables, conclusiones y fuentes con título y URL verificable."
                if use_web_search
                else "Una respuesta completa en español, con secciones claras, tablas Markdown "
                "cuando aplique, conclusiones y una nota sobre la fecha de corte del conocimiento."
            ),
            agent=researcher,
        )
        return Crew(
            agents=[researcher],
            tasks=[task],
            process=Process.sequential,
            verbose=True,
            chat_llm=llm,
        )
