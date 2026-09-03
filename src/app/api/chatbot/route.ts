import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { searchWikiArticles, formatArticlesForPrompt } from "@/lib/wiki-search";
import {
  detectQueryIntent,
  searchInternalKnowledge,
  formatInternalSourcesForPrompt,
} from "@/lib/internal-knowledge-search";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `あなたは「Ad-Arch Group OS」のヘルプ＆ナレッジアシスタント「アーチくん」です。
ユーザーの質問に対して、常に役立つ回答を返すことを最優先します。

## システム概要
Ad-Arch Group OS は広告代理店グループ「アドアーチ」の業務統合システムです。
全国の加盟パートナーが広告企画・媒体販売・映像制作の事業を展開しています。

## 主な機能（2026年9月時点・最新）
- **グループライブ／みんなのチャット** (/dashboard/live・ダッシュボード最上部にも常時表示) — 「いま誰が動いているか」を地図に灯し、全員に見えるチャットで声をかけ合う場所。📎で商談・顧客・案件・パッケージを紐づけて聞くと答えがその案件の履歴に残る。投稿には絵文字リアクション（👍❤️🔥👏😂🙏）を押せる（押す/外す・押した人が見える・通知は出ない）。地図やチャットのアバターを押すと1対1の「ひとこと」。顔アイコンは設定 (/dashboard/settings) で24種から選ぶ。誰も在席していない時の質問や「アーチくん」宛ての投稿にはチャットのアーチくんが返す。金額は書かない場所
- **営業フロー** (/dashboard/sales) — 「声かけ → 提案 → 受注」を一本道で進める営業の中心画面。広告媒体シミュレーターもこの流れに集約
- **あなたの営業数値** (/dashboard) — ご自身の探客・アプローチ・受注・エリア攻略率をトップに表示（ご本人のみ）
- **リード獲得AI** (/dashboard/leads) — エリア・業種を指定して営業候補リストを自動生成しAIスコアリング。リード管理 (/dashboard/leads/list) は「買う気配のシグナル」が新しい順に並ぶ
- **アウトリーチ（営業フォーム）** (/dashboard/leads/outreach) — 選択した会社への営業文面をAIが生成。フォーム送付に加え、メールアドレス取得済みの会社は件名・本文入りのメール下書きをワンクリックで開ける
- **返事待ち・結果登録** (/dashboard/leads/awaiting) — 送った先の結果を「返信あり／NG／無反応／断り」の4ボタンで登録。結果は自動でグループ事例DBに蓄積
- **受注→月次報告の取り込み** — 結果ボタンで「受注」にしたリードは月次報告の作成画面に候補として出て、クリックで明細に1行入る
- **入札ファインダー** (/dashboard/tender-finder) — 全国の自治体・官公庁の広告・映像関連の入札案件を自動収集
- **補助金ファインダー** (/dashboard/subsidy-finder) — クライアントの広告費の財源になる補助金を検索（動画制作費・媒体掲載費が対象になる制度あり）
- **周年ファインダー** (/dashboard/anniversary-finder) — 節目の周年（10/20/30/50/100周年等）を迎える会社を出典つきで一覧化。チェック選択とCSV書き出し対応
- **取引先マップ** (/dashboard/clients) — グループ全体の取引先・制作実績あり企業を写真つきカードと地図で一覧。地域・業種・規模・Google口コミ★で絞り込み、その集合の傾向（地域の集中・業種・★4.0以上の割合・従業員数の中央値）を表示。旧サイトの制作実績98本のサムネイルを会社ごとに紐づけ。金額は出さない
- **広告賞ファインダー** (/dashboard/award-finder) — 全国・地方・国際の広告賞（174件）の応募時期・応募料・狙いやすさを地域と制作物の種類から検索。制作前・制作中・完了後のどの段階でも「せっかくなので◯◯賞に出しませんか」をクライアントとのコミュニケーションのきっかけの一つにするための道具。地元の広告協会賞・地方紙広告賞・ラジオ局CMコンテストは応募料が無料〜数千円で、地元の制作会社の入賞も普通にある
- **既存顧客の一括登録** (/dashboard/customers) — 貼り付け・CSV・「URLからAI読み取り」でまとめて登録し、そのまま広告提案へ
- **広告媒体シミュレーター** — TVer (/dashboard/tver-simulator)、タクシー (/dashboard/taxi-ads-simulator)、スカイラーク、大学生協、イオンシネマ等の媒体別お見積り
- **継続案件（レギュラー）管理** (/dashboard/regulars) — 固定収入(MRR)・更新日を可視化
- **TVer広告 案件プール** (/dashboard/leads/tvcm-pool) — 本部抽出リードを先着claim
- **支払明細管理** (/dashboard/payments) / **経理情報の登録** (/dashboard/billing/settings) — 支払明細PDF・法人区分・インボイス・振込口座
- **ロイヤリティ・請求書のOS閲覧** (/dashboard/royalty)
- **営業プレイブック** (/dashboard/playbook) — 実績ベースのAI生成
- **契約更新管理** — 満了3ヶ月前から自動バナー・満了後はアクセス制限／月次報告・未払い解消後は自力復帰申請が可能
- **コンプライアンス相談**（旧:違反通報） (/dashboard/violation-report)

## 2026年8〜9月に追加された機能
- **パッケージ台帳** (/dashboard/packages・サイドバー「営業」→「パッケージ」) — 「何を・いくらで・誰が納品するか」が決まった売り物の台帳。各代表が「提案中」で起案し、本部が承認すると「稼働中」になる（稼働中の編集は本部のみ）。詳細画面から「営業フォームで使う（価格入り訴求）」「この内容で見積を作る（品目が最初から入る）」「お客様向け資料(A4)」「チャットでこれについて聞く（📎紐づけ）」へ進める。送付・返信・受注の記録がパッケージに紐づく。新規作成はAIで下書きできるが価格は人が入れる。公開ページ /p/<slug>、ログイン不要のフィードバック受け皿 /feedback/<slug>
- **LINE公式アカウント** (/dashboard/line・MANAGER以上) — 各拠点のLINE公式アカウントをOSにつなぐ（Lステップ等の代替）。接続（3つの値を貼る）／友だち一覧（検索・タグ・未読）／1:1チャット／タグ・メモ／ステップ配信（友だち追加・タグ・手動起点でN日後H時）／一斉配信（タグ絞り・予約）／あいさつ・自動返信／セミナー等の流入枠と地域別QR。本部は各拠点の接続状況と件数しか見ない（会話・友だち名は見ない）。Wiki「【新機能】LINE公式アカウントをOSにつなぐ（5分）」
- **TVerチラシ制作サポート** (/dashboard/tver-flyer・「広告申請」内・MANAGER以上) — 商圏（都道府県→市区町村・複数市の合算可）とクライアント・業種・秒数・予算を送ると、本部が数値を確定してA4縦1枚・拠点社名入りのチラシPDFを納品する（通知とメールで届く）。納品後はテンプレ3種（orange=既定・classic・poster）を代表がどれでもDLでき、業種に合ったヒーロー写真入り。印刷用の入稿PDF（塗り足し付き）も出せるので、印刷・配布は代表が印刷会社へ直接手配する（本部は間に入らない）。下書きは代表に見せず本部が作ってから渡す
- **デジタルサイネージ** (/dashboard/signage・サイドバー「サイネージ」・MANAGER以上) — 本部所有の端末を動かすCMS。端末・動作状況（ペアリング登録・再生状況）／プレイリスト（枠の並べ替え・秒数・広告主=顧客DB・掲載期間）／素材（アップロード）。設置先に無償で置いて広告枠を売るメディアオーナー型（設置先から月額を取るSaaS型ではない）
- **グループの動き** (/dashboard/group-moves・サイドバー「グループ共有」) — 拠点別カードに「業界×当たり方×段階」で動きを溜める場所。「動きを足す」の入力導線はここだけで、入れたものはグループライブにも流れる。金額は出さない。OSを開かない代表向けに、Google Chatから開けるログイン不要の /move（1件フォーム＋「AIに書かせて貼る」JSON一括取り込み）がある
- **リード管理の「解放中（誰でも取れる）」と取得の蓋** (/dashboard/leads/list) — 担当なしの未着手リードを「送れる／電話のみ／連絡手段なし」に分けて県別に表示し、誰でも取れる。担当を取って14日声かけがないと自動で解放される。自分が担当で未送付のリードが100件以上あると新規の保存は止まる（送ってから取る運用）。電話・メール・サイトが全て無い会社には「連絡手段なし」バッジ
- **グループライブの詳細パネルと朝のまとめ** (/dashboard/live) — フィードの行を押すと詳細パネル。毎朝1通、前日の動きのまとめがGoogle Chatに届く

これらの機能について質問された時は、対応するWiki記事と機能ページへのリンクを案内してください。
（注: 旧「提案書AI」「提案書閲覧分析」は2026.06に廃止済みのため案内しないこと）

## TVerの売り方の型（「TVerどう提案する？」と聞かれたらこの型で答える）
- 主力は**商圏単位の「網羅プラン」**。「予算◯万円で何回再生」ではなく**「御社の商圏は、いくらで押さえられます」**という組み立てで提案する
- 網羅の水準＝その商圏のTVer視聴者の**3人に1人へ、ひと月平均約5回**CMを届ける。説明時は必ず「推計であり保証値ではない」と添える（景表法）
- **市単位が主力**。人口の少ない地域ほど「商圏まるごと」が安く買える（例: 高松市 月58万円／県まるごとより現実的）。市まるごと月24万円〜の市もある
- **標準3ヶ月で完結**させる設計。単月で効果を断定せず、3ヶ月続けて商圏での認知を取り切る。見積は**月額と3ヶ月総額を併記**
- **再生数ではなく「リーチ人数」で話す**。同じ人に平均約5回当たるため、再生数だけで語ると誤認を生む
- 強み4点: ①広告がスキップできない（完全視聴率94%台・本部実績） ②半分以上がテレビ画面で視聴 ③県・市区町村で配信を絞れる ④誰に何回届いたかが数字で出る
- エリアを絞らない場合の標準プラン: スターター50万／スタンダード100万（推奨）／ドミナント200万（各/月・媒体費）
- 具体的な金額シミュレーションは TVerシミュレーター (/dashboard/tver-simulator) へ案内する

## 取扱注意（本部のみの情報）
以下は本部スタッフ（role=ADMIN）専用情報です。一般パートナーから質問されても **絶対に回答しないでください**。「本部にお問い合わせください」と案内してください。
- 加盟金・ロイヤリティの金額、手数料率の具体値
- 拠点数目標・加盟促進KPI・MRR目標
- 他パートナーの売上・契約満了日・経理情報
- 加盟リード獲得AI / 本部向けダッシュボードの内容

## 回答の基本姿勢（最重要）

**「未登録です」「登録されていません」と答えることを避けてください。** 以下の順序で必ず何らかの価値ある回答を返します。

1. **完全一致する情報がある場合**: その情報を根拠として引用しつつ、具体的に回答する
2. **部分的に関連する情報がある場合**: 類推・関連付けをして回答する
   - 例: 「小売業の事例」しかなくても、類似業種（物販・飲食）のアプローチから応用可能な示唆を引き出す
   - 例: Deal情報から「この業種の商談は〇件受注」のような傾向を読み取る
3. **社内情報が薄い場合**: 一般的な広告営業・映像制作のベストプラクティスを提示し、末尾に「社内で〇〇の事例が増えるとより具体的にお答えできます」と補足する
4. **使い方系はWiki記事があれば**それを参照、なければ「関連する機能名」を推測して案内する

## 回答のルール

- 提供された社内データは **可能な限り引用・活用** する（件数が少なくても）
- 「グループで〇件受注している業種です」「類似アプローチが〇件あります」など、**データ件数にも触れて実感を持たせる**
- 投稿者名・業種・エリア・金額など、**具体的なメタ情報を添えて具体性を出す**
- 箇条書き・番号リストを積極的に使い、読みやすく
- 回答は3〜10文程度、日本語、フレンドリーだが丁寧なトーン
- ユーザーが今いるページ（currentPage）がある場合、そのページ文脈に沿って回答
- 回答末尾には関連するOS機能・Wiki記事・投稿先へのリンクを1つ以上含める
  - 例: \`[アプローチ事例集](/dashboard/sales-approaches)\`
  - 例: \`[Wiki: 〇〇の使い方](/dashboard/wiki?q=〇〇)\`

## データが薄いときのフォールバック

社内ナレッジが2件以下の時は、必ず以下を添える:
「現在この領域のグループ事例は少ないため、一般的な知見と合わせてお答えします。実践された方は [アプローチ事例集](/dashboard/sales-approaches/new) への投稿をお願いします」

**要するに: 役に立つ回答を常に返す。ただし、社内データとそれ以外を明確に区別して伝える。**

## ツール活用
データベースを検索するツールが利用可能です。ユーザーが具体的な商談・顧客・実績について質問した場合は、ツールを使って実データを取得してから回答してください。
ツールで取得したデータは件数や具体名を引用して回答に含めてください。`;

