import { toReplayId } from "@ifos/shared-utils";
import {
  CtaPolicySchema,
  RenderCarouselRequest,
  RenderCarouselRequestSchema,
  RenderCarouselTemplate,
  RenderCarouselTemplateSchema,
  RenderGenerationResult,
  RenderQAScore,
  RenderValidationSummary,
  RenderSlide,
} from "@ifos/contracts";
import type { RenderBlockReason, RenderSlideIntent } from "@ifos/contracts";

type StagePolicy = {
  stage_label: string;
  maxHookWords: number;
  maxSlideWords: number;
  recommendedWordsPerSlide: number;
  densityTarget: number;
  readabilityThreshold: number;
  relationshipFitThreshold: number;
  emotionalThreshold: number;
  ctaPressureThreshold: number;
  commercialPressureThreshold: number;
  maxCtaCount: number;
  allowedCtas: ReadonlyArray<string>;
  continuitySignals: ReadonlyArray<string>;
  visualTone: string;
  visualPacingProfile: number;
  mobileConstraints: {
    maxWordPerLine: number;
    maxLinesPerSlide: number;
    maxSlideWordCount: number;
  };
};

type SlideIntent = RenderSlideIntent;

const STAGE_POLICIES: Record<string, StagePolicy> = {
  resonance: {
    stage_label: "Resonance",
    maxHookWords: 10,
    maxSlideWords: 18,
    recommendedWordsPerSlide: 12,
    densityTarget: 0.62,
    readabilityThreshold: 0.84,
    relationshipFitThreshold: 0.94,
    emotionalThreshold: 0.78,
    ctaPressureThreshold: 0.12,
    commercialPressureThreshold: 0.04,
    maxCtaCount: 1,
    allowedCtas: ["none"],
    continuitySignals: ["presence", "safe", "permission", "slow", "support"],
    visualTone: "high whitespace with soft framing",
    visualPacingProfile: 0.27,
    mobileConstraints: {
      maxWordPerLine: 6,
      maxLinesPerSlide: 5,
      maxSlideWordCount: 16,
    },
  },
  relief: {
    stage_label: "Relief",
    maxHookWords: 13,
    maxSlideWords: 22,
    recommendedWordsPerSlide: 18,
    densityTarget: 0.6,
    readabilityThreshold: 0.76,
    relationshipFitThreshold: 0.78,
    emotionalThreshold: 0.45,
    ctaPressureThreshold: 0.35,
    commercialPressureThreshold: 0.12,
    maxCtaCount: 3,
    allowedCtas: ["none", "save", "follow", "story"],
    continuitySignals: ["small", "quick", "repeat", "tonight", "simple"],
    visualTone: "clean checklist layout with generous whitespace",
    visualPacingProfile: 0.44,
    mobileConstraints: {
      maxWordPerLine: 7,
      maxLinesPerSlide: 6,
      maxSlideWordCount: 24,
    },
  },
  trust: {
    stage_label: "Trust",
    maxHookWords: 16,
    maxSlideWords: 24,
    recommendedWordsPerSlide: 18,
    densityTarget: 0.72,
    readabilityThreshold: 0.72,
    relationshipFitThreshold: 0.82,
    emotionalThreshold: 0.62,
    ctaPressureThreshold: 0.45,
    commercialPressureThreshold: 0.12,
    maxCtaCount: 4,
    allowedCtas: ["none", "save", "follow", "story"],
    continuitySignals: ["consistency", "proof", "repeat", "routine", "results"],
    visualTone: "evidence-first proof sequence with soft graph language",
    visualPacingProfile: 0.52,
    mobileConstraints: {
      maxWordPerLine: 7,
      maxLinesPerSlide: 6,
      maxSlideWordCount: 26,
    },
  },
  lead_capture: {
    stage_label: "Lead Capture",
    maxHookWords: 16,
    maxSlideWords: 26,
    recommendedWordsPerSlide: 20,
    densityTarget: 0.64,
    readabilityThreshold: 0.7,
    relationshipFitThreshold: 0.82,
    emotionalThreshold: 0.62,
    ctaPressureThreshold: 0.55,
    commercialPressureThreshold: 0.24,
    maxCtaCount: 2,
    allowedCtas: ["none", "soft_lead", "story", "follow"],
    continuitySignals: ["guide", "download", "quietly", "optional", "value-first"],
    visualTone: "soft offer framing with restrained CTA emphasis",
    visualPacingProfile: 0.36,
    mobileConstraints: {
      maxWordPerLine: 8,
      maxLinesPerSlide: 6,
      maxSlideWordCount: 28,
    },
  },
  default: {
    stage_label: "General",
    maxHookWords: 16,
    maxSlideWords: 26,
    recommendedWordsPerSlide: 18,
    densityTarget: 0.66,
    readabilityThreshold: 0.7,
    relationshipFitThreshold: 0.7,
    emotionalThreshold: 0.6,
    ctaPressureThreshold: 0.5,
    commercialPressureThreshold: 0.3,
    maxCtaCount: 3,
    allowedCtas: ["none", "save", "follow", "story", "soft_lead", "checkout"],
    continuitySignals: ["next", "continue", "steady"],
    visualTone: "balanced instructional structure",
    visualPacingProfile: 0.4,
    mobileConstraints: {
      maxWordPerLine: 8,
      maxLinesPerSlide: 6,
      maxSlideWordCount: 28,
    },
  },
};

