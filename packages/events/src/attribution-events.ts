export interface AttributionEvent {
  event_id: string;
  event_type: "attribution.recorded" | "attribution.reconciled";
  chain: string[];
  source: string;
  created_at: string;
  evidence: Record<string, unknown>;
}
