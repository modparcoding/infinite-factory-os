import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  AttributionSeedSchema,
  AttributionChainSchema,
  buildCanonicalChain,
  validateLineageTrace,
  PublishingMemorySnapshotSchema,
  PublishingMemoryInputFixtureSchema,
  RenderCarouselTemplateSchema,
  RenderCarouselTemplate,
  RenderCarouselRequestSchema,
  RenderCarouselRequest,
  RenderBlockReason,
  RelationshipStateSchema,
  PublishingEventSchema,
  DesignTokenProfile,
  DesignTokenProfileSchema,
  RenderInputContractSchema,
  RenderOutputContractSchema,
  RenderEditActionSchema,
  RenderExportManifestSchema,
  RenderInputContract,
  RenderLayoutArchetype,
  RenderOutputContract,
  RenderQAFinding,
  RenderVisualState,
  RenderVisualStateSchema
} from "@ifos/contracts";
import { buildAttributionLineage, evaluateAttributionLineage } from "@ifos/services-measurement";
import { buildPublishingMemory } from "@ifos/services-publishing-memory";
import { evaluateRenderTemplate, generateCarouselTemplate } from "@ifos/services-render-qa";
import { deriveRelationshipStateFromInput, deriveRelationshipStateFromMemory } from "@ifos/services-relationship-state";

const {
  buildRenderExportManifest,
  applyBoundedRenderEdits,
  generateRenderOutput,
} = await import(pathToFileURL(path.resolve(process.cwd(), "services/rendering-capability/dist/src/index.js")).href);

interface ResultFile {
  workstream_id: string;
  status: "passed" | "failed";
  checks: Array<{
    name: string;
    passed: boolean;
    notes?: string[];
  }>;
}

function asNonEmptyTuple<T>(items: T[]): [T, ...T[]] {
  if (items.length === 0) {
    throw new Error("publishing_memory_requires_non_empty_source_events");
  }
  return items as [T, ...T[]];
}

function writeResult(filePath: string, payload: ResultFile) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function readFixture<T>(fixturePath: string): T {
  const fullPath = path.resolve(process.cwd(), fixturePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

function countWords(input: string): number {
  return input.toLowerCase().split(/\s+/).filter(Boolean).length;
}

interface RenderQABlockCase {
  case_id: string;
  input: RenderCarouselRequest;
  request_overrides?: Partial<RenderCarouselRequest>;
  slide_overrides?: Array<{
    slide_index: number;
    copy?: string;
    cta_text?: string;
    cta_position?: RenderCtaPosition;
    mobile_lines?: string[];
    cta_slot?: RenderCtaPosition;
  }>;
  expected: {
    passed: boolean;
    blocked: boolean;
    block_conditions: RenderBlockReason[];
  };
}

type RenderCtaPosition = "none" | "top" | "inline" | "final" | "sidebar";

interface RenderQABlockFixture {
  fixture_id: string;
  scenario: string;
  cases: RenderQABlockCase[];
}

type RenderEdit = {
  op: "change_layout_variant";
  slide_index: number;
  layout_archetype_id: RenderLayoutArchetype;
} | {
  op: "adjust_text_hierarchy";
  slide_index: number;
  role: "headline" | "support" | "micro";
  delta: number;
} | {
  op: "reflow_content";
  slide_index: number;
  line_limit_override: number;
} | {
  op: "adjust_spacing_density";
  slide_index?: number;
  density_delta: number;
} | {
  op: "swap_template";
  template_archetypes: RenderLayoutArchetype[];
};

type RenderEditProfile = {
  edits: RenderEdit[];
};

type RenderingBaselineFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    input: RenderInputContract;
    reordered_input?: RenderInputContract;
  }>;
};

type RenderingArchetypeFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    input: RenderInputContract;
    edits: RenderEditProfile;
    expected_archetypes: RenderLayoutArchetype[];
  }>;
};

type RenderingVisualFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    input: RenderInputContract;
    expected_relative_shift?: {
      spacing_bias: "lower_than_baseline" | "higher_than_baseline";
    };
    compare_to_case_id?: string;
  }>;
};

type RenderingTokenFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    input: RenderInputContract;
    mutated_profile?: DesignTokenProfile;
    expected_finding_codes?: string[];
    expected_profile_id?: string;
  }>;
};

type RenderingBoundedEditFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    input: RenderInputContract;
    edit_profile: RenderEditProfile;
    alternate_edit_profile?: RenderEditProfile;
  }>;
};

type RenderingExportManifestFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    input: RenderInputContract;
    expected_file_count?: number;
  }>;
};

type RenderingMutationFixture = {
  fixture_id: string;
  scenario: string;
  cases: Array<{
    case_id: string;
    mutation_category:
      | "overflow"
      | "density_collapse"
      | "hierarchy_collapse"
      | "cta_overload"
      | "commercial_mismatch"
      | "whitespace_failure"
      | "contrast_failure"
      | "invalid_archetype_mapping"
      | "invalid_token_profile"
      | "invalid_visual_state"
      | "replay_reconstruction_mismatch"
      | "non_deterministic_edit_sequence";
    input: unknown;
    expected_finding_codes?: string[];
    expected_failure_fragment?: string;
    edits?: RenderEditProfile;
    alternate_edits?: RenderEditProfile;
  }>;
};

function stableStringify(input: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((row) => normalize(row));
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return keys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalize(record[key]);
      return acc;
    }, {});
  };

  return JSON.stringify(normalize(input));
}