const STAGE_ORDER: Record<string, string> = {
  resonance: "resonance",
  relief: "relief",
  trust: "trust",
  "lead capture": "lead_capture",
};

const CCA_RULES: Record<string, number> = {
  none: 0,
  save: 0.18,
  follow: 0.2,
  story: 0.22,
  soft_lead: 0.32,
  checkout: 0.7,
};

function clamp(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Number(value.toFixed(6))));
}

function splitWords(input: string): string[] {
  return input.toLowerCase().split(/\s+/).map((value) => value.trim()).filter(Boolean);
}

function sentenceWords(input: string): string[] {
  return splitWords(input).filter((word) => word.length > 0);
}

function wordCount(input: string): number {
  return sentenceWords(input).length;
}

function chunkIntoLines(input: string, maxWords: number): string[] {
  const words = sentenceWords(input);
  const lines: string[] = [];

  if (words.length === 0) {
    return [""];
  }

  for (let index = 0; index < words.length; index += maxWords) {
    lines.push(words.slice(index, index + maxWords).join(" "));
  }

  return lines.length ? lines : [""];
}

function toCanonicalStage(stageLabel: string): string {
  const lowered = stageLabel.toLowerCase().trim();
  for (const [key, value] of Object.entries(STAGE_ORDER)) {
    if (lowered.includes(key)) {
      return value;
    }
  }
  return "default";
}

function normalizeCta(input: string): string {
  return CtaPolicySchema.parse(input);
}

function normalizeTone(input: string): string {
  return input.toLowerCase().trim();
}

function buildCopyHierarchy(headline: string, support: string, micro?: string) {
  return {
    headline,
    support_copy: support,
    ...(micro ? { micro_copy: micro } : {}),
  };
}

function deriveSlideMetadata(
  intent: SlideIntent,
  words: number,
  policy: StagePolicy,
  support: string,
  ctaSlot: RenderSlide["cta_position"],
): Pick<
  RenderSlide,
  "visual_complexity" | "cta_slot" | "whitespace_bias" | "slide_energy" | "continuity_weight" | "visual_pacing"
