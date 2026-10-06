import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useRenderTool } from "@copilotkit/react-core/v2";
import { SearchToolRenderer } from "./SearchToolRenderer";

vi.mock("@copilotkit/react-core/v2", () => ({ useRenderTool: vi.fn() }));

type RenderInput = { name: string; parameters: unknown; status: string; result: unknown };
let registeredRenderer: ((input: RenderInput) => ReactNode) | undefined;

describe("SearchToolRenderer", () => {
  beforeEach(() => {
    registeredRenderer = undefined;
    vi.mocked(useRenderTool).mockClear();
    vi.mocked(useRenderTool).mockImplementation((options) => {
      if (options) registeredRenderer = options.render as unknown as (input: RenderInput) => ReactNode;
    });
  });

  function display(input: RenderInput) {
    vi.mocked(useRenderTool).mockClear();
    render(<SearchToolRenderer />);
    expect(vi.mocked(useRenderTool)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(useRenderTool).mock.calls.map(([config]) => config?.name)).toEqual(["web_search", "mcp_web_search"]);
    expect(registeredRenderer).toBeDefined();
    return render(registeredRenderer!(input));
  }

  it("shows the search query while the tool is running", () => {
    display({ name: "mcp_web_search", parameters: { query: "CrewAI AG-UI" }, status: "executing", result: null });
    expect(screen.getByText("Buscando en la web")).toBeInTheDocument();
    expect(screen.getByText("CrewAI AG-UI")).toBeInTheDocument();
  });

  it("shows validated source links after completion", () => {
    display({
      name: "mcp_web_search",
      parameters: { query: "CrewAI" },
      status: "complete",
      result: { results: [{ title: "CrewAI docs", url: "https://docs.crewai.com/" }] },
    });
    fireEvent.click(screen.getByRole("button", { name: "1 fuente" }));
    expect(screen.getByRole("link", { name: /CrewAI docs/ })).toHaveAttribute("href", "https://docs.crewai.com/");
  });

  it("shows empty-result and failure states", () => {
    display({ name: "mcp_web_search", parameters: {}, status: "complete", result: [] });
    expect(screen.getByText("La búsqueda terminó sin fuentes con URL válida.")).toBeInTheDocument();

    display({ name: "mcp_web_search", parameters: {}, status: "failed", result: null });
    expect(screen.getByText("No se pudo buscar")).toBeInTheDocument();
  });
});
