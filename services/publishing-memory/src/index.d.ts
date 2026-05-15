import { PublishingEvent, PublishingMemoryInputFixture, PublishingMemorySnapshot } from "@ifos/contracts";
export interface BucketCounts {
    [key: string]: {
        count: number;
        ratio: number;
    };
}
export declare function buildDistributionFromEvents(events: PublishingEvent[]): {
    stage_distribution: any;
    cta_distribution: any;
    value_type_mix: any;
    emotional_tone_mix: any;
};
export declare function buildPublishingMemory(snapshotInput: PublishingMemoryInputFixture): PublishingMemorySnapshot;
export declare function evaluatePublishingMemory(input: unknown): PublishingMemorySnapshot;
export declare function evaluatePublishingMemoryFailureCase(sourceEvents: unknown[], expectedFailure: string): boolean;
export declare function normalizePublishingEventRows(events: unknown[]): PublishingEvent[];
export { buildCanonicalChain } from "@ifos/contracts";
