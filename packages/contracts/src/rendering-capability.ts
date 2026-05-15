import { z } from "zod";

const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());
const nonEmpty = z.string().trim().min(1);
const canonicalId = z.string().trim().min(3);

export const RenderContentArchetypeSchema = z.enum([
  "hook_headline",
  "pain_problem",
  "insight_reframe",
  "checklist_steps",
  "comparison_before_after",
  "quote_affirmation",
  "example_scenario",
  "cta_next_step",
]);

export const RenderLayoutArchetypeSchema = z.enum([
  "sparse_checklist",
  "progressive_checklist",
  "split_comparison",
  "stacked_story",
  "emotional_quote",
  "centered_hook",
  "before_after",
  "layered_framework",
]);

export const RenderQAPolicyLevelSchema = z.enum(["pass", "warn", "block"]);
export const RenderApprovalStateSchema = z.enum(["auto_approved", "human_review_required", "blocked", "deferred"]);
export const RenderEditActionSchema = z.enum([
  "change_layout_variant",
  "adjust_text_hierarchy",
  "reflow_content",
  "adjust_spacing_density",
  "swap_template",
]);

export const CtaPositionSchema = z.enum(["none", "top", "inline", "final", "sidebar"]);

export const RenderVisualStateSchema = z.object({
  visual_intensity: z.number().min(0).max(1).default(0.45),
  density_profile: z.number().min(0).max(1).default(0.42),
  emotional_temperature: z.number().min(0).max(1).default(0.52),
  cognitive_load_target: z.number().min(1).max(10).default(5),
  trust_visual_mode: z.enum(["supportive", "directive", "neutral"]).default("supportive"),
  motion_expectation: z.enum(["none", "subtle", "moderate"]).default("none"),
});

export const RenderFormatConstraintsSchema = z.object({
  aspect_ratio: z.enum(["4:5", "9:16", "1:1"]).default("4:5"),
  safe_margins: z
    .object({
      top: z.number().min(0).max(0.5).default(0.08),
      right: z.number().min(0).max(0.5).default(0.06),
      bottom: z.number().min(0).max(0.5).default(0.08),
      left: z.number().min(0).max(0.5).default(0.06),
    })
    .default({}),
  max_word_per_line: z.number().int().min(4).default(8),
  max_lines_per_slide: z.number().int().min(3).default(6),
  min_slide_count: z.number().int().min(3).default(3),
  max_slide_count: z.number().int().min(3).max(12).default(10),
});

export const DesignTokenProfileSchema = z.object({
  profile_id: z.string().trim().min(3).default("rendering-token-profile-v1"),
  spacing_scale: z
    .object({
      section_gap: z.number().min(0).max(1).default(0.28),
      content_gap: z.number().min(0).max(1).default(0.2),
      element_gap: z.number().min(0).max(1).default(0.12),
      rhythm_step: z.number().min(0).max(1).default(0.08),
    })
    .default({}),
  typography_hierarchy: z
    .object({
      heading_scale: z.number().min(0.75).max(1.35).default(1),
      support_scale: z.number().min(0.6).max(1.2).default(0.86),
      micro_scale: z.number().min(0.45).max(0.9).default(0.68),
      line_height: z.number().min(1).max(1.7).default(1.34),
    })
    .default({}),
  safe_zones: z
    .object({
      horizontal_buffer_ratio: z.number().min(0.02).max(0.45).default(0.08),
      vertical_buffer_ratio: z.number().min(0.02).max(0.45).default(0.09),
    })
    .default({}),
  contrast_policy: z
    .object({
      minimum_ratio: z.number().min(1).max(21).default(4.5),
      heading_boost_ratio: z.number().min(1).max(21).default(7),
      body_ratio: z.number().min(1).max(21).default(4.5),
    })
    .default({}),
  whitespace_bias: z.number().min(0).max(1).default(0.57),
  hierarchy_weights: z
    .object({
      heading: z.number().min(0).max(1).default(0.48),
      support: z.number().min(0).max(1).default(0.33),
      micro: z.number().min(0).max(1).default(0.19),
    })
    .default({}),
  container_padding_rules: z
    .object({
      compact: z.number().min(0).max(1).default(0.06),
      normal: z.number().min(0).max(1).default(0.09),
      generous: z.number().min(0).max(1).default(0.12),
    })
    .default({}),
  emphasis_color_policy: z
    .object({
      primary_alpha: z.number().min(0).max(1).default(0.84),
      support_alpha: z.number().min(0).max(1).default(0.62),
      cta_alpha: z.number().min(0).max(1).default(0.72),
    })
    .default({}),
});

export const RenderInputSlideSchema = z.object({
  slide_index: z.number().int().min(1),
  content_archetype: RenderContentArchetypeSchema,
  headline: z.string().trim().min(3),
  body: z.string().trim().min(6),
  micro_copy: z.string().trim().min(3).optional(),
  cta_text: z.string().trim().min(1).optional(),
  cta_position: CtaPositionSchema.default("none"),
  tone_tags: z.array(z.string().trim().min(1)).default([]),
});