> {
  const visualComplexity = clamp(words / policy.maxSlideWords);
  const whitespaceBias = clamp(1 - visualComplexity + (policy.maxSlideWords - policy.recommendedWordsPerSlide) / 200);
  const hasCta = ctaSlot !== "none";

  const intentEnergyMap: Record<string, number> = {
    hook: 0.8,
    validation: 0.4,
    utility_step: 0.55,
    proof: 0.5,
    continuity: 0.42,
    soft_invite: 0.48,
    lead_collect: 0.5,
    resource_offer: 0.35,
    summary: 0.28,
  };
  const intentContinuityMap: Record<string, number> = {
    hook: 0.22,
    validation: 0.33,
    utility_step: 0.45,
    proof: 0.4,
    continuity: 0.92,
    soft_invite: 0.75,
    lead_collect: 0.7,
    resource_offer: 0.67,
    summary: 0.88,
  };

  const supportHint = normalizeTone(support);
  const supportBoost = supportHint.includes("continuity") ? 0.08 : supportHint.includes("emotional") ? 0.04 : 0;
  const ctaBoost = hasCta && policy.allowedCtas.length >= 2 ? 0.06 : 0;

  return {
    visual_complexity: visualComplexity,
    cta_slot: ctaSlot,
    whitespace_bias: clamp(whitespaceBias),
    slide_energy: clamp(intentEnergyMap[intent] + ctaBoost + visualComplexity * 0.08),
    continuity_weight: clamp(intentContinuityMap[intent] + supportBoost),
    visual_pacing: clamp(policy.visualPacingProfile + (1 - visualComplexity) * 0.08 + ctaBoost),
  };
}

function safeVisual(fitTone: string, fatigueRisk = 0): RenderSlide["visual"] {
  return {
    composition: fitTone,
    framing: "tight center subject, generous margins",
    mobile_safe: true,
    fatigue_risk: clamp(fatigueRisk),
    notes: ["mobile first", "low visual load"],
  };
}

function buildSlide(
  index: number,
  intent: SlideIntent,
  copy: string,
  ctaText: string | undefined,
  ctaPosition: RenderSlide["cta_position"],
  policy: StagePolicy,
  support: string,
  headline: string,
): RenderSlide {
  const lines = chunkIntoLines(copy, policy.mobileConstraints.maxWordPerLine);
  const words = wordCount(copy);
  const metadata = deriveSlideMetadata(intent, words, policy, support, ctaPosition);
  return {
    slide_index: index,
    intent,
    copy,
    copy_hierarchy: buildCopyHierarchy(headline, support),
    visual_direction: policy.visualTone,
    visual: safeVisual(policy.visualTone, clamp((wordCount(copy) - policy.maxSlideWords) / 100)),
    mobile_lines: lines.slice(0, policy.mobileConstraints.maxLinesPerSlide),
    cta_text: ctaText,
    cta_position: ctaPosition,
    ...metadata,
    cta_slot: ctaPosition,
    tone_markers: [normalizeTone(support)],
    word_count: wordCount(copy),
  };
}

function pickSentence(source: string, index: number): string {
  const pieces = source
    .split(/[.!?]/)
    .map((row) => row.trim())
    .filter(Boolean);
  return pieces[index % Math.max(1, pieces.length)] ?? pieces[0] ?? "";
}

function buildResonanceSlides(input: RenderCarouselRequest, policy: StagePolicy): RenderSlide[] {
  return [
    buildSlide(
      1,
      "hook",
      input.hook,
      undefined,
      "none",
      policy,
      "validation for emotional pacing",
      "Emotional Hook",
    ),
    buildSlide(
      2,
      "validation",
      `${input.hook} This lane begins with permission: your parenthood is hard and that is enough to receive support.`,
      undefined,
      "none",
      policy,
      "normalize emotional reality",
      "Permission",
    ),
    buildSlide(
      3,
      "utility_step",
      pickSentence(input.caption, 0),
      undefined,
      "none",
      policy,
      "one small reset before pressure builds",
      "Micro reset",
    ),
    buildSlide(
      4,
      "summary",
      "Stay with this lane for steady, practical support. No one is expected to be perfect, only present.",
      undefined,
      "none",
      policy,
      "continuity promise",
      "Keep the channel",
    ),
  ];
}

