import { load, Store } from "@tauri-apps/plugin-store";
import { ResultAsync, okAsync } from "neverthrow";
import { SettingsSchema, type Settings } from "./schemas";

const STORE_PATH = "settings.json";

let storeInstance: Store | null = null;

/**
 * Storeインスタンスを取得
 */
async function getStore(): Promise<Store> {
    if (!storeInstance) {
        storeInstance = await load(STORE_PATH);
    }
    return storeInstance;
}

/**
 * 設定を読み込む
 */
export function loadSettings(): ResultAsync<Settings, Error> {
    return ResultAsync.fromPromise(
        (async () => {
            const store = await getStore();
            const apiKey = await store.get<string>("apiKey");
            const selectedModel = await store.get<string>("selectedModel");
            return { apiKey, selectedModel };
        })(),
        (error) => new Error(`設定読み込みエラー: ${error}`)
    ).andThen((data) => {
        const parsed = SettingsSchema.safeParse(data);
        if (!parsed.success) {
            // スキーマエラーでもデフォルト値を返す
            return okAsync({ apiKey: undefined, selectedModel: undefined });
        }
        return okAsync(parsed.data);
    });
}

/**
 * 設定を保存する
 */
export function saveSettings(settings: Partial<Settings>): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
        (async () => {
            const store = await getStore();
            if (settings.apiKey !== undefined) {
                await store.set("apiKey", settings.apiKey);
            }
            if (settings.selectedModel !== undefined) {
                await store.set("selectedModel", settings.selectedModel);
            }
            await store.save();
        })(),
        (error) => new Error(`設定保存エラー: ${error}`)
    );
}

/**
 * APIキーが設定されているか確認
 */
export function hasApiKey(): ResultAsync<boolean, Error> {
    return loadSettings().map((settings) => !!settings.apiKey);
}
