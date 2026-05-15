import { z } from "zod";

import { TrustLevel } from "./relationship.js";

const TrustLevelSchema = z.enum(["cold", "warming", "engaged", "trusting", "saturated", "over-commercialized"] as const);

export const RelationshipStateSchema = z.object({
  relationship_id: z.string().min(6),
  trust_level: TrustLevelSchema,
  trust_score: z.number().min(0).max(1),
  campaign_id: z.string().min(3),
  journey_id: z.string().min(3),
  reasoning: z.array(
    z.object({
      rule: z.string().min(3),
      value: z.string().min(1),
      result: z.string().min(3),
    }),
  ).min(1),
  source_memory_id: z.string().min(6),
  generated_at: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export type RelationshipStateV1Result = z.infer<typeof RelationshipStateSchema>;

export interface RelationshipHeuristicInput {
  relationship_id: string;
  campaign_id: string;
  journey_id: string;
  memory_id: string;
  trust_score: number;
  commercial_density: number;
  repetition_risk: number;
  journey_stage_ratio: number;
  previous_trust_level?: TrustLevel;
}

export const RelationshipHeuristicSnapshotSchema = z.object({
  relationship_state: RelationshipStateSchema,
  input_snapshot_id: z.string().min(6),
  derivation_steps: z.array(z.string().min(3)),
  passed: z.boolean(),
  rejection_reason: z.string().optional(),
});

export type RelationshipHeuristicSnapshot = z.infer<typeof RelationshipHeuristicSnapshotSchema>;

export type { TrustLevel };
