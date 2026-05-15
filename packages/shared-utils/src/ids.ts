export function toReplayId(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join("::").replace(/[^a-zA-Z0-9:\-_.]/g, "_");
}

export function epochNowIso(): string {
  return new Date().toISOString();
}
