import { expect, test } from "@playwright/test";

test("research workspace provides local conversations and a chat input", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("textarea").first()).toBeVisible();
  await expect(page.getByText("Búsqueda web activa", { exact: true })).toBeVisible();
  const newConversation = page.getByRole("button", { name: "Nueva conversación", exact: true });
  if (await newConversation.count() === 0) {
    await page.getByRole("button", { name: "Abrir historial", exact: true }).click();
  }
  await expect(newConversation).toBeVisible();
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await page.getByRole("button", { name: "Nueva conversación", exact: true }).click();
  await expect(page.getByRole("region", { name: "Chat de investigación" }).getByText("Nueva conversación", { exact: true })).toBeVisible();
});

test("renders an A2UI research brief from an AG-UI stream", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/api/copilotkit/**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();

    const threadId = "e2e-a2ui-thread";
    const runId = "e2e-a2ui-run";
    const messageId = "e2e-answer";
    const toolCallId = "e2e-a2ui-tool";
    const surfaceId = "e2e-research-surface";
    const report = "# Salarios en El Salvador\n\n| Grupo | Promedio |\n|---|---:|\n| Técnicos | $900 |";
    const state = {
      id: threadId,
      messages: [{ id: "e2e-user", role: "user", content: "Investiga salarios" }],
      copilotkit: { actions: [] },
      topic: "Salarios en El Salvador",
      report,
      error: "",
      steps: [
        { id: "search", label: "Buscando fuentes en la web", status: "complete" },
        { id: "synthesis", label: "Preparando el resumen", status: "complete" },
      ],
    };
    const envelope = JSON.stringify({
      a2ui_operations: [
        { version: "v0.9", createSurface: { surfaceId, catalogId: "research-catalog" } },
        { version: "v0.9", updateComponents: { surfaceId, components: [{ id: "root", component: "ResearchBrief", topic: { path: "/topic" }, summary: { path: "/summary" } }] } },
        { version: "v0.9", updateDataModel: { surfaceId, path: "/", value: { topic: "Salarios en El Salvador", summary: "Informe con tabla comparativa y fuentes verificadas." } } },
      ],
    });
    const events = [
      { type: "RUN_STARTED", threadId, runId },
      { type: "STATE_SNAPSHOT", snapshot: state },
      { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId, delta: report },
      { type: "TEXT_MESSAGE_END", messageId },
      { type: "ACTIVITY_SNAPSHOT", messageId: "e2e-a2ui-activity", activityType: "a2ui-surface", content: JSON.parse(envelope) },
      { type: "TOOL_CALL_START", toolCallId, toolCallName: "render_research_brief" },
      { type: "TOOL_CALL_ARGS", toolCallId, delta: "{\"topic\":\"Salarios en El Salvador\"}" },
      { type: "TOOL_CALL_END", toolCallId },
      { type: "TOOL_CALL_RESULT", messageId: "e2e-tool-result", toolCallId, content: envelope, role: "tool" },
      { type: "MESSAGES_SNAPSHOT", messages: [...state.messages, { id: messageId, role: "assistant", content: report }] },
      { type: "STATE_SNAPSHOT", snapshot: { ...state, messages: [...state.messages, { id: messageId, role: "assistant", content: report }] } },
      { type: "RUN_FINISHED", threadId, runId },
    ];
    const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  });

  await page.goto("/");
  await page.locator("textarea").first().fill("Investiga salarios en El Salvador");
  await page.locator('[data-testid="copilot-send-button"]').click();

  await expect(page.getByText("Investigación completada", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Salarios en El Salvador", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Informe con tabla comparativa y fuentes verificadas.", { exact: true })).toBeVisible();
  await expect(page.getByText("Unable to display ResearchBrief", { exact: false })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/a2ui-research-brief.png", fullPage: true });
});
