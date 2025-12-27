import { ResultAsync, okAsync } from "neverthrow";
import { HistoryItemSchema, type HistoryItem, type ScoringResult } from "./schemas";
import { getStore } from "./store";

const STORE_PATH = "history.json";

export function addHistory(result: ScoringResult, articleContent: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
        (async () => {
            const store = await getStore(STORE_PATH);
            const history = (await store.get<HistoryItem[]>("history")) || [];
            
            // タイトル抽出（簡易的：最初の空行でない行）
            const lines = articleContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);
            const title = lines.length > 0 ? lines[0].substring(0, 30) : "無題の記事";

            const newItem: HistoryItem = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                title: title,
                category: result.category,
                total: result.total,
                result: result,
            };

            // 新しい順に追加（最大100件保存）
            const newHistory = [newItem, ...history].slice(0, 100);
            await store.set("history", newHistory);
            await store.save();
        })(),
        (error) => new Error(`履歴保存エラー: ${error}`)
    );
}

export function getHistory(): ResultAsync<HistoryItem[], Error> {
    return ResultAsync.fromPromise(
        (async () => {
            const store = await getStore(STORE_PATH);
            const history = await store.get<unknown>("history");
            if (!history) return [];
            return history as HistoryItem[];
        })(),
        (error) => new Error(`履歴読み込みエラー: ${error}`)
    ).andThen((data) => {
        const parsed = HistoryItemSchema.array().safeParse(data);
        if (!parsed.success) {
            console.warn("履歴データの一部が無効です:", parsed.error);
            // エラーでも空配列を返してアプリを止めない
            return okAsync([] as HistoryItem[]);
        }
        return okAsync(parsed.data);
    });
}

export function clearHistory(): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
        (async () => {
            const store = await getStore(STORE_PATH);
            await store.set("history", []);
            await store.save();
        })(),
        (error) => new Error(`履歴削除エラー: ${error}`)
    );
}
