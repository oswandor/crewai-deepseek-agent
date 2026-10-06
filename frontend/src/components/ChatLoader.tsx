"use client";

import dynamic from "next/dynamic";

const ResearchWidget = dynamic(() => import("./ResearchWidget"), {
  ssr: false,
  loading: () => <div className="chat-loading" role="status">Cargando el chat…</div>,
});

export function ChatLoader() {
  return <ResearchWidget />;
}
