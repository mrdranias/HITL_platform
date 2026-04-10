import * as vscode from "vscode";
import { ApiClient } from "./apiClient";
import { HitlChatProvider } from "./chatProvider";
import { ChatViewProvider } from "./chatViewProvider";
import { SessionLog } from "./sessionLog";
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
  const sessionLog = new SessionLog(context.globalStorageUri);

  // --- IRB Disclosure (Section 9) ---
  const IRB_KEY = "hitl.irbDisclosureAccepted";
  if (!context.globalState.get<boolean>(IRB_KEY)) {
    const consent = await vscode.window.showWarningMessage(
      "HITL AI Lab: This extension logs your AI interactions (prompts and responses) " +
        "to a research server for study purposes. No personally identifying information " +
        "is collected — only an opaque student token. By proceeding, you acknowledge " +
        "this data collection as described in the study consent form.",
      { modal: true },
      "I Understand",
    );
    if (consent !== "I Understand") {
      vscode.window.showErrorMessage("HITL: Disclosure must be accepted to use this extension.");
      return;
    }
    await context.globalState.update(IRB_KEY, true);
  }

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
    const auth = await apiClient.register(token, version);
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

    await sessionLog.logSessionStart(
      sessionState.sessionId,
      sessionState.projectId,
      sessionState.armId,
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `HITL: Authentication failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  // --- Command: hitl.resetToken ---
  context.subscriptions.push(
    vscode.commands.registerCommand("hitl.resetToken", async () => {
      await secrets.delete(SECRET_KEY);
      sessionState = null;
      vscode.window.showInformationMessage(
        "HITL: Token cleared. Reload the window to re-authenticate.",
        "Reload",
      ).then((action) => {
        if (action === "Reload") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
    }),
  );

  // --- Webview Chat Panel (Section 3.9) ---
  const chatViewProvider = new ChatViewProvider(
    context.extensionUri,
    apiClient,
    () => sessionState,
    version,
    sessionLog,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider),
  );

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
        chatViewProvider.updateSessionStatus();
      }
    }),
  );

  // --- Chat Model Provider (Section 3.1) ---
  const modelInfo: vscode.LanguageModelChatInformation = {
    id: "hitl-routing",
    name: "HITL Routing",
    family: "hitl",
    version,
    maxInputTokens: 4096,
    maxOutputTokens: 4096,
    capabilities: {},
  };

  const provider = new HitlChatProvider(
    apiClient,
    () => sessionState,
    modelInfo,
  );

  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider("hitl-lab", provider),
  );

  // --- Test command: send a quick message through the model ---
  context.subscriptions.push(
    vscode.commands.registerCommand("hitl.testChat", async () => {
      try {
        const models = await vscode.lm.selectChatModels({ vendor: "hitl-lab" });
        if (models.length === 0) {
          vscode.window.showErrorMessage("HITL: No HITL model found.");
          return;
        }
        const model = models[0];
        vscode.window.showInformationMessage(`HITL: Found model "${model.name}". Sending test message...`);
        const messages = [
          vscode.LanguageModelChatMessage.User("Hello, this is a test."),
        ];
        const response = await model.sendRequest(messages);
        let text = "";
        for await (const part of response.text) {
          text += part;
        }
        vscode.window.showInformationMessage(`HITL response: ${text.slice(0, 200)}`);
      } catch (err) {
        vscode.window.showErrorMessage(
          `HITL test failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );
}

export function deactivate(): void {
  sessionState = null;
}
