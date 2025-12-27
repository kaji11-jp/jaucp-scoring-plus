import { load } from "@tauri-apps/plugin-store";

/**
 * ストアインターフェース
 * TauriのStoreとLocalStorageラッパーの共通インターフェース
 */
export interface IStore {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    save(): Promise<void>;
}

/**
 * LocalStorageを使用したストアの実装（Webブラウザ用フォールバック）
 */
class LocalStorageStore implements IStore {
    private path: string;
    private data: Record<string, any>;

    constructor(path: string) {
        this.path = path;
        try {
            const stored = localStorage.getItem(path);
            this.data = stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.warn("LocalStorage access failed:", e);
            this.data = {};
        }
    }

    async get<T>(key: string): Promise<T | null> {
        return (this.data[key] as T) ?? null;
    }

    async set(key: string, value: any): Promise<void> {
        this.data[key] = value;
    }

    async save(): Promise<void> {
        try {
            localStorage.setItem(this.path, JSON.stringify(this.data));
        } catch (e) {
            console.error("LocalStorage save failed:", e);
        }
    }
}

const stores: Record<string, IStore> = {};

/**
 * ストアインスタンスを取得する
 * Tauri環境ならTauriのStore、そうでなければLocalStorageStoreを返す
 */
export async function getStore(path: string): Promise<IStore> {
    if (stores[path]) {
        return stores[path];
    }

    try {
        // Tauri環境かどうかの簡易チェック
        // @ts-ignore
        if (window.__TAURI_INTERNALS__) {
             const store = await load(path);
             // TauriのStoreはIStoreの要件を満たすはずだが、型定義が厳密でない場合があるのでキャスト
             const wrapper: IStore = {
                 get: async <T>(key: string) => {
                     const val = await store.get<T>(key);
                     return (val === undefined ? null : val) as T | null;
                 },
                 set: (key, val) => store.set(key, val),
                 save: () => store.save()
             };
             stores[path] = wrapper;
             return wrapper;
        }
        throw new Error("Not in Tauri environment");
    } catch (e) {
        console.debug(`Falling back to LocalStorage for ${path}`);
        const store = new LocalStorageStore(path);
        stores[path] = store;
        return store;
    }
}
