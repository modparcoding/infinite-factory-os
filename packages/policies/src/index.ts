export const policySchemaKind = [
  "campaign",
  "journey",
  "trust",
  "commercial",
  "interpretation",
] as const;

export type PolicyKind = (typeof policySchemaKind)[number];

export interface PolicyFile {
  policy_id: string;
  kind: PolicyKind;
  scope: string;
  requires_human_approval: boolean;
  rules: Array<{
    when: string;
    then: string;
  }>;
  changed_at: string;
}

export interface PolicyRuntimeInput {
  relationship_id: string;
  trust_level: string;
  journey_stage: string;
  campaign_stage?: string;
  attribution_signal?: number;
}
