import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { ScoringResultSchema, type ScoringResult } from "./schemas";

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * 記事を採点する
 */
export function scoreArticle(
    apiKey: string,
    model: string,
    articleContent: string,
    systemPrompt: string
): ResultAsync<ScoringResult, Error> {
    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: articleContent },
    ];

    return ResultAsync.fromPromise(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-Title": "JAUCP Scoring Tool",
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.3,
            }),
        }).then(async (response) => {
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API エラー (${response.status}): ${errorText}`);
            }
            return response.json() as Promise<ChatCompletionResponse>;
        }),
        (error) => new Error(`API 呼び出しエラー: ${error}`)
    ).andThen((response) => {
        const content = response.choices[0]?.message?.content;
        if (!content) {
            return errAsync(new Error("空のレスポンス"));
        }

        // JSONをパース
        let jsonContent: unknown;
        try {
            // コードブロックで囲まれている場合の対応
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            const rawJson = jsonMatch ? jsonMatch[1] : content;
            jsonContent = JSON.parse(rawJson.trim());
        } catch (e) {
            return errAsync(new Error(`JSON パースエラー: ${e}\n\nレスポンス: ${content}`));
        }

        // スキーマ検証
        const parsed = ScoringResultSchema.safeParse(jsonContent);
        if (!parsed.success) {
            return errAsync(
                new Error(`スキーマ検証エラー: ${parsed.error.message}`)
            );
        }

        return okAsync(parsed.data);
    });
}
