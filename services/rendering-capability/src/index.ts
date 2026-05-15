import { toReplayId } from "@ifos/shared-utils";
import {
  CtaPolicySchema,
  DesignTokenProfile,
  DesignTokenProfileSchema,
  RenderCarouselRequest,
  RenderCarouselRequestSchema,
  RenderContentArchetype,
  RenderEditActionSchema,
  RenderExportManifest,
  RenderFormatConstraints,
  RenderFormatConstraintsSchema,
  RenderInputContract,
  RenderInputContractSchema,
  RenderInputSlide,
  RenderLayoutArchetype,
  RenderOutputContract,
  RenderOutputContractSchema,
  RenderQAFinding,
  RenderQABlockConditionSchema,
  RenderCapabilityQAScore as RenderQAScore,
  RenderCapabilityQAScoreSchema as RenderQAScoreSchema,
  RenderVisualState,
  RenderVisualStateSchema,
  RenderContentArchetypeSchema,
} from "@ifos/contracts";

const RE_RENDERING_VERSION = "rendering-capability-v1.0.0";

type StagePolicy = {
  stage: string;
  minSlides: number;
  maxSlides: number;
  densityTarget: number;
  readabilityTarget: number;
  ctaPressureMax: number;
  commercialPressureMax: number;
  preferredArchetypes: RenderLayoutArchetype[];
  whitespaceFloor: number;
  relationshipTone: number;
  visualBias: {
    visualIntensity: number;
    density: number;
    trustMode: RenderVisualState["trust_visual_mode"];
  };
};

type RegisteredArchetype = {
  id: RenderLayoutArchetype;
  description: string;
  rhythmBias: number;
  spacingBias: number;
  defaultDensity: number;
  minimumHeadlineWords: number;
};

type RenderedSlide = {
  slide_index: number;
  content_archetype: RenderContentArchetype;
  layout_archetype: RenderLayoutArchetype;
  lines: string[];
  headline: string;
  copy_words: number;
  hierarchy_weights: {
    heading: number;
    support: number;
    micro: number;
  };
  spacing_bias: number;
  cta_slot: RenderInputSlide["cta_position"];
};

type RenderEdit =
  | {
      op: "change_layout_variant";
      slide_index: number;
      layout_archetype_id: RenderLayoutArchetype;
    }
  | {
      op: "adjust_text_hierarchy";
      slide_index: number;
      role: "headline" | "support" | "micro";
      delta: number;
    }
  | {
      op: "reflow_content";
      slide_index: number;
      line_limit_override: number;
    }
  | {
      op: "adjust_spacing_density";
      slide_index?: number;
      density_delta: number;
    }
  | {
      op: "swap_template";
      template_archetypes: RenderLayoutArchetype[];
    };

type RenderEditProfile = {
  edits: RenderEdit[];
};

const STAGE_POLICY: Record<string, StagePolicy> = {
  resonance: {
    stage: "Resonance",
    minSlides: 3,
    maxSlides: 8,
    densityTarget: 0.6,
    readabilityTarget: 0.72,
    ctaPressureMax: 1,
    commercialPressureMax: 0.24,
    preferredArchetypes: [
      "centered_hook",
      "sparse_checklist",
      "stacked_story",
      "emotional_quote",
      "layered_framework",
    ],
    relationshipTone: 0.82,
    visualBias: {
      visualIntensity: 0.28,
      density: 0.34,
      trustMode: "supportive",
    },
    whitespaceFloor: 0.52,
  },
  relief: {
    stage: "Relief",
    minSlides: 4,
    maxSlides: 9,
    densityTarget: 0.58,
    readabilityTarget: 0.7,
    ctaPressureMax: 1,
    commercialPressureMax: 0.32,
    preferredArchetypes: [
      "progressive_checklist",
      "sparse_checklist",
      "stacked_story",
      "split_comparison",
      "layered_framework",
    ],
    relationshipTone: 0.74,
    visualBias: {
      visualIntensity: 0.36,
      density: 0.42,
      trustMode: "supportive",
    },
    whitespaceFloor: 0.46,
  },
  trust: {
    stage: "Trust",
    minSlides: 4,
    maxSlides: 10,
    densityTarget: 0.66,
    readabilityTarget: 0.68,
    ctaPressureMax: 2,
    commercialPressureMax: 0.46,
    preferredArchetypes: [
      "before_after",
      "split_comparison",
      "stacked_story",
      "layered_framework",
      "emotional_quote",
    ],
    relationshipTone: 0.65,
    visualBias: {
      visualIntensity: 0.46,
      density: 0.52,
      trustMode: "neutral",
    },
    whitespaceFloor: 0.4,
  },
  "lead capture": {
    stage: "Lead Capture",
    minSlides: 4,
    maxSlides: 10,
    densityTarget: 0.55,
    readabilityTarget: 0.66,
    ctaPressureMax: 2,
    commercialPressureMax: 0.58,
    preferredArchetypes: [
      "stacked_story",
      "progressive_checklist",
      "layered_framework",
      "centered_hook",
      "sparse_checklist",
    ],
    relationshipTone: 0.52,
    visualBias: {
      visualIntensity: 0.5,
      density: 0.56,
      trustMode: "directive",
    },
    whitespaceFloor: 0.36,
  },
  monetization: {
    stage: "Monetization",
    minSlides: 3,
    maxSlides: 8,
    densityTarget: 0.54,
    readabilityTarget: 0.62,
    ctaPressureMax: 3,
    commercialPressureMax: 0.68,
    preferredArchetypes: [
      "layered_framework",
      "before_after",
      "split_comparison",
      "sparse_checklist",
      "centered_hook",
    ],
    relationshipTone: 0.48,
    visualBias: {
      visualIntensity: 0.56,
      density: 0.6,
      trustMode: "directive",
    },
    whitespaceFloor: 0.31,
  },
  default: {
    stage: "General",
    minSlides: 3,
    maxSlides: 8,
    densityTarget: 0.6,
    readabilityTarget: 0.65,
    ctaPressureMax: 1,
    commercialPressureMax: 0.4,
    preferredArchetypes: [
      "centered_hook",
      "progressive_checklist",
      "sparse_checklist",
      "layered_framework",
      "stacked_story",
    ],
    relationshipTone: 0.6,
    visualBias: {
      visualIntensity: 0.4,
      density: 0.46,
      trustMode: "supportive",
    },
    whitespaceFloor: 0.42,
  },
};

