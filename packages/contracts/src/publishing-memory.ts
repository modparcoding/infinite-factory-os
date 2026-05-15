import { z } from "zod";

export const PublishingEventSchema = z.object({
  event_id: z.string().min(6),
  campaign_id: z.string().min(6),
  journey_id: z.string().min(6),
  journey_stage: z.string().min(3),
  cta: z.string().min(3),
  value_type: z.string().min(3),
  emotional_tone: z.string().min(3),
  commercial_signal: z.boolean(),
  saves: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
  follows: z.number().int().nonnegative(),
  asset_id: z.string().min(6),
  captured_at: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export const DistributionBucketSchema = z.record(
  z.object({
    count: z.number().int().nonnegative(),
    ratio: z.number().min(0).max(1),
  }),
);

export const PublishingMemorySnapshotSchema = z.object({
  memory_id: z.string().min(6),
  campaign_id: z.string().min(6),
  journey_id: z.string().min(6),
  derived_at: z.string().datetime({ offset: true }).or(z.string().datetime()),
  stage_distribution: DistributionBucketSchema,
  cta_distribution: DistributionBucketSchema,
  value_type_mix: DistributionBucketSchema,
  emotional_tone_mix: DistributionBucketSchema,
  commercial_density: z.number().min(0).max(1),
  saves_shares_follows_trends: z.object({
    saves_delta: z.number().int(),
    shares_delta: z.number().int(),
    follows_delta: z.number().int(),
    direction: z.enum(["up", "down", "flat"]),
    movement_strength: z.number().min(-1).max(1),
  }),
  repetition_risk: z.number().min(0).max(1),
  engagement_rate: z.number().min(0),
  snapshot_version: z.string().min(3),
  source_event_ids: z.array(z.string()),
  immutable: z.literal(true),
});

export const PublishingMemoryInputFixtureSchema = z.object({
  source_events: z.array(PublishingEventSchema).nonempty(),
  memory_id: z.string().min(6),
});

export const PublishingMemoryFailureCaseSchema = z.object({
  failure_case_id: z.string().min(6),
  reason: z.string().min(3),
  source_events: z.array(PublishingEventSchema).or(z.array(z.unknown())),
  expected_failure: z.string().min(3),
});

export type PublishingEvent = z.infer<typeof PublishingEventSchema>;
export type PublishingMemorySnapshot = z.infer<typeof PublishingMemorySnapshotSchema>;
export type PublishingMemoryInputFixture = z.infer<typeof PublishingMemoryInputFixtureSchema>;
export type PublishingMemoryFailureCase = z.infer<typeof PublishingMemoryFailureCaseSchema>;
