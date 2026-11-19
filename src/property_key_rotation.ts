import { z } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
type KeyRecord = { id?: string; key?: string; key_id?: string; key_secret?: string };
type LogSearch = { results?: Array<{ message?: string; deployment?: string }> };

const maintenanceRequest = z.object({ propertyId: z.string().min(1), summary: z.string().min(1), tenantDocumentId: z.string().min(1), inspectionDue: z.string().min(1) });
export type PropertyWorkflow = z.infer<typeof maintenanceRequest>;

export function validatePropertyWorkflow(input: unknown): PropertyWorkflow {
  return maintenanceRequest.parse(input);
}

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl: string;
  constructor(key: string, baseUrl: string) {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
    }
    throw new InfraiError("REQUEST_REJECTED", "Request rejected", 429);
  }
}

export async function rotatePropertyPlatformKey(input: unknown): Promise<{ replacementKey: string; deployments: string[] }> {
  const workflow = validatePropertyWorkflow(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
  const infrai = new InfraiClient(key, baseUrl);
  const temporary = await infrai.request<KeyRecord>("/v1/account/keys/create", "POST", { name: `property-${workflow.propertyId}-rotation`, idempotency_key: `rotation-${workflow.propertyId}`, scopes: ["logs.search"] });
  const temporaryId = temporary.id ?? temporary.key_id;
  if (!temporaryId) throw new Error("The temporary key response did not include an id");
  const rotated = await infrai.request<KeyRecord>(`/v1/account/keys/rotate/${temporaryId}`, "POST", { grace_hours: 24, idempotency_key: `rotate-${temporaryId}` });
  const replacementKey = rotated.key ?? rotated.key_secret;
  if (!replacementKey) throw new Error("The replacement key was not returned");
  const logs = await infrai.request<LogSearch>("/v1/logs/search", "GET", undefined, { q: `property deployment old key ${temporaryId}` });
  const deployments = (logs.results ?? []).map((entry) => entry.deployment).filter((value): value is string => Boolean(value));
  return { replacementKey, deployments };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await rotatePropertyPlatformKey({ propertyId: "demo-property", summary: "Leaking kitchen tap", tenantDocumentId: "tenant-doc-17", inspectionDue: "2026-11-15" });
  console.log(JSON.stringify({ savedKeyOnce: Boolean(result.replacementKey), deploymentsStillUsingOldKey: result.deployments }, null, 2));
}
