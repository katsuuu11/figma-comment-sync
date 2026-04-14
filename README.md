# figma-comment-sync

Figmaの**注釈ウィジェット + 設定プラグイン + Google Apps Script**で、注釈をGoogle Sheetsへ同期する実装サンプルです。

## ディレクトリ構成

- `apps-script/Code.gs`: Webアプリとして公開するApps Script本体
- `plugin/`: sharedPluginDataに設定を書き込むFigmaプラグイン
- `widget/`: 付箋スタイル注釈ウィジェット

## 1) Apps Script セットアップ

1. Googleスプレッドシートを作成し、Apps Scriptを開く
2. `apps-script/Code.gs` を貼り付け
3. Webアプリとしてデプロイ（アクセス権: **全員（匿名ユーザーを含む）**）
4. 発行されたURLを控える

### curl 疎通確認

```bash
curl -X POST "https://script.google.com/macros/s/XXXX/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"test-001",
    "type":"修正",
    "status":"未対応",
    "body":"ヘッダーの色が仕様と異なる",
    "author":"田中",
    "reviewer":"佐藤",
    "page":"TOPページ",
    "frame":"hero",
    "createdAt":"2025-01-01T00:00:00Z",
    "updatedAt":"2025-01-01T00:00:00Z",
    "figmaUrl":"https://www.figma.com/file/xxxx?node-id=1-1"
  }'
```

## 2) Figmaプラグイン セットアップ

1. Figmaで新規プラグインを作成し、`plugin/manifest.json` を指定
2. `plugin/code.js`, `plugin/ui.html` を配置
3. プラグインを実行して以下を保存
   - メンバー一覧
   - Apps Script URL

保存データは以下キーに格納されます。

- namespace: `figma-annotation`
- key: `config`
- value: `{ "endpointUrl": "...", "members": ["田中", "佐藤"] }`

## 3) Figmaウィジェット セットアップ

1. Figma Widgetプロジェクトで `widget/manifest.json` を反映
2. `widget/code.tsx`, `widget/fetch-proxy.html` を配置してビルド
3. キャンバス上にウィジェットを配置
4. 注釈を入力して「保存」クリック

## ウィジェットの動作

- 注釈タイプ（仕様/修正/確認）で付箋色を切り替え
- ステータス（未対応/対応中/完了）を保持
- 作成者/確認者はプラグイン設定のメンバーを循環選択
- 保存時に以下を自動付与してPOST
  - ページ名: `figma.currentPage.name`
  - フレーム名: 最寄りの `Frame` 名
  - URL: `https://www.figma.com/file/${fileKey}?node-id=${nodeId}`
  - 日時: `createdAt`（初回のみ）/`updatedAt`（毎回）

## 期待するシート列順

`ID / 注釈タイプ / ステータス / 本文 / 作成者 / 確認者 / 対象ページ / 対象フレーム / 投稿日時 / 更新日時 / FigmaURL`
