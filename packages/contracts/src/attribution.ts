import { z } from "zod";

const nonEmpty = z.string().min(3);
const nonNegativeInt = z.number().int().nonnegative();
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

export const AttributionEntityId = z.string().min(6);

export const AudienceJourneySchema = z.object({
  journey_id: AttributionEntityId,
  niche: nonEmpty,
  title: nonEmpty,
  status: z.enum(["active", "paused", "graduated", "closed", "draft"]),
  audience_size: nonNegativeInt,
});

export const JourneyStageSchema = z.object({
  journey_stage_id: AttributionEntityId,
  journey_id: AttributionEntityId,
  name: nonEmpty,
  sequence_order: z.number().int().nonnegative(),
  trust_gate: z.enum(["cold", "warming", "engaged", "trusting", "saturated", "over-commercialized"]),
});

export const ValueArcSchema = z.object({
  value_arc_id: AttributionEntityId,
  journey_id: AttributionEntityId,
  label: nonEmpty,
  campaign_id: z.string().min(3),
  stage_id: AttributionEntityId,
});

export const CampaignThemeSchema = z.object({
  theme_id: AttributionEntityId,
  label: nonEmpty,
  narrative: nonEmpty,
  campaign_id: AttributionEntityId,
});

export const CampaignSchema = z.object({
  campaign_id: AttributionEntityId,
  campaign_name: nonEmpty,
  campaign_theme: z.string().min(3),
  objective: nonEmpty,
  value_arc_ids: z.array(AttributionEntityId).default([]),
});

export const BacklogItemSchema = z.object({
  backlog_id: AttributionEntityId,
  title: nonEmpty,
  priority: z.number().int().min(0),
  campaign_id: AttributionEntityId,
  value: z.number().min(0),
});

export const AssetSchema = z.object({
  asset_id: AttributionEntityId,
  source: nonEmpty,
  url: z.string().url(),
  campaign_id: AttributionEntityId,
  journey_stage_id: AttributionEntityId.optional(),
  stage_id: AttributionEntityId.optional(),
  backlog_id: AttributionEntityId,
}).superRefine((asset, ctx) => {
  const assetStage = asset.journey_stage_id ?? asset.stage_id;
  if (!assetStage) {
    ctx.addIssue({
      code: "custom",
      message: "asset_stage_required: provide journey_stage_id or stage_id",
      path: ["journey_stage_id"],
    });
  }
  if (asset.journey_stage_id && asset.stage_id && asset.journey_stage_id !== asset.stage_id) {
    ctx.addIssue({
      code: "custom",
      message: "asset_stage_mismatch: journey_stage_id must match stage_id when both are provided",
      path: ["journey_stage_id"],
    });
  }
});

export const PublishedPostSchema = z.object({
  published_post_id: AttributionEntityId,
  asset_id: AttributionEntityId,
  platform: nonEmpty,
  published_at: isoDate,
  platform_post_id: z.string().optional(),
});

export const PerformanceRecordSchema = z.object({
  performance_id: AttributionEntityId,
  published_post_id: AttributionEntityId,
  impressions: z.number().int().nonnegative(),
  engagement: z.number().nonnegative(),
  revenue: z.number().nonnegative().optional(),
  engagement_snapshot: z.record(z.number()).optional(),
  captured_at: isoDate,
});

export type AudienceJourney = z.infer<typeof AudienceJourneySchema>;
export type JourneyStage = z.infer<typeof JourneyStageSchema>;
export type ValueArc = z.infer<typeof ValueArcSchema>;
export type CampaignTheme = z.infer<typeof CampaignThemeSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type BacklogItem = z.infer<typeof BacklogItemSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type PublishedPost = z.infer<typeof PublishedPostSchema>;
export type PerformanceRecord = z.infer<typeof PerformanceRecordSchema>;

export const AttributionLinkSchema = z.object({
  source: z.string().min(1),
  source_id: AttributionEntityId,
  target: z.string().min(1),
  target_id: AttributionEntityId,
});

