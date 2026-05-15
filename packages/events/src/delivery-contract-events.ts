export interface DeliveryContractEvent {
  event_id: string;
  event_type: "contract.created" | "contract.published" | "contract.failed";
  contract_id: string;
  actor: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export type DeliverySignal =
  | { event_type: "delivery.contract.ready"; contract_id: string; objective: string }
  | { event_type: "delivery.contract.blocked"; contract_id: string; reason: string };