const LAYOUT_ARCHETYPE_REGISTRY: Record<RenderLayoutArchetype, RegisteredArchetype> = {
  sparse_checklist: {
    id: "sparse_checklist",
    description: "single focused list emphasis with calm breathing room",
    rhythmBias: 0.35,
    spacingBias: 0.56,
    defaultDensity: 0.34,
    minimumHeadlineWords: 2,
  },
  progressive_checklist: {
    id: "progressive_checklist",
    description: "stepwise progression with continuity cues and low cognitive load",
    rhythmBias: 0.48,
    spacingBias: 0.52,
    defaultDensity: 0.42,
    minimumHeadlineWords: 2,
  },
  split_comparison: {
    id: "split_comparison",
    description: "before / after framing for emotional contrast",
    rhythmBias: 0.6,
    spacingBias: 0.46,
    defaultDensity: 0.46,
    minimumHeadlineWords: 3,
  },
  stacked_story: {
    id: "stacked_story",
    description: "ordered sequence with evidence-first rhythm",
    rhythmBias: 0.43,
    spacingBias: 0.48,
    defaultDensity: 0.4,
    minimumHeadlineWords: 2,
  },
  emotional_quote: {
    id: "emotional_quote",
    description: "single emotional focal point with deliberate emphasis",
    rhythmBias: 0.31,
    spacingBias: 0.6,
    defaultDensity: 0.3,
    minimumHeadlineWords: 2,
  },
  centered_hook: {
    id: "centered_hook",
    description: "opening anchor with high contrast claim hierarchy",
    rhythmBias: 0.28,
    spacingBias: 0.64,
    defaultDensity: 0.28,
    minimumHeadlineWords: 2,
  },
  before_after: {
    id: "before_after",
    description: "ordered contrast structure with decision clarity",
    rhythmBias: 0.56,
    spacingBias: 0.47,
    defaultDensity: 0.45,
    minimumHeadlineWords: 2,
  },
  layered_framework: {
    id: "layered_framework",
    description: "stable instructional frame with deterministic rhythm",
    rhythmBias: 0.39,
    spacingBias: 0.5,
    defaultDensity: 0.52,
    minimumHeadlineWords: 2,
  },
};

const CONTENT_TO_LAYOUT: Record<RenderContentArchetype, RenderLayoutArchetype> = {
  hook_headline: "centered_hook",
  pain_problem: "sparse_checklist",
  insight_reframe: "layered_framework",
  checklist_steps: "progressive_checklist",
  comparison_before_after: "before_after",
  quote_affirmation: "emotional_quote",
  example_scenario: "stacked_story",
  cta_next_step: "layered_framework",
};

const STAGE_TONE_SET: Record<string, string[]> = {
  trust: ["trust", "steady", "calm", "consistent", "next", "safe", "care"],
  "lead capture": ["step", "start", "guide", "offer", "next", "supportive"],
  relief: ["relief", "gentle", "simple", "repeat", "today", "calm", "pause"],
  monetization: ["result", "outcome", "enough", "decision", "next", "guide", "offer"],
  resonance: ["permission", "warm", "you", "safe", "valid", "welcome"],
  default: ["steady", "today", "next", "save", "repeat", "practical", "clear"],
};

function clamp01(input: number): number {
  if (!Number.isFinite(input)) {
    return 0;
  }
  return Math.max(0, Math.min(1, input));
}

function normalizeWord(input: string): string {
  return input.toLowerCase().trim();
}

function splitWords(input: string): string[] {
  return normalizeWord(input)
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function chunkWords(input: string, maxWords: number): string[] {
  const words = splitWords(input);
  const limit = Math.max(4, Math.round(maxWords));
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  for (let index = 0; index < words.length; index += limit) {
    lines.push(words.slice(index, index + limit).join(" "));
  }
  return lines;
}

function deterministicIntHash(input: unknown): number {
  const text = JSON.stringify(input);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash);
}

function deterministicTimestamp(seed: string): string {
  const base = new Date("2026-01-01T00:00:00.000Z").getTime();
  const delta = deterministicIntHash(seed) % (24 * 60 * 60 * 1000);
  return new Date(base + delta).toISOString();
}

function stageKeyFromInput(stage: string): string {
  const normalized = normalizeWord(stage);
  if (normalized.includes("lead")) return "lead capture";
  if (normalized.includes("monet")) return "monetization";
  if (normalized.includes("trust")) return "trust";
  if (normalized.includes("relief")) return "relief";
  if (normalized.includes("resonance")) return "resonance";
  return "default";
}