function buildReliefSlides(input: RenderCarouselRequest, policy: StagePolicy): RenderSlide[] {
  return [
    buildSlide(
      1,
      "hook",
      input.hook,
      undefined,
      "none",
      policy,
      "relief-focused opening",
      "Quick Relief",
    ),
    buildSlide(
      2,
      "validation",
      `${pickSentence(input.caption, 0)} ${pickSentence(input.caption, 1)}`.trim(),
      undefined,
      "none",
      policy,
      "quick practical diagnosis",
      "What is happening",
    ),
    buildSlide(
      3,
      "utility_step",
      "Step 1: pause the room. Step 2: lower stimulation. Step 3: repeat the same phrase and wait 8 minutes.",
      "Save this reset",
      "inline",
      policy,
      "simple action sequence",
      "3-minute reset",
    ),
    buildSlide(
      4,
      "summary",
      "Next, try it one night, then adjust only one variable tomorrow.",
      undefined,
      "none",
      policy,
      "conservative utility",
      "Simple progression",
    ),
  ];
}

function buildTrustSlides(input: RenderCarouselRequest, policy: StagePolicy): RenderSlide[] {
  return [
    buildSlide(
      1,
      "hook",
      input.hook,
      undefined,
      "none",
      policy,
      "trust-first opening",
      "Trust Signal",
    ),
    buildSlide(
      2,
      "proof",
      `One family used a single cue change for 7 nights and tracked fewer wake loops.`,
      undefined,
      "none",
      policy,
      "evidence-based proof",
      "Pattern repeats",
    ),
    buildSlide(
      3,
      "utility_step",
      `${pickSentence(input.caption, 0)} ${pickSentence(input.caption, 2)}`.trim(),
      undefined,
      "none",
      policy,
      "consistency instruction",
      "Keep the sequence",
    ),
    buildSlide(
      4,
      "continuity",
      "If you are testing this, report one result in comments so we can keep the sequence consistent for the next few days.",
      "Reply with results",
      "inline",
      policy,
      "community continuity",
      "Relationship continuity",
    ),
  ];
}

function buildLeadCaptureSlides(input: RenderCarouselRequest, policy: StagePolicy): RenderSlide[] {
  return [
    buildSlide(
      1,
      "hook",
      input.hook,
      undefined,
      "none",
      policy,
      "value lead hook",
      "Need more than one-night tips",
    ),
    buildSlide(
      2,
      "resource_offer",
      "This is where the first 5 minutes of your routine can move from guesswork to sequence.",
      undefined,
      "none",
      policy,
      "download value framing",
      "Guide value",
    ),
    buildSlide(
      3,
      "utility_step",
      "The printable guide includes: calm reset script, 2-week notes, and one night-check template.",
      undefined,
      "none",
      policy,
      "clear resource map",
      "What the guide includes",
    ),
    buildSlide(
      4,
      "soft_invite",
      "If helpful, ask for it in comments as \"guide\" and I will send a quiet starter version.",
      "Comment GUIDE",
      "final",
      policy,
      "low-friction capture",
      "Optional next step",
    ),
  ];
}

function buildSlidesForContext(input: RenderCarouselRequest, policy: StagePolicy): RenderSlide[] {
  const key = policy.stage_label.toLowerCase().replace(/\s+/g, "_");
  if (key === "lead_capture") {
    return buildLeadCaptureSlides(input, policy);
  }
  if (key === "trust") {
    return buildTrustSlides(input, policy);
  }
  if (key === "relief") {
    return buildReliefSlides(input, policy);
  }
  return buildResonanceSlides(input, policy);
}

