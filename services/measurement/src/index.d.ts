import { AttributionSeed, AttributionSeedSchema, AttributionChain, buildCanonicalChain, validateLineageTrace } from "@ifos/contracts";
export interface AttributionLineageEvaluation {
    chain_id: string;
    deterministic_signature: string;
    lineage_depth: number;
    links_count: number;
    immutable: true;
    is_valid: boolean;
    notes: string[];
}
export declare function buildAttributionLineage(seed: AttributionSeed): AttributionChain;
export declare function evaluateAttributionLineage(seed: unknown): AttributionLineageEvaluation;
export declare function assertAttributionIntegrity(seed: AttributionSeed, chain: AttributionChain): boolean;
export declare function buildLineageEnvelope(seed: AttributionSeed): {
    seed: any;
    chain: AttributionChain;
    evaluation: AttributionLineageEvaluation;
};
export { AttributionSeedSchema, buildCanonicalChain, validateLineageTrace };
