"use client";

import { useAgent, UseAgentUpdate } from "@copilotkit/react-core/v2";
import { Icon } from "./Icon";

type Step = { id: string; label: string; status: "pending" | "active" | "complete" | "error" };

export function ResearchProgress() {
  const { agent } = useAgent({ agentId: "research", updates: [UseAgentUpdate.OnStateChanged] });
  const steps = ((agent?.state?.steps ?? []) as Step[]).filter((step) => step.status !== "pending");
  if (!steps.length) return null;
  return <aside className="research-progress" aria-live="polite" aria-label="Progreso de investigación">
    {steps.map((step) => <div key={step.id} className={`research-progress__step is-${step.status}`}>
      <Icon name={step.status === "complete" ? "check" : step.status === "error" ? "alert" : "search"} size={15} /><span>{step.label}</span>
    </div>)}
  </aside>;
}
