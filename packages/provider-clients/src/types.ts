export type ProviderId = "airtable" | "brevo" | "cloudflare" | "github" | "make" | "noop";

export interface ProviderError {
  code: string;
  message: string;
  provider: ProviderId;
}

export interface ProviderHealth {
  provider: ProviderId;
  ok: boolean;
  details: string;
}

export interface ProviderEnvelope<Payload> {
  provider: ProviderId;
  trace_id: string;
  payload: Payload;
}

export interface ProviderClient {
  providerId: ProviderId;
  name: string;
  health(): Promise<ProviderHealth>;
}
