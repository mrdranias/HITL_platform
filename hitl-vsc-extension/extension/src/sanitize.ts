import * as os from "os";

let _username: string | undefined;
let _hostname: string | undefined;

function getUsername(): string {
  if (_username === undefined) {
    try {
      _username = os.userInfo().username;
    } catch {
      _username = process.env.USERNAME ?? process.env.USER ?? "";
    }
  }
  return _username;
}

function getHostname(): string {
  if (_hostname === undefined) {
    try {
      _hostname = os.hostname();
    } catch {
      _hostname = "";
    }
  }
  return _hostname;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Aggressively strip PII from content before transmission.
 *
 * Removes:
 *  - Windows absolute paths  (C:\..., D:\...)
 *  - UNC paths               (\\server\share\...)
 *  - Unix home/system paths  (/home/..., /Users/..., etc.)
 *  - Current OS username (standalone word, 2+ chars)
 *  - Machine hostname    (standalone word, 2+ chars)
 */
export function sanitizeContent(content: string): string {
  let s = content;

  // Windows drive-letter paths
  s = s.replace(/[A-Za-z]:\\[^\s"'`,;)}\]>]*/g, "[path-redacted]");

  // UNC paths
  s = s.replace(/\\\\[^\s"'`,;)}\]>]*/g, "[path-redacted]");

  // Unix absolute paths under well-known roots
  s = s.replace(
    /\/(?:home|Users|tmp|var|etc|usr|opt|root|mnt|media|private)[/][^\s"'`,;)}\]>]*/g,
    "[path-redacted]",
  );

  // OS username
  const username = getUsername();
  if (username && username.length >= 2) {
    s = s.replace(
      new RegExp(`\\b${escapeRegExp(username)}\\b`, "g"),
      "[user-redacted]",
    );
  }

  // Hostname
  const hostname = getHostname();
  if (hostname && hostname.length >= 2) {
    s = s.replace(
      new RegExp(`\\b${escapeRegExp(hostname)}\\b`, "g"),
      "[host-redacted]",
    );
  }

  return s;
}
