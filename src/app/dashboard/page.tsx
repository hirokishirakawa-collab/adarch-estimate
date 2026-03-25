import { auth } from "@/lib/auth";
import Link from "next/link";
import { getOrGenerateDigest } from "@/lib/digest";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";
import {
  Users,
  FolderKanban,
  PenLine,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Search,
  Activity,
  Zap,
  ExternalLink,
  FileText,
  Crosshair,
  Tv2,
  CreditCard,
  BookOpen,
  ContactRound,
  Handshake,
  Megaphone,
  Palette,
  CalendarCheck,
  Target,
  Eye,
  Film,
  BarChart2,
  HardDrive,
  FolderOpen,
} from "lucide-react";

// ----------------------------------------------------------------
// ページ本体
// ----------------------------------------------------------------
export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  const name = session?.user?.name ?? null;

  const now = new Date();

  // ── ダイジェスト ──
  const digest = await getOrGenerateDigest();

  // ── 営業インサイト サマリー ──
  const [insightTotals, recentInsights] = await Promise.all([
    db.salesInsight.aggregate({
      _sum: { totalSent: true, totalReplied: true },
      _count: true,
    }),
    db.salesInsight.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        groupCompany: { select: { name: true, emoji: true } },
      },
    }),
  ]);

  const insightSummary = {
    totalReports: insightTotals._count,
    totalSent: insightTotals._sum.totalSent ?? 0,
    totalReplied: insightTotals._sum.totalReplied ?? 0,
    replyRate:
      insightTotals._sum.totalSent && insightTotals._sum.totalSent > 0
        ? Math.round(
            ((insightTotals._sum.totalReplied ?? 0) /
              insightTotals._sum.totalSent) *
              100
          )
        : 0,
  };

  // 直近のhotな業種を抽出
  type InsightJson = { industry: string; temperature: string; replied: number };
  const hotIndustries: string[] = [];
  for (const r of recentInsights) {
    const items = (r.insights as InsightJson[]) ?? [];
    for (const item of items) {
      if (item.temperature === "hot" && !hotIndustries.includes(item.industry)) {
        hotIndustries.push(item.industry);
      }
    }
    if (hotIndustries.length >= 3) break;
  }

  // ── 挨拶 ──
  const hour = now.getHours();
  const timeGreeting =
    hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "お疲れ様です";
  const firstName = name?.split(/[\s　]/)[0] ?? null;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">

      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-zinc-900">
            {timeGreeting}、{firstName ?? "ようこそ"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {new Intl.DateTimeFormat("ja-JP", {
              year: "numeric", month: "long", day: "numeric", weekday: "long",
            }).format(now)}
          </p>
        </div>
        {role === "ADMIN" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            本部 — 全拠点表示
          </span>
        )}
      </div>

      {/* ── グループダイジェスト ── */}
      {digest && (
        <div data-tour="digest" className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 w-7 h-7 bg-white/70 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-semibold text-indigo-600">グループダイジェスト — 直近3日間（AI分析）</p>
                <p className="text-[10px] text-indigo-400">
                  {new Intl.DateTimeFormat("ja-JP", {
                    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
                    timeZone: "Asia/Tokyo",
                  }).format(digest.updatedAt)}
                  {" 更新"}
                </p>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{digest.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 営業インサイト サマリー ── */}
      {insightSummary.totalReports > 0 && (
        <Link
          href="/dashboard/sales-insights"
          className="group block rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 px-5 py-4 hover:border-violet-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-800 group-hover:text-violet-700 transition-colors">
                営業インサイト共有
              </p>
              <p className="text-[11px] text-zinc-500">
                グループ全体の営業分析レポート
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-violet-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">レポート数</p>
              <p className="text-lg font-bold text-zinc-800">{insightSummary.totalReports}</p>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">総送信数</p>
              <p className="text-lg font-bold text-zinc-800">{insightSummary.totalSent}</p>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">総返信数</p>
              <p className="text-lg font-bold text-zinc-800">{insightSummary.totalReplied}</p>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
              <p className="text-[10px] text-zinc-400">返信率</p>
              <p className="text-lg font-bold text-violet-600">{insightSummary.replyRate}%</p>
            </div>
          </div>
          {hotIndustries.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-400">HOT業種:</span>
              {hotIndustries.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200"
                >
                  {ind}
                </span>
              ))}
            </div>
          )}
        </Link>
      )}

      {/* ── ご利用ガイド ── */}
      <div data-tour="guide-flow" className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
        <p className="text-[11px] font-semibold text-emerald-700 mb-2.5">ご利用の流れ</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-medium text-zinc-700">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">1</span>
            顧客管理に登録
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-medium text-zinc-700">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold">2</span>
            商談管理
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-medium text-zinc-700">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">3</span>
            プロジェクト一覧からプロジェクト追加
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">
          同じ顧客で新しい仕事が始まった場合は、商談管理 または プロジェクト一覧から新規追加してください
        </p>
      </div>

      {/* ── リード獲得AI ── */}
      <div data-tour="lead-ai" className="relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 px-6 py-5">
        <Link href="/dashboard/leads" className="group flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-800 group-hover:text-orange-700 transition-colors">
              リード獲得AI
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              AIがエリア・業種から見込み顧客を自動検索・スコアリング
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-orange-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
        </Link>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-orange-200/60">
          <span className="text-[10px] text-zinc-400 mr-1">検索タイプ:</span>
          <Link href="/dashboard/leads" className="text-[11px] font-semibold text-orange-600 bg-orange-100 hover:bg-orange-200 px-2.5 py-1 rounded-full border border-orange-200 transition-colors">
            BtoC
          </Link>
          <Link href="/dashboard/leads/btob" className="text-[11px] font-semibold text-blue-600 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-full border border-blue-200 transition-colors">
            BtoB
          </Link>
          <Link href="/dashboard/leads/cinema" className="text-[11px] font-semibold text-purple-600 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-full border border-purple-200 transition-colors">
            シネアド
          </Link>
        </div>
      </div>

      {/* ── 実績格納リンク ── */}
      <a
        href="https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link"
        target="_blank"
        rel="noopener noreferrer"
        className="group block relative overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 px-6 py-5 hover:border-amber-400 hover:shadow-lg transition-all ring-1 ring-amber-200/50"
      >
        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg">
          実績はここに格納
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform animate-pulse">
            <FolderOpen className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-800 group-hover:text-amber-700 transition-colors">
              実績フォルダ（Google Drive）
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              案件の実績データ・制作物はこちらに格納してください
            </p>
          </div>
          <ExternalLink className="w-5 h-5 text-amber-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
        </div>
      </a>

      {/* ── クイックアクション（ご利用の流れに沿った4つ） ── */}
      <div data-tour="quick-actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/dashboard/customers/new"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-blue-700">顧客を登録</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">STEP 1</p>
          </div>
        </Link>

        <Link
          href="/dashboard/deals"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center group-hover:bg-violet-200 transition-colors">
            <TrendingUp className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-violet-700">商談管理</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">STEP 2</p>
          </div>
        </Link>

        <Link
          href="/dashboard/projects"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <FolderKanban className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-emerald-700">プロジェクト</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">STEP 3</p>
          </div>
        </Link>

        <Link
          href="/dashboard/customers"
          className="group flex flex-col items-center gap-2 px-4 py-4 bg-white border border-zinc-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center"
        >
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <PenLine className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 group-hover:text-amber-700">活動を記録</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">顧客ページから</p>
          </div>
        </Link>
      </div>

      {/* ── OS更新情報 ── */}
      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-bold text-zinc-800">OS 更新情報</p>
        </div>
        <div className="space-y-2.5">
          {[
            {
              date: "2026.03.25",
              title: "ダッシュボード リンクツリー追加",
              desc: "主要機能へのクイックアクセスをダッシュボードに追加しました",
              tag: "NEW",
            },
            {
              date: "2026.03.24",
              title: "リード獲得AI — シネアド・BtoBリード対応",
              desc: "シネアド専用リードとBtoBリード検索に対応しました",
              tag: "NEW",
            },
            {
              date: "2026.03.22",
              title: "提案書AI — 閲覧トラッキング",
              desc: "Web提案書の閲覧状況をリアルタイムで分析できるようになりました",
              tag: "機能追加",
            },
            {
              date: "2026.03.20",
              title: "SNS簡易制作（Studio）正式リリース",
              desc: "SNSプラン生成・キャプション生成・自動字幕など制作支援ツールを公開",
              tag: "リリース",
            },
            {
              date: "2026.03.18",
              title: "案件マッチング機能",
              desc: "グループ内のスキル・実績に基づく案件マッチングを開始しました",
              tag: "機能追加",
            },
          ].map((item) => (
            <div
              key={item.date + item.title}
              className="flex items-start gap-3 bg-white/60 rounded-lg px-3 py-2.5 border border-sky-100"
            >
              <p className="text-[10px] text-zinc-400 font-mono whitespace-nowrap mt-0.5">
                {item.date}
              </p>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-zinc-800 truncate">
                    {item.title}
                  </p>
                  <span
                    className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      item.tag === "NEW"
                        ? "bg-sky-100 text-sky-600 border border-sky-200"
                        : item.tag === "リリース"
                          ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                          : "bg-violet-100 text-violet-600 border border-violet-200"
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── リンクツリー ── */}
      <div className="space-y-4">
        <p className="text-sm font-bold text-zinc-800">クイックリンク</p>

        {/* 営業 */}
        <div>
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-2">営業</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/customers", label: "顧客管理", icon: Users, iconClass: "text-blue-500" },
              { href: "/dashboard/deals", label: "商談管理（SFA）", icon: TrendingUp, iconClass: "text-blue-500" },
              { href: "/dashboard/estimates", label: "公式見積もり", icon: FileText, iconClass: "text-blue-500" },
              { href: "/dashboard/leads", label: "リード獲得AI", icon: Crosshair, iconClass: "text-orange-500" },
              { href: "/dashboard/sales-insights", label: "営業インサイト", icon: Activity, iconClass: "text-violet-500" },
              { href: "/dashboard/video-achievements", label: "競合実績スクレイピング", icon: Target, iconClass: "text-rose-500" },
              { href: "/dashboard/proposals", label: "提案書AI", icon: Sparkles, iconClass: "text-amber-500" },
              { href: "/dashboard/proposals/analytics", label: "提案書 閲覧分析", icon: Eye, iconClass: "text-amber-500" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                <link.icon className={`w-4 h-4 flex-shrink-0 ${link.iconClass}`} />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 広告媒体シミュレーター */}
        <div>
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">広告媒体シミュレーター</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/strategy-advisor", label: "提案戦略アドバイザー（AI）", icon: Sparkles },
              { href: "/dashboard/tver-simulator", label: "TVer広告", icon: Tv2 },
              { href: "/dashboard/taxi-ads-simulator", label: "タクシー広告", icon: Tv2 },
              { href: "/dashboard/skylark-simulator", label: "すかいらーく", icon: Tv2 },
              { href: "/dashboard/aeon-cinema-simulator", label: "イオンシネマ", icon: Tv2 },
              { href: "/dashboard/golfcart-simulator", label: "ゴルフカート", icon: Tv2 },
              { href: "/dashboard/omochannel-simulator", label: "おもチャンネル", icon: Tv2 },
              { href: "/dashboard/univ-coop-simulator", label: "大学生協広告", icon: Tv2 },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 制作・プロジェクト */}
        <div>
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest mb-2">制作・プロジェクト</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/projects", label: "プロジェクト一覧", icon: FolderKanban },
              { href: "/dashboard/cutsheet", label: "動画カット表AI", icon: Film },
              { href: "/dashboard/project-matching", label: "案件マッチング", icon: Handshake },
              { href: "/dashboard/group-profiles", label: "メンバー紹介", icon: Users },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-violet-300 hover:bg-violet-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-violet-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* SNS簡易制作（Studio） */}
        <div>
          <p className="text-[10px] font-semibold text-fuchsia-500 uppercase tracking-widest mb-2">SNS簡易制作（Studio）</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/studio", label: "Studio ホーム", icon: Palette },
              { href: "/dashboard/studio/clients", label: "クライアント管理", icon: Users },
              { href: "/dashboard/studio/generate", label: "SNSプラン生成", icon: Sparkles },
              { href: "/dashboard/studio/caption", label: "キャプション生成", icon: PenLine },
              { href: "/dashboard/studio/results", label: "成果ダッシュボード", icon: BarChart2 },
              { href: "/dashboard/studio/library", label: "制作ライブラリ", icon: HardDrive },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-fuchsia-300 hover:bg-fuchsia-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-fuchsia-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 経理・データベース・サポート */}
        <div>
          <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-widest mb-2">経理・データベース・サポート</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/billing", label: "請求依頼", icon: CreditCard, iconClass: "text-amber-500" },
              { href: "/dashboard/sales-report", label: "月次報告", icon: BarChart2, iconClass: "text-amber-500" },
              { href: "/dashboard/business-cards", label: "名刺管理", icon: ContactRound, iconClass: "text-teal-500" },
              { href: "/dashboard/wiki", label: "社内Wiki", icon: BookOpen, iconClass: "text-teal-500" },
              { href: "/dashboard/portfolio", label: "実績フォルダ検索", icon: HardDrive, iconClass: "text-teal-500" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-teal-300 hover:bg-teal-50/50 transition-all"
              >
                <link.icon className={`w-4 h-4 flex-shrink-0 ${link.iconClass}`} />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 広告申請 */}
        <div>
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-2">広告申請</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/tver-review", label: "TVer業態考査申請", icon: Tv2 },
              { href: "/dashboard/tver-campaign", label: "TVer配信申請", icon: Tv2 },
              { href: "/dashboard/tver-creative-review", label: "TVer クリエイティブ考査", icon: Tv2 },
              { href: "/dashboard/media", label: "媒体依頼", icon: Megaphone },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                <link.icon className="w-4 h-4 flex-shrink-0 text-blue-500" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 外部リンク */}
        <div>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">外部リンク</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { href: "https://calendar.app.google/DvCvNkUvw91Ytq9u8", label: "本部打ち合わせ予約" },
              { href: "https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link", label: "実績フォルダ（Drive）" },
              { href: "https://drive.google.com/drive/folders/1p9QtqSbPrBAkof5-10jeusyG6T2y7cB8?usp=drive_link", label: "グループ運用データ（Drive）" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-all"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0 text-zinc-400" />
                <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate">{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
