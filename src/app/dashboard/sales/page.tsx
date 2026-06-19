import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LeadStatus, LeadSource, DealStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";
import { FavoriteButton } from "@/components/layout/favorite-button";
import {
  Workflow,
  PhoneCall,
  Megaphone,
  Sparkles,
  Radar,
  TrendingUp,
  FileText,
  Users,
  Repeat,
  Tv,
  Car,
  UtensilsCrossed,
  GraduationCap,
  Clapperboard,
  Flag,
  Building2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

// 営業フロー: 加盟代表が「声をかけて → 提案して → 受注する」まで迷わない
// よう、営業を2段階のタブに割って道具を出し分けるオーケストレーション画面。
// 既存ページへ誘導するだけで、商談/リードのロジックには触れない。

type Stage = "outreach" | "deal";

interface ToolCard {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const OUTREACH_TOOLS: ToolCard[] = [
  { href: "/dashboard/leads/list", label: "リード管理", desc: "声かけ先の一覧。未対応から順に当たる", icon: PhoneCall },
  { href: "/dashboard/leads", label: "リード獲得AI", desc: "エリア×業種で新しい声かけ先を発掘", icon: Radar },
  { href: "/dashboard/outreach-pipeline", label: "アウトリーチ", desc: "刺さる初回文面を生成して送る", icon: Megaphone },
  { href: "/dashboard/video-achievements", label: "競合実績スクレイピング", desc: "競合の実績から提案の糸口を拾う", icon: Sparkles },
];

const DEAL_TOOLS: ToolCard[] = [
  { href: "/dashboard/deals", label: "商談管理（SFA）", desc: "見込み→提案→受注を一枚で進める", icon: TrendingUp },
  { href: "/dashboard/strategy-advisor", label: "提案戦略アドバイザー（AI）", desc: "相手に合う媒体と提案の型を相談", icon: Sparkles },
  { href: "/dashboard/estimates", label: "公式見積もり", desc: "その場で見積を作って提示する", icon: FileText },
  { href: "/dashboard/customers", label: "顧客管理", desc: "商談化した本命を顧客として管理", icon: Users },
  { href: "/dashboard/regulars", label: "レギュラー案件", desc: "継続発注の取りこぼしを防ぐ", icon: Repeat },
];

const SIMULATORS: ToolCard[] = [
  { href: "/dashboard/tver-simulator", label: "TVer広告", desc: "テレビ局公式の動画広告", icon: Tv },
  { href: "/dashboard/taxi-ads-simulator", label: "タクシー広告", desc: "TOKYO PRIME", icon: Car },
  { href: "/dashboard/skylark-simulator", label: "すかいらーく", desc: "店内サイネージ", icon: UtensilsCrossed },
  { href: "/dashboard/univ-coop-simulator", label: "大学生協広告", desc: "学生に届く媒体", icon: GraduationCap },
  { href: "/dashboard/aeon-cinema-simulator", label: "イオンシネマ", desc: "映画館スクリーン", icon: Clapperboard },
  { href: "/dashboard/golfcart-simulator", label: "ゴルフカート", desc: "Golfcart Vision", icon: Flag },
  { href: "/dashboard/omochannel-simulator", label: "おもチャンネル", desc: "アパホテル客室", icon: Building2 },
];

interface PageProps {
  searchParams: Promise<{ stage?: string }>;
}

export default async function SalesFlowPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user.role ?? "USER") as UserRole;
  const isAdmin = role === "ADMIN";

  const { stage: stageParam } = await searchParams;
  const stage: Stage = stageParam === "deal" ? "deal" : "outreach";

  // リード（声かけ）側のベース除外。リード管理ページと同じ作法。
  const baseExclude = {
    status: { notIn: ["SKIPPED", "ARCHIVED"] as LeadStatus[] },
    NOT: { source: "PR_TIMES_TVCM" as LeadSource, assigneeId: null },
  };

  // 商談（顧客）側の拠点スコープ。ADMINは全拠点、それ以外は自拠点のみ。
  const currentUser = isAdmin
    ? null
    : await db.user.findUnique({
        where: { email: session.user.email ?? "" },
        select: { branchId: true },
      });
  const branchScope = isAdmin ? {} : { branchId: currentUser?.branchId ?? "__no_branch__" };

  const DEAL_OPEN: DealStatus[] = ["PROSPECTING", "QUALIFYING", "PROPOSAL"];
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [untouched, called, appointment, dealConverted, openDeals, wonThisMonth] =
    await Promise.all([
      db.lead.count({ where: { ...baseExclude, status: "UNTOUCHED" } }),
      db.lead.count({ where: { ...baseExclude, status: "CALLED" } }),
      db.lead.count({ where: { ...baseExclude, status: "APPOINTMENT" } }),
      db.lead.count({ where: { ...baseExclude, status: "DEAL_CONVERTED" } }),
      db.deal.count({ where: { ...branchScope, status: { in: DEAL_OPEN } } }),
      db.deal.count({
        where: { ...branchScope, status: "CLOSED_WON", updatedAt: { gte: startOfMonth } },
      }),
    ]);

  const outreachTotal = untouched + called + appointment;
  const dealTotal = openDeals;

  const outreachFunnel = [
    { label: "未対応", value: untouched, tone: "text-zinc-900" },
    { label: "架電・連絡済み", value: called, tone: "text-blue-700" },
    { label: "アポ獲得", value: appointment, tone: "text-emerald-700" },
    { label: "商談化", value: dealConverted, tone: "text-violet-700" },
  ];

  const dealFunnel = [
    { label: "進行中の商談", value: openDeals, tone: "text-blue-700" },
    { label: "今月の受注", value: wonThisMonth, tone: "text-emerald-700" },
  ];

  return (
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          <Workflow className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-lg font-bold text-zinc-900">営業フロー</h2>
            <FavoriteButton path="/dashboard/sales" label="営業フロー" />
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            声をかけて、提案して、受注する。制作はグループが引き取ります。
          </p>
        </div>
      </div>

      {/* 段階タブ */}
      <div className="flex items-center gap-2">
        <StageTab
          href="/dashboard/sales?stage=outreach"
          active={stage === "outreach"}
          step="①"
          label="声かけ"
          count={outreachTotal}
        />
        <ArrowRight className="w-4 h-4 text-zinc-300 shrink-0" />
        <StageTab
          href="/dashboard/sales?stage=deal"
          active={stage === "deal"}
          step="②"
          label="商談・提案"
          count={dealTotal}
        />
      </div>

      {stage === "outreach" ? (
        <StageSection
          funnel={outreachFunnel}
          tools={OUTREACH_TOOLS}
          toolsTitle="声かけの道具"
          goal="このタブのゴールは「アポ獲得」。アポが取れたら②へ進みます。"
        />
      ) : (
        <div className="space-y-6">
          <StageSection
            funnel={dealFunnel}
            tools={DEAL_TOOLS}
            toolsTitle="商談・提案の道具"
            goal="このタブのゴールは「受注」。受注後の制作はグループへ引き渡します。"
          />
          {/* 広告媒体シミュレーター */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">広告媒体シミュレーター</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                提案の場で金額と効果をその場で出す。媒体を「持てる」のがグループの強み。
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {SIMULATORS.map((t) => (
                <ToolLink key={t.href} tool={t} compact />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageTab({
  href,
  active,
  step,
  label,
  count,
}: {
  href: string;
  active: boolean;
  step: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
        active
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white border-zinc-200 text-zinc-600 hover:border-blue-300 hover:text-blue-700"
      }`}
    >
      <span className={`text-sm font-bold ${active ? "text-white/90" : "text-zinc-400"}`}>
        {step}
      </span>
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function StageSection({
  funnel,
  tools,
  toolsTitle,
  goal,
}: {
  funnel: { label: string; value: number; tone: string }[];
  tools: ToolCard[];
  toolsTitle: string;
  goal: string;
}) {
  return (
    <div className="space-y-5">
      {/* ファネルの数字 */}
      <div
        className={`grid grid-cols-2 gap-3 ${
          funnel.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-4"
        }`}
      >
        {funnel.map((f) => (
          <div key={f.label} className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
            <p className="text-[11px] text-zinc-500">{f.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${f.tone}`}>{f.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* ゴール案内 */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-2.5">
        <p className="text-xs text-blue-800">{goal}</p>
      </div>

      {/* 道具カード */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-900">{toolsTitle}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((t) => (
            <ToolLink key={t.href} tool={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolLink({ tool, compact = false }: { tool: ToolCard; compact?: boolean }) {
  const Icon = tool.icon;
  return (
    <Link
      href={tool.href}
      className="group flex items-start gap-3 bg-white rounded-lg border border-zinc-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="w-8 h-8 bg-zinc-50 group-hover:bg-blue-50 rounded-lg flex items-center justify-center shrink-0 transition-colors">
        <Icon className="w-4 h-4 text-zinc-500 group-hover:text-blue-600 transition-colors" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 group-hover:text-blue-700 transition-colors">
          {tool.label}
        </p>
        {!compact && <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{tool.desc}</p>}
        {compact && <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{tool.desc}</p>}
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-blue-500 transition-colors shrink-0 mt-1" />
    </Link>
  );
}
