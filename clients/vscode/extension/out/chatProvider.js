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
exports.HitlChatProvider = void 0;
const vscode = __importStar(require("vscode"));
const sanitize_1 = require("./sanitize");
const sessionState_1 = require("./sessionState");
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 15;
class HitlChatProvider {
    apiClient;
    getSession;
    modelInfo;
    constructor(apiClient, getSession, modelInfo) {
        this.apiClient = apiClient;
        this.getSession = getSession;
        this.modelInfo = modelInfo;
    }
    async provideLanguageModelChatInformation(_options, _token) {
        return [this.modelInfo];
    }
    async provideTokenCount(_model, text, _token) {
        const str = typeof text === "string" ? text : text.content.toString();
        return Math.ceil(str.length / 4);
    }
    async provideLanguageModelChatResponse(_model, messages, _options, progress, token) {
        const session = this.getSession();
        if (!session) {
            throw new Error("No active session. Please authenticate first.");
        }
        if (!session.sessionStarted) {
            throw new Error("Session not yet started. Please acknowledge the research disclaimer in the HITL Chat panel first.");
        }
        if ((session.armId === 2 || session.armId === 3) &&
            !session.planningDocumentUri) {
            const action = await vscode.window.showWarningMessage("HITL: A planning document is required before sending messages (Arms 2/3).", "Set Planning Document");
            if (action === "Set Planning Document") {
                await vscode.commands.executeCommand("hitl.setPlanningDocument");
            }
            throw new Error("A planning document must be set before using the AI assistant. " +
                'Run "HITL: Set Planning Document" first.');
        }
        let planningDocument = null;
        if (session.planningDocumentUri) {
            const bytes = await vscode.workspace.fs.readFile(session.planningDocumentUri);
            planningDocument = Buffer.from(bytes).toString("utf-8");
        }
        const sanitizedMessages = extractMessages(messages).map((m) => ({
            ...m,
            content: (0, sanitize_1.sanitizeContent)(m.content),
        }));
        const envelope = {
            student_id: session.studentId,
            session_id: session.sessionId,
            project_id: session.projectId,
            arm_id: session.armId,
            messages: sanitizedMessages,
            timestamp: new Date().toISOString(),
            workflow_landmark: (0, sessionState_1.currentLandmark)(session),
            planning_document: planningDocument ? (0, sanitize_1.sanitizeContent)(planningDocument) : null,
            client_version: this.modelInfo.version,
        };
        const abort = new AbortController();
        const onCancel = token.onCancellationRequested(() => abort.abort());
        let response;
        try {
            response = await this.apiClient.interact(envelope, abort.signal);
        }
        finally {
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
exports.HitlChatProvider = HitlChatProvider;
function extractMessages(messages) {
    return messages.map((msg) => {
        const role = msg.role === vscode.LanguageModelChatMessageRole.User
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
//# sourceMappingURL=chatProvider.js.map