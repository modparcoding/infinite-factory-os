import fs from "node:fs";
import path from "node:path";

import { RelationshipStateSchema, PublishingMemorySnapshotSchema } from "@ifos/contracts";
import { deriveRelationshipStateFromInput, deriveRelationshipStateFromMemory } from "@ifos/services-relationship-state";

interface RelationshipFixtureCase {
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
    campaign_id: string;
    journey_id: string;
  };
}

interface RelationshipFailureCase {
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
}

interface MemoryFixtureCase {
  case_id: string;
  expected_snapshot: unknown;
  input_events?: unknown[];
}

function loadJson<T>(fixturePath: string): T {
  const fullPath = path.resolve(process.cwd(), fixturePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

export function runRelationshipStateContractChecks() {
  const cases = loadJson<RelationshipFixtureCase[]>("tests/replay/relationship-state.snapshots.json");
  const failures = loadJson<RelationshipFailureCase[]>("tests/replay/relationship-state.failures.json");
  const memoryCases = loadJson<MemoryFixtureCase[]>("tests/replay/publishing-memory.snapshots.json");

  for (const item of cases) {
    const snapshot = deriveRelationshipStateFromInput(item.input);
    RelationshipStateSchema.parse(snapshot.relationship_state);

    if (snapshot.relationship_state.relationship_id !== item.expected_state.relationship_id) {
      throw new Error(`Relationship state fixture ${item.case_id} relationship_id mismatch`);
    }
    if (snapshot.relationship_state.trust_level !== item.expected_state.trust_level) {
      throw new Error(`Relationship state fixture ${item.case_id} trust level mismatch`);
    }
    if (snapshot.relationship_state.trust_score !== item.expected_state.trust_score) {
      throw new Error(`Relationship state fixture ${item.case_id} trust_score mismatch`);
    }
    if (snapshot.relationship_state.campaign_id !== item.expected_state.campaign_id) {
      throw new Error(`Relationship state fixture ${item.case_id} campaign mismatch`);
    }
    if (snapshot.relationship_state.journey_id !== item.expected_state.journey_id) {
      throw new Error(`Relationship state fixture ${item.case_id} journey mismatch`);
    }
  }

  for (const item of memoryCases) {
    const memory = PublishingMemorySnapshotSchema.parse(item.expected_snapshot);
    const output = deriveRelationshipStateFromMemory(memory);
    RelationshipStateSchema.parse(output.relationship_state);
  }

  for (const item of failures) {
    try {
      deriveRelationshipStateFromInput(item.input as any);
      throw new Error(`Relationship failure fixture ${item.case_id} unexpectedly succeeded`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(item.expected_failure)) {
        throw new Error(`Relationship failure fixture ${item.case_id} expected failure '${item.expected_failure}', got '${message}'`);
      }
    }
  }

  return {
    fixture_cases: cases.length,
    failure_cases: failures.length,
  };
}

export const relationshipStateContractTestResult = runRelationshipStateContractChecks();
