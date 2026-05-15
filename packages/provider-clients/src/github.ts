import type { ProviderClient, ProviderHealth } from "./types.js";

export interface GitHubClient extends ProviderClient {
  openIssue(repo: string, title: string, body: string): Promise<{ number: number }>;
}

export class GitHubBoundaryClient implements GitHubClient {
  providerId = "github" as const;
  name = "GitHubBoundary";

  async openIssue(_repo: string, _title: string, _body: string): Promise<{ number: number }> {
    throw new Error("GITHUB_CLIENT_NOT_IMPLEMENTED: scaffold boundary only");
  }

  async health(): Promise<ProviderHealth> {
    return { provider: this.providerId, ok: false, details: "scaffold boundary for human-approved integrations" };
  }
}