function ensureMinimumSlides(
  slides: RenderInputSlide[],
  stage: string,
  minimum: number,
  maximum: number,
): RenderInputSlide[] {
  const fallbackArchetypes: RenderContentArchetype[] = [
    "insight_reframe",
    "example_scenario",
    "cta_next_step",
    "comparison_before_after",
    "quote_affirmation",
    "pain_problem",
  ];
  const fallbackBase = [
    "Keep the rhythm calm and measurable.",
    "One practical step next: repeat only the same cue.",
    "Pause once, then continue only one choice at a time.",
    "Capture results in a short note before shifting stages.",
    "Invite action only when the audience is ready.",
  ];
  const copy = [...slides];
  const target = Math.max(minimum, Math.min(maximum, copy.length));
  let index = 0;
  while (copy.length < target) {
    const stageKey = stageKeyFromInput(stage);
    copy.push({
      slide_index: copy.length + 1,
      content_archetype: fallbackArchetypes[index % fallbackArchetypes.length],
      headline: stageKey.includes("trust") ? "Trust through quieter pacing" : "Next steady step",
      body: fallbackBase[index % fallbackBase.length],
      cta_text: stageKey.includes("lead") ? "Comment START" : undefined,
      cta_position: stageKey.includes("lead") ? "final" : "none",
      tone_tags: ["fallback", stageKey],
    });
    index += 1;
  }
  return copy.slice(0, maximum);
}

function normalizeInput(contract: RenderInputContract): {
  contract: RenderInputContract;
  tokens: DesignTokenProfile;
  constraints: RenderFormatConstraints;
  visual: RenderVisualState;
  stageKey: string;
  policy: StagePolicy;
} {
  const parsed = RenderInputContractSchema.parse(contract);
  const stageKey = stageKeyFromInput(parsed.journey_stage);
  const policy = STAGE_POLICY[stageKey] ?? STAGE_POLICY.default;

  const tokens = DesignTokenProfileSchema.parse(parsed.design_tokens_profile);
  const constraints = RenderFormatConstraintsSchema.parse(parsed.format_constraints);
  const visual = RenderVisualStateSchema.parse({
    ...parsed.visual_state,
    visual_intensity: clamp01(parsed.visual_state.visual_intensity ?? policy.visualBias.visualIntensity),
    density_profile: clamp01(parsed.visual_state.density_profile ?? policy.visualBias.density),
    trust_visual_mode: parsed.visual_state.trust_visual_mode ?? policy.visualBias.trustMode,
    motion_expectation: parsed.visual_state.motion_expectation ?? "none",
  });

  const normalizedSlides: RenderInputSlide[] = parsed.slides
    .map((slide, index) => ({
      ...slide,
      slide_index: index + 1,
      headline: slide.headline.trim(),
      body: slide.body.trim(),
      micro_copy: slide.micro_copy?.trim(),
      cta_text: slide.cta_text?.trim(),
      tone_tags: [...new Set((slide.tone_tags ?? []).map((tag) => normalizeWord(tag)).filter(Boolean))],
      cta_position: slide.cta_position ?? "none",
      content_archetype: RenderContentArchetypeSchema.parse(slide.content_archetype),
    }))
    .filter((row) => row.headline.length > 0 && row.body.length > 0);

  const requiredMin = Math.max(constraints.min_slide_count, policy.minSlides);
  const requiredMax = Math.min(constraints.max_slide_count, policy.maxSlides);
  const safeSlides = ensureMinimumSlides(normalizedSlides, parsed.journey_stage, requiredMin, requiredMax);

  const canonical = {
    ...parsed,
    visual_state: {
      ...visual,
      cognitive_load_target: Math.max(1, Math.min(10, Math.round(visual.cognitive_load_target))),
    },
    design_tokens_profile: tokens,
    format_constraints: {
      ...constraints,
      max_slide_count: requiredMax,
      min_slide_count: requiredMin,
    },
    slides: safeSlides,
    cta_policy: CtaPolicySchema.parse(parsed.cta_policy),
  };

  return { contract: canonical, tokens, constraints: canonical.format_constraints, visual: canonical.visual_state, stageKey, policy };
}

function chooseArchetypeSequence(
  slides: RenderInputSlide[],
  policy: StagePolicy,
  explicitSwap?: RenderLayoutArchetype[],
): RenderLayoutArchetype[] {
  const derived = slides.map((slide, index) => {
    if (index === 0 && slide.content_archetype === "hook_headline") {
      return "centered_hook";
    }
    return (
      CONTENT_TO_LAYOUT[slide.content_archetype]
      ?? policy.preferredArchetypes[index % policy.preferredArchetypes.length]
    );
  });

  if (!explicitSwap || explicitSwap.length === 0) {
    return derived;
  }

  const filtered = explicitSwap.filter((item): item is RenderLayoutArchetype => item in LAYOUT_ARCHETYPE_REGISTRY);
  if (filtered.length === 0) {
    return derived;
  }
  if (filtered.length >= derived.length) {
    return filtered.slice(0, derived.length);
  }

  return derived.map((item, index) => filtered[index % filtered.length]);
}

