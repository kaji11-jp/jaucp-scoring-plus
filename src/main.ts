import { loadSettings, saveSettings, getCurrentApiKey } from "./lib/settings";
import { generateOGPCanvas, downloadCanvasAsPng, type OGPOptions } from "./lib/ogp";
import { fetchAvailableModels, getModelDisplayName } from "./lib/models";
import { scoreArticle } from "./lib/scoring";
import { fetchGeminiModels, scoreArticleWithGemini } from "./lib/gemini";
import { fetchCerebrasModels, scoreArticleWithCerebras } from "./lib/cerebras";
import { checkWikipediaJa, checkWikipediaEn, generateTemplates, type WikipediaCheckResult } from "./lib/wikipedia";
import type { ScoringResult, ProviderType, Settings } from "./lib/schemas";
import { DEFAULT_SYSTEM_PROMPT, HUMORLESS_SYSTEM_PROMPT } from "./lib/prompts";
import { formatAsWikitext } from "./lib/export";
import { addHistory, getHistory, clearHistory } from "./lib/history";

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
const cerebrasKeyInput = document.getElementById("cerebras-key-input") as HTMLInputElement;
const cerebrasKeyGroup = document.getElementById("cerebras-key-group") as HTMLDivElement;
const systemPromptInput = document.getElementById("system-prompt-input") as HTMLTextAreaElement;
const promptPresetSelect = document.getElementById("prompt-preset-select") as HTMLSelectElement;
const resetPromptBtn = document.getElementById("reset-prompt-btn") as HTMLButtonElement;
const providerIcon = document.querySelector(".provider-icon") as HTMLImageElement;
const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
const articleInput = document.getElementById("article-input") as HTMLTextAreaElement;
const charCount = document.getElementById("char-count") as HTMLSpanElement;
const scoreBtn = document.getElementById("score-btn") as HTMLButtonElement;
const resultSection = document.getElementById("result-section") as HTMLElement;
const exportWikiBtn = document.getElementById("export-wiki-btn") as HTMLButtonElement;
const resultCategory = document.getElementById("result-category") as HTMLSpanElement;
const resultTotal = document.getElementById("result-total") as HTMLSpanElement;
const scoreTbody = document.getElementById("score-tbody") as HTMLTableSectionElement;
const adviceSection = document.getElementById("advice-section") as HTMLElement;
const adviceContent = document.getElementById("advice-content") as HTMLElement;
const errorSection = document.getElementById("error-section") as HTMLElement;
const errorMessage = document.getElementById("error-message") as HTMLSpanElement;
const historyList = document.getElementById("history-list") as HTMLDivElement;
const clearHistoryBtn = document.getElementById("clear-history-btn") as HTMLButtonElement;

// State
let currentSettings: Settings = {
  provider: "openrouter",
  openrouterApiKey: undefined,
  geminiApiKey: undefined,
  cerebrasApiKey: undefined,
  selectedModel: undefined,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};
let isScoring = false;
let currentResult: ScoringResult | null = null;

// Provider icons
const PROVIDER_ICONS: Record<ProviderType, string> = {
  openrouter: "https://svgl.app/library/openrouter_dark.svg",
  gemini: "https://svgl.app/library/gemini.svg",
  cerebras: "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/cerebras.svg",
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
  const labels: Record<ProviderType, string> = {
    openrouter: "OpenRouter",
    gemini: "Gemini",
    cerebras: "Cerebras",
  };
  providerIcon.alt = labels[currentSettings.provider];
}

/**
 * 設定ダイアログのプロバイダ表示を切り替え
 */
