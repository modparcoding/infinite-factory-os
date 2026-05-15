import { z } from "zod";
import {
  RelationshipHeuristicInput,
  RelationshipHeuristicSnapshot,
  RelationshipHeuristicSnapshotSchema,
  RelationshipStateSchema,
  RelationshipStateV1Result,
  PublishingMemorySnapshot,
} from "@ifos/contracts";

const RelationshipHeuristicInputSchema = z.object({
  relationship_id: z.string().min(6),
  campaign_id: z.string().min(3),
  journey_id: z.string().min(3),
  memory_id: z.string().min(6),
  trust_score: z.number().min(0).max(1),
  commercial_density: z.number().min(0).max(1),
  repetition_risk: z.number().min(0).max(1),
  journey_stage_ratio: z.number().min(0).max(1),
  previous_trust_level: z
    .union([
      z.literal("cold"),
      z.literal("warming"),
      z.literal("engaged"),
      z.literal("trusting"),
      z.literal("saturated"),
      z.literal("over-commercialized"),
      z.literal("trusted"),
    ])
    .transform((value) => (value === "trusted" ? "trusting" : value))
    .optional(),
});

const TrustBandSchema = z.object({
  trust_score: z.number().min(0).max(1),
  commercial_density: z.number().min(0).max(1),
  repetition_risk: z.number().min(0).max(1),
  journey_stage_ratio: z.number().min(0).max(1),
});

const TRUST_SCORE_WEIGHTS = {
  baseSignal: 0.74,
  commercialRelief: 0.12,
  repetitionRelief: 0.14,
};

const RELATIONSHIP_STATE_EPOCH_MS = Date.UTC(2026, 4, 15);

function deterministicTimestamp(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) >>> 0;
  }
  const offsetMs = hash % (24 * 60 * 60 * 1000);
  return new Date(RELATIONSHIP_STATE_EPOCH_MS + offsetMs).toISOString();
}

function clampValue(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, Number(value.toFixed(6))));
}

function deriveBaseTrustScore(input: z.infer<typeof TrustBandSchema>): number {
  const weighted = input.trust_score * TRUST_SCORE_WEIGHTS.baseSignal
    + (1 - input.commercial_density) * TRUST_SCORE_WEIGHTS.commercialRelief
    + (1 - input.repetition_risk) * TRUST_SCORE_WEIGHTS.repetitionRelief;

  return clampValue(weighted);
}

function pickTrustLevel(input: z.infer<typeof TrustBandSchema>) {
  const steps: string[] = [];

  if (input.commercial_density >= 0.8 || input.repetition_risk >= 0.8) {
    steps.push("commercial_or_repetition_cap_reached");
    return { trustLevel: "over-commercialized" as const, steps, trust_score: input.trust_score };
  }

  if (input.repetition_risk >= 0.5 && input.commercial_density >= 0.55) {
    steps.push("combined_saturation_pressure");
    const adjustedTrust = clampValue(input.trust_score * 0.4 + (1 - input.commercial_density) * 0.2 + (1 - input.repetition_risk) * 0.4);
    return { trustLevel: "saturated" as const, steps, trust_score: adjustedTrust };
  }

  if (input.journey_stage_ratio >= 0.7) {
    steps.push("journey_stage_concentration_high");
  }

  const adjustedTrust = deriveBaseTrustScore(input);
  steps.push(`adjusted_trust=${adjustedTrust}`);

  if (adjustedTrust >= 0.85) {
    steps.push("trusting_threshold_met");
    return { trustLevel: "trusting" as const, steps, trust_score: adjustedTrust };
  }
  if (adjustedTrust >= 0.6) {
    steps.push("engaged_threshold_met");
    return { trustLevel: "engaged" as const, steps, trust_score: adjustedTrust };
  }
  if (adjustedTrust >= 0.35) {
    steps.push("warming_threshold_met");
    return { trustLevel: "warming" as const, steps, trust_score: adjustedTrust };
  }

  steps.push("cold_fallback");
  return { trustLevel: "cold" as const, steps, trust_score: adjustedTrust };
}