function applyEditTemplates(input: RenderInputContract, profile: RenderEditProfile | undefined): {
  slides: RenderInputSlide[];
  archetypeSequence: RenderLayoutArchetype[];
  tokens: DesignTokenProfile;
  lineLimitOverrides: Map<number, number>;
  hierarchyAdjustments: Map<number, { role: "headline" | "support" | "micro"; multiplier: number }[]>;
} {
  const parsed = RenderInputContractSchema.parse(input);
  const policy = STAGE_POLICY[stageKeyFromInput(parsed.journey_stage)] ?? STAGE_POLICY.default;
  const archetypeSequence = [...chooseArchetypeSequence(parsed.slides, policy)];
  const tokens = {
    ...DesignTokenProfileSchema.parse(parsed.design_tokens_profile),
    hierarchy_weights: { ...DesignTokenProfileSchema.parse(parsed.design_tokens_profile).hierarchy_weights },
    spacing_scale: { ...DesignTokenProfileSchema.parse(parsed.design_tokens_profile).spacing_scale },
    container_padding_rules: { ...DesignTokenProfileSchema.parse(parsed.design_tokens_profile).container_padding_rules },
  } as DesignTokenProfile;

  const lineLimitOverrides = new Map<number, number>();
  const hierarchyAdjustments = new Map<number, { role: "headline" | "support" | "micro"; multiplier: number }[]>();

  if (!profile?.edits?.length) {
    return {
      slides: parsed.slides.map((slide) => ({ ...slide })),
      archetypeSequence,
      tokens,
      lineLimitOverrides,
      hierarchyAdjustments,
    };
  }

  for (const edit of profile.edits) {
    const action = RenderEditActionSchema.parse(edit.op);
    if (action === "swap_template") {
      if (edit.op !== "swap_template") {
        continue;
      }
      const safe = edit.template_archetypes.filter((row): row is RenderLayoutArchetype => row in LAYOUT_ARCHETYPE_REGISTRY);
      const sequence = chooseArchetypeSequence(parsed.slides, policy, safe);
      if (sequence.length > 0) {
        archetypeSequence.splice(0, archetypeSequence.length, ...sequence);
      }
      continue;
    }

    if (action === "change_layout_variant") {
      if (edit.op !== "change_layout_variant") {
        continue;
      }
      if (edit.slide_index > 0 && edit.slide_index <= parsed.slides.length) {
        if (edit.layout_archetype_id in LAYOUT_ARCHETYPE_REGISTRY) {
          archetypeSequence[edit.slide_index - 1] = edit.layout_archetype_id;
        }
      }
      continue;
    }

    if (action === "reflow_content") {
      if (edit.op !== "reflow_content") {
        continue;
      }
      if (edit.slide_index > 0 && edit.slide_index <= parsed.slides.length) {
        const override = Math.max(4, Math.min(14, Math.round(edit.line_limit_override)));
        lineLimitOverrides.set(edit.slide_index, override);
      }
      continue;
    }

    if (action === "adjust_spacing_density") {
      if (edit.op !== "adjust_spacing_density") {
        continue;
      }
      const densityDelta = clamp01(edit.density_delta / 10);
      const slideScale = edit.slide_index ? edit.density_delta / 12 : 0;
      tokens.spacing_scale.section_gap = clamp01(tokens.spacing_scale.section_gap + densityDelta * -0.12 + slideScale * 0.05);
      tokens.spacing_scale.content_gap = clamp01(tokens.spacing_scale.content_gap + densityDelta * -0.11 + slideScale * 0.05);
      tokens.whitespace_bias = clamp01(tokens.whitespace_bias + (edit.density_delta > 0 ? -densityDelta : densityDelta));
      continue;
    }

    if (action === "adjust_text_hierarchy") {
      if (edit.op !== "adjust_text_hierarchy") {
        continue;
      }
      const index = edit.slide_index;
      if (index > 0 && index <= parsed.slides.length) {
        const next = hierarchyAdjustments.get(index) ?? [];
        next.push({ role: edit.role, multiplier: clamp01(1 + clamp01(edit.delta / 5)) });
        hierarchyAdjustments.set(index, next);
      }
    }
  }

  RenderQABlockConditionSchema.array().parse([]);
  return {
    slides: parsed.slides.map((slide) => ({ ...slide })),
    archetypeSequence,
    tokens,
    lineLimitOverrides,
    hierarchyAdjustments,
  };
}

