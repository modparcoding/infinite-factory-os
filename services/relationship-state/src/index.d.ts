import { z } from "zod";
import { RelationshipHeuristicInput, RelationshipHeuristicSnapshot, RelationshipStateSchema, PublishingMemorySnapshot } from "@ifos/contracts";
declare const RelationshipHeuristicInputSchema: z.ZodObject<{
    relationship_id: z.ZodString;
    campaign_id: z.ZodString;
    journey_id: z.ZodString;
    memory_id: z.ZodString;
    trust_score: z.ZodNumber;
    commercial_density: z.ZodNumber;
    repetition_risk: z.ZodNumber;
    journey_stage_ratio: z.ZodNumber;
    previous_trust_level: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"cold">, z.ZodLiteral<"warming">, z.ZodLiteral<"engaged">, z.ZodLiteral<"trusting">, z.ZodLiteral<"saturated">, z.ZodLiteral<"over-commercialized">]>>;
}, "strip", z.ZodTypeAny, {
    relationship_id: string;
    campaign_id: string;
    journey_id: string;
    memory_id: string;
    trust_score: number;
    commercial_density: number;
    repetition_risk: number;
    journey_stage_ratio: number;
    previous_trust_level?: "cold" | "warming" | "engaged" | "trusting" | "saturated" | "over-commercialized" | undefined;
}, {
    relationship_id: string;
    campaign_id: string;
    journey_id: string;
    memory_id: string;
    trust_score: number;
    commercial_density: number;
    repetition_risk: number;
    journey_stage_ratio: number;
    previous_trust_level?: "cold" | "warming" | "engaged" | "trusting" | "saturated" | "over-commercialized" | undefined;
}>;
export declare function deriveRelationshipStateFromInput(input: RelationshipHeuristicInput): RelationshipHeuristicSnapshot;
export declare function deriveRelationshipStateFromMemory(memory: PublishingMemorySnapshot): RelationshipHeuristicSnapshot;
export declare function validateRelationshipInput(input: RelationshipHeuristicInput): boolean;
export { RelationshipHeuristicInputSchema, RelationshipStateSchema };
