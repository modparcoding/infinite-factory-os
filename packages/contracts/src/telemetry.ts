import { z } from "zod";

const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());
const metricInt = z.number().int().nonnegative();
const metricFloat = z.number().min(0).max(1);

const TrustGateSchema = z.enum([
  "cold",
  "warming",
  "engaged",
  "trusting",
  "saturated",
  "over-commercialized",
]);

export const LiveTelemetryAttributionIdsSchema = z.object({
  journey_id: z.string().min(6),
  journey_stage_id: z.string().min(6),
  value_arc_id: z.string().min(6),
  campaign_id: z.string().min(6),
  campaign_theme_id: z.string().min(6),
  backlog_item_id: z.string().min(6),
  asset_id: z.string().min(6),
  chain_id: z.string().min(6),
  performance_record_id: z.string().min(6).optional(),
});

const TrustGateStringSchema = z.string().min(3);

export const LiveTelemetryComparisonSignalsSchema = z.object({
  validates_model_when: z.array(z.string().min(3)).nonempty(),
  invalidates_model_when: z.array(z.string().min(3)).nonempty(),
});

const LiveProgressionPointSchema = z.object({
  post: z.number().int().positive(),
  state: z.string().min(3),
  trust_score: z.number().min(0).max(1),
});

const LiveMemoryProgressionPointSchema = z.object({
  post: z.number().int().positive(),
  expectation: z.string().min(3),
});

const LiveRelationshipProgressionPointSchema = z.object({
  post: z.number().int().positive(),
  state: z.string().min(3),
  trust_gate_after: TrustGateSchema,
  trust_score: z.number().min(0).max(1),
});

export const LiveTelemetryComparisonPlanSchema = z.object({
  simulated_progression_expectations: z.object({
    relationship: z.array(LiveProgressionPointSchema).nonempty(),
    publishing_memory: z.array(LiveMemoryProgressionPointSchema).nonempty(),
    relationship_state: z.array(LiveRelationshipProgressionPointSchema).nonempty(),
  }),
  real_telemetry_validation_signals: LiveTelemetryComparisonSignalsSchema,
  most_likely_wrong_heuristics: z.array(z.string().min(3)).nonempty(),
  sensitive_stages: z.array(z.string().min(3)).nonempty(),
  over_commercialization_risk_hotspots: z.array(z.string().min(3)).nonempty(),
});

export const LiveTelemetryIngestionReadinessSchema = z.object({
  prepared_schema_fields: z.array(TrustGateStringSchema).nonempty(),
  required_sources: z.array(TrustGateStringSchema).nonempty(),
  capture_instructions: z.array(TrustGateStringSchema).nonempty(),
});

export const LiveTelemetryIngestionRecordSchema = z.object({
  published_post_id: z.string().min(6),
  platform: z.string().min(3),
  captured_at: isoDate,
  attribution_ids: LiveTelemetryAttributionIdsSchema,
  saves: metricInt,
  shares: metricInt,
  follows: metricInt,
  comments: metricInt,
  watch_time_seconds: z.number().nonnegative().optional(),
  lead_captures: z.number().int().nonnegative().optional(),
  platform_post_id: z.string().optional(),
});

export const LiveMetricComparisonBandSchema = z.object({
  metric: z.enum(["saves", "shares", "follows", "comments", "lead_captures"]),
  target: z.number().nonnegative(),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  tolerance_ratio: z.number().min(0).max(3).optional(),
});

export const LivePublishingReadyContentSchema = z.object({
  hook: z.string().min(3),
  caption: z.string().min(10),
  suggested_visual_direction: z.string().min(3),
  cta_instructions: z.string().min(3),
  success_metric: z.string().min(3),
});

export const ExpectedPublishingMemorySnapshotSchema = z.object({
  trust_band: z.enum(["cold", "warming", "engaged", "trusting", "saturated"]),
  memory_id: z.string().min(6),
  stage_ratio_after: z.record(z.number().min(0).max(1)),
  cta_ratio_after: z.record(z.number().min(0).max(1)),
  commercial_density_after: metricFloat,
  trend: z.enum(["up", "down", "flat"]),
  saves_shares_follows_delta: z.object({
    saves: z.number().int(),
    shares: z.number().int(),
    follows: z.number().int(),
  }),
});

export const ExpectedRelationshipStateDeltaSchema = z.object({
  state_after_post: z.string().min(3),
  trust_score_estimate: z.number().min(0).max(1),
  trust_gate_after: TrustGateSchema,
  confidence: z.enum(["low", "medium", "high"]),
});