function buildRenderedSlides(
  slides: RenderInputSlide[],
  constraints: RenderFormatConstraints,
  tokens: DesignTokenProfile,
  visual: RenderVisualState,
  archetypeSequence: RenderLayoutArchetype[],
  lineLimitOverrides: Map<number, number>,
  hierarchyAdjustments: Map<number, { role: "headline" | "support" | "micro"; multiplier: number }[]>,
): RenderedSlide[] {
  return slides.map((row, index) => {
    const layout = archetypeSequence[index % archetypeSequence.length] ?? "centered_hook";
    const registry = LAYOUT_ARCHETYPE_REGISTRY[layout];
    const content = `${row.headline} ${row.body}${row.micro_copy ? ` ${row.micro_copy}` : ""}`;
    const overrideLimit = lineLimitOverrides.get(row.slide_index);
    const baseLimit = Math.max(4, constraints.max_word_per_line);
    const visualDensity = constraints.max_word_per_line * clamp01(1 - (visual.visual_intensity * 0.2) + registry.defaultDensity * 0.1);
    const lineLimit = Math.max(4, overrideLimit ?? Math.round(baseLimit * visualDensity / Math.max(1, baseLimit)));
    const lines = chunkWords(content, Math.max(4, lineLimit));
    const hierarchy = hierarchyAdjustments.get(row.slide_index) ?? [];

    const headingDelta = hierarchy
      .filter((item) => item.role === "headline")
      .reduce((sum, item) => sum + (item.multiplier - 1), 0);
    const supportDelta = hierarchy
      .filter((item) => item.role === "support")
      .reduce((sum, item) => sum + (item.multiplier - 1), 0);
    const microDelta = hierarchy
      .filter((item) => item.role === "micro")
      .reduce((sum, item) => sum + (item.multiplier - 1), 0);

  const hierarchyWeights = {
      heading: clamp01(tokens.hierarchy_weights.heading + registry.rhythmBias * 0.05 + headingDelta * 0.12),
      support: clamp01(tokens.hierarchy_weights.support + supportDelta * 0.12 - visual.density_profile * 0.1),
      micro: clamp01(tokens.hierarchy_weights.micro + microDelta * 0.12 - visual.cognitive_load_target / 20),
    };

    const normalizedHeading = Math.max(0.01, hierarchyWeights.heading);
    const normalizedSupport = Math.max(0.01, hierarchyWeights.support);
    const normalizedMicro = Math.max(0.01, hierarchyWeights.micro);
    const totalWeight = normalizedHeading + normalizedSupport + normalizedMicro;
    const normalized: RenderedSlide["hierarchy_weights"] = {
      heading: normalizedHeading / totalWeight,
      support: normalizedSupport / totalWeight,
      micro: normalizedMicro / totalWeight,
    };

    const spacing = clamp01(
      tokens.whitespace_bias
      + registry.spacingBias * 0.1
      + tokens.container_padding_rules.normal * 0.15
      + (1 - visual.visual_intensity) * 0.08
      - visual.density_profile * 0.06
      - clamp01(registry.rhythmBias * 0.05),
    );

    return {
      slide_index: row.slide_index,
      content_archetype: row.content_archetype,
      layout_archetype: layout,
      lines,
      headline: row.headline,
      copy_words: splitWords(content).length,
      hierarchy_weights: normalized,
      spacing_bias: spacing,
      cta_slot: row.cta_position ?? "none",
    };
  });
}

function computeToneMatch(tokensForLine: string[], stageKey: string): number {
  const tokensSet = STAGE_TONE_SET[stageKey] ?? STAGE_TONE_SET.default;
  let hits = 0;
  for (const token of tokensForLine) {
    if (tokensSet.includes(normalizeWord(token))) {
      hits += 1;
    }
  }
  return hits / Math.max(1, tokensForLine.length);
}

