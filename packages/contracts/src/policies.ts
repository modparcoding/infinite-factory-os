export interface PolicyVersion {
  policy_id: string;
  name: string;
  kind: "trust" | "campaign" | "commercial" | "interpretation";
  version: string;
  effective_date: string;
  content_ref: string;
  governance_owner: string;
  immutable: boolean;
}

export interface PolicyChangeRequest {
  request_id: string;
  policy_id: string;
  change_summary: string;
  requires_human_approval: true;
  reviewer: string;
  reviewed_at?: string;
}
