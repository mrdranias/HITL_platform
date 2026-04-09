import * as vscode from "vscode";
import { ApiClient } from "./apiClient";
import { HitlChatProvider } from "./chatProvider";
import { SessionState } from "./sessionState";

const SECRET_KEY = "hitl.studentToken";
const SERVER_URL = "http://localhost:8000";

let sessionState: SessionState | null = null;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const secrets = context.secrets;
  const version: string =
    (context.extension.packageJSON as { version?: string }).version ?? "0.0.0";
  const apiClient = new ApiClient(SERVER_URL);

  // --- Authentication (Section 6.1) ---
  let token = await secrets.get(SECRET_KEY);
  if (!token) {
    token = await vscode.window.showInputBox({
      prompt: "Enter your HITL student token",
      ignoreFocusOut: true,
      password: true,
    });
    if (!token) {
      vscode.window.showErrorMessage(
        "HITL: A student token is required to use this extension.",
      );
      return;
    }
  }

  try {
    const auth = await apiClient.register(token);
    await secrets.store(SECRET_KEY, token);

    sessionState = {
      studentId: token,
      sessionId: auth.session_id,
      projectId: auth.project_id,
      armId: auth.arm_id,
      landmarks: auth.lab_config.landmarks,
      interactionCount: 0,
      planningDocumentUri: null,
    };
  } catch (err) {
    vscode.window.showErrorMessage(
      `HITL: Authentication failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  // --- Command: hitl.setPlanningDocument (Section 3.6) ---
  context.subscriptions.push(
    vscode.commands.registerCommand("hitl.setPlanningDocument", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          "HITL: Open a planning document first, then run this command.",
        );
        return;
      }
      if (sessionState) {
        sessionState.planningDocumentUri = editor.document.uri;
        vscode.window.showInformationMessage(
          `HITL: Planning document set to ${vscode.workspace.asRelativePath(editor.document.uri)}`,
        );
      }
    }),
  );

  // --- Chat Model Provider (Section 3.1) ---
  const provider = new HitlChatProvider(
    apiClient,
    () => sessionState,
    version,
  );

  context.subscriptions.push(
    (vscode.lm as any).registerChatModelProvider(
      "hitl-routing",
      provider,
      {
        name: "HITL Routing",
        vendor: "hitl-lab",
        family: "hitl",
        version,
        isDefault: false,
      },
    ),
  );
}

export function deactivate(): void {
  sessionState = null;
}