function evaluateQaFindings(
  rendered: RenderedSlide[],
  contract: RenderInputContract,
  tokens: DesignTokenProfile,
  policy: StagePolicy,
  stageKey: string,
): { status: RenderOutputContract["qa_status"]; findings: RenderQAFinding[]; scores: RenderQAScore } {
  const constraints = contract.format_constraints;
  const visual = contract.visual_state;

  const findings: RenderQAFinding[] = [];
  let hasBlock = false;

  let totalLineOverflowPenalty = 0;
  let totalLineOverage = 0;
  let totalReadability = 0;
  let totalEmotional = 0;
  let totalRelationship = 0;
  let totalCtaAppropriate = 0;
  let totalSaveability = 0;
  let totalMobile = 0;

  const lineLimit = constraints.max_word_per_line;
  const lineOveragePenalty = 1 / Math.max(1, constraints.max_lines_per_slide);

  for (const row of rendered) {
    const overflowLines = row.lines.filter((line) => splitWords(line).length > lineLimit).length;
    const lineCount = row.lines.length;

    if (overflowLines > 0) {
      hasBlock = true;
      findings.push({
        code: "text_overflow",
        severity: "block",
        message: `Slide ${row.slide_index} exceeds line-length budget`,
        score: clamp01(1 - overflowLines / Math.max(1, lineCount)),
      });
    }

    if (lineCount > constraints.max_lines_per_slide) {
      hasBlock = true;
      findings.push({
        code: "mobile_unreadability",
        severity: "block",
        message: `Slide ${row.slide_index} has ${lineCount} lines over the mobile limit`,
        score: clamp01(1 - (lineCount - constraints.max_lines_per_slide) * 0.22),
      });
    }

    const marginDelta = Math.abs(
      (constraints.safe_margins.left + constraints.safe_margins.right) - tokens.safe_zones.horizontal_buffer_ratio,
    );
    const verticalDelta = Math.abs(
      (constraints.safe_margins.top + constraints.safe_margins.bottom) - tokens.safe_zones.vertical_buffer_ratio,
    );
    if (marginDelta > 0.2 || verticalDelta > 0.2) {
      hasBlock = true;
      findings.push({
        code: "unsafe_clipping",
        severity: "block",
        message: `Slide ${row.slide_index} may clip due to safe-zone mismatch`,
        score: clamp01(1 - Math.max(marginDelta, verticalDelta)),
      });
    }

    const hierarchy = row.hierarchy_weights.heading / (row.hierarchy_weights.support + row.hierarchy_weights.micro);
    if (hierarchy < 0.68) {
      findings.push({
        code: "typography_hierarchy_collapse",
        severity: "warn",
        message: `Slide ${row.slide_index} hierarchy is weak relative to support/micro balance`,
        score: clamp01(hierarchy),
      });
    }

    const contrastScore = clamp01(tokens.contrast_policy.minimum_ratio / 10);
    if (contrastScore < 0.45) {
      findings.push({
        code: "contrast_failure",
        severity: "warn",
        message: `Slide ${row.slide_index} contrast ratio is below the trust-readable threshold`,
        score: contrastScore,
      });
    }

    totalReadability += clamp01(1 - overflowLines * 0.35 - Math.max(0, lineCount - constraints.max_lines_per_slide) * 0.1);
    totalLineOverage += overflowLines;
    totalLineOverage += Math.max(0, lineCount - constraints.max_lines_per_slide);
    totalMobile += clamp01(1 - totalLineOverage * lineOveragePenalty);
    totalEmotional += computeToneMatch([...splitWords(row.headline), ...row.lines.flatMap(splitWords)], stageKey);
    totalRelationship += row.content_archetype === "cta_next_step" ? 0.64 : 0.79;
    totalCtaAppropriate += row.cta_slot === "none" ? 1 : 0.66;

    if (row.cta_slot !== "none" && row.copy_words > 0) {
      totalSaveability += 0.62;
    }
  }

  const headlineValues = new Set(rendered.map((row) => normalizeWord(row.headline)));
  const distinctiveness = headlineValues.size / Math.max(1, rendered.length);
  if (distinctiveness < 0.74) {
    findings.push({
      code: "weak_distinctiveness",
      severity: "warn",
      message: "Headline distinctiveness is below the calm scanability floor",
      score: clamp01(distinctiveness),
    });
  }

  const totalWords = rendered.reduce((sum, row) => sum + row.copy_words, 0);
  const uniqueWords = new Set(rendered.flatMap((row) => splitWords(`${row.headline} ${row.lines.join(" ")}`)));
  const densityScore = totalWords > 0 ? clamp01(uniqueWords.size / totalWords) : 0;
  if (densityScore < policy.densityTarget) {
    findings.push({
      code: "excessive_density",
      severity: "warn",
      message: "Density exceeds the trust-calibration floor for a mobile-first lane",
      score: densityScore,
    });
  }

  const ctaCount = rendered.filter((row) => row.cta_slot !== "none" && row.copy_words > 0).length;
  if (ctaCount > policy.ctaPressureMax) {
    hasBlock = true;
    findings.push({
      code: "cta_pressure_too_high",
      severity: "block",
      message: `CTA pressure exceeds stage allowance (${ctaCount} vs ${policy.ctaPressureMax})`,
      score: clamp01(1 - (ctaCount - policy.ctaPressureMax) / Math.max(1, Math.max(policy.ctaPressureMax, 1))),
    });
  }

  const whitespace = rendered.reduce((sum, row) => sum + row.spacing_bias, 0) / Math.max(1, rendered.length);
  if (whitespace < policy.whitespaceFloor) {
    findings.push({
      code: "whitespace_rhythm_failure",
      severity: "warn",
      message: "Whitespace rhythm is too dense for calm readability",
      score: clamp01(whitespace),
    });
  }

  const templateSet = new Set(rendered.map((row) => row.layout_archetype));
  for (const archetype of templateSet) {
    if (!(archetype in LAYOUT_ARCHETYPE_REGISTRY)) {
      hasBlock = true;
      findings.push({
        code: "template_inconsistency",
        severity: "block",
        message: `Unknown archetype in output sequence: ${archetype}`,
        score: 0.05,
      });
    }
  }

  const readability = clamp01(totalReadability / rendered.length);
  const density = clamp01(densityScore);
  const emotionalCoherence = clamp01(totalEmotional / rendered.length);
  const relationshipFit = clamp01(totalRelationship / rendered.length);
  const ctaAppropriateness = clamp01(totalCtaAppropriate / rendered.length);
  const commercialPressure = clamp01(
    1 - (ctaCount / Math.max(1, policy.ctaPressureMax + 1)) * (policy.commercialPressureMax + 0.15),
  );
  const mobileScanability = clamp01(totalMobile / rendered.length);
  const saveability = clamp01(totalSaveability / rendered.length);
  const overall = clamp01(
    (readability + density + emotionalCoherence + relationshipFit + ctaAppropriateness + commercialPressure + mobileScanability + saveability)
      / 8,
  );

  const scores: RenderQAScore = {
    readability: {
      score: readability,
      notes: ["overflow_count", `total_overflow=${totalLineOverage}`, `line_limit=${lineLimit}`],
    },
    density: {
      score: density,
      notes: ["distinctiveness", `headline_unique_ratio=${distinctiveness.toFixed(3)}`],
    },
    emotional_coherence: {
      score: emotionalCoherence,
      notes: ["tone_match", `stage=${policy.stage}`, `tone_score=${totalEmotional.toFixed(3)}`],
    },
    relationship_fit: {
      score: relationshipFit,
      notes: ["trust_progression", `stage=${policy.stage}`],
    },
    cta_appropriateness: {
      score: ctaAppropriateness,
      notes: ["cta_slots", `count=${ctaCount}`, `max=${policy.ctaPressureMax}`],
    },
    commercial_pressure: {
      score: commercialPressure,
      notes: ["visual_state", `intensity=${visual.visual_intensity}`, `policy_limit=${policy.commercialPressureMax}`],
    },
    mobile_scanability: {
      score: mobileScanability,
      notes: ["line_count", `max_lines=${constraints.max_lines_per_slide}`],
    },
    saveability: {
      score: saveability,
      notes: ["cta_clarity", "copy_density", "line_hierarchy"],
    },
    overall: {
      score: overall,
      notes: ["weighted_average", `version=${RE_RENDERING_VERSION}`],
    },
  };

  RenderQAScoreSchema.parse(scores);

  const hasWarn = findings.some((item) => item.severity === "warn");
  const hasBlockFinding = findings.some((item) => item.severity === "block");
  const status = hasBlock || hasBlockFinding || readability < policy.readabilityTarget
    ? "block"
    : hasWarn
      ? "warn"
      : "pass";
  const ordered = findings
    .map((item) => ({ ...item }))
    .sort((left, right) => left.code.localeCompare(right.code) || left.severity.localeCompare(right.severity));

  return { status: status as RenderOutputContract["qa_status"], findings: ordered, scores };
}

