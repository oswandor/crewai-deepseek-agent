export type ConversationSnapshot = { role: "user" | "assistant"; content: string; createdAt: string };
export type LocalConversation = { id: string; threadId: string; title: string; createdAt: string; updatedAt: string; messages: ConversationSnapshot[] };
export const CONVERSATIONS_KEY = "research-conversations-v1";
export function makeConversation(): LocalConversation { const now = new Date().toISOString(); const id = crypto.randomUUID(); return { id, threadId: `research-${id}`, title: "Nueva conversación", createdAt: now, updatedAt: now, messages: [] }; }
export function loadConversations(): LocalConversation[] { try { const value: unknown = JSON.parse(window.localStorage.getItem(CONVERSATIONS_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((item): item is LocalConversation => !!item && typeof item === "object" && typeof item.id === "string" && typeof item.threadId === "string" && typeof item.title === "string" && Array.isArray(item.messages)).map((item) => ({...item, title: item.title === "Nueva conversación" ? titleFromMessage(item.messages.find((message) => message.role === "user")?.content ?? "") : item.title})).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : []; } catch { return []; } }
export function saveConversations(conversations: LocalConversation[]) { window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations)); }
export function titleFromMessage(message: string) {
  const firstLine = message.trim().split(/\r?\n/).find((line) => line.trim()) ?? "";
  const title = firstLine.replace(/\s+/g, " ").trim();
  return title.length > 46 ? `${title.slice(0, 46).trimEnd()}…` : title || "Nueva conversación";
}
