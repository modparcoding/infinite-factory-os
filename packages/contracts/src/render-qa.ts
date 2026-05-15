import { z } from "zod";

const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());
const nonEmpty = z.string().min(3);

export const RenderStageNameSchema = z.string().min(3);

export const RenderToneSchema = z.string().min(3);

export const RenderObjectiveSchema = z.string().min(3);

export const CtaPolicySchema = z
  .string()
  .min(1)
  .transform((value) => value.toLowerCase().replace(/\s+/g, "_").trim());

export const StageIntentSchema = z.enum(["Resonance", "Relief", "Trust", "Lead Capture", "Monetization", "Retention"]);

export const RenderSlideIntentSchema = z.enum([
  "hook",
  "validation",
  "utility_step",
  "proof",
  "continuity",
  "soft_invite",
  "lead_collect",
  "resource_offer",
  "summary",
]);

export type RenderSlideIntent = z.infer<typeof RenderSlideIntentSchema>;

export const RenderBlockReasonSchema = z.enum([
  "cta_pressure_exceeds_stage_allowance",
  "readability_below_threshold",
  "excessive_density",
  "emotional_mismatch",
  "relationship_fit_mismatch",
  "commercial_mismatch",
  "hook_not_present",
  "final_slide_breaks_continuity",
  "mobile_scanability_low",
]);

export type RenderBlockReason = z.infer<typeof RenderBlockReasonSchema>;

export const RenderSlideVisualSchema = z.object({
  composition: nonEmpty,
  framing: nonEmpty,
  mobile_safe: z.boolean(),
  fatigue_risk: z.number().min(0).max(1),
  notes: z.array(nonEmpty).default([]),
});

export const RenderCopyHierarchySchema = z.object({
  headline: z.string().min(3),
  support_copy: z.string().min(3),
  micro_copy: z.string().min(1).optional(),
});

export const RenderSlideSchema = z.object({
  slide_index: z.number().int().min(1),
  intent: RenderSlideIntentSchema,
  copy: nonEmpty,
  copy_hierarchy: RenderCopyHierarchySchema,
  visual_direction: nonEmpty,
  visual: RenderSlideVisualSchema,
  mobile_lines: z.array(nonEmpty).min(1),
  cta_text: z.string().optional(),
  cta_position: z.enum(["none", "top", "inline", "final", "sidebar"]).default("none"),
  visual_complexity: z.number().min(0).max(1),
  cta_slot: z.enum(["none", "top", "inline", "final", "sidebar"]),
  whitespace_bias: z.number().min(0).max(1),
  slide_energy: z.number().min(0).max(1),
  continuity_weight: z.number().min(0).max(1),
  visual_pacing: z.number().min(0).max(1),
  tone_markers: z.array(z.string().min(1)).default([]),
  word_count: z.number().int().nonnegative(),
});

export const RenderMobileConstraintSchema = z.object({
  max_word_per_line: z.number().int().positive().default(8),
  max_lines_per_slide: z.number().int().positive().default(5),
  max_slide_word_count: z.number().int().positive().default(28),
  recommended_word_per_slide: z.number().int().positive(),
});

export const RenderScoreComponentSchema = z.object({
  score: z.number().min(0).max(1),
  notes: z.array(nonEmpty).default([]),
});

export const RenderQAHeaderSchema = z.object({
  stage_fit: RenderScoreComponentSchema,
  readability: RenderScoreComponentSchema,
  density: RenderScoreComponentSchema,
  emotional_coherence: RenderScoreComponentSchema,
  relationship_fit: RenderScoreComponentSchema,
  cta_appropriateness: RenderScoreComponentSchema,
  commercial_pressure: RenderScoreComponentSchema,
  saveability: RenderScoreComponentSchema,
  mobile_scanability: RenderScoreComponentSchema,
});

export const RenderQAScoreSchema = RenderQAHeaderSchema.extend({
  overall: z.number().min(0).max(1),
});

export const RenderValidationSummarySchema = z.object({
  passed: z.boolean(),
  blocked: z.boolean(),
  block_conditions: z.array(RenderBlockReasonSchema),
  warnings: z.array(nonEmpty).default([]),
});

export const RenderCarouselTemplateSchema = z.object({
  template_id: z.string().min(6),
  generated_by: nonEmpty,
  generated_at: isoDate,
  source_backlog_item_id: z.string().min(6),
  source_attribution: z.object({
    journey_stage_id: z.string().min(6),
    value_arc_id: z.string().min(6),
    journey_stage_label: RenderStageNameSchema,
    value_arc_label: z.string().min(3),
    campaign_theme_id: z.string().min(6),
    campaign_theme_label: z.string().min(3),
  }),
  relationship_objective: RenderObjectiveSchema,
  audience_state_before: z.string().min(3),
  audience_state_after: z.string().min(3),
  hook: nonEmpty,
  commercial_intent: nonEmpty,
  cta_policy: nonEmpty,
  emotional_tone: RenderToneSchema,
  hook_direction: z.string().min(3),
  mobile_constraints: RenderMobileConstraintSchema,
  slides: z.array(RenderSlideSchema).nonempty().max(12),
  qa: RenderQAScoreSchema,
  validation: RenderValidationSummarySchema,
});

export const RenderCarouselRequestSchema = z.object({
  backlog_item_id: z.string().min(6),
  campaign_id: z.string().min(3),
  journey_stage_id: z.string().min(6),
  journey_stage_label: RenderStageNameSchema,
  value_arc_id: z.string().min(6),
  value_arc_label: z.string().min(3),
  campaign_theme_id: z.string().min(6),
  campaign_theme_label: z.string().min(3),
  relationship_objective: RenderObjectiveSchema,
  audience_state_before: z.string().min(3),
  audience_state_after: z.string().min(3),
  hook: nonEmpty,
  caption: z.string().min(6),
  suggested_visual_direction: nonEmpty,
  cta_policy: CtaPolicySchema,
  commercial_intent: nonEmpty,
  hook_direction: z.string().min(3),
  emotional_tone: RenderToneSchema,
  success_metric: z.string().min(3),
});

export type RenderCarouselRequest = z.infer<typeof RenderCarouselRequestSchema>;
export type RenderCarouselTemplate = z.infer<typeof RenderCarouselTemplateSchema>;
export type RenderSlide = z.infer<typeof RenderSlideSchema>;
export type RenderQAScore = z.infer<typeof RenderQAScoreSchema>;
export type RenderValidationSummary = z.infer<typeof RenderValidationSummarySchema>;

export interface RenderGenerationResult {
  template: RenderCarouselTemplate;
  rationale: string[];
  stage_policy_version: string;
}