function buildSignature(lines: RenderedSlide[], contract: RenderInputContract): string {
  const payload = {
    version: RE_RENDERING_VERSION,
    stage: stageKeyFromInput(contract.journey_stage),
    constraints: {
      width: contract.format_constraints.max_word_per_line,
      lines: contract.format_constraints.max_lines_per_slide,
      ratio: contract.format_constraints.aspect_ratio,
      min: contract.format_constraints.min_slide_count,
      max: contract.format_constraints.max_slide_count,
    },
    visual: {
      intensity: contract.visual_state.visual_intensity,
      density: contract.visual_state.density_profile,
      trustMode: contract.visual_state.trust_visual_mode,
      cognitiveLoad: contract.visual_state.cognitive_load_target,
      motion: contract.visual_state.motion_expectation,
    },
    tokens: contract.design_tokens_profile.profile_id,
    slides: lines.map((row) => ({
      i: row.slide_index,
      h: row.headline,
      c: row.content_archetype,
      l: row.layout_archetype,
      w: row.copy_words,
    })),
  };

  return toReplayId("sig", JSON.stringify(payload).replace(/[^a-z0-9]/gi, "_").slice(0, 100));
}

function renderIdForInput(contract: RenderInputContract, signature: string, stageKey: string, archetypes: RenderLayoutArchetype[]): string {
  return toReplayId("render", contract.backlog_item_id, stageKey, String(archetypes.length), signature);
}

export function generateRenderOutput(contract: RenderInputContract): RenderOutputContract {
  const normalized = normalizeInput(contract);
  const edits = applyEditTemplates(normalized.contract, undefined);
  const archetypes = chooseArchetypeSequence(edits.slides, normalized.policy, edits.archetypeSequence);
  const renderedSlides = buildRenderedSlides(
    edits.slides,
    normalized.constraints,
    edits.tokens,
    normalized.visual,
    archetypes,
    edits.lineLimitOverrides,
    edits.hierarchyAdjustments,
  );
  const signature = buildSignature(renderedSlides, normalized.contract);
  const renderId = renderIdForInput(normalized.contract, signature, normalized.stageKey, archetypes);
  const qa = evaluateQaFindings(renderedSlides, normalized.contract, edits.tokens, normalized.policy, normalized.stageKey);
  const assetCount = renderedSlides.length;

  return RenderOutputContractSchema.parse({
    render_id: renderId,
    asset_urls: [...Array(assetCount)].map((_, index) => `asset://render/${renderId}/${index + 1}`),
    template_id: toReplayId("template", normalized.stageKey, signature),
    archetype_sequence: archetypes,
    slide_count: assetCount,
    qa_status: qa.status,
    qa_findings: qa.findings,
    approval_state: qa.status === "pass" ? "auto_approved" : qa.status === "warn" ? "human_review_required" : "blocked",
    render_version: RE_RENDERING_VERSION,
    render_proof_id: toReplayId("proof", renderId),
    applied_visual_state: normalized.visual,
    applied_token_profile: edits.tokens,
    qa_scores: qa.scores,
    rendered_slides: renderedSlides,
    output_constraints: normalized.constraints,
    generated_at: deterministicTimestamp(renderId),
  });
}

export function applyBoundedRenderEdits(
  contract: RenderInputContract,
  profile: RenderEditProfile,
): RenderOutputContract {
  const normalized = normalizeInput(contract);
  const edits = applyEditTemplates(normalized.contract, profile);
  const archetypes = chooseArchetypeSequence(normalized.contract.slides, normalized.policy, edits.archetypeSequence);
  const renderedSlides = buildRenderedSlides(
    edits.slides,
    normalized.constraints,
    edits.tokens,
    normalized.visual,
    archetypes,
    edits.lineLimitOverrides,
    edits.hierarchyAdjustments,
  );
  const signature = buildSignature(renderedSlides, { ...normalized.contract, design_tokens_profile: edits.tokens });
  const renderId = renderIdForInput(normalized.contract, signature, normalized.stageKey, archetypes);
  const qa = evaluateQaFindings(renderedSlides, normalized.contract, edits.tokens, normalized.policy, normalized.stageKey);

  const extraInfo: RenderQAFinding = {
    code: "template_inconsistency",
    severity: profile.edits.length > 0 ? "info" : "info",
    message: "Preview correction layer applied with bounded operators.",
    score: 0.9,
  };

  return RenderOutputContractSchema.parse({
    render_id: renderId,
    asset_urls: [...Array(renderedSlides.length)].map((_, index) => `asset://render/${renderId}/${index + 1}`),
    template_id: toReplayId("template", normalized.stageKey, signature, "preview"),
    archetype_sequence: archetypes,
    slide_count: renderedSlides.length,
    qa_status: qa.status,
    qa_findings: [...qa.findings, extraInfo],
    approval_state: qa.status === "block" ? "blocked" : "human_review_required",
    render_version: RE_RENDERING_VERSION,
    render_proof_id: toReplayId("proof", renderId),
    applied_visual_state: normalized.visual,
    applied_token_profile: edits.tokens,
    qa_scores: qa.scores,
    rendered_slides: renderedSlides,
    output_constraints: normalized.constraints,
    generated_at: deterministicTimestamp(renderId),
  });
}

