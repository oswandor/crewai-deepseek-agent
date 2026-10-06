"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CopilotChat, CopilotChatInput, CopilotChatReasoningMessage, CopilotKitProvider, useAgent, UseAgentUpdate, type CopilotChatInputProps } from "@copilotkit/react-core/v2";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SearchToolRenderer } from "./SearchToolRenderer";
import { ResearchProgress } from "./ResearchProgress";
import { Icon } from "./Icon";
import { researchCatalog } from "@/a2ui/research-catalog";
import { ConversationSnapshot, LocalConversation, loadConversations, makeConversation, saveConversations, titleFromMessage } from "@/lib/conversations";

const WEB_SEARCH_KEY = "research-web-search-v1";
const SUGGESTED_TOPICS = [
  "Tendencias de IA generativa",
  "¿Qué es CrewAI y para qué se usa?",
  "PostgreSQL vs MySQL",
  "Novedades de Python 3.13",
];

type WebSearchToggle = { enabled: boolean; toggle: () => void };
const WebSearchContext = createContext<WebSearchToggle>({ enabled: true, toggle: () => {} });

const SubmitContext = createContext<(message: string) => void>(() => {});
// Referencia estable al manejador de envío que CopilotChat inyecta en el input;
// permite enviar mensajes desde fuera del input (chips de temas sugeridos).
const ChatSubmitRefContext = createContext<{ current: (message: string) => void }>({ current: () => {} });

function SearchMode() {
  const { enabled, toggle } = useContext(WebSearchContext);
  return <button type="button" className="search-mode" aria-pressed={enabled}
    title={enabled ? "El agente buscará en la web. Clic para responder solo con el modelo." : "El agente responderá solo con su conocimiento. Clic para activar la búsqueda web."}
    onClick={toggle}>
    <Icon name={enabled ? "globe" : "globeOff"} size={15} />
    {enabled ? "Búsqueda web activa" : "Sin búsqueda web"}
  </button>;
}

const ResearchInput = Object.assign(function ResearchInput(props: CopilotChatInputProps) {
  const recordMessage = useContext(SubmitContext);
  const chatSubmitRef = useContext(ChatSubmitRefContext);
  chatSubmitRef.current = props.onSubmitMessage ?? (() => {});
  return <CopilotChatInput
    {...props}
    addMenuButton={SearchMode}
    textArea={{ "aria-label": "Mensaje de investigación" }}
    sendButton={{ "aria-label": "Enviar mensaje" }}
    onSubmitMessage={(message) => {
      recordMessage(message);
      props.onSubmitMessage?.(message);
    }}
  />;
}, CopilotChatInput);

function ReasoningHeader(props: React.ComponentProps<typeof CopilotChatReasoningMessage.Header>) {
  const label = props.isStreaming ? "Pensando…" : props.label?.replace(/^Thought for /, "Pensó durante ").replace(" seconds", " segundos").replace(" second", " segundo").replace(" minutes", " minutos").replace(" minute", " minuto");
  return <CopilotChatReasoningMessage.Header {...props} label={label} />;
}

/** Guarda el informe final del asistente en la conversación local. */
function AssistantReportRecorder({ threadId, onReport }: { threadId: string; onReport: (report: string) => void }) {
  const { agent } = useAgent({ agentId: "research", updates: [UseAgentUpdate.OnStateChanged] });
  const lastSaved = useRef("");
  const report = typeof agent?.state?.report === "string" ? agent.state.report.trim() : "";
  const agentThreadId = (agent as { threadId?: string } | undefined)?.threadId;
  useEffect(() => {
    if (!report || report === lastSaved.current) return;
    // El estado del agente puede conservar el reporte de otro hilo justo
    // después de cambiar de conversación; solo persiste el del hilo activo.
    if (agentThreadId !== threadId) return;
    lastSaved.current = report;
    onReport(report);
  }, [report, agentThreadId, threadId, onReport]);
  return null;
}

function TranscriptView({ messages }: { messages: ConversationSnapshot[] }) {
  return <div className="conversation-transcript" aria-label="Mensajes anteriores">
    {messages.map((message, index) => message.role === "user"
      ? <div key={index} className="transcript-bubble is-user">{message.content}</div>
      : <div key={index} className="transcript-bubble is-assistant"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
    )}
  </div>;
}

const formatActivity = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(date));