function validateTransition(previousTrustLevel: string | undefined, nextTrustLevel: string, trustScore: number) {
  if (!previousTrustLevel || previousTrustLevel === nextTrustLevel) {
    return;
  }

  const trustOrder = ["cold", "warming", "engaged", "trusting"] as const;
  const indexOf = (value: string) => trustOrder.indexOf(value as (typeof trustOrder)[number]);

  if (trustOrder.includes(previousTrustLevel as (typeof trustOrder)[number]) && trustOrder.includes(nextTrustLevel as any)) {
    const previousIndex = indexOf(previousTrustLevel as string);
    const nextIndex = indexOf(nextTrustLevel);
    if (Math.abs(previousIndex - nextIndex) > 1) {
      throw new Error(`invalid_trust_transition: ${previousTrustLevel}->${nextTrustLevel} with trust_score:${trustScore}`);
    }
    if (nextIndex < previousIndex - 1) {
      throw new Error(`invalid_trust_transition_regression: ${previousTrustLevel}->${nextTrustLevel} with trust_score:${trustScore}`);
    }
    return;
  }

  if (previousTrustLevel === "trusting" && nextTrustLevel === "cold") {
    throw new Error(`invalid_trust_transition: ${previousTrustLevel}->${nextTrustLevel}`);
  }

  if (previousTrustLevel === "over-commercialized" && nextTrustLevel === "trusting") {
    throw new Error(`invalid_trust_transition: ${previousTrustLevel}->${nextTrustLevel}`);
  }
}

export function deriveRelationshipStateFromInput(input: RelationshipHeuristicInput): RelationshipHeuristicSnapshot {
  const parsed = RelationshipHeuristicInputSchema.parse(input);
  const baseTrust = deriveBaseTrustScore({
    trust_score: parsed.trust_score,
    commercial_density: parsed.commercial_density,
    repetition_risk: parsed.repetition_risk,
    journey_stage_ratio: parsed.journey_stage_ratio,
  });

  const { trustLevel, steps, trust_score } = pickTrustLevel({
    trust_score: parsed.trust_score,
    commercial_density: parsed.commercial_density,
    repetition_risk: parsed.repetition_risk,
    journey_stage_ratio: parsed.journey_stage_ratio,
  });
  validateTransition(parsed.previous_trust_level, trustLevel, trust_score);

  const finalTrustScore = trust_score ?? baseTrust;

  const reasoning = [
    "raw_trust_input=" + parsed.trust_score,
    "commercial_density=" + parsed.commercial_density,
    "repetition_risk=" + parsed.repetition_risk,
    "journey_stage_ratio=" + parsed.journey_stage_ratio,
    "base_trust_weighted=" + baseTrust,
    ...steps,
    `final_trust_score=${finalTrustScore}`,
  ].map((step) => ({
    rule: step.includes("=") ? step.split("=")[0] : "heuristic_step",
    value: step,
    result: "applied",
  }));

  const output: RelationshipStateV1Result = {
    relationship_id: parsed.relationship_id,
    trust_level: trustLevel,
    trust_score: finalTrustScore,
    campaign_id: parsed.campaign_id,
    journey_id: parsed.journey_id,
    reasoning,
    source_memory_id: parsed.memory_id,
    generated_at: deterministicTimestamp(parsed.relationship_id),
  };

  const relationship_state = RelationshipStateSchema.parse(output);
  const derivation_steps = steps.length ? steps : ["fallback_trust_rule"];

  return RelationshipHeuristicSnapshotSchema.parse({
    relationship_state,
    input_snapshot_id: parsed.memory_id,
    derivation_steps,
    passed: true,
  });
}

export function deriveRelationshipStateFromMemory(memory: PublishingMemorySnapshot): RelationshipHeuristicSnapshot {
  const stageRatios = Object.values(memory.stage_distribution).map((entry) => entry.ratio);
  const topStageRatio = stageRatios.length > 0 ? Math.max(...stageRatios) : 0;
  const trustScoreEstimate = clampValue(
    Math.min(
      1,
      (Math.min(1, memory.engagement_rate / 15) * 0.55)
      + ((1 - memory.commercial_density) * 0.25)
      + ((1 - memory.repetition_risk) * 0.2),
    ),
  );

  const baseInput = {
    relationship_id: `rel-${memory.journey_id}`,
    campaign_id: memory.campaign_id,
    journey_id: memory.journey_id,
    memory_id: memory.memory_id,
    trust_score: trustScoreEstimate,
    commercial_density: memory.commercial_density,
    repetition_risk: memory.repetition_risk,
    journey_stage_ratio: topStageRatio,
  };

  return deriveRelationshipStateFromInput(baseInput);
}

export function validateRelationshipInput(input: RelationshipHeuristicInput): boolean {
  try {
    RelationshipHeuristicInputSchema.parse(input);
    return true;
  } catch {
    return false;
  }
}

export { RelationshipHeuristicInputSchema, RelationshipStateSchema };
