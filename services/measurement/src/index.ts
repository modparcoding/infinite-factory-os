import {
  AttributionSeed,
  AttributionSeedSchema,
  AttributionChain,
  buildCanonicalChain,
  validateLineageTrace,
  AttributionChainSchema,
} from "@ifos/contracts";

export interface AttributionLineageEvaluation {
  chain_id: string;
  deterministic_signature: string;
  lineage_depth: number;
  links_count: number;
  immutable: true;
  is_valid: boolean;
  notes: string[];
}

export function buildAttributionLineage(seed: AttributionSeed): AttributionChain {
  return buildCanonicalChain(seed);
}

function fingerprintNotes(seed: AttributionSeed): string[] {
  const notes: string[] = [
    `seed_owner:${seed.chain_owner}`,
    `journey:${seed.source.audience_journey.journey_id}`,
    `campaign:${seed.source.campaign.campaign_id}`,
    `backlog:${seed.source.backlog_item.backlog_id}`,
  ];

  if (seed.source.value_arcs.length > 1) {
    notes.push(`value_arc_count:${seed.source.value_arcs.length}`);
  }

  if (seed.source.journey_stages.length > 1) {
    notes.push(`journey_stage_count:${seed.source.journey_stages.length}`);
  }

  return notes;
}

export function evaluateAttributionLineage(seed: unknown): AttributionLineageEvaluation {
  const parsedSeed = AttributionSeedSchema.parse(seed);
  const chain = buildAttributionLineage(parsedSeed);

  const notes = fingerprintNotes(parsedSeed);
  const isValid = validateLineageTrace(chain, parsedSeed);
  if (!isValid) {
    notes.push("lineage_trace_reconstruction_mismatch");
  }

  return {
    chain_id: chain.chain_id,
    deterministic_signature: chain.deterministic_signature,
    lineage_depth: chain.canonical_chain.length,
    links_count: chain.links.length,
    immutable: true,
    is_valid: isValid,
    notes,
  };
}

export function assertAttributionIntegrity(seed: AttributionSeed, chain: AttributionChain): boolean {
  const parsed = AttributionChainSchema.parse(chain);
  return validateLineageTrace(parsed, seed);
}

export function buildLineageEnvelope(seed: AttributionSeed) {
  const parsedSeed = AttributionSeedSchema.parse(seed);
  const chain = buildAttributionLineage(parsedSeed);

  return {
    seed: parsedSeed,
    chain,
    evaluation: evaluateAttributionLineage(parsedSeed),
  };
}

export { AttributionSeedSchema, buildCanonicalChain, validateLineageTrace };
