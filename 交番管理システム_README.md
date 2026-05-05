# 交番管理システム

ヤマト運輸の営業所向け交番（シフト）管理Webアプリケーション。
コース（配送ルート）と社員の月次割り当てを自動生成し、管理者が素早く確認・修正できます。

---

## 機能一覧

| 機能 | 概要 |
|------|------|
| 自動シフト生成 | 3種の優先ルール×5パターンを一括生成 |
| ドラッグ＆ドロップ編集 | 社員タブで担当者をドラッグで入れ替え（PC・スマホ対応） |
| 日別コース設定 | 日付ごとに稼働コースをON/OFF。前月コピー機能あり |
| 予定・希望休入力 | 社員ごとに希望休・研修などを事前登録し自動生成に反映 |
| シフト診断 | 精度スコア・ルール違反・未割当を自動チェック |
| ダッシュボード | 労働時間・土日出勤偏差をグラフで分析 |
| CSV出力 / 印刷 | A4横向きPDF印刷・CSV一括ダウンロード |
| バックアップ | 全データのJSON出力・読込（機種変更・復元対応） |
| リマインダー通知 | 毎月の提出期限日を設定してブラウザ通知 |
| ダークモード | システム設定に関わらずトグル切替可能 |
| PWA対応 | ホーム画面追加・スタンドアロン起動（Android / iOS） |
| 複数営業所管理 | 営業所ごとにデータを完全分離して管理 |

---

## 技術スタック

| カテゴリ | 使用技術 |
|----------|----------|
| フロントエンド | React 19 + TypeScript |
| ビルドツール | Vite 8 |
| スタイリング | Tailwind CSS v4 |
| ルーティング | React Router v7 |
| 状態管理 | React Context API + localStorage |
| アイコン | Lucide React |
| 日付処理 | date-fns |
| デプロイ | Vercel |

---

## セットアップ

### 前提条件

- Node.js 20以上
- npm 10以上

### インストール・起動

```bash
# リポジトリのクローン（またはフォルダに移動）
cd 交番管理システム

# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで `http://localhost:5173` にアクセス。

### ビルド

```bash
npm run build
```

`dist/` フォルダにビルド成果物が出力されます。

---

## デプロイ

Vercel CLI を使用してデプロイします。

```bash
# 本番デプロイ
npx vercel --prod
```

本番URL: `https://yamato-shift.vercel.app`

---

## プロジェクト構成

```
交番管理システム/
├── public/
│   ├── favicon.svg          # アプリアイコン
│   └── manifest.json        # PWAマニフェスト
├── src/
│   ├── components/
│   │   ├── Layout.tsx        # サイドバー・ナビゲーション・バックアップUI
│   │   └── Toast.tsx         # トースト通知
│   ├── pages/
│   │   ├── BranchSelect.tsx  # 営業所選択画面
│   │   ├── ShiftManage.tsx   # 交番管理（メイン画面）
│   │   ├── CourseManage.tsx  # コース管理
│   │   ├── EmployeeManage.tsx# 社員管理
│   │   ├── Dashboard.tsx     # ダッシュボード
│   │   └── HelpPage.tsx      # 使い方ガイド
│   ├── store/
│   │   ├── AppContext.tsx     # グローバル状態・localStorage永続化
│   │   └── ThemeContext.tsx   # ダークモード管理
│   ├── utils/
│   │   ├── shiftGenerator.ts # 自動生成アルゴリズム
│   │   └── notifications.ts  # リマインダー通知
│   ├── types.ts              # 型定義
│   ├── main.tsx              # エントリーポイント
│   └── index.css             # Tailwind CSS・カスタムアニメーション
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## データ保存

すべてのデータはブラウザの **localStorage** に保存されます。
サーバーへの送信は一切行いません。

> ブラウザのキャッシュクリアでデータが消える場合があります。
> 定期的に「バックアップ出力」でJSONファイルを保存してください。

---

## ライセンス

社内利用専用。無断転用・再配布禁止。
