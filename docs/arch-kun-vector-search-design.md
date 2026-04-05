# アーチくん ベクトル検索（Phase 3）設計ドキュメント

## 目的

現在のアーチくんは**キーワード完全一致**で Wiki / 社内ナレッジを検索している。以下の限界がある:

- 「toC向け提案」→「BtoC初期アプローチ」の記事にヒットしない（語彙の違い）
- 「タクシー広告の決め手」→「タクシーサイネージ」のDeal.closingFactorを拾えない
- 「商談を早く進めるには」→抽象的な質問に答えられない

**解決策:** ベクトル埋め込みを使った**意味ベースの類似度検索**に切り替える。

---

## アーキテクチャ選択肢

### 案A: pgvector（推奨）

**長所:**
- 既存PostgreSQL（Railway）にそのまま拡張として追加できる
- 別サービスやAPI不要、運用がシンプル
- トランザクション整合性を保てる

**短所:**
- Railway の Postgres で pgvector が有効か要確認（多くの場合デフォルトで使える）
- 大規模化（100万行超）では性能限界

**必要な準備:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 案B: 外部ベクトルDB（Pinecone / Weaviate / Qdrant）

**長所:**
- 高スケール対応
- メタデータフィルタリングが強力

**短所:**
- 追加コスト・追加の運用対象
- 現状データ規模（Wiki46件＋SalesApproach4件＋Deal76件）では過剰

### 案C: SQLite FTS5 / Postgres 全文検索

**長所:**
- 埋め込み不要、文字列ベース
- セットアップ簡単

**短所:**
- 意味理解はできない（「顧客」≠「クライアント」）
- キーワード検索の上位互換程度

**結論: 案A（pgvector）採用**

---

## データモデル

### 新規テーブル

```prisma
model EmbeddingIndex {
  id           String   @id @default(cuid())
  // 参照元
  sourceType   String   // "wiki" | "sales_approach" | "deal_closing_factor" | "highlight"
  sourceId     String   // 元レコードのID
  // テキスト本体
  content      String   @db.Text  // 埋め込み元テキスト（検索用）
  metadata     Json     // 表示用の付加情報（title, industry, 投稿者等）
  // ベクトル
  embedding    Unsupported("vector(1536)")?
  // メタ
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([sourceType, sourceId])
  @@index([sourceType])
  @@map("embedding_index")
}
```

### 埋め込み対象

| sourceType | 対象 | content | metadata |
|---|---|---|---|
| `wiki` | WikiArticle | `title + body` | `{ title }` |
| `sales_approach` | SalesApproach | `industry + targetDesc + messageBody + learnings` | `{ industry, method, result, author, group }` |
| `deal_closing_factor` | Deal (CLOSED_WON, closingFactor設定済) | `title + closingFactor` | `{ customer, industry, amount, closedAt }` |
| `highlight` | CollaborationHighlight (active) | `title + description` | `{ members, emoji }` |

---

## 実装フロー

### 1. 埋め込み生成パイプライン

```typescript
// src/lib/embeddings.ts
import Anthropic from "@anthropic-ai/sdk";

export async function generateEmbedding(text: string): Promise<number[]> {
  // Voyage AI（Anthropic推奨）または OpenAI embeddings-3-small を使用
  // 候補1: Voyage AI voyage-3 (1024次元)
  // 候補2: OpenAI text-embedding-3-small (1536次元、$0.02/1M tokens)
}
```

### 2. バッチインデックス作成

```typescript
// prisma/scripts/_build-embeddings.ts
// 全Wiki/SalesApproach/Deal/Highlightを走査
// → generateEmbedding → EmbeddingIndexに保存
// 初回実行: ~130件で数分、$0.01未満
```

### 3. 検索クエリ

```typescript
// src/lib/vector-search.ts
export async function semanticSearch(query: string, limit = 8) {
  const queryEmbedding = await generateEmbedding(query);
  // pgvector の cosine similarity (<=>) で検索
  return db.$queryRaw`
    SELECT *, embedding <=> ${queryEmbedding}::vector AS distance
    FROM embedding_index
    ORDER BY distance ASC
    LIMIT ${limit}
  `;
}
```

### 4. チャットボットAPIの統合

```typescript
// src/app/api/chatbot/route.ts
const results = await semanticSearch(message);
// results を sourceType でグループ化して system prompt に注入
```

### 5. 差分更新

Wiki/SalesApproach/Dealの作成・更新時に、対応するEmbeddingIndexレコードを再生成する必要がある。

**実装パターン:**
- 各モデルの server action で、更新後に `await upsertEmbedding(sourceType, sourceId)` を呼ぶ
- または Prisma middleware でフック（7.x対応要確認）

---

## マイグレーション手順

1. **Railway Postgresでpgvector有効化**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. **Prisma migration作成**（`Unsupported` 型はraw SQLで定義）
3. **埋め込みAPI選定**（Voyage AI契約 or OpenAI API使用）
4. **バッチスクリプト実装・初回インデックス構築**
5. **vector-search.ts実装**
6. **chatbot/route.ts にインテント別でsemanticSearch統合**
7. **差分更新フック設置**（各モデルのserver actions）
8. **既存のキーワード検索はfallbackとして残す**

---

## コスト見積もり

| 項目 | 見積 |
|---|---|
| OpenAI text-embedding-3-small（初回インデックス130件） | $0.01未満 |
| 月間クエリ（1000回/月 × 平均50トークン） | $0.001未満 |
| pgvector拡張 | 無料 |
| 運用人件費（実装工数） | 4-6時間 |

**月次コスト: ほぼ無視できる**

---

## ロールアウト順序

1. **Phase 3a**: pgvector導入＋Wiki記事のみベクトル化（リスク低）
2. **Phase 3b**: SalesApproach + CollaborationHighlight追加
3. **Phase 3c**: Deal.closingFactor追加（データが貯まってから）
4. **Phase 3d**: 差分更新フックを全server actionsに組み込み

---

## 成功指標

- 質問への**「該当なし」**回答率を30%以下に削減（現在キーワードマッチ依存で50%前後と推定）
- 「同業種×別エリア」の類似事例が正しく引ける（例: 京都の製薬 → 大阪の化粧品会社の事例）
- ユーザーから「具体的で役立った」という感触（Thumbs up機能を追加するとよい）

---

## 次セッションでの作業内容

1. Railway Postgres で `CREATE EXTENSION vector;` 可能か確認
2. Voyage AI vs OpenAI の選定（Anthropicユーザーとの整合性、コスト、日本語品質）
3. Prisma schema 拡張 → マイグレーション
4. `src/lib/embeddings.ts` と `src/lib/vector-search.ts` 実装
5. `prisma/scripts/_build-embeddings.ts` 初回インデックス構築
6. チャットボットAPIの差し替え（既存キーワード検索と並行運用 → A/B）
