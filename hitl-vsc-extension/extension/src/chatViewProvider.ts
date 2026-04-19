import * as vscode from "vscode";
import { ApiClient } from "./apiClient";
import { sanitizeContent } from "./sanitize";
import { AgentRequestEnvelope } from "./schemas";
import { SessionLog } from "./sessionLog";
import { SessionState, currentLandmark } from "./sessionState";

const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 15;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hitl.chatView";

  private webviewView?: vscode.WebviewView;
  private conversationHistory: ChatMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiClient: ApiClient,
    private readonly getSession: () => SessionState | null,
    private readonly clientVersion: string,
    private readonly sessionLog: SessionLog,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "sendMessage") {
        await this.handleUserMessage(msg.text);
      } else if (msg.type === "clearChat") {
        this.conversationHistory = [];
      }
    });

    // Send initial session status
    const session = this.getSession();
    if (session) {
      this.postMessage({
        type: "sessionStatus",
        armId: session.armId,
        landmark: currentLandmark(session),
        hasPlanningDoc: session.planningDocumentUri !== null,
      });
    }
  }

  /** Notify the webview when the planning document changes. */
  updateSessionStatus(): void {
    const session = this.getSession();
    if (session && this.webviewView) {
      this.postMessage({
        type: "sessionStatus",
        armId: session.armId,
        landmark: currentLandmark(session),
        hasPlanningDoc: session.planningDocumentUri !== null,
      });
    }
  }

  private async handleUserMessage(text: string): Promise<void> {
    const session = this.getSession();
    if (!session) {
      this.postMessage({ type: "error", text: "No active session. Please authenticate first." });
      return;
    }

    if (!session.sessionStarted) {
      this.postMessage({ type: "addMessage", role: "user", content: text });
      const answer = text.trim().toUpperCase();
      if (answer === "Y" || answer === "YES") {
        session.sessionStarted = true;
        this.postMessage({
          type: "addMessage",
          role: "assistant",
          content: "Session started. You may now ask coding questions.",
        });
      } else if (answer === "N" || answer === "NO") {
        this.postMessage({
          type: "error",
          text: "Session declined. Reload the window to try again.",
        });
      } else {
        this.postMessage({
          type: "error",
          text: "Please respond with Y or N to acknowledge the research disclaimer.",
        });
      }
      return;
    }

    if (
      (session.armId === 2 || session.armId === 3) &&
      !session.planningDocumentUri
    ) {
      this.postMessage({
        type: "error",
        text: 'A planning document must be set before using the AI assistant. Run "HITL: Set Planning Document" first.',
      });
      const action = await vscode.window.showWarningMessage(
        "HITL: A planning document is required before sending messages (Arms 2/3).",
        "Set Planning Document",
      );
      if (action === "Set Planning Document") {
        await vscode.commands.executeCommand("hitl.setPlanningDocument");
      }
      return;
    }

    // Add user message and show in UI
    this.conversationHistory.push({ role: "user", content: text });
    this.postMessage({ type: "addMessage", role: "user", content: text });
    this.postMessage({ type: "setLoading", loading: true });

    try {
      let planningDocument: string | null = null;
      if (session.planningDocumentUri) {
        const bytes = await vscode.workspace.fs.readFile(session.planningDocumentUri);
        planningDocument = Buffer.from(bytes).toString("utf-8");
      }

      const envelope: AgentRequestEnvelope = {
        student_id: session.studentId,
        session_id: session.sessionId,
        project_id: session.projectId,
        arm_id: session.armId,
        messages: this.conversationHistory.map((m) => ({
          role: m.role,
          content: sanitizeContent(m.content),
        })),
        timestamp: new Date().toISOString(),
        workflow_landmark: currentLandmark(session),
        planning_document: planningDocument ? sanitizeContent(planningDocument) : null,
        client_version: this.clientVersion,
      };

      const response = await this.apiClient.interact(envelope);
      session.interactionCount++;

      await this.sessionLog.logInteractionOk(
        session.sessionId,
        session.projectId,
        session.armId,
        session.interactionCount,
      );

      const assistantContent = response.response_content;
      this.conversationHistory.push({ role: "assistant", content: assistantContent });

      // Stream response progressively (Section 3.8 / 6.3)
      this.postMessage({ type: "streamStart" });
      for (let i = 0; i < assistantContent.length; i += CHUNK_SIZE) {
        this.postMessage({
          type: "streamChunk",
          text: assistantContent.slice(i, i + CHUNK_SIZE),
        });
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      }
      this.postMessage({ type: "streamEnd" });
      this.postMessage({ type: "setLoading", loading: false });

      // Update landmark display after interaction
      this.updateSessionStatus();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.sessionLog.logInteractionError(
        session.sessionId,
        session.projectId,
        session.armId,
        session.interactionCount,
        errMsg,
      );
      this.postMessage({ type: "setLoading", loading: false });
      this.postMessage({
        type: "error",
        text: `Request failed: ${errMsg}`,
      });
    }
  }

  private postMessage(msg: unknown): void {
    this.webviewView?.webview.postMessage(msg);
  }

  private getHtml(): string {
    const session = this.getSession();
    const emptyStateHtml = session?.sessionStarted
      ? "HITL AI Lab Assistant<br>Type a message below to continue."
      : "Do you want to begin a coding session (Y/N)?<br>Please post your project artifact.<br><br><em>Note: All interactions are logged for the AIML research study, and AI outputs may be unreliable.</em>";
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* Status bar */
  .status-bar {
    padding: 6px 10px;
    background: var(--vscode-sideBarSectionHeader-background);
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .status-bar .badge {
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-weight: 600;
  }

  /* Messages area */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .message {
    padding: 8px 12px;
    border-radius: 8px;
    max-width: 90%;
    word-wrap: break-word;
    white-space: pre-wrap;
    line-height: 1.45;
  }
  .message.user {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    align-self: flex-end;
    border-bottom-right-radius: 2px;
  }
  .message.assistant {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border, transparent));
    align-self: flex-start;
    border-bottom-left-radius: 2px;
  }
  .message.error {
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    align-self: center;
    font-size: 12px;
  }

  /* Loading indicator */
  .loading {
    align-self: flex-start;
    padding: 8px 12px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    display: none;
  }
  .loading.visible { display: block; }
  .loading::after {
    content: '';
    animation: dots 1.4s steps(4, end) infinite;
  }
  @keyframes dots {
    0%  { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    padding: 20px;
    line-height: 1.6;
  }

  /* Input area */
  .input-area {
    padding: 8px 10px;
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, transparent));
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }
  .input-area textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    padding: 6px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: inherit;
    min-height: 32px;
    max-height: 120px;
    outline: none;
  }
  .input-area textarea:focus {
    border-color: var(--vscode-focusBorder);
  }
  .input-area button {
    padding: 6px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: inherit;
    white-space: nowrap;
  }
  .input-area button:hover {
    background: var(--vscode-button-hoverBackground);
  }
  .input-area button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