function toggleProviderFields() {
  const provider = providerSelect.value;
  openrouterKeyGroup.classList.toggle("hidden", provider !== "openrouter");
  geminiKeyGroup.classList.toggle("hidden", provider !== "gemini");
  cerebrasKeyGroup.classList.toggle("hidden", provider !== "cerebras");
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  settingsBtn.addEventListener("click", () => {
    providerSelect.value = currentSettings.provider;
    openrouterKeyInput.value = currentSettings.openrouterApiKey || "";
    geminiKeyInput.value = currentSettings.geminiApiKey || "";
    cerebrasKeyInput.value = currentSettings.cerebrasApiKey || "";
    
    const currentPrompt = currentSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    systemPromptInput.value = currentPrompt;

    if (currentPrompt === DEFAULT_SYSTEM_PROMPT) {
      promptPresetSelect.value = "default";
    } else if (currentPrompt === HUMORLESS_SYSTEM_PROMPT) {
      promptPresetSelect.value = "humorless";
    } else {
      promptPresetSelect.value = "custom";
    }

    toggleProviderFields();
    settingsDialog.showModal();
  });

  promptPresetSelect.addEventListener("change", () => {
    const val = promptPresetSelect.value;
    let newPrompt = "";
    if (val === "default") newPrompt = DEFAULT_SYSTEM_PROMPT;
    if (val === "humorless") newPrompt = HUMORLESS_SYSTEM_PROMPT;
    
    if (newPrompt) {
      if (systemPromptInput.value !== newPrompt && systemPromptInput.value.trim() !== "") {
         if (!confirm("プロンプトを上書きしますか？現在の編集内容は失われます。")) {
             return;
         }
      }
      systemPromptInput.value = newPrompt;
    }
  });

  systemPromptInput.addEventListener("input", () => {
    promptPresetSelect.value = "custom";
  });

  closeSettingsBtn.addEventListener("click", () => settingsDialog.close());
  cancelSettingsBtn.addEventListener("click", () => settingsDialog.close());

  settingsDialog.addEventListener("click", (e) => {
    if (e.target === settingsDialog) settingsDialog.close();
  });

  exportWikiBtn.addEventListener("click", () => {
    if (!currentResult) return;
    const text = formatAsWikitext(currentResult);
    navigator.clipboard.writeText(text);
    const originalText = exportWikiBtn.textContent;
    exportWikiBtn.textContent = "コピーしました！";
    setTimeout(() => {
      exportWikiBtn.textContent = originalText;
    }, 2000);
  });

  resetPromptBtn.addEventListener("click", () => {
    const val = promptPresetSelect.value;
    let targetPrompt = DEFAULT_SYSTEM_PROMPT;
    if (val === "humorless") targetPrompt = HUMORLESS_SYSTEM_PROMPT;
    
    if (confirm("プロンプトをリセットしますか？")) {
      systemPromptInput.value = targetPrompt;
      if (val === "custom") promptPresetSelect.value = "default";
    }
  });

  providerSelect.addEventListener("change", toggleProviderFields);

  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newSettings: Partial<Settings> = {
      provider: providerSelect.value as ProviderType,
      openrouterApiKey: openrouterKeyInput.value.trim() || undefined,
      geminiApiKey: geminiKeyInput.value.trim() || undefined,
      cerebrasApiKey: cerebrasKeyInput.value.trim() || undefined,
      systemPrompt: systemPromptInput.value.trim() || undefined,
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

  // タブ切り替え
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = (btn as HTMLButtonElement).dataset.tab;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.add("hidden"));

      btn.classList.add("active");
      document.getElementById(`tab-${tabId}`)?.classList.remove("hidden");
      hideError();

      if (tabId === "history") {
        renderHistoryList();
      }
    });
  });

  clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("全ての履歴を削除しますか？この操作は取り消せません。")) {
      const result = await clearHistory();
      result.match(
        () => renderHistoryList(),
        (e) => alert(`削除エラー: ${e.message}`)
      );
    }
  });

  // Wikipedia存在確認
  const wikiTitleInput = document.getElementById("wiki-title-input") as HTMLInputElement;
  const wikiCheckBtn = document.getElementById("wiki-check-btn") as HTMLButtonElement;
  const wikiResult = document.getElementById("wiki-result") as HTMLDivElement;
  const wikiStatusIcon = document.getElementById("wiki-status-icon") as HTMLSpanElement;
  const wikiStatusText = document.getElementById("wiki-status-text") as HTMLSpanElement;
  const wikiRedirectInfo = document.getElementById("wiki-redirect-info") as HTMLDivElement;
  const wikiRedirectTarget = document.getElementById("wiki-redirect-target") as HTMLSpanElement;
  const wikiTemplates = document.getElementById("wiki-templates") as HTMLDivElement;
  const wikiTemplateList = document.getElementById("wiki-template-list") as HTMLDivElement;

  wikiCheckBtn.addEventListener("click", async () => {
    const title = wikiTitleInput.value.trim();
    if (!title) {
      showError("記事タイトルを入力してください");
      return;
    }

    const btnText = wikiCheckBtn.querySelector(".btn-text") as HTMLSpanElement;
    const btnLoader = wikiCheckBtn.querySelector(".btn-loader") as HTMLSpanElement;

    btnText.textContent = "確認中...";
    btnLoader.classList.remove("hidden");
    wikiCheckBtn.disabled = true;
    hideError();
    wikiResult.classList.add("hidden");

    // 日本語・英語両方を並行チェック
    const [jaResultAsync, enResultAsync] = await Promise.all([
      checkWikipediaJa(title),
      checkWikipediaEn(title),
    ]);

    let jaResult: WikipediaCheckResult | null = null;
    let enResult: WikipediaCheckResult | null = null;

    jaResultAsync.match(
      (r) => { jaResult = r; },
      (e) => { console.error("日本語版エラー:", e); }
    );

    enResultAsync.match(
      (r) => { enResult = r; },
      (e) => { console.error("英語版エラー:", e); }
    );

    // 結果表示
    if (!jaResult && !enResult) {
      showError("Wikipedia APIへの接続に失敗しました");
    } else {
      displayWikiResult(jaResult, enResult, title);
    }

    btnText.textContent = "確認";
    btnLoader.classList.add("hidden");
    wikiCheckBtn.disabled = false;
  });

  function displayWikiResult(
    jaResult: WikipediaCheckResult | null,
    enResult: WikipediaCheckResult | null,
    originalTitle: string
  ) {
    wikiResult.classList.remove("hidden");

    // ステータス表示
    if (jaResult?.exists) {
      wikiStatusIcon.textContent = "✅";
      if (jaResult.isDisambiguation) {
        wikiStatusText.textContent = "存在（曖昧さ回避ページ）";
        wikiRedirectInfo.classList.add("hidden");
      } else if (jaResult.isRedirect) {
        wikiStatusText.textContent = `存在（リダイレクト）`;
        wikiRedirectInfo.classList.remove("hidden");
        wikiRedirectTarget.textContent = jaResult.redirectTarget || "";
      } else {
        wikiStatusText.textContent = "存在";
        wikiRedirectInfo.classList.add("hidden");
      }
    } else {
      wikiStatusIcon.textContent = "❌";
      wikiStatusText.textContent = "日本語版に存在しません";
      wikiRedirectInfo.classList.add("hidden");
    }

    // テンプレート生成
    if (jaResult || enResult) {
      const templates = generateTemplates(
        jaResult || { exists: false, isRedirect: false, isDisambiguation: false, title: originalTitle },
        enResult || { exists: false, isRedirect: false, isDisambiguation: false, title: originalTitle },
        originalTitle
      );

      if (templates.length > 0) {
        wikiTemplates.classList.remove("hidden");
        wikiTemplateList.innerHTML = templates
          .map(
            (t) => `
              <div class="template-item">
                <code class="template-code">${escapeHtml(t.template)}</code>
                <button class="btn btn-icon copy-btn" title="コピー" data-template="${escapeHtml(t.template)}">📋</button>
                <span class="template-desc">${escapeHtml(t.description)}</span>
              </div>
            `
          )
          .join("");

        // コピーボタン
        wikiTemplateList.querySelectorAll(".copy-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const template = (btn as HTMLButtonElement).dataset.template || "";
            navigator.clipboard.writeText(template);
            (btn as HTMLButtonElement).textContent = "✓";
            setTimeout(() => {
              (btn as HTMLButtonElement).textContent = "📋";
            }, 1000);
          });
        });
      } else {
        wikiTemplates.classList.add("hidden");
      }
    } else {
      wikiTemplates.classList.add("hidden");
    }
  }
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

  let result;
  if (currentSettings.provider === "gemini") {
    result = await fetchGeminiModels(apiKey);
  } else if (currentSettings.provider === "cerebras") {
    result = await fetchCerebrasModels(apiKey);
  } else {
    result = await fetchAvailableModels(apiKey);
  }

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
  const systemPrompt = currentSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  if (!apiKey || !model) {
    showError("APIキーまたはモデルが設定されていません");
    isScoring = false;
    btnText.textContent = "採点する";
    btnLoader.classList.add("hidden");
    updateScoreButtonState();
    return;
  }

  let result;
  if (currentSettings.provider === "gemini") {
    result = await scoreArticleWithGemini(apiKey, model, articleInput.value, systemPrompt);
  } else if (currentSettings.provider === "cerebras") {
    result = await scoreArticleWithCerebras(apiKey, model, articleInput.value, systemPrompt);
  } else {
    result = await scoreArticle(apiKey, model, articleInput.value, systemPrompt);
  }

  result.match(
    (scoring) => {
      currentResult = scoring;
      displayResult(scoring);
      addHistory(scoring, articleInput.value).match(
        () => {},
        (e) => console.error("履歴保存エラー:", e)
      );
    },
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

/**
 * 履歴リストを描画
 */
async function renderHistoryList() {
  historyList.innerHTML = '<div class="loader">読み込み中...</div>';
  
  const result = await getHistory();
  result.match(
    (history) => {
      if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">履歴はありません</div>';
        return;
      }

      historyList.innerHTML = history.map(item => {
        const date = new Date(item.timestamp).toLocaleString("ja-JP");
        const scoreClass = item.total >= 80 ? "score-high" : item.total >= 60 ? "score-mid" : "score-low";
        
        return `
          <div class="history-item" data-id="${item.id}">
            <div class="history-meta">
              <span class="history-date">${date}</span>
              <span class="history-category">${item.category}</span>
            </div>
            <div class="history-title">${escapeHtml(item.title)}</div>
            <div class="history-score ${scoreClass}">${item.total}点</div>
          </div>
        `;
      }).join("");

      // クリックイベント
      document.querySelectorAll(".history-item").forEach(el => {
        el.addEventListener("click", () => {
          const id = (el as HTMLElement).dataset.id;
          const item = history.find(h => h.id === id);
          if (item) {
            currentResult = item.result;
            displayResult(item.result);
            // 採点タブに切り替え
            const scoringTabBtn = document.querySelector('.tab-btn[data-tab="scoring"]') as HTMLElement;
            if (scoringTabBtn) scoringTabBtn.click();
          }
        });
      });
    },
    (error) => {
      historyList.innerHTML = `<div class="error-message">読み込みエラー: ${error.message}</div>`;
    }
  );
}

