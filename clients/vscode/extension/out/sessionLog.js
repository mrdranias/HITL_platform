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
exports.SessionLog = void 0;
const vscode = __importStar(require("vscode"));
class SessionLog {
    logUri;
    constructor(globalStorageUri) {
        this.logUri = vscode.Uri.joinPath(globalStorageUri, "session-log.jsonl");
    }
    async logSessionStart(sessionId, projectId, armId) {
        await this.append({
            timestamp: new Date().toISOString(),
            event: "session_start",
            session_id: sessionId,
            project_id: projectId,
            arm_id: armId,
            last_interaction_index: 0,
        });
    }
    async logInteractionOk(sessionId, projectId, armId, interactionIndex) {
        await this.append({
            timestamp: new Date().toISOString(),
            event: "interaction_ok",
            session_id: sessionId,
            project_id: projectId,
            arm_id: armId,
            last_interaction_index: interactionIndex,
        });
    }
    async logInteractionError(sessionId, projectId, armId, interactionIndex, error) {
        await this.append({
            timestamp: new Date().toISOString(),
            event: "interaction_error",
            session_id: sessionId,
            project_id: projectId,
            arm_id: armId,
            last_interaction_index: interactionIndex,
            error,
        });
    }
    async append(entry) {
        const line = JSON.stringify(entry) + "\n";
        const bytes = Buffer.from(line, "utf-8");
        try {
            const existing = await vscode.workspace.fs.readFile(this.logUri);
            const merged = Buffer.concat([existing, bytes]);
            await vscode.workspace.fs.writeFile(this.logUri, merged);
        }
        catch {
            // File doesn't exist yet — create it
            await vscode.workspace.fs.writeFile(this.logUri, bytes);
        }
    }
}
exports.SessionLog = SessionLog;
//# sourceMappingURL=sessionLog.js.map