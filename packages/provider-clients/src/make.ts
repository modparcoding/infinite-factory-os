import type { ProviderClient, ProviderHealth } from "./types.js";

export interface MakeClient extends ProviderClient {
  triggerScenario(scenarioName: string): Promise<{ runId: string }>;
}

export class MakeBoundaryClient implements MakeClient {
  providerId = "make" as const;
  name = "MakeBoundary";

  async triggerScenario(_scenarioName: string): Promise<{ runId: string }> {
    throw new Error("MAKE_CLIENT_NOT_IMPLEMENTED: boundary only; Make optional orchestration only");
  }

  async health(): Promise<ProviderHealth> {
    return {
      provider: this.providerId,
      ok: false,
      details: "scaffold boundary preserved for optional Make-orchestration compatibility",
    };
  }
}
