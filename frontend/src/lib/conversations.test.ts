import { beforeEach, describe, expect, it } from "vitest";
import { CONVERSATIONS_KEY, loadConversations, makeConversation, saveConversations, titleFromMessage } from "./conversations";

describe("local conversations", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses the first line of the first query as a compact title", () => {
    expect(titleFromMessage("  Investigar CrewAI y AG-UI   \ncon ejemplos ")).toBe("Investigar CrewAI y AG-UI");
    expect(titleFromMessage("a".repeat(60))).toBe(`${"a".repeat(46)}…`);
    expect(titleFromMessage("   ")).toBe("Nueva conversación");
  });

  it("restores saved conversations sorted by activity", () => {
    const older = makeConversation();
    older.updatedAt = "2025-01-01T00:00:00.000Z";
    const newer = makeConversation();
    newer.updatedAt = "2025-01-02T00:00:00.000Z";
    saveConversations([older, newer]);
    expect(loadConversations().map(({ id }) => id)).toEqual([newer.id, older.id]);
  });

  it("repairs an old default title when the first user message exists", () => {
    const conversation = makeConversation();
    conversation.messages = [{ role: "user", content: "buscar fuentes sobre CopilotKit", createdAt: conversation.createdAt }];
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([conversation]));
    expect(loadConversations()[0].title).toBe("buscar fuentes sobre CopilotKit");
  });
});
