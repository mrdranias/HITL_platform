"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const crypto_1 = require("crypto");
const apiClient_1 = require("./apiClient");
const chatProvider_1 = require("./chatProvider");
const chatViewProvider_1 = require("./chatViewProvider");
const sessionLog_1 = require("./sessionLog");
const SECRET_KEY = "hitl.studentToken";
let sessionState = null;
async function activate(context) {
    const secrets = context.secrets;
    const version = context.extension.packageJSON.version ?? "0.0.0";
    const serverUrl = vscode.workspace
        .getConfiguration("hitlRouting")
        .get("serverUrl", "http://localhost:8000");
    const apiClient = new apiClient_1.ApiClient(serverUrl);
    const sessionLog = new sessionLog_1.SessionLog(context.globalStorageUri);
    // --- IRB Disclosure (Section 9) ---
    const IRB_KEY = "hitl.irbDisclosureAccepted";
    if (!context.globalState.get(IRB_KEY)) {
        const consent = await vscode.window.showWarningMessage("HITL AI Lab: This extension logs your AI interactions (prompts and responses) " +
            "to a research server for study purposes. No personally identifying information " +
            "is collected — only an opaque student token. By proceeding, you acknowledge " +
            "this data collection as described in the study consent form.", { modal: true }, "I Understand");
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
            vscode.window.showErrorMessage("HITL: A student token is required to use this extension.");
            return;
        }
    }
    // --- Command: hitl.resetToken (registered early so it works even if auth fails) ---
    context.subscriptions.push(vscode.commands.registerCommand("hitl.resetToken", async () => {
        await secrets.delete(SECRET_KEY);
        sessionState = null;
        vscode.window.showInformationMessage("HITL: Token cleared. Reload the window to re-authenticate.", "Reload").then((action) => {
            if (action === "Reload") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
    }));
    try {
        const auth = await apiClient.register(token, version);
        await secrets.store(SECRET_KEY, token);
        sessionState = {
            studentId: token,
            sessionId: (0, crypto_1.randomUUID)(),
            projectId: auth.project_id,
            armId: auth.arm_id,
            landmarks: auth.lab_config.landmarks,
            interactionCount: 0,
            planningDocumentUri: null,
            sessionStarted: false,
        };
        await sessionLog.logSessionStart(sessionState.sessionId, sessionState.projectId, sessionState.armId);
    }
    catch (err) {
        await secrets.delete(SECRET_KEY);
        vscode.window.showErrorMessage(`HITL: Authentication failed — ${err instanceof Error ? err.message : String(err)}. Token has been cleared; reload to try again.`, "Reload").then((action) => {
            if (action === "Reload") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
        return;
    }
    // --- Webview Chat Panel (Section 3.9) ---
    const chatViewProvider = new chatViewProvider_1.ChatViewProvider(context.extensionUri, apiClient, () => sessionState, version, sessionLog);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatViewProvider_1.ChatViewProvider.viewType, chatViewProvider));
    // --- Command: hitl.setPlanningDocument (Section 3.6) ---
    context.subscriptions.push(vscode.commands.registerCommand("hitl.setPlanningDocument", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("HITL: Open a planning document first, then run this command.");
            return;
        }
        if (sessionState) {
            sessionState.planningDocumentUri = editor.document.uri;
            vscode.window.showInformationMessage(`HITL: Planning document set to ${vscode.workspace.asRelativePath(editor.document.uri)}`);
            chatViewProvider.updateSessionStatus();
        }
    }));
    // --- Chat Model Provider (Section 3.1) ---
    const modelInfo = {
        id: "hitl-routing",
        name: "HITL Routing",
        family: "hitl",
        version,
        maxInputTokens: 4096,
        maxOutputTokens: 4096,
        capabilities: {},
    };
    const provider = new chatProvider_1.HitlChatProvider(apiClient, () => sessionState, modelInfo);
    context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider("hitl-lab", provider));
    // --- Test command: send a quick message through the model ---
    context.subscriptions.push(vscode.commands.registerCommand("hitl.testChat", async () => {
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
        }
        catch (err) {
            vscode.window.showErrorMessage(`HITL test failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }));
}
function deactivate() {
    sessionState = null;
}
//# sourceMappingURL=extension.js.map