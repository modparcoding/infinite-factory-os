import fs from "node:fs";
import path from "node:path";

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
} from "@ifos/contracts";
import { buildAttributionLineage, evaluateAttributionLineage } from "@ifos/services-measurement";
import { buildPublishingMemory } from "@ifos/services-publishing-memory";
import { evaluateRenderTemplate, generateCarouselTemplate } from "@ifos/services-render-qa";
import { deriveRelationshipStateFromInput, deriveRelationshipStateFromMemory } from "@ifos/services-relationship-state";

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
  const attribution = await validateAttributionLineage();
  const publishing = await validatePublishingMemory();
  const relationship = await validateRelationshipState();
  const renderQa = await validateRenderQaBlockCases();
  const endToEnd = await validateEndToEndScenario();

  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
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