function scoreReadability(slides: RenderSlide[], policy: StagePolicy): number {
  const totalWords = slides.reduce((sum, slide) => sum + slide.word_count, 0);
  const avgWords = totalWords / Math.max(1, slides.length);

  const hookWords = slides[0]?.word_count ?? 0;
  let penalty = 0;

  if (hookWords > policy.maxHookWords) {
    penalty += (hookWords - policy.maxHookWords) / policy.maxHookWords;
  }

  for (const slide of slides) {
    if (slide.word_count > policy.maxSlideWords) {
      penalty += (slide.word_count - policy.maxSlideWords) / policy.maxSlideWords;
    }
  }

  const density = avgWords / policy.maxSlideWords;
  if (density > 1) {
    penalty += density - 1;
  }

  const mobileLinePenalty = slides.reduce((sum, slide) => {
    const overflow = Math.max(0, slide.mobile_lines.length - policy.mobileConstraints.maxLinesPerSlide);
    return sum + overflow * 0.12;
  }, 0);

  const raw = 1 - (penalty / (slides.length + 4)) - mobileLinePenalty;
  return clamp(raw);
}

function scoreDensity(slides: RenderSlide[]): number {
  const words = slides.flatMap((slide) => splitWords(slide.copy));
  const unique = new Set(words);
  const uniqueRatio = unique.size / Math.max(1, words.length);
  return clamp(uniqueRatio);
}

function scoreEmotionalCoherence(input: RenderCarouselRequest, slides: RenderSlide[], policy: StagePolicy): number {
  const text = `${input.hook} ${input.caption} ${input.emotional_tone}`.toLowerCase();
  const toneTokens = [
    ...policy.continuitySignals,
    ...policy.stage_label.toLowerCase().split(" "),
    ...normalizeTone(input.emotional_tone).split(" "),
  ];

  const slideMatches = slides.map((slide) => splitWords(slide.copy).some((word) => toneTokens.includes(word))).filter(Boolean).length;
  const textMatch = toneTokens.reduce((sum, token) => (text.includes(token) ? sum + 1 : sum), 0) / Math.max(1, toneTokens.length);

  return clamp((slideMatches / Math.max(1, slides.length)) * 0.65 + textMatch * 0.35);
}

function scoreRelationshipFit(input: RenderCarouselRequest, slides: RenderSlide[], policy: StagePolicy): number {
  const objective = normalizeTone(input.relationship_objective);
  const stageLabel = normalizeTone(policy.stage_label);
  const hasObjective = objective.includes(stageLabel) || stageLabel.includes(objective.split(" ")[0] ?? "") ? 1 : 0.45;
  const continuityHit = slides[slides.length - 1].copy.toLowerCase().includes("next") ? 0.6 : 0.2;
  return clamp((hasObjective * 0.7) + (continuityHit * 0.3));
}

function normalizeCtaPressureValue(value: string): number {
  return CCA_RULES[normalizeCta(value)] ?? 0;
}

function extractSlideCtas(slides: RenderSlide[]): string[] {
  const raw = slides
    .map((slide) => slide.cta_text)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeCta(value.includes("guide") ? "soft_lead" : value.includes("save") ? "save" : value.includes("follow") ? "follow" : value.includes("checkout") ? "checkout" : "none"));

  return raw;
}

function scoreCtaAppropriateness(input: RenderCarouselRequest, slides: RenderSlide[], policy: StagePolicy): number {
  const allowed = new Set(policy.allowedCtas);
  const detected = extractSlideCtas(slides);

  const invalid = detected.filter((value) => !allowed.has(value));
  const hookHasCta = !!slides[0].cta_text;
  const extra = Math.max(0, detected.length - policy.maxCtaCount);

  const tonePenalty = hookHasCta ? 0.4 : 0;
  const missPenalty = invalid.length * 0.45;
  const countPenalty = extra * 0.18;

  return clamp(1 - tonePenalty - missPenalty - countPenalty);
}

function scoreCommercialPressure(input: RenderCarouselRequest, slides: RenderSlide[], policy: StagePolicy): number {
  const requested = normalizeCta(input.commercial_intent);
  const requestedPressure = normalizeCtaPressureValue(
    requested === "low" ? "save" : requested === "careful" ? "soft_lead" : requested,
  );

  const detected = extractSlideCtas(slides);
  const avgSlidePressure = detected.length ? detected.reduce((sum, row) => sum + (CCA_RULES[row] ?? 0), 0) / detected.length : 0;
  const combined = (requestedPressure + avgSlidePressure) / 2;
  const allowance = policy.commercialPressureThreshold;
  const excess = Math.max(0, combined - allowance);
  const maxSpan = Math.max(0.01, 1 - allowance);

  return clamp(1 - excess / maxSpan);
}

