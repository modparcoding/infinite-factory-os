import type { ProviderClient, ProviderHealth } from "./types.js";

export interface AirtableReadInput {
  table: string;
  filters?: Record<string, unknown>;
}

export interface AirtableWriteInput {
  table: string;
  record: Record<string, unknown>;
}

export interface AirtableClient extends ProviderClient {
  read(input: AirtableReadInput): Promise<Record<string, unknown>[]>;
  write(input: AirtableWriteInput): Promise<{ id: string }>;
}

export class AirtableBoundaryClient implements AirtableClient {
  providerId = "airtable" as const;
  name = "AirtableBoundary";

  async read(_input: AirtableReadInput): Promise<Record<string, unknown>[]> {
    throw new Error("AIRTABLE_CLIENT_NOT_IMPLEMENTED: scaffold boundary only");
  }

  async write(_input: AirtableWriteInput): Promise<{ id: string }> {
    throw new Error("AIRTABLE_CLIENT_NOT_IMPLEMENTED: scaffold boundary only");
  }

  async health(): Promise<ProviderHealth> {
    return { provider: this.providerId, ok: false, details: "boundary only; no active runtime implementation" };
  }
}