export default function ResearchWidget() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("");
  const [agentError, setAgentError] = useState(""); const [conversations, setConversations] = useState<LocalConversation[]>([]); const [activeId, setActiveId] = useState(""); const [sidebarOpen, setSidebarOpen] = useState(false); const initialized = useRef(false);
  const [webSearch, setWebSearch] = useState(true);
  useEffect(() => { const saved = loadConversations(); const first = saved[0] ?? makeConversation(); setConversations(saved.length ? saved : [first]); setActiveId(first.id); try { setWebSearch(window.localStorage.getItem(WEB_SEARCH_KEY) !== "off"); } catch { /* localStorage no disponible */ } initialized.current = true; }, []);
  useEffect(() => { if (initialized.current && conversations.length) saveConversations(conversations); }, [conversations]);
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const updateActive = useCallback((fn: (item: LocalConversation) => LocalConversation) => setConversations((items) => items.map((item) => item.id === activeId ? fn(item) : item)), [activeId]);
  const createConversation = () => { const item = makeConversation(); setConversations((items) => [item, ...items]); setActiveId(item.id); setAgentError(""); setSidebarOpen(false); };
  const chooseConversation = (id: string) => { setActiveId(id); setAgentError(""); setSidebarOpen(false); };
  const rename = (item: LocalConversation) => { const title = window.prompt("Nombre de la conversación", item.title)?.trim(); if (title) setConversations((items) => items.map((current) => current.id === item.id ? { ...current, title, updatedAt: new Date().toISOString() } : current)); };
  const remove = (item: LocalConversation) => { if (!window.confirm(`¿Eliminar “${item.title}”?`)) return; setConversations((items) => { const remaining = items.filter((current) => current.id !== item.id); if (remaining.length) { if (activeId === item.id) setActiveId(remaining[0].id); return remaining; } const replacement = makeConversation(); setActiveId(replacement.id); return [replacement]; }); };
  const recordSubmission = useCallback((content: string) => { const now = new Date().toISOString(); updateActive((item) => ({ ...item, title: item.messages.some((message) => message.role === "user") ? item.title : titleFromMessage(content), updatedAt: now, messages: [...item.messages, { role: "user", content, createdAt: now }] })); }, [updateActive]);
  const recordReport = useCallback((report: string) => { const now = new Date().toISOString(); updateActive((item) => item.messages.some((message) => message.role === "assistant" && message.content === report) ? item : { ...item, updatedAt: now, messages: [...item.messages, { role: "assistant", content: report, createdAt: now }] }); }, [updateActive]);

  const chatSubmitRef = useRef((message: string) => {});
  const sendTopic = (topic: string) => { recordSubmission(topic); chatSubmitRef.current(topic); };
  // Persiste solo al interactuar: un efecto sobre webSearch correría en el
  // mismo flush que la carga inicial y sobrescribiría la preferencia guardada.
  const webSearchToggle = useCallback(() => setWebSearch((value) => {
    const next = !value;
    try { window.localStorage.setItem(WEB_SEARCH_KEY, next ? "on" : "off"); } catch { /* localStorage no disponible */ }
    return next;
  }), []);

  const visibleConversations = conversations
    .filter((item) => item.title.toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es")))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return <CopilotKitProvider runtimeUrl="/api/copilotkit" agentId="research" a2ui={{ catalog: researchCatalog }} enableInspector={false} properties={{ useWebSearch: webSearch }}>
    <WebSearchContext.Provider value={{ enabled: webSearch, toggle: webSearchToggle }}>
    <ChatSubmitRefContext.Provider value={chatSubmitRef}>
    <div className={`workspace dark ${collapsed ? "is-collapsed" : ""}`}>
      <aside id="conversation-sidebar" className={`conversation-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Historial de conversaciones">
        <div className="sidebar-heading">
          <div className="brand"><span className="brand-mark"><Icon name="brand" size={23} /></span><span>Cuaderno</span></div>
          <button className="icon-button" type="button" aria-label="Ocultar historial" title="Ocultar historial" onClick={() => { setCollapsed(true); setSidebarOpen(false); }}><Icon name="panel" /></button>
        </div>
        <button className="new-chat" type="button" onClick={createConversation}><Icon name="plus" size={18} /><span>Nueva conversación</span></button>
        <label className="history-search"><Icon name="search" size={17} /><input aria-label="Buscar conversaciones" placeholder="Buscar conversaciones" value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
        <div className="history-heading"><p>Historial</p><span>{conversations.length}</span></div>
        <nav className="conversation-list" aria-label="Conversaciones guardadas">
          {visibleConversations.length === 0 && <p className="history-empty">No hay conversaciones con ese nombre.</p>}
          {visibleConversations.map((item) => <div className={`conversation-row ${item.id === activeId ? "is-active" : ""}`} key={item.id}>
            <button className="conversation-select" type="button" onClick={() => chooseConversation(item.id)} aria-current={item.id === activeId ? "page" : undefined} title={item.title}>
              <Icon name="message" size={16} /><span>{item.title}</span><small>{formatActivity(item.updatedAt)}</small>
            </button>
            <div className="conversation-actions">
              <button type="button" aria-label={`Renombrar ${item.title}`} title="Renombrar" onClick={() => rename(item)}><Icon name="edit" size={15} /></button>
              <button type="button" aria-label={`Eliminar ${item.title}`} title="Eliminar" onClick={() => remove(item)}><Icon name="trash" size={15} /></button>
            </div>
          </div>)}
        </nav>
        <div className="local-profile"><span className="avatar"><Icon name="sparkles" size={17} /></span><div>Mi espacio<small>Solo en este navegador</small></div></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Cerrar historial" onClick={() => setSidebarOpen(false)} />}
      <section className="chat-panel" aria-label="Chat de investigación">
        <header className="chat-header">
          <button className="sidebar-toggle icon-button" type="button" aria-label="Abrir historial" title="Abrir historial" aria-controls="conversation-sidebar" aria-expanded={sidebarOpen || !collapsed} onClick={() => { setCollapsed(false); setSidebarOpen(true); }}><Icon name="panel" /></button>
          <div className="header-title"><span>ESPACIO DE INVESTIGACIÓN</span><p>{active?.title ?? "Nueva conversación"}</p></div>
          <button className="header-new" type="button" onClick={createConversation}><Icon name="plus" size={16} /><span>Nueva</span></button>
        </header>
        {active && <div className="copilot-area" key={active.threadId}>
          <ChatArea conversation={active} agentError={agentError} onAgentError={() => setAgentError("No se pudo completar la solicitud. Verifica que el backend, SearXNG y OPENROUTER_API_KEY estén configurados e inténtalo de nuevo.")} recordSubmission={recordSubmission} recordReport={recordReport} sendTopic={sendTopic} />
        </div>}
      </section>
    </div>
    </ChatSubmitRefContext.Provider>
    </WebSearchContext.Provider>
  </CopilotKitProvider>;
}

function ChatArea({ conversation, agentError, onAgentError, recordSubmission, recordReport, sendTopic }: {
  conversation: LocalConversation;
  agentError: string;
  onAgentError: () => void;
  recordSubmission: (message: string) => void;
  recordReport: (report: string) => void;
  sendTopic: (topic: string) => void;
}) {
  // Se congela una sola vez por montaje (la clave threadId de .copilot-area
  // remonta este componente): la transcripción muestra solo lo guardado antes
  // de esta sesión; el chat vivo renderiza los mensajes nuevos.
  const [frozenMessages] = useState(() => conversation.messages);
  const hasHistory = frozenMessages.length > 0;
  return <>
    <SearchToolRenderer />
    <ResearchProgress />
    <AssistantReportRecorder threadId={conversation.threadId} onReport={recordReport} />
    {hasHistory && <TranscriptView messages={frozenMessages} />}
    {!hasHistory && <div className="empty-state"><span className="empty-icon"><Icon name="sparkles" size={24} /></span><h1>¿Qué quieres investigar?</h1><p>Pregunta sobre un tema y explora respuestas con fuentes.</p>
      <div className="empty-chips">
        {SUGGESTED_TOPICS.map((topic) => <button key={topic} type="button" className="empty-chip" onClick={() => sendTopic(topic)}>{topic}</button>)}
      </div>
    </div>}
    {agentError && <div role="alert" className="agent-error">{agentError}</div>}
    <SubmitContext.Provider value={recordSubmission}>
      <CopilotChat input={ResearchInput} messageView={{ reasoningMessage: { header: ReasoningHeader } }} agentId="research" threadId={conversation.threadId} labels={{ welcomeMessageText: hasHistory ? "" : "¿Qué quieres descubrir hoy?", chatInputPlaceholder: "Pregunta, explora, encuentra respuestas...", chatDisclaimerText: "La IA puede cometer errores. Comprueba la información y sus fuentes." }} onError={onAgentError} />
    </SubmitContext.Provider>
  </>;
}