function scoreMobileScanability(slides: RenderSlide[], policy: StagePolicy): number {
  const maxLineWords = policy.mobileConstraints.maxWordPerLine;
  const maxLines = policy.mobileConstraints.maxLinesPerSlide;

  let penalty = 0;
  for (const slide of slides) {
    for (const line of slide.mobile_lines) {
      if (wordCount(line) > maxLineWords) {
        penalty += 0.12;
      }
    }
    if (slide.mobile_lines.length > maxLines) {
      penalty += 0.2;
    }
  }

  return clamp(1 - penalty / Math.max(1, slides.length));
}

function scoreSaveability(input: RenderCarouselRequest, policy: StagePolicy): number {
  const copyText = `${input.hook} ${input.caption} ${input.success_metric}`.toLowerCase();
  const tokens = ["save", "bookmark", "note", "copy", "revisit", "repeat", "routine"];
  const saveHits = tokens.reduce((sum, token) => (copyText.includes(token) ? sum + 1 : sum), 0);
  const hasSoft = input.cta_policy === "save" || input.cta_policy === "follow";
  const baseline = saveHits > 0 ? 0.85 : 0.62;
  return clamp(baseline + (hasSoft ? 0.1 : 0) + (policy.stage_label === "Trust" ? 0.05 : 0));
}

function evaluateQuality(input: RenderCarouselRequest, slides: RenderSlide[]): { qa: RenderQAScore; validation: RenderValidationSummary } {
  const stageKey = toCanonicalStage(input.relationship_objective);
  const policy = STAGE_POLICIES[stageKey] ?? STAGE_POLICIES.default;
  const requested = normalizeCta(input.cta_policy);

  const readability = scoreReadability(slides, policy);
  const density = scoreDensity(slides);
  const emotionalCoherence = scoreEmotionalCoherence(input, slides, policy);
  const relationshipFit = scoreRelationshipFit(input, slides, policy);
  const ctaAppropriateness = scoreCtaAppropriateness(input, slides, policy);
  const commercialPressure = scoreCommercialPressure(input, slides, policy);
  const saveability = scoreSaveability(input, policy);
  const mobileScanability = scoreMobileScanability(slides, policy);
  const stageFit = Math.min(
    (relationshipFit + emotionalCoherence + ctaAppropriateness + commercialPressure) / 4,
    1,
  );

  const overall = clamp(
    (stageFit + readability + density + emotionalCoherence + relationshipFit + ctaAppropriateness + commercialPressure + saveability + mobileScanability)
      / 9,
  );

  const blockConditions: RenderBlockReason[] = [];
  if (readability < policy.readabilityThreshold) {
    blockConditions.push("readability_below_threshold");
  }
  if (density < policy.densityTarget) {
    blockConditions.push("excessive_density");
  }
  if (emotionalCoherence < policy.emotionalThreshold) {
    blockConditions.push("emotional_mismatch");
  }
  if (relationshipFit < policy.relationshipFitThreshold) {
    blockConditions.push("relationship_fit_mismatch");
  }
  if (ctaAppropriateness < 0.7) {
    blockConditions.push("cta_pressure_exceeds_stage_allowance");
  }
  if (commercialPressure < 0.55) {
    blockConditions.push("commercial_mismatch");
  }
  const detectedCtas = extractSlideCtas(slides);
  if ((slides[0]?.copy ?? "").split(/\s+/).filter(Boolean).length < 3) {
    blockConditions.push("hook_not_present");
  }
  if (requested !== "none" && detectedCtas.length === 0) {
    blockConditions.push("hook_not_present");
  }
  if (requested === "none" && detectedCtas.length > 0) {
    blockConditions.push("cta_pressure_exceeds_stage_allowance");
  }

  const finalText = slides[slides.length - 1]?.copy?.toLowerCase() ?? "";
  const hasContinuity = policy.continuitySignals.some((signal) => finalText.includes(signal));
  if (!hasContinuity && ["trust", "lead_capture"].includes(toCanonicalStage(input.relationship_objective))) {
    blockConditions.push("final_slide_breaks_continuity");
  }

  if (mobileScanability < 0.75) {
    blockConditions.push("mobile_scanability_low");
  }

  if (requested === "soft_lead" && toCanonicalStage(input.relationship_objective) === "resonance") {
    blockConditions.push("commercial_mismatch");
  }

  const blocked = blockConditions.length > 0;
  const passed = !blocked;

  const qa: RenderQAScore = {
    stage_fit: {
      score: clamp(stageFit),
      notes: ["stage intent alignment", `policy=${policy.stage_label}`, `requested_policy=${requested}`],
    },
    readability: { score: clamp(readability), notes: ["word and hook fit", `threshold=${policy.readabilityThreshold}`] },
    density: { score: clamp(density), notes: ["content density", `policy_target=${policy.densityTarget}`] },
    emotional_coherence: { score: clamp(emotionalCoherence), notes: ["tone tokens", ...policy.continuitySignals] },
    relationship_fit: { score: clamp(relationshipFit), notes: ["objective continuity", `target=${policy.relationshipFitThreshold}`] },
    cta_appropriateness: { score: clamp(ctaAppropriateness), notes: ["policy ctas", policy.allowedCtas.join(", ")] },
    commercial_pressure: { score: clamp(commercialPressure), notes: ["input intent", input.commercial_intent, `threshold=${policy.commercialPressureThreshold}`] },
    saveability: { score: clamp(saveability), notes: ["reusability signals", "soft retention language"] },
    mobile_scanability: { score: clamp(mobileScanability), notes: ["mobile chunking", `max_words_per_line=${policy.mobileConstraints.maxWordPerLine}`] },
    overall,
  };

  const validation: RenderValidationSummary = {
    passed,
    blocked,
    block_conditions: [...new Set(blockConditions)],
    warnings: blocked ? ["template requires human review before publish"] : ["no blocking issues"],
  };

  return { qa, validation };
}

