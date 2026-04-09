import * as vscode from "vscode";

/**
 * Minimal local session recovery log (Section 7.2).
 *
 * Records only:
 *  - session_id, project_id, arm_id
 *  - Index of the last successfully completed interaction
 *  - Timestamps and error events
 *
 * Full interaction content is NOT stored locally;
 * the server is the authoritative log.
 */

interface LogEntry {
  timestamp: string;
  event: "session_start" | "interaction_ok" | "interaction_error";
  session_id: string;
  project_id: string;
  arm_id: 1 | 2 | 3;
  last_interaction_index: number;
  error?: string;
}

export class SessionLog {
  private readonly logUri: vscode.Uri;

  constructor(globalStorageUri: vscode.Uri) {
    this.logUri = vscode.Uri.joinPath(globalStorageUri, "session-log.jsonl");
  }

  async logSessionStart(
    sessionId: string,
    projectId: string,
    armId: 1 | 2 | 3,
  ): Promise<void> {
    await this.append({
      timestamp: new Date().toISOString(),
      event: "session_start",
      session_id: sessionId,
      project_id: projectId,
      arm_id: armId,
      last_interaction_index: 0,
    });
  }

  async logInteractionOk(
    sessionId: string,
    projectId: string,
    armId: 1 | 2 | 3,
    interactionIndex: number,
  ): Promise<void> {
    await this.append({
      timestamp: new Date().toISOString(),
      event: "interaction_ok",
      session_id: sessionId,
      project_id: projectId,
      arm_id: armId,
      last_interaction_index: interactionIndex,
    });
  }

  async logInteractionError(
    sessionId: string,
    projectId: string,
    armId: 1 | 2 | 3,
    interactionIndex: number,
    error: string,
  ): Promise<void> {
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

  private async append(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + "\n";
    const bytes = Buffer.from(line, "utf-8");
    try {
      const existing = await vscode.workspace.fs.readFile(this.logUri);
      const merged = Buffer.concat([existing, bytes]);
      await vscode.workspace.fs.writeFile(this.logUri, merged);
    } catch {
      // File doesn't exist yet — create it
      await vscode.workspace.fs.writeFile(this.logUri, bytes);
    }
  }
}
