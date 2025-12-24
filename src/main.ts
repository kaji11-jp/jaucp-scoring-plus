import { loadSettings, saveSettings, getCurrentApiKey } from "./lib/settings";
import { fetchAvailableModels, getModelDisplayName } from "./lib/models";
import { scoreArticle } from "./lib/scoring";
import { fetchGeminiModels, scoreArticleWithGemini } from "./lib/gemini";
import type { ScoringResult, ProviderType, Settings } from "./lib/schemas";

// DOM Elements
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const settingsDialog = document.getElementById("settings-dialog") as HTMLDialogElement;
const closeSettingsBtn = document.getElementById("close-settings") as HTMLButtonElement;
const cancelSettingsBtn = document.getElementById("cancel-settings") as HTMLButtonElement;
const settingsForm = document.getElementById("settings-form") as HTMLFormElement;
const providerSelect = document.getElementById("provider-select") as HTMLSelectElement;
const openrouterKeyInput = document.getElementById("openrouter-key-input") as HTMLInputElement;
const geminiKeyInput = document.getElementById("gemini-key-input") as HTMLInputElement;
const openrouterKeyGroup = document.getElementById("openrouter-key-group") as HTMLDivElement;
const geminiKeyGroup = document.getElementById("gemini-key-group") as HTMLDivElement;
const providerIcon = document.querySelector(".provider-icon") as HTMLImageElement;
const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
const articleInput = document.getElementById("article-input") as HTMLTextAreaElement;
const charCount = document.getElementById("char-count") as HTMLSpanElement;
const scoreBtn = document.getElementById("score-btn") as HTMLButtonElement;
const resultSection = document.getElementById("result-section") as HTMLElement;
const resultCategory = document.getElementById("result-category") as HTMLSpanElement;
const resultTotal = document.getElementById("result-total") as HTMLSpanElement;
const scoreTbody = document.getElementById("score-tbody") as HTMLTableSectionElement;
const adviceSection = document.getElementById("advice-section") as HTMLElement;
const adviceContent = document.getElementById("advice-content") as HTMLElement;
const errorSection = document.getElementById("error-section") as HTMLElement;
const errorMessage = document.getElementById("error-message") as HTMLSpanElement;

// State
let currentSettings: Settings = {
  provider: "openrouter",
  openrouterApiKey: undefined,
  geminiApiKey: undefined,
  selectedModel: undefined,
};
let isScoring = false;

// Provider icons
const PROVIDER_ICONS: Record<ProviderType, string> = {
  openrouter: "https://svgl.app/library/openrouter_dark.svg",
  gemini: "https://svgl.app/library/gemini.svg",
};

// Evaluation axis info
const EVAL_AXES = [
  { key: "humor", label: "ユーモア", max: 50 },
  { key: "structure", label: "構成一貫性", max: 20 },
  { key: "format", label: "記事フォーマット", max: 10 },
  { key: "language", label: "文章の自然さ", max: 10 },
  { key: "completeness", label: "完成度", max: 10 },
] as const;

/**
 * 初期化
 */
async function init() {
  setupEventListeners();

  const settingsResult = await loadSettings();
  settingsResult.match(
    (settings) => {
      currentSettings = settings;
      updateProviderUI();
      loadModels();
    },
    (error) => {
      console.error("設定読み込みエラー:", error);
    }
  );

  updateCharCount();
}

/**
 * プロバイダUIを更新
 */
function updateProviderUI() {
  providerIcon.src = PROVIDER_ICONS[currentSettings.provider];
  providerIcon.alt = currentSettings.provider === "gemini" ? "Gemini" : "OpenRouter";
}

/**
 * 設定ダイアログのプロバイダ表示を切り替え
 */
function toggleProviderFields() {
  const isGemini = providerSelect.value === "gemini";
  openrouterKeyGroup.classList.toggle("hidden", isGemini);
  geminiKeyGroup.classList.toggle("hidden", !isGemini);
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  settingsBtn.addEventListener("click", () => {
    providerSelect.value = currentSettings.provider;
    openrouterKeyInput.value = currentSettings.openrouterApiKey || "";
    geminiKeyInput.value = currentSettings.geminiApiKey || "";
    toggleProviderFields();
    settingsDialog.showModal();
  });

  closeSettingsBtn.addEventListener("click", () => settingsDialog.close());
  cancelSettingsBtn.addEventListener("click", () => settingsDialog.close());

  settingsDialog.addEventListener("click", (e) => {
    if (e.target === settingsDialog) settingsDialog.close();
  });

  providerSelect.addEventListener("change", toggleProviderFields);

  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newSettings: Partial<Settings> = {
      provider: providerSelect.value as ProviderType,
      openrouterApiKey: openrouterKeyInput.value.trim() || undefined,
      geminiApiKey: geminiKeyInput.value.trim() || undefined,
    };

    const result = await saveSettings(newSettings);
    result.match(
      () => {
        currentSettings = { ...currentSettings, ...newSettings };
        updateProviderUI();
        loadModels();
      },
      (error) => showError(`設定保存エラー: ${error.message}`)
    );
    settingsDialog.close();
  });

  modelSelect.addEventListener("change", async () => {
    currentSettings.selectedModel = modelSelect.value;
    await saveSettings({ selectedModel: currentSettings.selectedModel });
    updateScoreButtonState();
  });

  articleInput.addEventListener("input", () => {
    updateCharCount();
    updateScoreButtonState();
    hideError();
  });

  scoreBtn.addEventListener("click", () => {
    if (!isScoring) performScoring();
  });

  const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
  clearBtn.addEventListener("click", () => {
    articleInput.value = "";
    updateCharCount();
    updateScoreButtonState();
    resultSection.classList.add("hidden");
    hideError();
  });
}

