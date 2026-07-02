import {
  AgentRequestEnvelope,
  AgentRequestEnvelopeSchema,
  AuthRegisterResponse,
  AuthRegisterResponseSchema,
  InstructionalResponseEnvelope,
  InstructionalResponseEnvelopeSchema,
} from "./schemas";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1_000;

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async register(studentToken: string, clientVersion: string): Promise<AuthRegisterResponse> {
    const raw = await this.postWithRetry("/auth/register", {
      student_token: studentToken,
      client_version: clientVersion,
    });
    return AuthRegisterResponseSchema.parse(raw);
  }

  async interact(
    envelope: AgentRequestEnvelope,
    signal?: AbortSignal,
  ): Promise<InstructionalResponseEnvelope> {
    const body = AgentRequestEnvelopeSchema.parse(envelope);
    const raw = await this.postWithRetry("/interact", body, signal);
    return InstructionalResponseEnvelopeSchema.parse(raw);
  }

  private async postWithRetry(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let delay = INITIAL_DELAY_MS;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.post(path, body, signal);
      } catch (err) {
        const isRetryable =
          !(err instanceof Error) ||
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

  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onExternalAbort = signal
      ? () => controller.abort()
      : undefined;
    signal?.addEventListener("abort", onExternalAbort!);
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
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onExternalAbort!);
    }
  }
}
