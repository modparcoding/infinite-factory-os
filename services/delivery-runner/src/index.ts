export interface DeliveryRunnerManifest {
  delivery_runner: string;
  owner_system: string;
  contract_contract: string;
  environment: string;
}

export const DELIVERY_RUNNER_MANIFEST: DeliveryRunnerManifest = {
  delivery_runner: "lead-magnet-delivery-runner",
  owner_system: "infinite-factory-os/workers/lead-magnet-delivery-runner",
  contract_contract: "Delivery Contract",
  environment: "superseded_by_os_scaffold",
} as const;

export function resolveDeliveryRunnerLocation() {
  return DELIVERY_RUNNER_MANIFEST.owner_system;
}
