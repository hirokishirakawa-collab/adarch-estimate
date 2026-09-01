import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPackagePrice, parseDeliverables, parseFulfillment, parseOptions } from "@/lib/packages/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------
// POST /api/packages/draft
//   一言のアイデアから、パッケージの下書き（中身・分担・営業文・規定まで）を作る。
//   材料: 既存パッケージ（統一感を保つ）＋ 営業ガイドライン（禁止事項）＋ グループの成功事例
//   価格は「候補」として返すだけ＝画面側で人が入れる（本部が確定する）
//   body: { idea: string; baseSlug?: string }
// ---------------------------------------------------------------
const SYSTEM = `あなたは広告代理店グループ「アドアーチ」の本部で、加盟代表（全国の独立した小さな会社の社長）が
地元の中小企業に売る「パッケージ商品」を設計する担当です。

## 前提
- 加盟代表は自分では制作しないことが多い。制作はグループ内の制作代表へ発注、TVer等の媒体設定と報告は本部が行う
- 売る相手は地方の中小企業・店舗（採用に困っている／集客したい／周年など）
- 「売りやすさ」が最優先: 中身が一目で分かる・価格が固定・納期が言える・誰がやるか決まっている
- 営業文はフォーム営業（相手サイトの問い合わせフォーム）に貼る前提。丁寧・押し売りしない・1段落（180〜260字）・{name} は相手の会社名
- 媒体名を書くときは正規代理店として扱えるもの（TVer・イオンシネマ・タクシー広告・サイネージ・SNS）に限る
- 数字（再生数・リーチ等）は根拠が無ければ書かない。書くなら「目安」と付ける
- 既存パッケージがあれば、名前の付け方・粒度・分担の書き方を揃える`;

interface Draft {
  name: string;
  tagline: string;
  category: string;
  targetIndustries: string[];
  painPoints: string;
  summary: string;
  deliverables: { name: string; qty: number; unit: string; spec: string }[];
  leadTime: string;
  options: { name: string; price: number | null; note: string }[];
  priceType: "ONE_TIME" | "MONTHLY" | "INITIAL_PLUS_MONTHLY";
  priceHint: string;
  fulfillment: { task: string; owner: "HQ" | "BRANCH" | "PRODUCER"; note: string }[];
  pitchText: string;
  talkTrack: string;
  rules: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AIの設定がありません（ANTHROPIC_API_KEY）" }, { status: 503 });

  let body: { idea?: unknown; baseSlug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, 1200) : "";
  if (idea.length < 4) return NextResponse.json({ error: "アイデアを一言で書いてください（例: 周年企業向けの記念動画＋TVer）" }, { status: 400 });
  const baseSlug = typeof body.baseSlug === "string" ? body.baseSlug.slice(0, 60) : "";