// ----------------------------------------------------------------
// Tool Use: アーチくんが OS データベースを検索できるツール定義
// ----------------------------------------------------------------
const CHATBOT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_deals",
    description: "商談を検索する。顧客名・タイトル・ステータスで絞り込み可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "顧客名やタイトルのキーワード" },
        status: { type: "string", description: "ステータス: PROSPECTING, PROPOSAL, NEGOTIATION, WON, LOST" },
      },
    },
  },
  {
    name: "search_customers",
    description: "顧客（取引先）を名前で検索する。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "顧客名のキーワード" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_my_stats",
    description: "自分（またはログインユーザー）の商談件数・売上サマリーを取得する。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "check_report_status",
    description: "月次報告（売上報告）の提出状況を確認する。管理者のみ全拠点の提出状況を取得可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "対象月 YYYY-MM（省略時は今月）" },
      },
    },
  },
  {
    name: "check_contract_expiry",
    description:
      "契約満了が近いパートナー（GroupCompany）を取得する。デフォルトは90日以内。ADMINは全社、一般ユーザーは自社のみ。",
    input_schema: {
      type: "object" as const,
      properties: {
        withinDays: {
          type: "number",
          description: "何日以内に満了するかの日数（省略時は90）",
        },
      },
    },
  },
  {
    name: "search_tvcm_leads",
    description:
      "TVer広告 案件プール（source=PR_TIMES_TVCM）の状況を取得する。未claim件数・自分のclaim件数を返す。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "企業名・業種のキーワード（省略可）" },
      },
    },
  },
];

