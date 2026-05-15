import type { JourneyAllocationPolicy, RelationshipAudienceJourney } from "@ifos/contracts";

export interface CampaignPlanInput {
  journey: RelationshipAudienceJourney;
  policy: JourneyAllocationPolicy;
}

export interface CampaignPlanOutput {
  sequence: string[];
  policy_id: string;
  warnings: string[];
}

export function buildCampaignSequence(input: CampaignPlanInput): CampaignPlanOutput {
  const uniqueObjectives = Array.from(new Set(input.journey.objective_ids));
  const stageGateTag = `stage:${input.policy.journey_stage}`;
  const policyTag = `policy:${input.policy.policy_id}`;
  const sequence = [stageGateTag, ...uniqueObjectives, policyTag].filter((value) => value.length > 0);

  const warnings: string[] = [];
  if (input.journey.objective_ids.length === 0) {
    warnings.push("journey_has_no_objectives");
  }
  if (input.policy.max_weekly_contact <= 0) {
    warnings.push("zero_weekly_contact");
  }

  return {
    sequence,
    policy_id: input.policy.policy_id,
    warnings,
  };
}
