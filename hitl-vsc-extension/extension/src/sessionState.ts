import * as vscode from "vscode";

export interface SessionState {
  studentId: string;
  sessionId: string;
  projectId: string;
  armId: 1 | 2 | 3;
  landmarks: string[];
  interactionCount: number;
  planningDocumentUri: vscode.Uri | null;
  sessionStarted: boolean;
}

export function currentLandmark(state: SessionState): string | null {
  if (state.landmarks.length === 0) {
    return null;
  }
  const idx = Math.min(state.interactionCount, state.landmarks.length - 1);
  return state.landmarks[idx];
}