export function generateCarouselTemplate(input: RenderCarouselRequest): RenderGenerationResult {
  const parsed = RenderCarouselRequestSchema.parse(input);
  const normalizedPolicy = normalizeCta(parsed.cta_policy);
  const request: RenderCarouselRequest = {
    ...parsed,
    cta_policy: normalizedPolicy,
  };

  const policyKey = toCanonicalStage(request.relationship_objective);
  const policy = STAGE_POLICIES[policyKey] ?? STAGE_POLICIES.default;
  const slides = buildSlidesForContext(request, policy);
  const { qa, validation } = evaluateQuality(request, slides);

  const payload: RenderCarouselTemplate = RenderCarouselTemplateSchema.parse({
    template_id: toReplayId("car", request.backlog_item_id, policyKey, String(slides.length)),
    generated_by: "render-qa-service",
    generated_at: new Date("2026-05-15T00:00:00.000Z").toISOString(),
    source_backlog_item_id: request.backlog_item_id,
    source_attribution: {
      journey_stage_id: request.journey_stage_id,
      value_arc_id: request.value_arc_id,
      journey_stage_label: request.journey_stage_label,
      value_arc_label: request.value_arc_label,
      campaign_theme_id: request.campaign_theme_id,
      campaign_theme_label: request.campaign_theme_label,
    },
    relationship_objective: request.relationship_objective,
    audience_state_before: request.audience_state_before,
    audience_state_after: request.audience_state_after,
    hook: request.hook,
    commercial_intent: request.commercial_intent,
    cta_policy: request.cta_policy,
    emotional_tone: request.emotional_tone,
    hook_direction: request.hook_direction,
    mobile_constraints: {
      max_word_per_line: policy.mobileConstraints.maxWordPerLine,
      max_lines_per_slide: policy.mobileConstraints.maxLinesPerSlide,
      max_slide_word_count: policy.mobileConstraints.maxSlideWordCount,
      recommended_word_per_slide: policy.recommendedWordsPerSlide,
    },
    slides,
    qa,
    validation,
  });

  return {
    template: payload,
    rationale: [
      `Stage policy applied: ${policy.stage_label}`,
      `Slides generated: ${slides.length}`,
      `Overall QA score: ${qa.overall}`,
      `Blocked: ${validation.blocked}`,
    ],
    stage_policy_version: `render-qa-policy-${policyKey}-v1.0`,
  };
}

