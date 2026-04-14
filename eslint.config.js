import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import securityPlugin from 'eslint-plugin-security';
import nodePlugin from 'eslint-plugin-n';

export default tseslint.config(
  // グローバル推奨ルール
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  securityPlugin.configs.recommended,

  // Node.js用ルールの適用（ビルドスクリプトや設定ファイルなどルート直下のファイル群に限定）
  {
    files: ['*.js', '*.ts', '*.cjs', '*.mjs'],
    ...nodePlugin.configs['flat/recommended-module'],
    rules: {
      'n/no-missing-import': 'off', // ViteやTypeScriptのインポート解決と衝突しやすいため無効化
      'n/no-unpublished-import': 'off'
    }
  },

  // フロントエンド向け除外設定
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx'],
    rules: {
      // フロントエンド(ブラウザ環境)での特定のNodeルールの誤検知を防ぐための設定があればここに記述
      // オブジェクトの動的キーアクセスはフロントエンドのディクショナリで頻繁に使うため、誤検知防止でOFFにする
      'security/detect-object-injection': 'off',
      // アンダースコアから始まる未使用変数を許可
      '@typescript-eslint/no-unused-vars': [
        'error',
        { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }
      ]
    }
  },

  // 共通ルールの微調整や特定ファイルの無視
  {
    ignores: ['dist/**', 'src-tauri/**', 'node_modules/**']
  }
);
