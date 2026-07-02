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
exports.sanitizeContent = sanitizeContent;
const os = __importStar(require("os"));
let _username;
let _hostname;
function getUsername() {
    if (_username === undefined) {
        try {
            _username = os.userInfo().username;
        }
        catch {
            _username = process.env.USERNAME ?? process.env.USER ?? "";
        }
    }
    return _username ?? "";
}
function getHostname() {
    if (_hostname === undefined) {
        try {
            _hostname = os.hostname();
        }
        catch {
            _hostname = "";
        }
    }
    return _hostname ?? "";
}
function escapeRegExp(s) {
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
function sanitizeContent(content) {
    let s = content;
    // Windows drive-letter paths
    s = s.replace(/[A-Za-z]:\\[^\s"'`,;)}\]>]*/g, "[path-redacted]");
    // UNC paths
    s = s.replace(/\\\\[^\s"'`,;)}\]>]*/g, "[path-redacted]");
    // Unix absolute paths under well-known roots
    s = s.replace(/\/(?:home|Users|tmp|var|etc|usr|opt|root|mnt|media|private)[/][^\s"'`,;)}\]>]*/g, "[path-redacted]");
    // OS username
    const username = getUsername();
    if (username && username.length >= 2) {
        s = s.replace(new RegExp(`\\b${escapeRegExp(username)}\\b`, "g"), "[user-redacted]");
    }
    // Hostname
    const hostname = getHostname();
    if (hostname && hostname.length >= 2) {
        s = s.replace(new RegExp(`\\b${escapeRegExp(hostname)}\\b`, "g"), "[host-redacted]");
    }
    return s;
}
//# sourceMappingURL=sanitize.js.map