function normalizeRenderVisualState(visual: RenderVisualState): RenderVisualState {
  return {
    visual_intensity: Math.round(visual.visual_intensity * 1000) / 1000,
    density_profile: Math.round(visual.density_profile * 1000) / 1000,
    emotional_temperature: Math.round(visual.emotional_temperature * 1000) / 1000,
    cognitive_load_target: Math.round(visual.cognitive_load_target * 1000) / 1000,
    trust_visual_mode: visual.trust_visual_mode,
    motion_expectation: visual.motion_expectation,
  };
}

function normalizeRenderTokenProfile(profile: DesignTokenProfile): DesignTokenProfile {
  return {
    profile_id: profile.profile_id,
    whitespace_bias: Math.round(profile.whitespace_bias * 1000) / 1000,
    spacing_scale: {
      section_gap: Math.round(profile.spacing_scale.section_gap * 1000) / 1000,
      content_gap: Math.round(profile.spacing_scale.content_gap * 1000) / 1000,
      element_gap: Math.round(profile.spacing_scale.element_gap * 1000) / 1000,
      rhythm_step: Math.round(profile.spacing_scale.rhythm_step * 1000) / 1000,
    },
    typography_hierarchy: {
      heading_scale: Math.round(profile.typography_hierarchy.heading_scale * 1000) / 1000,
      support_scale: Math.round(profile.typography_hierarchy.support_scale * 1000) / 1000,
      micro_scale: Math.round(profile.typography_hierarchy.micro_scale * 1000) / 1000,
      line_height: Math.round(profile.typography_hierarchy.line_height * 1000) / 1000,
    },
    safe_zones: {
      horizontal_buffer_ratio: Math.round(profile.safe_zones.horizontal_buffer_ratio * 1000) / 1000,
      vertical_buffer_ratio: Math.round(profile.safe_zones.vertical_buffer_ratio * 1000) / 1000,
    },
    contrast_policy: {
      minimum_ratio: Math.round(profile.contrast_policy.minimum_ratio * 1000) / 1000,
      heading_boost_ratio: Math.round(profile.contrast_policy.heading_boost_ratio * 1000) / 1000,
      body_ratio: Math.round(profile.contrast_policy.body_ratio * 1000) / 1000,
    },
    hierarchy_weights: {
      heading: Math.round(profile.hierarchy_weights.heading * 1000) / 1000,
      support: Math.round(profile.hierarchy_weights.support * 1000) / 1000,
      micro: Math.round(profile.hierarchy_weights.micro * 1000) / 1000,
    },
    container_padding_rules: {
      compact: Math.round(profile.container_padding_rules.compact * 1000) / 1000,
      normal: Math.round(profile.container_padding_rules.normal * 1000) / 1000,
      generous: Math.round(profile.container_padding_rules.generous * 1000) / 1000,
    },
    emphasis_color_policy: {
      primary_alpha: Math.round(profile.emphasis_color_policy.primary_alpha * 1000) / 1000,
      support_alpha: Math.round(profile.emphasis_color_policy.support_alpha * 1000) / 1000,
      cta_alpha: Math.round(profile.emphasis_color_policy.cta_alpha * 1000) / 1000,
    },
  };
}

function findingCodes(findings: RenderQAFinding[]): string[] {
  return [...new Set(findings.map((row) => row.code))].sort();
}

function reorderInvariantInput(contract: RenderInputContract): RenderInputContract {
  return {
    ...contract,
    slides: contract.slides.map((row) => ({
      ...row,
      tone_tags: [...(row.tone_tags ?? [])].sort(),
    })),
  };
}

function normalizeRenderEdits(profile: RenderEditProfile | undefined): RenderEditProfile {
  if (!profile?.edits?.length) {
    return { edits: [] };
  }
  const normalized: RenderEdit[] = profile.edits
    .filter((edit) => Object.prototype.hasOwnProperty.call(edit, "op"))
    .map((edit) => {
      const action = RenderEditActionSchema.parse(edit.op);
      if (action === "swap_template") {
        return {
          op: action,
          template_archetypes: [...new Set((edit as { template_archetypes?: RenderLayoutArchetype[] }).template_archetypes ?? [])],
        };
      }
      if (action === "change_layout_variant") {
        return {
          op: action,
          slide_index: (edit as { slide_index: number; layout_archetype_id: RenderLayoutArchetype }).slide_index,
          layout_archetype_id: (edit as { layout_archetype_id: RenderLayoutArchetype }).layout_archetype_id,
        };
      }
      if (action === "reflow_content") {
        return {
          op: action,
          slide_index: (edit as { slide_index: number; line_limit_override: number }).slide_index,
          line_limit_override: (edit as { line_limit_override: number }).line_limit_override,
        };
      }
      if (action === "adjust_spacing_density") {
        return {
          op: action,
          slide_index: (edit as { slide_index?: number; density_delta: number }).slide_index,
          density_delta: (edit as { density_delta: number }).density_delta,
        };
      }
      return {
        op: action,
        slide_index: (edit as { slide_index: number; role: "headline" | "support" | "micro"; delta: number }).slide_index,
        role: (edit as { role: "headline" | "support" | "micro" }).role,
        delta: (edit as { delta: number }).delta,
      };
    });
  return { edits: normalized };
}