export const LivePostExpectedActualComparisonSchema = z.object({
  sequence: z.number().int().positive(),
  backlog_item_id: z.string().min(6),
  post_id: z.string().min(6),
  published_at_utc: isoDate,
  content: z.object({
    journey_stage_id: z.string().min(3),
    value_arc_id: z.string().min(3),
    campaign_theme_id: z.string().min(3),
    relationship_objective: z.string().min(3),
    audience_state_before: z.string().min(3),
    audience_state_after: z.string().min(3),
  }),
  publishing_ready_content: LivePublishingReadyContentSchema,
  attribution_ids: LiveTelemetryAttributionIdsSchema.extend({
    published_post_id: z.string().min(6).optional(),
    platform_post_id: z.string().optional(),
  }),
  expected_engagement_bands: z.array(LiveMetricComparisonBandSchema).nonempty(),
  expected_relationship_effect: z.string().min(3),
  expected_publishing_memory: ExpectedPublishingMemorySnapshotSchema,
  expected_relationship_state: ExpectedRelationshipStateDeltaSchema,
  confirm_if: z.array(z.string().min(3)).min(1),
  invalidate_if: z.array(z.string().min(3)).min(1),
  actual: z.object({
    recorded_at: isoDate.optional(),
    metrics: z.object({
      saves: metricInt.optional(),
      shares: metricInt.optional(),
      follows: metricInt.optional(),
      comments: metricInt.optional(),
      watch_time_seconds: z.number().nonnegative().optional(),
      lead_captures: z.number().int().nonnegative().optional(),
    }).partial(),
  }).optional(),
  drift: z
    .object({
      savings_drift_ratio: z.number(),
      stage_distribution_shift: z.number().min(-1).max(1).optional(),
      trust_delta: z.number().min(-1).max(1).optional(),
      commercial_density_delta: z.number().min(-1).max(1).optional(),
    })
    .partial()
    .optional(),
});

export const LivePublishingCadenceInstructionSchema = z.object({
  sequence: z.number().int().positive(),
  scheduled_at_utc: isoDate,
  recommended_window_local: z.string().min(3),
  cta_instruction: z.string().min(3),
  notes: z.string().min(3),
});

export const DriftDetectionRuleSchema = z.object({
  rule_id: z.string().min(3),
  metric: z.enum(["saves", "shares", "follows", "comments", "commercial_density", "trust_score", "repetition_risk"]),
  threshold: z.number(),
  severity: z.enum(["info", "warn", "critical"]),
  action: z.string().min(3),
});

export const OverCommercializationRuleSchema = z.object({
  rule_id: z.string().min(3),
  metric: z.string().min(3),
  threshold: z.number().min(0).max(1),
  window_posts: z.number().int().positive(),
  warning: z.string().min(3),
});

export const LiveTelemetryBatchManifestSchema = z.object({
  batch_id: z.string().min(6),
  lane_id: z.string().min(3),
  batch_type: z.literal("live-publishing-readiness-batch"),
  package_scope: z.object({
    posts_planned: z.number().int().positive(),
    window: z.string().min(3),
    commercial_injection: z.string().min(3),
  }),
  publishing_cadence: z.object({
    cadence_notes: z.string().min(3),
    sequence_gap_hours: z.number().positive(),
    max_posts_per_day: z.number().int().positive(),
    recommended_schedule: z.array(LivePublishingCadenceInstructionSchema).nonempty(),
  }),
  metadata_lineage_persistence: z.array(z.string().min(3)),
  posts: z.array(LivePostExpectedActualComparisonSchema).nonempty(),
  drift_detection_rules: z.array(DriftDetectionRuleSchema).nonempty(),
  over_commercialization_rules: z.array(OverCommercializationRuleSchema).nonempty(),
  human_review_checklist: z.array(z.string().min(3)).nonempty(),
  comparison_plan: LiveTelemetryComparisonPlanSchema.optional(),
  live_ingestion_readiness: LiveTelemetryIngestionReadinessSchema.optional(),
});

export type LiveTelemetryIngestionRecord = z.infer<typeof LiveTelemetryIngestionRecordSchema>;
export type LiveTelemetryPostComparison = z.infer<typeof LivePostExpectedActualComparisonSchema>;
export type LiveTelemetryBatchManifest = z.infer<typeof LiveTelemetryBatchManifestSchema>;
export type LiveTelemetryComparisonPlan = z.infer<typeof LiveTelemetryComparisonPlanSchema>;
