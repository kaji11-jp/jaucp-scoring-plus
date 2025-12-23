import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { OpenRouterModelsResponseSchema, type OpenRouterModel } from "./schemas";

/**
 * OpenRouter APIから利用可能なモデル一覧を取得
 * Cline方式の動的モデル取得
 */
export function fetchAvailableModels(
    apiKey: string
): ResultAsync<OpenRouterModel[], Error> {
    return ResultAsync.fromPromise(
        fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        }).then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        }),
        (error) => new Error(`モデル取得エラー: ${error}`)
    ).andThen((data) => {
        const parsed = OpenRouterModelsResponseSchema.safeParse(data);
        if (!parsed.success) {
            return errAsync(new Error(`スキーマ検証エラー: ${parsed.error.message}`));
        }
        // コンテキスト長でソート（大きい順）
        const sorted = parsed.data.data.sort(
            (a, b) => b.context_length - a.context_length
        );
        return okAsync(sorted);
    });
}

/**
 * モデルIDからモデル名を取得するヘルパー
 */
export function getModelDisplayName(model: OpenRouterModel): string {
    return model.name || model.id;
}

/**
 * モデルの料金情報をフォーマット
 */
export function formatModelPricing(model: OpenRouterModel): string {
    const promptPrice = parseFloat(model.pricing.prompt) * 1_000_000;
    const completionPrice = parseFloat(model.pricing.completion) * 1_000_000;
    return `$${promptPrice.toFixed(2)}/${completionPrice.toFixed(2)} per 1M tokens`;
}