export const AttributionLinkKindSchema = z.enum([
  "AudienceJourney",
  "JourneyStage",
  "ValueArc",
  "Campaign",
  "CampaignTheme",
  "BacklogItem",
  "Asset",
  "PublishedPost",
  "PerformanceRecord",
]);

export type AttributionLinkKind = z.infer<typeof AttributionLinkKindSchema>;

export const AttributionChainSchema = z.object({
  chain_id: AttributionEntityId,
  audience_journey_id: AttributionEntityId,
  journey_stage_id: AttributionEntityId,
  value_arc_id: AttributionEntityId,
  campaign_id: AttributionEntityId,
  campaign_theme_id: AttributionEntityId,
  backlog_item_id: AttributionEntityId,
  asset_id: AttributionEntityId,
  published_post_id: AttributionEntityId,
  performance_record_id: AttributionEntityId,
  deterministic_signature: z.string().min(16),
  immutable: z.literal(true),
  lineage_order: z
    .tuple([
      z.literal("AudienceJourney"),
      z.literal("JourneyStage"),
      z.literal("ValueArc"),
      z.literal("Campaign"),
      z.literal("CampaignTheme"),
      z.literal("BacklogItem"),
      z.literal("Asset"),
      z.literal("PublishedPost"),
      z.literal("PerformanceRecord"),
    ])
    .readonly(),
  links: z.array(AttributionLinkSchema),
  canonical_chain: z.array(z.string().min(1)),
  created_at: isoDate,
});

export const AttributionSeedSchema = z.object({
  source: z.object({
    audience_journey: AudienceJourneySchema,
    journey_stages: z.array(JourneyStageSchema).nonempty(),
    value_arcs: z.array(ValueArcSchema).nonempty(),
    campaign_theme: CampaignThemeSchema,
    campaign: CampaignSchema,
    backlog_item: BacklogItemSchema,
    asset: AssetSchema,
    published_post: PublishedPostSchema,
    performance_record: PerformanceRecordSchema,
  }),
  chain_id: AttributionEntityId,
  chain_owner: z.string().min(3),
});

export type AttributionSeed = z.infer<typeof AttributionSeedSchema>;
export type AttributionChain = z.infer<typeof AttributionChainSchema>;

export interface CanonicalLink {
  sourceSegment: AttributionLinkKind;
  sourceId: string;
  targetSegment: AttributionLinkKind;
  targetId: string;
}

export interface AttributionTrace {
  chain_id: string;
  journey_id: string;
  journey_stage_id: string;
  value_arc_id: string;
  campaign_id: string;
  campaign_theme_id: string;
  backlog_item_id: string;
  asset_id: string;
  published_post_id: string;
  performance_record_id: string;
}

function deterministicFingerprint(trace: AttributionTrace) {
  const ordered = [
    trace.chain_id,
    trace.journey_id,
    trace.journey_stage_id,
    trace.value_arc_id,
    trace.campaign_id,
    trace.campaign_theme_id,
    trace.backlog_item_id,
    trace.asset_id,
    trace.published_post_id,
    trace.performance_record_id,
  ];
  return ordered.join("::");
}

const ATTRIBUTION_CHAIN_EPOCH_MS = Date.UTC(2026, 4, 15);

function deterministicCreatedAt(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) >>> 0;
  }
  const offsetMs = hash % (24 * 60 * 60 * 1000);
  return new Date(ATTRIBUTION_CHAIN_EPOCH_MS + offsetMs).toISOString();
}

function pickCanonicalJourneyStage(stages: JourneyStage[]) {
  return [...stages].sort(
    (left, right) => left.sequence_order - right.sequence_order || left.journey_stage_id.localeCompare(right.journey_stage_id),
  )[0];
}

function pickCanonicalValueArc(arcs: ValueArc[]) {
  return [...arcs].sort((left, right) => left.value_arc_id.localeCompare(right.value_arc_id))[0];
}