/**
 * モデル一覧を読み込む
 */
async function loadModels() {
  const apiKey = getCurrentApiKey(currentSettings);

  if (!apiKey) {
    modelSelect.innerHTML = '<option value="">APIキーを設定してください</option>';
    modelSelect.disabled = true;
    return;
  }

  modelSelect.innerHTML = '<option value="">読み込み中...</option>';
  modelSelect.disabled = true;

  const result = currentSettings.provider === "gemini"
    ? await fetchGeminiModels(apiKey)
    : await fetchAvailableModels(apiKey);

  result.match(
    (models) => {
      modelSelect.innerHTML = models
        .map((m) => {
          const name = "name" in m ? m.name : getModelDisplayName(m as never);
          return `<option value="${m.id}"${m.id === currentSettings.selectedModel ? " selected" : ""}>${name}</option>`;
        })
        .join("");
      modelSelect.disabled = false;

      if (!currentSettings.selectedModel && models.length > 0) {
        currentSettings.selectedModel = models[0].id;
        modelSelect.value = currentSettings.selectedModel;
        saveSettings({ selectedModel: currentSettings.selectedModel });
      }

      updateScoreButtonState();
    },
    (error) => {
      modelSelect.innerHTML = '<option value="">モデル取得エラー</option>';
      showError(`モデル取得エラー: ${error.message}`);
    }
  );
}

/**
 * 文字数カウント更新
 */
function updateCharCount() {
  const count = articleInput.value.length;
  charCount.textContent = `${count.toLocaleString()} 文字`;
}

/**
 * 採点ボタンの状態更新
 */
function updateScoreButtonState() {
  const hasContent = articleInput.value.trim().length > 0;
  const hasModel = !!currentSettings.selectedModel;
  const hasApiKey = !!getCurrentApiKey(currentSettings);
  scoreBtn.disabled = !hasContent || !hasModel || !hasApiKey || isScoring;
}

/**
 * 採点を実行
 */
async function performScoring() {
  if (isScoring) return;

  isScoring = true;
  const btnText = scoreBtn.querySelector(".btn-text") as HTMLSpanElement;
  const btnLoader = scoreBtn.querySelector(".btn-loader") as HTMLSpanElement;

  btnText.textContent = "採点中...";
  btnLoader.classList.remove("hidden");
  scoreBtn.disabled = true;
  hideError();
  resultSection.classList.add("hidden");

  const apiKey = getCurrentApiKey(currentSettings);
  const model = currentSettings.selectedModel;

  if (!apiKey || !model) {
    showError("APIキーまたはモデルが設定されていません");
    isScoring = false;
    btnText.textContent = "採点する";
    btnLoader.classList.add("hidden");
    updateScoreButtonState();
    return;
  }

  const result = currentSettings.provider === "gemini"
    ? await scoreArticleWithGemini(apiKey, model, articleInput.value)
    : await scoreArticle(apiKey, model, articleInput.value);

  result.match(
    (scoring) => displayResult(scoring),
    (error) => showError(error.message)
  );

  isScoring = false;
  btnText.textContent = "採点する";
  btnLoader.classList.add("hidden");
  updateScoreButtonState();
}

/**
 * 結果を表示
 */
function displayResult(result: ScoringResult) {
  resultCategory.textContent = result.category;

  resultTotal.textContent = `${result.total} / 100`;
  resultTotal.className = "total-score";
  if (result.total >= 80) {
    resultTotal.classList.add("score-high");
  } else if (result.total >= 60) {
    resultTotal.classList.add("score-mid");
  } else {
    resultTotal.classList.add("score-low");
  }

  scoreTbody.innerHTML = EVAL_AXES.map(({ key, label, max }) => {
    const score = result.details[key as keyof typeof result.details];
    const reason = result.reasons[key as keyof typeof result.reasons];
    return `
      <tr>
        <td>${label}</td>
        <td class="score-value">${max}</td>
        <td class="score-value">${score}</td>
        <td class="reason-cell">${escapeHtml(reason)}</td>
      </tr>
    `;
  }).join("");

  if (result.advice) {
    adviceContent.textContent = result.advice;
    adviceSection.classList.remove("hidden");
  } else {
    adviceSection.classList.add("hidden");
  }

  resultSection.classList.remove("hidden");
}

/**
 * エラーを表示
 */
function showError(message: string) {
  errorMessage.textContent = message;
  errorSection.classList.remove("hidden");
}

/**
 * エラーを非表示
 */
function hideError() {
  errorSection.classList.add("hidden");
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 初期化実行
init();
