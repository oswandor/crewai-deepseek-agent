"use client";

import { useState } from "react";
import { useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { parseSources, type SearchSource } from "@/lib/search-results";
import { Icon } from "./Icon";

function Sources({ sources }: { sources: SearchSource[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources.length) return <p className="search-query">La búsqueda terminó sin fuentes con URL válida.</p>;
  return (
    <><button className="sources-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{sources.length} {sources.length === 1 ? "fuente" : "fuentes"} <Icon name="chevronDown" size={13} /></button>{expanded && <ul className="source-list">{sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.title}</span><small>{new URL(source.url).hostname.replace(/^www\./, "")}</small><Icon name="external" size={13} /></a></li>)}</ul>}</>
  );
}

export function SearchToolRenderer() {
  return <><SearchToolCallRenderer name="web_search" /><SearchToolCallRenderer name="mcp_web_search" /></>;
}

const searchParameters = z.object({ query: z.string().optional() }).passthrough();

function SearchToolCallRenderer({ name }: { name: string }) {
  useRenderTool({
    name,
    parameters: searchParameters,
    render: ({ parameters, status, result }) => {
      const query = parameters.query ?? "";
      const sources = status === "complete" ? parseSources(result) : [];
      const failed = String(status) === "failed";
      const phase = status === "inProgress" ? "Preparando búsqueda" : "Buscando en la web";
      return (
        <div className="search-card" data-status={status} aria-live="polite">
          <div className="search-heading"><Icon name="search" size={14} />
            {failed ? "No se pudo buscar" : status === "complete" ? "Búsqueda web completada" : phase}
          </div>
          {query && <p className="search-query">{query}</p>}
          {failed && <p className="search-query">No se pudo completar web_search. Revisa que SearXNG esté activo e inténtalo de nuevo.</p>}
          {status === "complete" && <Sources sources={sources} />}
        </div>
      );
    },
  });
  return null;
}