function toCanonicalChain(seed: AttributionSeed, canonicalJourneyStage: JourneyStage, canonicalArc: ValueArc): AttributionTrace {
  return {
    chain_id: seed.chain_id,
    journey_id: seed.source.audience_journey.journey_id,
    journey_stage_id: canonicalJourneyStage.journey_stage_id,
    value_arc_id: canonicalArc.value_arc_id,
    campaign_id: seed.source.campaign.campaign_id,
    campaign_theme_id: seed.source.campaign_theme.theme_id,
    backlog_item_id: seed.source.backlog_item.backlog_id,
    asset_id: seed.source.asset.asset_id,
    published_post_id: seed.source.published_post.published_post_id,
    performance_record_id: seed.source.performance_record.performance_id,
  };
}

export function buildCanonicalChain(seed: AttributionSeed): AttributionChain {
  const parsedSeed = AttributionSeedSchema.parse(seed);
  const { source } = parsedSeed;

  const stageIds = new Set(source.journey_stages.map((stage) => stage.journey_stage_id));
  const campaignArcIds = new Set(source.campaign.value_arc_ids);
  const canonicalJourneyStage = pickCanonicalJourneyStage(source.journey_stages);
  const canonicalValueArc = pickCanonicalValueArc(source.value_arcs);
  const canonicalIds = [
    source.audience_journey.journey_id,
    ...source.journey_stages.map((stage) => stage.journey_stage_id),
    ...source.value_arcs.map((arc) => arc.value_arc_id),
    source.campaign.campaign_id,
    source.campaign_theme.theme_id,
    source.backlog_item.backlog_id,
    source.asset.asset_id,
    source.published_post.published_post_id,
    source.performance_record.performance_id,
  ];

  const errors: string[] = [];

  if (canonicalIds.length !== new Set(canonicalIds).size) {
    errors.push("duplicate_entity_id_detected");
  }
  if (source.published_post.published_post_id === source.asset.asset_id) {
    errors.push("duplicate_published_post_lineage");
  }

  if (!source.journey_stages.every((stage) => stage.journey_id === source.audience_journey.journey_id)) {
    errors.push("journey_stage_journey_mismatch");
  }
  if (!source.value_arcs.every((arc) => arc.journey_id === source.audience_journey.journey_id)) {
    errors.push("arc_journey_mismatch");
  }
  if (canonicalJourneyStage.journey_id !== source.audience_journey.journey_id) {
    errors.push("journey_stage_primary_mismatch");
  }
  if (canonicalValueArc.journey_id !== source.audience_journey.journey_id) {
    errors.push("value_arc_journey_mismatch");
  }
  const assetStageId = source.asset.journey_stage_id ?? source.asset.stage_id;
  if (assetStageId && !stageIds.has(assetStageId)) {
    errors.push("asset_stage_not_found");
  }
  if (!campaignArcIds.has(canonicalValueArc.value_arc_id)) {
    errors.push("campaign_value_arc_not_linked");
  }
  if (canonicalValueArc.campaign_id !== source.campaign.campaign_id) {
    errors.push("arc_campaign_mismatch");
  }
  if (canonicalValueArc.stage_id && !stageIds.has(canonicalValueArc.stage_id)) {
    errors.push("canonical_arc_stage_not_found");
  }
  if (source.campaign.campaign_theme !== source.campaign_theme.theme_id) {
    errors.push("campaign_theme_mismatch");
  }
  if (source.backlog_item.campaign_id !== source.campaign.campaign_id) {
    errors.push("backlog_campaign_mismatch");
  }
  if (source.asset.campaign_id !== source.campaign.campaign_id) {
    errors.push("asset_campaign_mismatch");
  }
  if (source.asset.backlog_id !== source.backlog_item.backlog_id) {
    errors.push("asset_backlog_mismatch");
  }
  if (source.published_post.asset_id !== source.asset.asset_id) {
    errors.push("published_post_asset_mismatch");
  }
  if (source.performance_record.published_post_id !== source.published_post.published_post_id) {
    errors.push("performance_post_mismatch");
  }

  if (errors.length > 0) {
    throw new Error(`Attribution seed validation failed: ${errors.join(",")}`);
  }

  const trace = toCanonicalChain(parsedSeed, canonicalJourneyStage, canonicalValueArc);
  const canonicalLinks: CanonicalLink[] = [
    { sourceSegment: "AudienceJourney", sourceId: trace.journey_id, targetSegment: "JourneyStage", targetId: trace.journey_stage_id },
    { sourceSegment: "JourneyStage", sourceId: trace.journey_stage_id, targetSegment: "ValueArc", targetId: trace.value_arc_id },
    { sourceSegment: "ValueArc", sourceId: trace.value_arc_id, targetSegment: "Campaign", targetId: trace.campaign_id },
    { sourceSegment: "Campaign", sourceId: trace.campaign_id, targetSegment: "CampaignTheme", targetId: trace.campaign_theme_id },
    { sourceSegment: "CampaignTheme", sourceId: trace.campaign_theme_id, targetSegment: "BacklogItem", targetId: trace.backlog_item_id },
    { sourceSegment: "BacklogItem", sourceId: trace.backlog_item_id, targetSegment: "Asset", targetId: trace.asset_id },
    { sourceSegment: "Asset", sourceId: trace.asset_id, targetSegment: "PublishedPost", targetId: trace.published_post_id },
    { sourceSegment: "PublishedPost", sourceId: trace.published_post_id, targetSegment: "PerformanceRecord", targetId: trace.performance_record_id },
  ];

  const links = canonicalLinks.map((link) => ({
    source: `${link.sourceSegment}:${link.sourceId}`,
    source_id: link.sourceId,
    target: `${link.targetSegment}:${link.targetId}`,
    target_id: link.targetId,
  }));

  return AttributionChainSchema.parse({
    chain_id: trace.chain_id,
    audience_journey_id: trace.journey_id,
    journey_stage_id: trace.journey_stage_id,
    value_arc_id: trace.value_arc_id,
    campaign_id: trace.campaign_id,
    campaign_theme_id: trace.campaign_theme_id,
    backlog_item_id: trace.backlog_item_id,
    asset_id: trace.asset_id,
    published_post_id: trace.published_post_id,
    performance_record_id: trace.performance_record_id,
    deterministic_signature: deterministicFingerprint(trace),
    immutable: true,
    lineage_order: [
      "AudienceJourney",
      "JourneyStage",
      "ValueArc",
      "Campaign",
      "CampaignTheme",
      "BacklogItem",
      "Asset",
      "PublishedPost",
      "PerformanceRecord",
    ],
    links,
    canonical_chain: [
      trace.journey_id,
      trace.journey_stage_id,
      trace.value_arc_id,
      trace.campaign_id,
      trace.campaign_theme_id,
      trace.backlog_item_id,
      trace.asset_id,
      trace.published_post_id,
      trace.performance_record_id,
    ],
    created_at: deterministicCreatedAt(seed.chain_id),
  });
}

export function validateLineageTrace(lineage: AttributionChain, seed: AttributionSeed): boolean {
  const reconstructed = buildCanonicalChain(seed);
  return (
    reconstructed.audience_journey_id === lineage.audience_journey_id
    && reconstructed.journey_stage_id === lineage.journey_stage_id
    && reconstructed.value_arc_id === lineage.value_arc_id
    && reconstructed.campaign_id === lineage.campaign_id
    && reconstructed.campaign_theme_id === lineage.campaign_theme_id
    && reconstructed.backlog_item_id === lineage.backlog_item_id
    && reconstructed.asset_id === lineage.asset_id
    && reconstructed.published_post_id === lineage.published_post_id
    && reconstructed.performance_record_id === lineage.performance_record_id
    && reconstructed.deterministic_signature === lineage.deterministic_signature
  );
}
