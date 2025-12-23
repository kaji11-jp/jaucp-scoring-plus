import { z } from "@zod/zod";

/**
 * 採点結果の詳細スキーマ
 */
export const ScoringDetailsSchema = z.object({
    humor: z.number().min(0).max(50),
    structure: z.number().min(0).max(20),
    format: z.number().min(0).max(10),
    language: z.number().min(0).max(10),
    completeness: z.number().min(0).max(10),
});

/**
 * 採点理由のスキーマ
 */
export const ScoringReasonsSchema = z.object({
    humor: z.string(),
    structure: z.string(),
    format: z.string(),
    language: z.string(),
    completeness: z.string(),
});

/**
 * 採点結果のスキーマ
 */
export const ScoringResultSchema = z.object({
    category: z.string(),
    total: z.number().min(0).max(100),
    details: ScoringDetailsSchema,
    reasons: ScoringReasonsSchema,
    advice: z.string().optional(),
});

export type ScoringDetails = z.infer<typeof ScoringDetailsSchema>;
export type ScoringReasons = z.infer<typeof ScoringReasonsSchema>;
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

/**
 * OpenRouter モデル情報のスキーマ
 */
export const OpenRouterModelSchema = z.object({
    id: z.string(),
    name: z.string(),
    context_length: z.number(),
    pricing: z.object({
        prompt: z.string(),
        completion: z.string(),
    }),
});

export const OpenRouterModelsResponseSchema = z.object({
    data: z.array(OpenRouterModelSchema),
});

export type OpenRouterModel = z.infer<typeof OpenRouterModelSchema>;

/**
 * 設定のスキーマ
 */
export const SettingsSchema = z.object({
    apiKey: z.string().optional(),
    selectedModel: z.string().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;
