import fs from "node:fs";
import path from "node:path";

import { AttributionSeedSchema, AttributionChainSchema, validateLineageTrace, buildCanonicalChain } from "@ifos/contracts";
import { buildAttributionLineage } from "@ifos/services-measurement";

interface AttributionFixtureCase {
  case_id: string;
  seed: unknown;
  expected_signature: string;
}

interface AttributionFailureCase {
  case_id: string;
  seed: unknown;
  expected_failure: string;
}

function loadJson<T>(fixturePath: string): T {
  const fullPath = path.resolve(process.cwd(), fixturePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

export function runAttributionContractChecks() {
  const cases = loadJson<AttributionFixtureCase[]>("tests/replay/attribution-lineage.snapshots.json");
  const failures = loadJson<AttributionFailureCase[]>("tests/replay/attribution-lineage.failures.json");

  const checks = {
    successful_cases: 0,
    failed_cases: 0,
    failure_cases: 0,
  };

  for (const item of cases) {
    const seedResult = AttributionSeedSchema.safeParse(item.seed);
    if (!seedResult.success) {
      checks.failed_cases += 1;
      throw new Error(`Attribution fixture ${item.case_id} failed seed schema`);
    }

    const chain = buildAttributionLineage(seedResult.data);
    const schemaResult = AttributionChainSchema.safeParse(chain);
    if (!schemaResult.success) {
      checks.failed_cases += 1;
      throw new Error(`Attribution fixture ${item.case_id} failed chain schema`);
    }

    if (!validateLineageTrace(chain, seedResult.data) || chain.deterministic_signature !== item.expected_signature) {
      checks.failed_cases += 1;
      throw new Error(`Attribution fixture ${item.case_id} failed deterministic trace`);
    }

    checks.successful_cases += 1;
  }

  for (const item of failures) {
    try {
      AttributionSeedSchema.parse(item.seed);
      buildCanonicalChain(item.seed as any);
      throw new Error(`Attribution failure fixture ${item.case_id} unexpectedly succeeded`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(item.expected_failure)) {
        throw new Error(`Attribution failure fixture ${item.case_id} expected '${item.expected_failure}', got '${message}'`);
      }
      checks.failure_cases += 1;
    }
  }

  return checks;
}

export const attributionContractTestResult = runAttributionContractChecks();
