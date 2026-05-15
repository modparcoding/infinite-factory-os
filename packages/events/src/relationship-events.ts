export interface RelationshipEvent {
  event_id: string;
  event_type:
    | "relationship.pacing.adjusted"
    | "journey.stage.advanced"
    | "trust.level.changed"
    | "campaign.sequence.updated";
  journey_id: string;
  actor: string;
  created_at: string;
  context: Record<string, unknown>;
}