</head>
<body>

<div class="status-bar" id="statusBar">
  <span>Arm: <span class="badge" id="armBadge">—</span></span>
  <span>Landmark: <span id="landmarkText">—</span></span>
  <span>Plan: <span id="planStatus">not set</span></span>
</div>

<div class="messages" id="messages">
  <div class="empty-state" id="emptyState">
    ${emptyStateHtml}
  </div>
</div>
<div class="loading" id="loading">Thinking</div>

<div class="input-area">
  <textarea id="input" rows="1" placeholder="Ask a question…"></textarea>
  <button id="sendBtn">Send</button>
</div>

<script>
  const vscode = acquireVsCodeApi();
  const messagesEl = document.getElementById('messages');
  const emptyState = document.getElementById('emptyState');
  const loadingEl = document.getElementById('loading');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');

  let messageCount = 0;
  let streamingDiv = null;

  function addMessage(role, content) {
    if (emptyState) emptyState.remove();
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    messageCount++;
  }

  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    vscode.postMessage({ type: 'sendMessage', text });
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'addMessage':
        addMessage(msg.role, msg.content);
        break;
      case 'streamStart':
        if (emptyState) emptyState.remove();
        streamingDiv = document.createElement('div');
        streamingDiv.className = 'message assistant';
        messagesEl.appendChild(streamingDiv);
        break;
      case 'streamChunk':
        if (streamingDiv) {
          streamingDiv.textContent += msg.text;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        break;
      case 'streamEnd':
        streamingDiv = null;
        messageCount++;
        break;
      case 'error':
        if (emptyState) emptyState.remove();
        const errDiv = document.createElement('div');
        errDiv.className = 'message error';
        errDiv.textContent = msg.text;
        messagesEl.appendChild(errDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        break;
      case 'setLoading':
        loadingEl.classList.toggle('visible', msg.loading);
        sendBtn.disabled = msg.loading;
        inputEl.disabled = msg.loading;
        if (!msg.loading) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        break;
      case 'sessionStatus':
        document.getElementById('armBadge').textContent = msg.armId;
        document.getElementById('landmarkText').textContent = msg.landmark || 'none';
        document.getElementById('planStatus').textContent = msg.hasPlanningDoc ? 'set ✓' : 'not set';
        break;
    }
  });

  // Focus input on load
  inputEl.focus();
</script>
</body>
</html>`;
  }
}