  // 材料
  const [packages, guidelines, wins] = await Promise.all([
    db.salesPackage.findMany({
      where: { status: { in: ["ACTIVE", "PROPOSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { slug: true, name: true, tagline: true, category: true, deliverables: true, fulfillment: true, options: true, priceType: true, initialPrice: true, monthlyPrice: true, rules: true, pitchText: true },
    }),
    db.salesGuideline.findMany(),
    db.salesApproach.findMany({
      where: { result: { in: ["DEAL", "REPLIED_OK"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { industry: true, result: true, learnings: true, messageBody: true },
    }),
  ]);

  const base = baseSlug ? packages.find((p) => p.slug === baseSlug) : null;
  const pkgText = packages
    .map((p) => {
      const d = parseDeliverables(p.deliverables).map((x) => `${x.name}×${x.qty}${x.unit}`).join("・");
      const f = parseFulfillment(p.fulfillment).map((x) => `${x.task}=${x.owner}`).join("・");
      return `- ${p.name}（${p.category}／${formatPackagePrice(p)}）: ${d || "—"}／分担: ${f || "—"}`;
    })
    .join("\n");
  const prohibited = guidelines.find((g) => g.key === "prohibited")?.value;
  const winText = wins
    .map((w) => `- ${w.industry}／${w.result}: ${(w.learnings || w.messageBody).slice(0, 160)}`)
    .join("\n");

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `## 既存パッケージ（揃える基準）\n${pkgText || "（まだ無い）"}`,
            base ? `## 派生元（この型を踏襲して変える）\n${base.name}: 営業文=${base.pitchText ?? "—"}\n規定=${base.rules ?? "—"}\n中身=${JSON.stringify(parseDeliverables(base.deliverables))}\nオプション=${JSON.stringify(parseOptions(base.options))}` : "",
            prohibited ? `## 禁止事項（営業文に入れない）\n${JSON.stringify(prohibited)}` : "",
            winText ? `## グループで反応が出た営業（参考）\n${winText}` : "",
            `## アイデア（一言）\n${idea}`,
            `以下のJSONだけを出力してください（前後の説明・コードフェンス不要）。
{
  "name": "パッケージ名（15字以内・売り物として一目で分かる）",
  "tagline": "一言（30字以内）",
  "category": "分類（採用/サイネージ/TVer/SNS/動画制作/Web/イベント/その他 のどれか）",
  "targetIndustries": ["対象業種を3〜6個"],
  "painPoints": "想定顧客の悩み（誰の・何が・どう困っているか。2〜4文）",
  "summary": "概要（何が届くか。2〜4文）",
  "deliverables": [{"name":"品目","qty":1,"unit":"本","spec":"仕様（尺・本数・納品形式など）"}],
  "leadTime": "納期（例: 発注から4週間）",
  "options": [{"name":"追加オプション","price":null,"note":"内容"}],
  "priceType": "ONE_TIME | MONTHLY | INITIAL_PLUS_MONTHLY",
  "priceHint": "価格の考え方（相場と根拠・粗利の見立て。数字は候補として1〜2案）",
  "fulfillment": [{"task":"やること","owner":"HQ|BRANCH|PRODUCER","note":"補足"}],
  "pitchText": "フォーム営業用の営業文（1段落・{name}を使う・金額を入れる場合は「〜円〜」など幅で）",
  "talkTrack": "商談の切り口（最初の質問・刺さる言い方・よくある反論と返し。箇条書き可）",
  "rules": "統一規定（値引き上限・名称の使い方・言ってはいけないこと・納品の最低ライン。箇条書き）"
}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("no json");
    const raw = JSON.parse(jsonText.slice(start, end + 1)) as Partial<Draft>;

    const draft: Draft = {
      name: String(raw.name ?? "").slice(0, 80),
      tagline: String(raw.tagline ?? "").slice(0, 80),
      category: String(raw.category ?? "その他").slice(0, 40),
      targetIndustries: Array.isArray(raw.targetIndustries) ? raw.targetIndustries.map(String).slice(0, 10) : [],
      painPoints: String(raw.painPoints ?? ""),
      summary: String(raw.summary ?? ""),
      deliverables: parseDeliverables(raw.deliverables),
      leadTime: String(raw.leadTime ?? "").slice(0, 80),
      options: parseOptions(raw.options),
      priceType: raw.priceType === "MONTHLY" || raw.priceType === "INITIAL_PLUS_MONTHLY" ? raw.priceType : "ONE_TIME",
      priceHint: String(raw.priceHint ?? ""),
      fulfillment: parseFulfillment(raw.fulfillment),
      pitchText: String(raw.pitchText ?? ""),
      talkTrack: String(raw.talkTrack ?? ""),
      rules: String(raw.rules ?? ""),
    };
    return NextResponse.json({ draft, basedOn: packages.length });
  } catch (e) {
    console.error("[packages/draft]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "下書きの生成に失敗しました。もう一度お試しください" }, { status: 500 });
  }
}
