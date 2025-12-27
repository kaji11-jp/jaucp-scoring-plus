import { type ScoringResult } from "./schemas";

/**
 * 採点結果をWikitext形式に変換する
 */
export function formatAsWikitext(result: ScoringResult): string {
    const today = new Date().toLocaleDateString("ja-JP");
    
    let wikitext = `{| class="wikitable"\n`;
    wikitext += `|+ 採点結果（${today}時点）\n`;
    wikitext += `! 評価軸 !! 点数 !! 理由\n`;

    const axes = [
        { key: "humor", label: "ユーモア", max: 50 },
        { key: "structure", label: "構成一貫性", max: 20 },
        { key: "format", label: "記事フォーマット", max: 10 },
        { key: "language", label: "文章の自然さ", max: 10 },
        { key: "completeness", label: "完成度", max: 10 },
    ] as const;

    for (const axis of axes) {
        const score = result.details[axis.key];
        const reason = result.reasons[axis.key];
        wikitext += `|-\n`;
        wikitext += `| ${axis.label} || ${score}/${axis.max} || ${reason}\n`;
    }

    wikitext += `|-\n`;
    wikitext += `! 合計 !! ${result.total}/100 !! ${result.category}\n`;
    wikitext += `|}\n\n`;

    if (result.advice) {
        wikitext += `=== 改善アドバイス ===\n`;
        wikitext += `${result.advice}\n`;
    }

    // 署名追加
    wikitext += `\n--~~~~`;

    return wikitext;
}
