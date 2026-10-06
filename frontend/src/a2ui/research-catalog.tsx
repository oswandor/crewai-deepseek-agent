"use client";

import { DynamicStringSchema, createCatalog, type CatalogDefinitions } from "@copilotkit/a2ui-renderer";
import { z } from "zod3";
import { Icon } from "@/components/Icon";

const definitions = {
  ResearchBrief: {
    description: "Resumen compacto de una investigación web terminada.",
    // Los props llegan como bindings A2UI ({ path: "/topic" }) y el renderer
    // los resuelve contra updateDataModel antes de entregarlos al componente.
    props: z.object({ topic: DynamicStringSchema, summary: DynamicStringSchema }),
  },
} satisfies CatalogDefinitions;

export const researchCatalog = createCatalog(definitions, {
  ResearchBrief: ({ props }) => {
    // El adaptador resuelve DynamicString contra el data model antes de pintar.
    const { topic, summary } = props as { topic: string; summary: string };
    return <section className="a2ui-research-brief" aria-label={`Resumen de ${topic}`}>
      <span className="a2ui-research-brief__icon"><Icon name="sparkles" size={15} /></span>
      <div><p>Investigación completada</p><strong>{topic}</strong><span>{summary}</span></div>
    </section>
  },
}, { catalogId: "research-catalog" });
