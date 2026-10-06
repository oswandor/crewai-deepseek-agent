import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CONVERSATIONS_KEY } from "@/lib/conversations";
import ResearchWidget from "./ResearchWidget";

vi.mock("@copilotkit/react-core/v2", async () => {
  const React = await import("react");
  return {
    CopilotKitProvider: ({ children }: { children: React.ReactNode }) => children,
    CopilotChat: ({ input: Input }: { input: React.ComponentType<{ onSubmitMessage: (message: string) => void }> }) =>
      React.createElement(Input, { onSubmitMessage: vi.fn() }),
    CopilotChatInput: ({ onSubmitMessage, addMenuButton: MenuButton }: { onSubmitMessage: (message: string) => void; addMenuButton?: React.ComponentType }) =>
      React.createElement(React.Fragment, null,
        MenuButton ? React.createElement(MenuButton) : null,
        React.createElement("button", { onClick: () => onSubmitMessage("  Investigar AG-UI y CrewAI  ") }, "Enviar consulta")),
    CopilotChatReasoningMessage: { Header: () => null },
    UseAgentUpdate: { OnStateChanged: "state-changed" },
    useAgent: () => ({ agent: { state: {} } }),
  };
});

vi.mock("./SearchToolRenderer", () => ({ SearchToolRenderer: () => null }));
vi.mock("./ResearchProgress", () => ({ ResearchProgress: () => null }));

beforeEach(() => window.localStorage.clear());

it("names a new chat from its first submitted query and saves it locally", async () => {
  render(<ResearchWidget />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar consulta" }));
  const history = screen.getByRole("navigation", { name: "Conversaciones guardadas" });
  expect(history.querySelector(".conversation-select")).toHaveTextContent("Investigar AG-UI y CrewAI");
  await waitFor(() => {
    const saved = JSON.parse(window.localStorage.getItem(CONVERSATIONS_KEY) ?? "[]");
    expect(saved[0].title).toBe("Investigar AG-UI y CrewAI");
    expect(saved[0].messages[0].content).toContain("Investigar AG-UI y CrewAI");
  });
});

it("shows the web search toggle active by default and toggles off on click", async () => {
  render(<ResearchWidget />);
  const toggle = await screen.findByRole("button", { name: /búsqueda web activa/i });
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(toggle);
  const off = screen.getByRole("button", { name: /sin búsqueda web/i });
  expect(off).toHaveAttribute("aria-pressed", "false");
  expect(window.localStorage.getItem("research-web-search-v1")).toBe("off");
});

it("restores the persisted web search preference", async () => {
  window.localStorage.setItem("research-web-search-v1", "off");
  render(<ResearchWidget />);
  const toggle = await screen.findByRole("button", { name: /sin búsqueda web/i });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
});

it("renders suggested topic chips in the empty state and records on click", async () => {
  render(<ResearchWidget />);
  const chip = await screen.findByRole("button", { name: "¿Qué es CrewAI y para qué se usa?" });
  fireEvent.click(chip);
  await waitFor(() => {
    const saved = JSON.parse(window.localStorage.getItem(CONVERSATIONS_KEY) ?? "[]");
    expect(saved[0].messages).toEqual([expect.objectContaining({ role: "user", content: "¿Qué es CrewAI y para qué se usa?" })]);
  });
});

it("renders the saved transcript instead of the welcome when reopening a conversation", async () => {
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([{
    id: "saved", threadId: "research-saved", title: "Charla previa", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z",
    messages: [
      { role: "user", content: "Pregunta previa", createdAt: "2026-10-01T10:00:00.000Z" },
      { role: "assistant", content: "Respuesta previa", createdAt: "2026-10-01T10:01:00.000Z" },
    ],
  }]));
  render(<ResearchWidget />);
  const transcript = await screen.findByLabelText("Mensajes anteriores");
  expect(transcript).toHaveTextContent("Pregunta previa");
  expect(transcript).toHaveTextContent("Respuesta previa");
  expect(screen.queryByRole("heading", { name: "¿Qué quieres investigar?" })).not.toBeInTheDocument();
});
