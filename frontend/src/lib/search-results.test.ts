import { describe, expect, it } from "vitest";
import { parseSources } from "./search-results";

describe("parseSources", () => {
  it("extracts safe source links from MCP result content", () => {
    expect(parseSources({ content: [{ text: JSON.stringify([{ title: "CrewAI", url: "https://crewai.com/docs" }]) }] }))
      .toEqual([{ title: "CrewAI", url: "https://crewai.com/docs" }]);
  });

  it("drops non-http URLs and limits the displayed source count", () => {
    const results = Array.from({ length: 7 }, (_, i) => ({ title: `Source ${i}`, url: `https://example.com/${i}` }));
    results.push({ title: "unsafe", url: "javascript:alert(1)" });
    expect(parseSources(results)).toHaveLength(5);
    expect(parseSources(results).every((source) => source.url.startsWith("https://"))).toBe(true);
  });

  it("handles empty and malformed results", () => {
    expect(parseSources(undefined)).toEqual([]);
    expect(parseSources({ content: [{ text: "not json" }] })).toEqual([]);
  });
});
