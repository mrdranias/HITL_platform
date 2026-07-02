"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const schemas_1 = require("./schemas");
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1_000;
class ApiClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async register(studentToken, clientVersion) {
        const raw = await this.postWithRetry("/auth/register", {
            student_token: studentToken,
            client_version: clientVersion,
        });
        return schemas_1.AuthRegisterResponseSchema.parse(raw);
    }
    async interact(envelope, signal) {
        const body = schemas_1.AgentRequestEnvelopeSchema.parse(envelope);
        const raw = await this.postWithRetry("/interact", body, signal);
        return schemas_1.InstructionalResponseEnvelopeSchema.parse(raw);
    }
    async postWithRetry(path, body, signal) {
        let delay = INITIAL_DELAY_MS;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.post(path, body, signal);
            }
            catch (err) {
                const isRetryable = !(err instanceof Error) ||
                    !err.message.startsWith("Server error: 4");
                if (!isRetryable || attempt === MAX_RETRIES) {
                    throw err;
                }
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay *= 2;
            }
        }
        throw new Error("Unreachable");
    }
    async post(path, body, signal) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const onExternalAbort = signal
            ? () => controller.abort()
            : undefined;
        signal?.addEventListener("abort", onExternalAbort);
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!res.ok) {
                throw new Error(`Server error: ${res.status} ${res.statusText}`);
            }
            return await res.json();
        }
        finally {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", onExternalAbort);
        }
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=apiClient.js.map