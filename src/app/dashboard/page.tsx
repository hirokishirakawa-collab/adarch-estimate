import { auth } from "@/lib/auth";
import Link from "next/link";
import { getOrGenerateDigest } from "@/lib/digest";
import type { UserRole } from "@/types/roles";
import {
  Users,
  FolderKanban,
  PenLine,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Search,
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

      {/* ── リード獲得AI ── */}
      <Link
        href="/dashboard/leads"
        className="group block relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 px-6 py-5 hover:border-orange-300 hover:shadow-md transition-all"
      >
        <div className="flex items-center gap-4">
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
        </div>
      </Link>

      {/* ── グループダイジェスト ── */}
      {digest && (
        <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 px-5 py-4">
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

      {/* ── ご利用ガイド ── */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
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

      {/* ── クイックアクション（ご利用の流れに沿った4つ） ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

    </div>
  );
}