export function scoreRenderTemplate(input: RenderCarouselRequest): RenderGenerationResult {
  return generateCarouselTemplate(input);
}

export function validateRenderTemplate(template: RenderCarouselTemplate): RenderValidationSummary {
  const parsed = RenderCarouselTemplateSchema.parse(template);
  const derivedCaption = parsed.slides.map((slide) => slide.copy).join(" ").trim();
  const derivedMetric = "deterministic render validation baseline";
  const reconstructed = generateCarouselTemplate({
    backlog_item_id: parsed.source_backlog_item_id,
    campaign_id: "validation-campaign",
    journey_stage_id: parsed.source_attribution.journey_stage_id,
    journey_stage_label: parsed.source_attribution.journey_stage_label,
    value_arc_id: parsed.source_attribution.value_arc_id,
    value_arc_label: parsed.source_attribution.value_arc_label,
    campaign_theme_id: parsed.source_attribution.campaign_theme_id,
    campaign_theme_label: parsed.source_attribution.campaign_theme_label,
    relationship_objective: parsed.relationship_objective,
    audience_state_before: parsed.audience_state_before,
    audience_state_after: parsed.audience_state_after,
    hook: parsed.hook,
    caption: derivedCaption,
    suggested_visual_direction: parsed.slides[0]?.visual_direction ?? "relationship-aware visual",
    cta_policy: parsed.cta_policy,
    commercial_intent: parsed.commercial_intent,
    hook_direction: parsed.hook_direction,
    emotional_tone: parsed.emotional_tone,
    success_metric: derivedMetric,
  });

  return reconstructed.template.validation;
}

export function evaluateRenderTemplate(template: RenderCarouselTemplate): RenderValidationSummary {
  const parsed = RenderCarouselTemplateSchema.parse(template);
  const request: RenderCarouselRequest = {
    backlog_item_id: parsed.source_backlog_item_id,
    campaign_id: "validation-campaign",
    journey_stage_id: parsed.source_attribution.journey_stage_id,
    journey_stage_label: parsed.source_attribution.journey_stage_label,
    value_arc_id: parsed.source_attribution.value_arc_id,
    value_arc_label: parsed.source_attribution.value_arc_label,
    campaign_theme_id: parsed.source_attribution.campaign_theme_id,
    campaign_theme_label: parsed.source_attribution.campaign_theme_label,
    relationship_objective: parsed.relationship_objective,
    audience_state_before: parsed.audience_state_before,
    audience_state_after: parsed.audience_state_after,
    hook: parsed.hook,
    caption: parsed.slides.map((slide) => slide.copy).join(" "),
    suggested_visual_direction: parsed.slides[0]?.visual_direction ?? "relationship-aware visual",
    cta_policy: parsed.cta_policy,
    commercial_intent: parsed.commercial_intent,
    hook_direction: parsed.hook_direction,
    emotional_tone: parsed.emotional_tone,
    success_metric: `${parsed.source_backlog_item_id}-render-qa-replay-review`,
  };

  return evaluateQuality(request, parsed.slides).validation;
}

export function buildCarouselFromBacklog(input: RenderCarouselRequest): RenderGenerationResult {
  return generateCarouselTemplate(input);
}

export {
  CCA_RULES,
  STAGE_POLICIES,
  evaluateQuality,
};