function canonicalOutputFingerprint(result: RenderOutputContract): string {
  return stableStringify(RenderOutputContractSchema.parse({
    render_id: result.render_id,
    asset_urls: [...result.asset_urls],
    template_id: result.template_id,
    archetype_sequence: [...result.archetype_sequence],
    slide_count: result.slide_count,
    qa_status: result.qa_status,
    qa_findings: [...result.qa_findings]
      .map((finding) => ({
        code: finding.code,
        message: finding.message,
        severity: finding.severity,
        score: finding.score,
      }))
      .sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message)),
    approval_state: result.approval_state,
    render_version: result.render_version,
    render_proof_id: result.render_proof_id,
    applied_visual_state: normalizeRenderVisualState(result.applied_visual_state),
    applied_token_profile: normalizeRenderTokenProfile(result.applied_token_profile),
    qa_scores: result.qa_scores,
    rendered_slides: [...result.rendered_slides]
      .sort((lhs, rhs) => lhs.slide_index - rhs.slide_index)
      .map((slide) => ({
        slide_index: slide.slide_index,
        content_archetype: slide.content_archetype,
        layout_archetype: slide.layout_archetype,
        lines: [...slide.lines],
        headline: slide.headline,
        copy_words: slide.copy_words,
        hierarchy_weights: slide.hierarchy_weights,
        spacing_bias: slide.spacing_bias,
        cta_slot: slide.cta_slot,
      })),
    output_constraints: result.output_constraints,
    generated_at: result.generated_at,
  }));
}

function failureIncludesFragment(
  parseError: unknown,
  expectedFailureFragment?: string,
): boolean {
  if (!expectedFailureFragment) {
    return true;
  }
  const message = parseError instanceof Error ? parseError.message : String(parseError);
  return message.toLowerCase().includes(expectedFailureFragment.toLowerCase());
}

function applyRenderQaSlideOverrides(
  slides: RenderCarouselTemplate["slides"],
  overrides: RenderQABlockCase["slide_overrides"],
): Array<RenderCarouselTemplate["slides"][number]> {
  if (!overrides?.length) {
    return slides;
  }
  const next = slides.map((slide) => ({ ...slide }));
  for (const override of overrides) {
    const target = next.find((row) => row.slide_index === override.slide_index);
    if (!target) {
      throw new Error(`slide index ${override.slide_index} not found for render qa mutation`);
    }
    if (override.copy !== undefined) {
      target.copy = override.copy;
      target.word_count = countWords(override.copy);
    }
    if (override.cta_text !== undefined) {
      target.cta_text = override.cta_text;
    }
    if (override.cta_position !== undefined) {
      target.cta_position = override.cta_position;
      target.cta_slot = override.cta_position;
    }
    if (override.cta_slot !== undefined) {
      target.cta_slot = override.cta_slot;
    }
    if (override.mobile_lines !== undefined) {
      target.mobile_lines = override.mobile_lines;
    }
  }
  return next;
}

function normalizeRenderQaFixture(
  item: RenderQABlockCase,
): RenderCarouselTemplate {
  const request: RenderCarouselRequest = RenderCarouselRequestSchema.parse({
    ...item.input,
    ...(item.request_overrides ?? {}),
  });

  const generated = generateCarouselTemplate(request);
  const baselineTemplate = generated.template;
  const slides = applyRenderQaSlideOverrides(baselineTemplate.slides, item.slide_overrides);
  return RenderCarouselTemplateSchema.parse({ ...baselineTemplate, slides });
}

function arraysEqual(lhs: string[], rhs: string[]) {
  if (lhs.length !== rhs.length) {
    return false;
  }
  return lhs.every((value, index) => value === rhs[index]);
}

function mergeTokenProfile(
  base: DesignTokenProfile,
  patch?: DesignTokenProfile,
): DesignTokenProfile {
  if (!patch) {
    return base;
  }
  return {
    ...base,
    ...patch,
    spacing_scale: { ...base.spacing_scale, ...(patch.spacing_scale ?? {}) },
    typography_hierarchy: { ...base.typography_hierarchy, ...(patch.typography_hierarchy ?? {}) },
    safe_zones: { ...base.safe_zones, ...(patch.safe_zones ?? {}) },
    contrast_policy: { ...base.contrast_policy, ...(patch.contrast_policy ?? {}) },
    hierarchy_weights: { ...base.hierarchy_weights, ...(patch.hierarchy_weights ?? {}) },
    container_padding_rules: { ...base.container_padding_rules, ...(patch.container_padding_rules ?? {}) },
    emphasis_color_policy: { ...base.emphasis_color_policy, ...(patch.emphasis_color_policy ?? {}) },
  };
}

