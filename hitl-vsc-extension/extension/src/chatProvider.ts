import * as vscode from "vscode";
import { ApiClient } from "./apiClient";
import { AgentRequestEnvelope } from "./schemas";
import { SessionState, currentLandmark } from "./sessionState";

const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 15;

export class HitlChatProvider {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly getSession: () => SessionState | null,
    private readonly clientVersion: string,
  ) {}

  async provideLanguageModelChatResponse(
    messages: vscode.LanguageModelChatMessage[],
    _options: Record<string, unknown>,
    progress: vscode.Progress<vscode.LanguageModelTextPart>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const session = this.getSession();
    if (!session) {
      throw new Error("No active session. Please authenticate first.");
    }

    if (
      (session.armId === 2 || session.armId === 3) &&
      !session.planningDocumentUri
    ) {
      throw new Error(
        "A planning document must be set before using the AI assistant. " +
          'Run "HITL: Set Planning Document" first.',
      );
    }

    let planningDocument: string | null = null;
    if (session.planningDocumentUri) {
      const bytes = await vscode.workspace.fs.readFile(
        session.planningDocumentUri,
      );
      planningDocument = Buffer.from(bytes).toString("utf-8");
    }

    const envelope: AgentRequestEnvelope = {
      student_id: session.studentId,
      session_id: session.sessionId,
      project_id: session.projectId,
      arm_id: session.armId,
      messages: extractMessages(messages),
      timestamp: new Date().toISOString(),
      workflow_landmark: currentLandmark(session),
      planning_document: planningDocument,
      client_version: this.clientVersion,
    };

    const abort = new AbortController();
    const onCancel = token.onCancellationRequested(() => abort.abort());
    let response;
    try {
      response = await this.apiClient.interact(envelope, abort.signal);
    } finally {
      onCancel.dispose();
    }
    session.interactionCount++;

    const text = response.response_content;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      if (token.isCancellationRequested) {
        break;
      }
      progress.report(new vscode.LanguageModelTextPart(text.slice(i, i + CHUNK_SIZE)));
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }
}

function extractMessages(
  messages: vscode.LanguageModelChatMessage[],
): { role: string; content: string }[] {
  return messages.map((msg) => {
    const role =
      msg.role === vscode.LanguageModelChatMessageRole.User
        ? "user"
        : msg.role === vscode.LanguageModelChatMessageRole.Assistant
          ? "assistant"
          : "system";
    let content = "";
    for (const part of msg.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        content += part.value;
      }
    }
    return { role, content };
  });
}
