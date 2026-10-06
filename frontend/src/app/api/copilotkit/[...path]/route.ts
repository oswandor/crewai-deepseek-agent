import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { CrewAIAgent } from "@ag-ui/crewai";

const agentUrl = process.env.AGENT_URL ?? "http://127.0.0.1:8000/research/";
const runtime = new CopilotRuntime({
  agents: {
    research: new CrewAIAgent({ url: agentUrl }),
  },
  a2ui: {
    enabled: true,
    agents: ["research"],
  },
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });

export const GET = handler;
export const POST = handler;
