export type TrustLevel =
  | "cold"
  | "warming"
  | "engaged"
  | "trusting"
  | "saturated"
  | "over-commercialized";

export type JourneyStatus = "not_started" | "active" | "paused" | "graduated" | "closed";

export interface RelationshipObjective {
  objective_id: string;
  name: string;
  value: string;
  priority: number;
}

export interface RelationshipJourneyStage {
  stage_id: string;
  name: string;
  objective_id: string;
  sequence_order: number;
  trust_gate: TrustLevel;
  audience_count: number;
}

export interface RelationshipValueArc {
  arc_id: string;
  journey_id: string;
  label: string;
  active: boolean;
  stages: string[];
}

export interface RelationshipAudienceJourney {
  journey_id: string;
  niche: string;
  title: string;
  status: JourneyStatus;
  objective_ids: string[];
  stages: RelationshipJourneyStage[];
  value_arcs: RelationshipValueArc[];
}

export interface JourneyAllocationPolicy {
  policy_id: string;
  journey_stage: string;
  max_daily_publication: number;
  max_weekly_contact: number;
  trust_multiplier: number;
}

export interface RelationshipState {
  relationship_id: string;
  audience_journey_id: string;
  trust_level: TrustLevel;
  current_stage_id: string;
  value_arc_id: string;
  campaign_id?: string;
  last_evaluated_at: string;
  commerciality_signal: number;
  saturation_risk: number;
  context: Record<string, unknown>;
}

export interface RelationshipStateV1 {
  relationship_id: string;
  trust_level: TrustLevel;
  trust_score: number;
  campaign_id: string;
  journey_id: string;
  reasoning: Array<{
    rule: string;
    value: string;
    result: string;
  }>;
  source_memory_id: string;
  generated_at: string;
}