export const RenderInputContractSchema = z.object({
  asset_type: canonicalId,
  campaign_id: canonicalId,
  campaign_theme_id: canonicalId,
  backlog_item_id: canonicalId,
  brand_identity_id: canonicalId,
  content_policy_id: canonicalId,
  journey_stage: z.string().trim().min(2),
  slides: z.array(RenderInputSlideSchema).min(1).max(12),
  cta_policy: z.string().trim().min(1).default("none"),
  visual_direction: z.string().trim().min(3),
  format_constraints: RenderFormatConstraintsSchema.default({}),
  visual_state: RenderVisualStateSchema.default({}),
  design_tokens_profile: DesignTokenProfileSchema.default({}),
});

export const RenderQABlockConditionSchema = z.enum([
  "text_overflow",
  "mobile_unreadability",
  "unsafe_clipping",
  "excessive_density",
  "cta_pressure_too_high",
  "template_inconsistency",
  "weak_distinctiveness",
  "typography_hierarchy_collapse",
  "whitespace_rhythm_failure",
  "contrast_failure",
]);

export const RenderQAFindingSchema = z.object({
  code: RenderQABlockConditionSchema,
  severity: z.enum(["block", "warn", "info"]),
  message: z.string().trim().min(3),
  score: z.number().min(0).max(1).default(1),
});

export const RenderQAScoreComponentSchema = z.object({
  score: z.number().min(0).max(1),
  notes: z.array(z.string().trim().min(1)),
});

export const RenderQAScoreSchema = z.object({
  readability: RenderQAScoreComponentSchema,
  density: RenderQAScoreComponentSchema,
  emotional_coherence: RenderQAScoreComponentSchema,
  relationship_fit: RenderQAScoreComponentSchema,
  cta_appropriateness: RenderQAScoreComponentSchema,
  commercial_pressure: RenderQAScoreComponentSchema,
  mobile_scanability: RenderQAScoreComponentSchema,
  saveability: RenderQAScoreComponentSchema,
  overall: RenderQAScoreComponentSchema,
});

export const RenderOutputRenderedSlideSchema = z.object({
  slide_index: z.number().int().min(1),
  content_archetype: RenderContentArchetypeSchema,
  layout_archetype: RenderLayoutArchetypeSchema,
  lines: z.array(z.string().trim().min(1)),
  headline: z.string().trim().min(3),
  copy_words: z.number().int().min(0),
  hierarchy_weights: z.object({
    heading: z.number().min(0).max(1),
    support: z.number().min(0).max(1),
    micro: z.number().min(0).max(1),
  }),
  spacing_bias: z.number().min(0).max(1),
  cta_slot: CtaPositionSchema,
});

export const RenderOutputContractSchema = z.object({
  render_id: canonicalId,
  asset_urls: z.array(z.string().trim().min(3)),
  template_id: z.string().trim().min(6),
  archetype_sequence: z.array(RenderLayoutArchetypeSchema).nonempty(),
  slide_count: z.number().int().min(1).max(12),
  qa_status: RenderQAPolicyLevelSchema,
  qa_findings: z.array(RenderQAFindingSchema),
  approval_state: RenderApprovalStateSchema,
  render_version: z.string().trim().min(3),
  render_proof_id: z.string().trim().min(6),
  applied_visual_state: RenderVisualStateSchema,
  applied_token_profile: DesignTokenProfileSchema,
  qa_scores: RenderQAScoreSchema,
  rendered_slides: z.array(RenderOutputRenderedSlideSchema).default([]),
  output_constraints: RenderFormatConstraintsSchema,
  generated_at: isoDate,
});

export const RenderExportManifestSchema = z.object({
  render_id: canonicalId,
  export_id: z.string().trim().min(6),
  render_version: z.string().trim().min(3),
  manifest_version: z.string().trim().min(3).default("v1.0"),
  file_count: z.number().int().min(0),
  file_urls: z.array(z.string().trim().min(3)),
  replay_references: z.array(z.string().trim().min(3)),
  exported_at: isoDate,
});

export type RenderContentArchetype = z.infer<typeof RenderContentArchetypeSchema>;
export type RenderLayoutArchetype = z.infer<typeof RenderLayoutArchetypeSchema>;
export type RenderVisualState = z.infer<typeof RenderVisualStateSchema>;
export type RenderFormatConstraints = z.infer<typeof RenderFormatConstraintsSchema>;
export type DesignTokenProfile = z.infer<typeof DesignTokenProfileSchema>;
export type RenderInputSlide = z.infer<typeof RenderInputSlideSchema>;
export type RenderInputContract = z.infer<typeof RenderInputContractSchema>;
export type RenderOutputRenderedSlide = z.infer<typeof RenderOutputRenderedSlideSchema>;
export type RenderQABlockCondition = z.infer<typeof RenderQABlockConditionSchema>;
export type RenderQAFinding = z.infer<typeof RenderQAFindingSchema>;
export type RenderQAScore = z.infer<typeof RenderQAScoreSchema>;
export type RenderOutputContract = z.infer<typeof RenderOutputContractSchema>;
export type RenderExportManifest = z.infer<typeof RenderExportManifestSchema>;

export { canonicalId, isoDate };