// ========================================
// OGP画像タブ
// ========================================
function setupOGPTab() {
  const titleInput = document.getElementById('ogp-title-input') as HTMLInputElement;
  const descInput = document.getElementById('ogp-desc-input') as HTMLTextAreaElement;
  const imageInput = document.getElementById('ogp-image-input') as HTMLInputElement;
  const imageBtn = document.getElementById('ogp-image-btn') as HTMLButtonElement;
  const imageName = document.getElementById('ogp-image-name') as HTMLSpanElement;
  const imageClear = document.getElementById('ogp-image-clear') as HTMLButtonElement;
  const previewBtn = document.getElementById('ogp-preview-btn') as HTMLButtonElement;
  const downloadBtn = document.getElementById('ogp-download-btn') as HTMLButtonElement;
  const previewCanvas = document.getElementById('ogp-preview-canvas') as HTMLCanvasElement;
  const placeholder = document.getElementById('ogp-preview-placeholder') as HTMLDivElement;
  const errorEl = document.getElementById('ogp-error') as HTMLDivElement;

  let currentOGPCanvas: HTMLCanvasElement | null = null;
  let selectedImageFile: File | null = null;

  function showOGPError(msg: string) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function hideOGPError() {
    errorEl.classList.add('hidden');
  }

  async function renderPreview() {
    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!title || !description) {
      showOGPError('タイトルと説明文を入力してください');
      return;
    }

    hideOGPError();
    previewBtn.disabled = true;
    previewBtn.textContent = '生成中...';

    try {
      const options: OGPOptions = { title, description, imageFile: selectedImageFile };
      const fullCanvas = await generateOGPCanvas(options);
      currentOGPCanvas = fullCanvas;

      // 600×315 にスケールダウンしてプレビューに描画
      const ctx = previewCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, 600, 315);
      ctx.drawImage(fullCanvas, 0, 0, 600, 315);

      placeholder.classList.add('hidden');
      previewCanvas.classList.remove('hidden');
      downloadBtn.disabled = false;
    } catch (e) {
      showOGPError(`生成エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      previewBtn.disabled = false;
      previewBtn.textContent = 'プレビュー更新';
    }
  }

  imageBtn.addEventListener('click', () => imageInput.click());

  // タイトル/説明変更時に自動プレビュー更新（デバウンス）
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePreview() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (titleInput.value.trim() && descInput.value.trim()) {
        renderPreview();
      }
    }, 600);
  }

  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0] ?? null;
    selectedImageFile = file;
    if (file) {
      imageName.textContent = file.name;
      imageClear.classList.remove('hidden');
    } else {
      imageName.textContent = '選択なし';
      imageClear.classList.add('hidden');
    }
    schedulePreview();
  });

  imageClear.addEventListener('click', () => {
    selectedImageFile = null;
    imageInput.value = '';
    imageName.textContent = '選択なし';
    imageClear.classList.add('hidden');
    schedulePreview();
  });

  previewBtn.addEventListener('click', renderPreview);
  titleInput.addEventListener('input', schedulePreview);
  descInput.addEventListener('input', schedulePreview);

  downloadBtn.addEventListener('click', () => {
    if (!currentOGPCanvas) return;
    const title = titleInput.value.trim();
    const safeName = title.replace(/[<>:"/\\|?*\s]/g, '_').substring(0, 40) || 'ogp';
    downloadCanvasAsPng(currentOGPCanvas, `${safeName}.png`);
  });
}

setupOGPTab();

// 初期化実行
init();