export function buildRenderExportManifest(output: RenderOutputContract): RenderExportManifest {
  return {
    render_id: output.render_id,
    export_id: toReplayId("render-export", output.render_id),
    render_version: output.render_version,
    manifest_version: "v1.0",
    file_count: output.asset_urls.length,
    file_urls: output.asset_urls,
    replay_references: [output.render_id, output.render_proof_id, output.template_id],
    exported_at: deterministicTimestamp(`${output.render_id}${output.render_proof_id}`),
  };
}

export function listLayoutArchetypes(): RenderLayoutArchetype[] {
  return Object.keys(LAYOUT_ARCHETYPE_REGISTRY).sort() as RenderLayoutArchetype[];
}

export function listContentArchetypes(): RenderContentArchetype[] {
  return [
    "hook_headline",
    "pain_problem",
    "insight_reframe",
    "checklist_steps",
    "comparison_before_after",
    "quote_affirmation",
    "example_scenario",
    "cta_next_step",
  ];
}

export function adaptLegacyRenderInput(input: RenderCarouselRequest): RenderInputContract {
  const parsed = RenderCarouselRequestSchema.parse(input);
  const stage = parsed.relationship_objective;
  const stageKey = stageKeyFromInput(stage);
  const parsedCaption = parsed.caption
    .split(/[.!?]/)
    .map((row) => row.trim())
    .filter(Boolean)
    .filter((row) => row.length >= 6);

  const baselineSlides: RenderInputSlide[] = [
    {
      slide_index: 1,
      content_archetype: "hook_headline",
      headline: parsed.hook,
      body: parsed.hook,
      cta_text: undefined,
      cta_position: "none",
      tone_tags: ["hook", "entry"],
    },
  ];

  const mappedSlides = parsedCaption.slice(0, 4).map((value, index) => ({
    slide_index: index + 2,
    content_archetype: index % 2 === 0 ? "pain_problem" : "insight_reframe",
    headline: `${parsed.journey_stage_label} focus ${index + 1}`,
    body: value,
    cta_text: undefined,
    cta_position: "none" as const,
    tone_tags: ["legacy", "migration"],
  }));

  const fallbackSlide: RenderInputSlide = {
    slide_index: baselineSlides.length + mappedSlides.length + 1,
    content_archetype: "example_scenario",
    headline: stageKey.includes("trust") ? "Trust grows on rhythm" : "Start with one clear next step",
    body: "Use one cue, keep it simple, then pause before introducing the next one.",
    cta_text: undefined,
    cta_position: stageKey.includes("lead") ? "final" : "none",
    tone_tags: ["fallback", stageKey],
  };

  const seedSlides = [...baselineSlides, ...mappedSlides];
  if (seedSlides.length < 3) {
    seedSlides.push(fallbackSlide);
  }

  return RenderInputContractSchema.parse({
    asset_type: "carousel",
    campaign_id: parsed.campaign_id,
    campaign_theme_id: parsed.campaign_theme_id,
    backlog_item_id: parsed.backlog_item_id,
    brand_identity_id: "legacy-brand",
    content_policy_id: "legacy-policy",
    journey_stage: parsed.relationship_objective,
    slides: seedSlides,
    cta_policy: stageKey === "lead capture" ? "soft_lead" : parsed.cta_policy,
    visual_direction: parsed.suggested_visual_direction,
    format_constraints: {
      aspect_ratio: "4:5",
      max_word_per_line: 7,
      max_lines_per_slide: 6,
      min_slide_count: 3,
      max_slide_count: 10,
      safe_margins: {
        top: 0.08,
        right: 0.06,
        bottom: 0.08,
        left: 0.06,
      },
    },
    visual_state: {
      visual_intensity: stageKey === "trust" ? 0.46 : 0.42,
      density_profile: stageKey === "monetization" ? 0.58 : 0.42,
      emotional_temperature: stageKey === "relief" ? 0.62 : 0.49,
      cognitive_load_target: 5,
      trust_visual_mode: stageKey === "monetization" ? "directive" : "supportive",
      motion_expectation: "none",
    },
    design_tokens_profile: {
      profile_id: "legacy-bridge-v1",
      whitespace_bias: 0.58,
      spacing_scale: {
        section_gap: 0.24,
        content_gap: 0.19,
        element_gap: 0.1,
        rhythm_step: 0.08,
      },
      typography_hierarchy: {
        heading_scale: 1,
        support_scale: 0.84,
        micro_scale: 0.67,
        line_height: 1.34,
      },
      safe_zones: {
        horizontal_buffer_ratio: 0.08,
        vertical_buffer_ratio: 0.09,
      },
      contrast_policy: {
        minimum_ratio: 4.5,
        heading_boost_ratio: 7,
        body_ratio: 4.8,
      },
      hierarchy_weights: {
        heading: 0.48,
        support: 0.34,
        micro: 0.18,
      },
      container_padding_rules: {
        compact: 0.05,
        normal: 0.08,
        generous: 0.11,
      },
      emphasis_color_policy: {
        primary_alpha: 0.82,
        support_alpha: 0.58,
        cta_alpha: 0.72,
      },
    },
  });
}