// ----------------------------------------------------------------
// ツール実行関数
// ----------------------------------------------------------------
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  user: { id: string; branchId: string | null; role: string },
): Promise<unknown> {
  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : user.branchId ? { branchId: user.branchId } : {};

  switch (name) {
    case "search_deals": {
      const where: Record<string, unknown> = { ...branchFilter };
      if (input.query) {
        where.OR = [
          { title: { contains: input.query as string, mode: "insensitive" } },
          { customer: { name: { contains: input.query as string, mode: "insensitive" } } },
        ];
      }
      if (input.status) where.status = input.status;

      const deals = await db.deal.findMany({
        where,
        include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      return deals.map((d) => ({
        title: d.title,
        customer: d.customer.name,
        assignedTo: d.assignedTo?.name || "未割当",
        amount: d.amount ? `¥${Number(d.amount).toLocaleString()}` : "未設定",
        status: d.status,
        probability: d.probability ? `${d.probability}%` : null,
        expectedClose: d.expectedCloseDate?.toISOString().split("T")[0],
        updated: d.updatedAt.toISOString().split("T")[0],
      }));
    }

    case "search_customers": {
      const customers = await db.customer.findMany({
        where: {
          ...branchFilter,
          // 実績アーカイブ（未整備）は通常の顧客検索に出さない
          NOT: { branchId: ARCHIVE_BRANCH_ID },
          name: { contains: input.query as string, mode: "insensitive" },
        },
        select: {
          name: true,
          industry: true,
          status: true,
          contactName: true,
          phone: true,
          prefecture: true,
          _count: { select: { deals: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      return customers.map((c) => ({
        name: c.name,
        industry: c.industry || "未設定",
        status: c.status,
        contactName: c.contactName,
        phone: c.phone,
        prefecture: c.prefecture,
        dealCount: c._count.deals,
      }));
    }

    case "get_my_stats": {
      const [dealCounts, thisMonthRevenue] = await Promise.all([
        db.deal.groupBy({
          by: ["status"],
          where: branchFilter,
          _count: true,
        }),
        db.revenueReport.aggregate({
          where: {
            ...branchFilter,
            targetMonth: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      return {
        deals: dealCounts.map((d) => ({ status: d.status, count: d._count })),
        thisMonth: {
          revenue: thisMonthRevenue._sum.amount
            ? `¥${Number(thisMonthRevenue._sum.amount).toLocaleString()}`
            : "¥0",
          reportCount: thisMonthRevenue._count,
        },
      };
    }

    case "check_report_status": {
      if (!isAdmin) return { error: "この機能は管理者のみ利用可能です" };

      const now = new Date();
      const monthStr =
        (input.month as string) ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = monthStr.split("-").map(Number);
      const targetMonth = new Date(y, m - 1, 1);

      const [reports, branches] = await Promise.all([
        db.revenueReport.findMany({
          where: { targetMonth },
          include: {
            branch: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        }),
        db.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
      ]);

      const submittedIds = new Set(reports.map((r) => r.branchId));
      return {
        month: monthStr,
        submitted: reports.map((r) => ({
          branch: r.branch.name,
          by: r.createdBy.name,
          amount: `¥${Number(r.amount).toLocaleString()}`,
        })),
        missing: branches.filter((b) => !submittedIds.has(b.id)).map((b) => b.name),
      };
    }

    case "check_contract_expiry": {
      const withinDays = typeof input.withinDays === "number" ? input.withinDays : 90;
      const now = new Date();
      const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

      // 一般ユーザーは自社（紐づくGroupCompany）のみ閲覧可能
      const userRecord = await db.user.findUnique({
        where: { id: user.id },
        select: { groupCompanyId: true },
      });

      const where: Record<string, unknown> = {
        contractEndDate: { lte: threshold, gte: now },
        isActive: true,
      };
      if (!isAdmin && userRecord?.groupCompanyId) {
        where.id = userRecord.groupCompanyId;
      } else if (!isAdmin) {
        return { error: "あなたのアカウントには加盟会社が紐づいていません" };
      }

      const companies = await db.groupCompany.findMany({
        where,
        select: {
          name: true,
          ownerName: true,
          contractEndDate: true,
          contractRenewed: true,
        },
        orderBy: { contractEndDate: "asc" },
        take: 50,
      });

      return {
        withinDays,
        count: companies.length,
        companies: companies.map((c) => {
          const daysLeft = c.contractEndDate
            ? Math.ceil((c.contractEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            : null;
          return {
            name: c.name,
            ownerName: c.ownerName,
            contractEndDate: c.contractEndDate?.toISOString().split("T")[0],
            daysLeft,
            renewed: c.contractRenewed,
          };
        }),
      };
    }

    case "search_tvcm_leads": {
      const baseWhere: Record<string, unknown> = { source: "PR_TIMES_TVCM" };
      if (input.query) {
        baseWhere.OR = [
          { name: { contains: input.query as string, mode: "insensitive" } },
          { industry: { contains: input.query as string, mode: "insensitive" } },
        ];
      }

      const [unclaimedCount, myClaimedCount, recentUnclaimed] = await Promise.all([
        db.lead.count({
          where: { ...baseWhere, assigneeId: null, status: { not: "SKIPPED" } },
        }),
        db.lead.count({
          where: { ...baseWhere, assigneeId: user.id },
        }),
        db.lead.findMany({
          where: { ...baseWhere, assigneeId: null, status: { not: "SKIPPED" } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            name: true,
            industry: true,
            prefecture: true,
            announcedDate: true,
            productionCompany: true,
          },
        }),
      ]);

      return {
        unclaimedCount,
        myClaimedCount,
        recentUnclaimed: recentUnclaimed.map((l) => ({
          name: l.name,
          industry: l.industry,
          prefecture: l.prefecture,
          announcedDate: l.announcedDate?.toISOString().split("T")[0],
          productionCompany: l.productionCompany,
        })),
        poolUrl: "/dashboard/leads/tvcm-pool",
      };
    }

    default:
      return { error: `不明なツール: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(session.user.email, "chatbot", AI_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { message, conversationId, currentPage, pageLabel } = await req.json();
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // ユーザーを取得
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 会話を取得 or 作成
  let conversation;
  if (conversationId) {
    conversation = await db.chatbotConversation.findFirst({
      where: { id: conversationId, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    });
  }

  if (!conversation) {
    conversation = await db.chatbotConversation.create({
      data: { userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  // ユーザーメッセージを保存
  await db.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message.trim(),
    },
  });

  // --- 質問タイプ判定 → 検索先を切り替え ---
  const intent = detectQueryIntent(message.trim());
  const searchQuery = [message.trim(), pageLabel || ""].filter(Boolean).join(" ");

  // Wikiと社内ナレッジを常に両方検索（営業系・事例系のときは社内ナレッジを優先）
  const wikiLimit = intent === "howto" ? 5 : 3;
  const internalLimit = intent === "howto" ? 4 : 10;

  const isAdmin = user.role === "ADMIN";
  const [wikiArticles, internalSources] = await Promise.all([
    searchWikiArticles(searchQuery, wikiLimit, { isAdmin }),
    searchInternalKnowledge(message.trim(), internalLimit),
  ]);

  const wikiContext = formatArticlesForPrompt(wikiArticles);
  const internalContext = formatInternalSourcesForPrompt(internalSources);

  // 動的コンテキストを構築（BASE_SYSTEM_PROMPTはキャッシュ対象として分離）
  let dynamicContext = `\n\n---\n\n# 検出された質問タイプ: ${intent}\n# 見つかった社内データ件数: ${internalSources.length}件\n# 見つかったWiki記事: ${wikiArticles.length}件`;

  if (wikiContext) {
    dynamicContext += `\n\n---\n\n# 関連Wiki記事\n\n${wikiContext}`;
  }

  if (internalContext) {
    dynamicContext += `\n\n---\n\n# 社内ナレッジ（グループ内の実例データ）\n\n**これらを根拠として引用・類推し、具体的なアドバイスを返してください。件数が少なくても必ず活用してください。**\n\n${internalContext}`;
  }

  if (!wikiContext && !internalContext) {
    dynamicContext += `\n\n---\n\n# 情報源\n\n関連する社内データは今回見つかりませんでした。一般的な広告営業・映像制作のベストプラクティスで回答してください。末尾に「社内で〇〇の事例が増えるとより具体的にお答えできます」と添えてください。`;
  }

  if (currentPage && pageLabel) {
    dynamicContext += `\n\n---\n\n## 現在のコンテキスト
- ユーザーが今見ているページ: ${pageLabel}（${currentPage}）
- ユーザーのロール: ${user.role}
- ユーザー名: ${user.name || "不明"}
このページに関連する質問には、より具体的なガイドを提供してください。`;
  }

  // 過去メッセージを Anthropic 形式に変換
  const history = (conversation.messages ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: message.trim() });

  // Claude API 呼び出し（ストリーミング + Tool Use + プロンプトキャッシュ）
  const client = new Anthropic({ apiKey });
  const systemPrompt = [
    { type: "text" as const, text: BASE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: dynamicContext },
  ];

  const encoder = new TextEncoder();
  let fullText = "";
  const metadata = {
    conversationId: conversation.id,
    intent,
    sources: {
      wiki: wikiArticles.map((a) => ({ id: a.id, title: a.title })),
      internal: internalSources.map((s) => ({ type: s.type, title: s.title })),
    },
  };

  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

      let currentMessages: Anthropic.Messages.MessageParam[] = [...history];
      let iterations = 0;

      while (iterations < 3) {
        const stream = client.messages.stream({
          model: "claude-sonnet-5",
          thinking: { type: "disabled" },
          max_tokens: 1024,
          system: systemPrompt,
          messages: currentMessages,
          tools: CHATBOT_TOOLS,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }

        const finalMessage = await stream.finalMessage();
        if (finalMessage.stop_reason !== "tool_use") break;

        // ツール実行
        const toolBlocks = finalMessage.content.filter(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
        );

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
          toolBlocks.map(async (block) => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(
              await executeTool(
                block.name,
                block.input as Record<string, unknown>,
                { id: user.id, branchId: user.branchId, role: user.role },
              ),
            ),
          })),
        );

        currentMessages = [
          ...currentMessages,
          { role: "assistant" as const, content: finalMessage.content },
          { role: "user" as const, content: toolResults },
        ];

        iterations++;
      }

      await db.chatbotMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: fullText,
        },
      });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
