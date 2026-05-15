import type { ProviderClient, ProviderHealth } from "./types.js";

export interface BrevoLeadPayload {
  email: string;
  routeKey: string;
}

export interface BrevoClient extends ProviderClient {
  submitLead(payload: BrevoLeadPayload): Promise<{ result: string }>;
  readContact(email: string): Promise<Record<string, unknown>>;
}

export class BrevoBoundaryClient implements BrevoClient {
  providerId = "brevo" as const;
  name = "BrevoBoundary";

  async submitLead(_payload: BrevoLeadPayload): Promise<{ result: string }> {
    throw new Error("BREVO_CLIENT_NOT_IMPLEMENTED: scaffold boundary only");
  }

  async readContact(_email: string): Promise<Record<string, unknown>> {
    throw new Error("BREVO_CLIENT_NOT_IMPLEMENTED: scaffold boundary only");
  }

  async health(): Promise<ProviderHealth> {
    return { provider: this.providerId, ok: false, details: "boundary only; wire calls intentionally absent" };
  }
}