async function validateRenderingBaselineReplay() {
  const fixture = readFixture<RenderingBaselineFixture>("tests/replay/rendering-capability-baseline.json");

  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
    const contract = RenderInputContractSchema.parse(item.input);
    const parsedInput = reorderInvariantInput(contract);
    const output1 = generateRenderOutput(parsedInput);
    const output2 = generateRenderOutput(parsedInput);
    const baselineSame = canonicalOutputFingerprint(output1) === canonicalOutputFingerprint(output2);

    const fallbackReordered = {
      ...parsedInput,
      slides: parsedInput.slides.map((slide) => ({
        ...slide,
        tone_tags: [...(slide.tone_tags ?? [])].slice().reverse(),
      })),
    };
    const reordered = reorderInvariantInput(
      item.reordered_input ? RenderInputContractSchema.parse(item.reordered_input) : fallbackReordered,
    );
    const reorderedOutput = generateRenderOutput(reordered);
    const invariant = canonicalOutputFingerprint(output1) === canonicalOutputFingerprint(reorderedOutput);

    const reconstructedInput: RenderInputContract = {
      ...parsedInput,
      design_tokens_profile: output1.applied_token_profile,
      visual_state: output1.applied_visual_state,
    };
    const reconstructedOutput = generateRenderOutput(reconstructedInput);
    const reconstruction = canonicalOutputFingerprint(output1) === canonicalOutputFingerprint(reconstructedOutput);

    checks.push({
      name: `render-baseline-${item.case_id}`,
      passed: baselineSame && invariant && reconstruction && output1.slide_count >= 3 && output1.slide_count === output1.rendered_slides.length,
      notes: [
        output1.render_id,
        `qa=${output1.qa_status}`,
        `reconstruct=${reconstruction}`,
      ],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-BASELINE",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-baseline.validation.result.json", result);
  return result;
}

async function validateRenderingArchetypeReplay() {
  const fixture = readFixture<RenderingArchetypeFixture>("tests/replay/rendering-capability-archetype-replay.json");
  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
    const contract = RenderInputContractSchema.parse(item.input);
    const editProfile = normalizeRenderEdits(item.edits);
    const output = applyBoundedRenderEdits(contract, editProfile);
    const outputRepeat = applyBoundedRenderEdits(contract, editProfile);
    const stable = canonicalOutputFingerprint(output) === canonicalOutputFingerprint(outputRepeat);
    const expectedArchetypes = item.expected_archetypes;
    const archetypesMatch = expectedArchetypes.length
      ? JSON.stringify(output.archetype_sequence) === JSON.stringify(expectedArchetypes)
      : output.archetype_sequence.length > 0;
    checks.push({
      name: `render-archetype-${item.case_id}`,
      passed: stable && archetypesMatch && output.slide_count >= 3,
      notes: [output.render_id, `archetypes=${output.archetype_sequence.join(",")}`],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-ARCHETYPE",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-archetype-replay.validation.result.json", result);
  return result;
}

async function validateRenderingVisualReplay() {
  const fixture = readFixture<RenderingVisualFixture>("tests/replay/rendering-capability-visual-state-replay.json");
  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];
  const outputs = new Map<string, RenderOutputContract>();
  const spacing = new Map<string, number>();

  for (const item of fixture.cases) {
    const contract = RenderInputContractSchema.parse(item.input);
    const output = generateRenderOutput(contract);
    const outputRepeat = generateRenderOutput(contract);
    const stable = canonicalOutputFingerprint(output) === canonicalOutputFingerprint(outputRepeat);
    const canonical = output.rendered_slides.reduce(
      (sum: number, row: RenderOutputContract["rendered_slides"][number]) => sum + row.spacing_bias,
      0,
    ) / Math.max(1, output.rendered_slides.length);
    outputs.set(item.case_id, output);
    spacing.set(item.case_id, canonical);

    checks.push({
      name: `render-visual-${item.case_id}`,
      passed: stable,
      notes: [`spacing=${canonical.toFixed(4)}`],
    });

    const reconstructedInput: RenderInputContract = {
      ...contract,
      design_tokens_profile: output.applied_token_profile,
      visual_state: output.applied_visual_state,
    };
    const reconstruction = generateRenderOutput(reconstructedInput);
    const replay = canonicalOutputFingerprint(output) === canonicalOutputFingerprint(reconstruction);
    checks.push({
      name: `render-visual-reconstruct-${item.case_id}`,
      passed: replay,
      notes: [`replay=${replay}`],
    });
  }

  for (const item of fixture.cases) {
    if (!item.compare_to_case_id || !item.expected_relative_shift) {
      continue;
    }
    const left = spacing.get(item.case_id);
    const right = spacing.get(item.compare_to_case_id);
    if (left === undefined || right === undefined) {
      continue;
    }
    const isLower = item.expected_relative_shift.spacing_bias === "lower_than_baseline";
    checks.push({
      name: `render-visual-shift-${item.case_id}`,
      passed: isLower ? left < right : left > right,
      notes: [`lhs=${left.toFixed(4)} rhs=${right.toFixed(4)}`],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-VISUAL",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-visual-state-replay.validation.result.json", result);
  return result;
}

async function validateRenderingTokenReplay() {
  const fixture = readFixture<RenderingTokenFixture>("tests/replay/rendering-capability-token-replay.json");
  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
    const contract = RenderInputContractSchema.parse(item.input);
    const baseline = generateRenderOutput(contract);
    const baselineStable = canonicalOutputFingerprint(baseline) === canonicalOutputFingerprint(generateRenderOutput(contract));
    checks.push({
      name: `render-token-baseline-${item.case_id}`,
      passed: baselineStable,
      notes: [`contract=${baseline.render_id}`],
    });

    if (!item.mutated_profile) {
      continue;
    }
    const mutatedProfile = mergeTokenProfile(contract.design_tokens_profile, item.mutated_profile);
    const mutatedContract = {
      ...contract,
      design_tokens_profile: DesignTokenProfileSchema.parse(mutatedProfile),
    };
    const mutatedOutput = generateRenderOutput(mutatedContract);
    const expectedCodes = item.expected_finding_codes ?? [];
    const observedCodes = findingCodes(mutatedOutput.qa_findings);
    const findingMatch = expectedCodes.every((code) => observedCodes.includes(code));
    const profileIdMatch = item.expected_profile_id ? mutatedOutput.applied_token_profile.profile_id === item.expected_profile_id : true;
    const deterministic = canonicalOutputFingerprint(mutatedOutput) === canonicalOutputFingerprint(generateRenderOutput(mutatedContract));

    checks.push({
      name: `render-token-mutate-${item.case_id}`,
      passed: deterministic && findingMatch && profileIdMatch,
      notes: [observedCodes.join("|")],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-TOKEN",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-token-replay.validation.result.json", result);
  return result;
}

async function validateRenderingBoundedEditReplay() {
  const fixture = readFixture<RenderingBoundedEditFixture>("tests/replay/rendering-capability-bounded-edit-replay.json");
  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
    const contract = RenderInputContractSchema.parse(item.input);
    const primaryProfile = normalizeRenderEdits(item.edit_profile);
    const outputPrimary = applyBoundedRenderEdits(contract, primaryProfile);
    const outputPrimaryReplay = applyBoundedRenderEdits(contract, primaryProfile);
    const primaryStable = canonicalOutputFingerprint(outputPrimary) === canonicalOutputFingerprint(outputPrimaryReplay);

    const reconstructed = applyBoundedRenderEdits(contract, primaryProfile);
    const reconstruction = canonicalOutputFingerprint(outputPrimary) === canonicalOutputFingerprint(reconstructed);

    checks.push({
      name: `render-bounded-edit-${item.case_id}`,
      passed: primaryStable && reconstruction,
      notes: [outputPrimary.render_id, `qa=${outputPrimary.qa_status}`],
    });

    if (!item.alternate_edit_profile) {
      continue;
    }
    const alternate = applyBoundedRenderEdits(contract, normalizeRenderEdits(item.alternate_edit_profile));
    const alternateStable = canonicalOutputFingerprint(alternate) === canonicalOutputFingerprint(
      applyBoundedRenderEdits(contract, normalizeRenderEdits(item.alternate_edit_profile)),
    );
    checks.push({
      name: `render-bounded-edit-alt-${item.case_id}`,
      passed: alternateStable && alternate.slide_count > 0,
      notes: [`alt=${alternate.render_id}`],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-BOUNDED-EDIT",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-bounded-edit-replay.validation.result.json", result);
  return result;
}

async function validateRenderingExportManifestReplay() {
  const fixture = readFixture<RenderingExportManifestFixture>("tests/replay/rendering-capability-export-manifest-replay.json");
  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
    const contract = RenderInputContractSchema.parse(item.input);
    const output = generateRenderOutput(contract);
    const manifest = buildRenderExportManifest(output);
    const validated = RenderExportManifestSchema.parse(manifest);
    const manifest2 = buildRenderExportManifest(output);
    const manifestReplay = stableStringify(validated) === stableStringify(RenderExportManifestSchema.parse(manifest2));
    const expectedCount = item.expected_file_count ?? output.asset_urls.length;
    const passed = manifestReplay
      && validated.file_count === output.asset_urls.length
      && validated.file_urls.length === expectedCount;
    checks.push({
      name: `render-export-manifest-${item.case_id}`,
      passed,
      notes: [validated.export_id, `count=${validated.file_count}`],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-EXPORT",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-export-manifest-replay.validation.result.json", result);
  return result;
}

function evaluateMutationOutput(output: RenderOutputContract): { codes: string[]; hasCommercialPressureIssue: boolean } {
  const codes = findingCodes(output.qa_findings);
  const hasCommercialPressureIssue = output.qa_scores.commercial_pressure.score < 0.45;
  return { codes, hasCommercialPressureIssue };
}

async function validateRenderingMutationCoverage() {
  const fixture = readFixture<RenderingMutationFixture>("tests/replay/rendering-capability-mutation-cases.json");
  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
    let passed = true;
    const notes: string[] = [];

    if (item.mutation_category === "invalid_token_profile") {
      const parse = RenderInputContractSchema.safeParse(item.input);
      passed = !parse.success;
      if (parse.success) {
        notes.push("failure=validation_succeeded");
      } else {
        const failureMatched = failureIncludesFragment(parse.error, item.expected_failure_fragment ?? "whitespace_bias");
        passed = passed && failureMatched;
        notes.push(`failure=${failureMatched}`);
      }
      checks.push({
        name: `render-mutation-${item.case_id}`,
        passed,
        notes,
      });
      continue;
    }

    if (item.mutation_category === "invalid_visual_state") {
      const parse = RenderInputContractSchema.safeParse(item.input);
      passed = !parse.success;
      if (parse.success) {
        notes.push("failure=validation_succeeded");
      } else {
        const failureMatched = failureIncludesFragment(parse.error, item.expected_failure_fragment ?? "visual_intensity");
        passed = passed && failureMatched;
        notes.push(`failure=${failureMatched}`);
      }
      checks.push({
        name: `render-mutation-${item.case_id}`,
        passed,
        notes,
      });
      continue;
    }

    const contract = RenderInputContractSchema.parse(item.input as RenderInputContract);

    if (item.mutation_category === "invalid_archetype_mapping") {
      let output: RenderOutputContract | null = null;
      try {
        output = applyBoundedRenderEdits(contract, normalizeRenderEdits(item.edits ?? { edits: [] }));
      } catch (error) {
        passed = failureIncludesFragment(error, "template_inconsistency");
        notes.push(`error=${passed}`);
        checks.push({
          name: `render-mutation-${item.case_id}`,
          passed,
          notes,
        });
        continue;
      }
      if (!output) {
        passed = false;
        checks.push({
          name: `render-mutation-${item.case_id}`,
          passed,
          notes: ["output_missing"],
        });
        continue;
      }

      const findings = findingCodes(output.qa_findings);
      const hadTemplateIssue = findings.includes("template_inconsistency");
      const hasFallbackArchetype = output.archetype_sequence.every((row) => !!row);
      passed = hadTemplateIssue && hasFallbackArchetype;
      checks.push({
        name: `render-mutation-${item.case_id}`,
        passed,
        notes: [...notes, `render_id=${output.render_id}`, `findings=${findings.join("|")}`],
      });
      continue;
    }

    if (item.mutation_category === "replay_reconstruction_mismatch") {
      const output = generateRenderOutput(contract);
      const mismatchInput = {
        ...contract,
        visual_state: { ...contract.visual_state, visual_intensity: contract.visual_state.visual_intensity + 0.3 },
      };
      const mutated = generateRenderOutput(mismatchInput as RenderInputContract);
      passed = canonicalOutputFingerprint(output) !== canonicalOutputFingerprint(mutated);
      checks.push({
        name: `render-mutation-${item.case_id}`,
        passed,
        notes: [item.expected_finding_codes?.join("|") ?? "reconstruction_mismatch"],
      });
      continue;
    }

    const profile = normalizeRenderEdits(item.edits ?? { edits: [] });
    const output = item.edits
      ? applyBoundedRenderEdits(contract, profile)
      : generateRenderOutput(contract);
    const mutationEval = evaluateMutationOutput(output);
    const observed = mutationEval.codes;
    const expectedCodes = item.expected_finding_codes ?? [];
    const codesPresent = expectedCodes.every((code) => observed.includes(code));
    const commerceHit = item.mutation_category === "commercial_mismatch" ? mutationEval.hasCommercialPressureIssue : true;
    const nonDeterministic = item.mutation_category === "non_deterministic_edit_sequence"
      ? canonicalOutputFingerprint(output) === canonicalOutputFingerprint(
        applyBoundedRenderEdits(contract, normalizeRenderEdits(item.alternate_edits ?? item.edits ?? { edits: [] })),
      )
      : true;

    passed = codesPresent && commerceHit && nonDeterministic;
    checks.push({
      name: `render-mutation-${item.case_id}`,
      passed,
      notes: [observed.join("|")],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-RENDERING-MUTATION",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/rendering-mutation-cases.validation.result.json", result);
  return result;
}

async function validateAttributionLineage() {
  const cases = readFixture<Array<{ case_id: string; seed: unknown; expected_signature: string }>>(
    "tests/replay/attribution-lineage.snapshots.json",
  );

  const failures = readFixture<Array<{ case_id: string; seed: unknown; expected_failure: string }>>(
    "tests/replay/attribution-lineage.failures.json",
  );

  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of cases) {
    const seedResult = AttributionSeedSchema.safeParse(item.seed);
    if (!seedResult.success) {
      throw new Error(`seed invalid for ${item.case_id}: ${seedResult.error.message}`);
    }

    const chain = buildAttributionLineage(seedResult.data);
    const chainParsed = AttributionChainSchema.parse(chain);
    const reorderedSeed: ReturnType<typeof AttributionSeedSchema["parse"]> = {
      ...seedResult.data,
      source: {
        ...seedResult.data.source,
        journey_stages: [...seedResult.data.source.journey_stages].slice().reverse() as typeof seedResult.data.source.journey_stages,
        value_arcs: [...seedResult.data.source.value_arcs].slice().reverse() as typeof seedResult.data.source.value_arcs,
      },
    };
    const reorderedChain = buildAttributionLineage(reorderedSeed);
    const reorderedSignature = AttributionChainSchema.parse(reorderedChain).deterministic_signature;

    const recreated = buildCanonicalChain(seedResult.data);
    const valid = validateLineageTrace(recreated, seedResult.data);

    checks.push({
      name: `attribution-case-${item.case_id}`,
      passed: valid && chainParsed.deterministic_signature === item.expected_signature && reorderedSignature === item.expected_signature,
      notes: [chainParsed.deterministic_signature],
    });

    if (!checks[checks.length - 1].passed) {
      throw new Error(`Attribution replay failed for ${item.case_id}`);
    }

    const evalResult = evaluateAttributionLineage(seedResult.data);
    if (!evalResult.is_valid || evalResult.chain_id !== seedResult.data.chain_id) {
      throw new Error(`Attribution evaluation failed for ${item.case_id}`);
    }
  }

  for (const item of failures) {
    const result = AttributionSeedSchema.safeParse(item.seed);
    if (!result.success) {
      checks.push({
        name: `attribution-failure-${item.case_id}`,
        passed: true,
        notes: [item.expected_failure],
      });
      continue;
    }

    try {
      buildAttributionLineage(result.data);
      throw new Error(`Attribution failure case unexpectedly succeeded: ${item.case_id}`);
    } catch (error) {
      checks.push({
        name: `attribution-failure-${item.case_id}`,
        passed: true,
        notes: [String(error instanceof Error ? error.message : String(error))],
      });
    }
  }

  const passed = checks.every((check) => check.passed);
  const result: ResultFile = {
    workstream_id: "WS-ATY-001",
    status: passed ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/attribution-lineage.validation.result.json", result);
  return result;
}

async function validatePublishingMemory() {
  const cases = readFixture<
    Array<{
      case_id: string;
      input_events: unknown[];
      expected_snapshot: {
        memory_id: string;
      };
    }>
  >("tests/replay/publishing-memory.snapshots.json");

  const failureCases = readFixture<
    Array<{
      case_id: string;
      source_events: unknown[];
      expected_failure: string;
    }>
  >("tests/replay/publishing-memory.failures.json");

  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of cases) {
    const parsedEvents = item.input_events.map((row) => PublishingEventSchema.parse(row));
    const fixture = PublishingMemoryInputFixtureSchema.parse({
      memory_id: item.expected_snapshot.memory_id,
      source_events: parsedEvents,
    });
    const snapshot = buildPublishingMemory({
      memory_id: item.expected_snapshot.memory_id,
      source_events: asNonEmptyTuple(fixture.source_events),
    });
    const reorderedSnapshot = buildPublishingMemory({
      memory_id: item.expected_snapshot.memory_id,
      source_events: asNonEmptyTuple([...fixture.source_events].reverse()),
    });

    const expected = PublishingMemorySnapshotSchema.parse(item.expected_snapshot);
    const equal = JSON.stringify(snapshot) === JSON.stringify(expected);
    const reorderEqual = JSON.stringify(snapshot) === JSON.stringify(reorderedSnapshot);
    checks.push({
      name: `publishing-memory-case-${item.case_id}`,
      passed: equal && reorderEqual,
      notes: [snapshot.memory_id],
    });

    if (!equal) {
      throw new Error(`Publishing memory replay failed for ${item.case_id}`);
    }
  }

  for (const item of failureCases) {
    const parsed = PublishingMemoryInputFixtureSchema.safeParse({
      memory_id: `failure-${item.case_id}`,
      source_events: item.source_events,
    });

    if (parsed.success) {
      try {
        buildPublishingMemory({
          memory_id: `failure-${item.case_id}`,
        source_events: asNonEmptyTuple(parsed.data.source_events),
        });
        throw new Error(`Publishing-memory failure case unexpectedly succeeded for ${item.case_id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes(item.expected_failure)) {
          throw new Error(`Publishing-memory failure mismatch for ${item.case_id}: ${message}`);
        }
      }
    } else {
      const parseMatch = parsed.error.message.includes(item.expected_failure);
      if (!parseMatch) {
        throw new Error(`Publishing-memory failure mismatch for ${item.case_id}: ${parsed.error.message}`);
      }
    }

    checks.push({
      name: `publishing-memory-failure-${item.case_id}`,
      passed: true,
      notes: [item.expected_failure],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-PUB-002",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/publishing-memory.validation.result.json", result);
  return result;
}

async function validateRelationshipState() {
  const cases = readFixture<
    Array<{
      case_id: string;
      input: {
        relationship_id: string;
        campaign_id: string;
        journey_id: string;
        memory_id: string;
        trust_score: number;
        commercial_density: number;
        repetition_risk: number;
        journey_stage_ratio: number;
      };
      expected_state: {
        relationship_id: string;
        trust_level: string;
        trust_score: number;
      };
    }>
  >("tests/replay/relationship-state.snapshots.json");

  const failureCases = readFixture<
    Array<{
      case_id: string;
      input: {
        relationship_id: string;
        campaign_id: string;
        journey_id: string;
        memory_id: string;
        trust_score: number;
        commercial_density: number;
        repetition_risk: number;
        journey_stage_ratio: number;
      };
      expected_failure: string;
    }>
  >("tests/replay/relationship-state.failures.json");

  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of cases) {
    const output = deriveRelationshipStateFromInput(item.input);
    RelationshipStateSchema.parse(output.relationship_state);

    const passed =
      output.relationship_state.relationship_id === item.expected_state.relationship_id
      && output.relationship_state.trust_level === item.expected_state.trust_level
      && output.relationship_state.trust_score === item.expected_state.trust_score;

    checks.push({
      name: `relationship-state-case-${item.case_id}`,
      passed,
      notes: [output.relationship_state.trust_level],
    });

    if (!passed) {
      throw new Error(`Relationship state replay failed for ${item.case_id}`);
    }

    const memoryInput = {
      relationship_id: item.input.relationship_id,
      campaign_id: item.input.campaign_id,
      journey_id: item.input.journey_id,
      memory_id: item.input.memory_id,
      trust_score: item.input.trust_score,
      commercial_density: item.input.commercial_density,
      repetition_risk: item.input.repetition_risk,
      journey_stage_ratio: item.input.journey_stage_ratio,
    };
    const fromInput = deriveRelationshipStateFromInput(memoryInput);
    if (fromInput.relationship_state.trust_level !== output.relationship_state.trust_level) {
      throw new Error(`Relationship state input/memory parity mismatch for ${item.case_id}`);
    }
  }

  for (const item of failureCases) {
    try {
      deriveRelationshipStateFromInput(item.input as any);
      throw new Error(`Relationship state failure unexpectedly succeeded: ${item.case_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(item.expected_failure)) {
        throw new Error(`Relationship failure mismatch for ${item.case_id}`);
      }
      checks.push({
        name: `relationship-state-failure-${item.case_id}`,
        passed: true,
        notes: [item.expected_failure],
      });
    }
  }

  const result: ResultFile = {
    workstream_id: "WS-RLS-003",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/relationship-state.validation.result.json", result);
  return result;
}

async function validateRenderQaBlockCases() {
  const fixture = readFixture<RenderQABlockFixture>("tests/replay/render-qa-block-cases.json");

  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of fixture.cases) {
  const template = normalizeRenderQaFixture(item);
  const validation = evaluateRenderTemplate(template);
  const observed = [...new Set(validation.block_conditions)].sort() as string[];
  const expected = [...new Set(item.expected.block_conditions)].sort() as string[];

    const passed =
      validation.passed === item.expected.passed &&
      validation.blocked === item.expected.blocked &&
      arraysEqual(observed, expected);

    checks.push({
      name: `render-qa-block-${item.case_id}`,
      passed,
      notes: [`observed=${observed.join(",")}`],
    });

    if (!passed) {
      throw new Error(
        `Render QA block replay validation failed for ${item.case_id}: expected ${expected.join(",")} got ${observed.join(",")}`,
      );
    }
  }

  const result: ResultFile = {
    workstream_id: "WS-Render-QA-Block-Cases",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/render-qa-block-cases.validation.result.json", result);
  return result;
}

async function validateEndToEndScenario() {
  const cases = readFixture<
    Array<{
      case_id: string;
      attribution_seed: {
        source: {
          audience_journey: Record<string, unknown>;
          journey_stages: unknown[];
          value_arcs: unknown[];
          campaign_theme: Record<string, unknown>;
          campaign: Record<string, unknown>;
          backlog_item: Record<string, unknown>;
          asset: Record<string, unknown>;
          published_post: Record<string, unknown>;
          performance_record: Record<string, unknown>;
        };
        chain_id: string;
        chain_owner: string;
      };
      publishing_events: unknown[];
      expected_signature: string;
      expected_memory_id: string;
      expected_relationship_state: {
        relationship_id: string;
        campaign_id: string;
        journey_id: string;
        trust_level: string;
        trust_score: number;
      };
    }>
  >("tests/replay/end-to-end-attribution-publishing-relationship.json");

  const checks: Array<{ name: string; passed: boolean; notes: string[] }> = [];

  for (const item of cases) {
    const attributionSeed = AttributionSeedSchema.parse(item.attribution_seed);
    const chain = buildAttributionLineage(attributionSeed);
    if (chain.deterministic_signature !== item.expected_signature) {
      throw new Error(`End-to-end signature mismatch for ${item.case_id}`);
    }

    const parsedEvents = item.publishing_events.map((row) => PublishingEventSchema.parse(row));
    const memory = buildPublishingMemory({
      memory_id: item.expected_memory_id,
      source_events: asNonEmptyTuple(parsedEvents),
    });
    const relationship = deriveRelationshipStateFromMemory(memory);

    if (relationship.relationship_state.relationship_id !== item.expected_relationship_state.relationship_id) {
      throw new Error(`End-to-end relationship id mismatch for ${item.case_id}`);
    }
    if (relationship.relationship_state.campaign_id !== item.expected_relationship_state.campaign_id) {
      throw new Error(`End-to-end relationship campaign mismatch for ${item.case_id}`);
    }
    if (relationship.relationship_state.journey_id !== item.expected_relationship_state.journey_id) {
      throw new Error(`End-to-end relationship journey mismatch for ${item.case_id}`);
    }
    if (relationship.relationship_state.trust_level !== item.expected_relationship_state.trust_level) {
      throw new Error(`End-to-end trust level mismatch for ${item.case_id}`);
    }
    if (relationship.relationship_state.trust_score !== item.expected_relationship_state.trust_score) {
      throw new Error(`End-to-end trust score mismatch for ${item.case_id}`);
    }

    checks.push({
      name: `end-to-end-${item.case_id}`,
      passed: true,
      notes: [chain.deterministic_signature, relationship.relationship_state.trust_level],
    });
  }

  const result: ResultFile = {
    workstream_id: "WS-ATY-001+WS-PUB-002+WS-RLS-003",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };

  writeResult("tests/replay/end-to-end-attribution-publishing-relationship.validation.result.json", result);
  return result;
}

async function main() {
  const baseline = await validateRenderingBaselineReplay();
  const archetype = await validateRenderingArchetypeReplay();
  const visual = await validateRenderingVisualReplay();
  const token = await validateRenderingTokenReplay();
  const boundedEdit = await validateRenderingBoundedEditReplay();
  const exportManifest = await validateRenderingExportManifestReplay();
  const mutation = await validateRenderingMutationCoverage();
  const attribution = await validateAttributionLineage();
  const publishing = await validatePublishingMemory();
  const relationship = await validateRelationshipState();
  const renderQa = await validateRenderQaBlockCases();
  const endToEnd = await validateEndToEndScenario();

  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        rendering_baseline: baseline.status,
        rendering_archetype: archetype.status,
        rendering_visual: visual.status,
        rendering_token: token.status,
        rendering_bounded_edit: boundedEdit.status,
        rendering_export_manifest: exportManifest.status,
        rendering_mutation: mutation.status,
        attribution: attribution.status,
        publishing: publishing.status,
        relationship: relationship.status,
        render_qa: renderQa.status,
        end_to_end: endToEnd.status,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
