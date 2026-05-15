import type { ProviderClient, ProviderHealth } from "./types.js";

export interface CloudflareClient extends ProviderClient {
  runWorker(workerName: string, payload: Record<string, unknown>): Promise<{ requestId: string }>;
}

export class CloudflareBoundaryClient implements CloudflareClient {
  providerId = "cloudflare" as const;
  name = "CloudflareBoundary";

  async runWorker(_workerName: string, _payload: Record<string, unknown>): Promise<{ requestId: string }> {
    throw new Error("CLOUDFLARE_CLIENT_NOT_IMPLEMENTED: scaffold boundary only");
  }

  async health(): Promise<ProviderHealth> {
    return { provider: this.providerId, ok: false, details: "scaffold boundary; runtime account wiring needed" };
  }
}
