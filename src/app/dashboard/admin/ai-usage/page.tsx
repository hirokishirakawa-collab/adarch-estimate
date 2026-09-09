// ==============================================================
// AI活用度（ADMIN専用・2026-09-09）
//   「誰がAIで動いているか」を拠点別に数字で見る。
//   材料 = 監査ログ（mcp_os_read / mcp_os_write / brand_kit_mcp / mcp_connected）＋ アーチくんの会話数 ＋ 接続中のAIクライアント。
//   MCP（各代表のClaude/ChatGPT）とアーチくん（OS内）は同じ action に残るので、detail 先頭の [クライアント名] で分ける。
//   金額は扱わない。ADMIN判定は共通ガード（/dashboard/admin）＋このページの二重。
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { Bot } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

const PERIODS = [
  { days: 7, label: "7日間" },
  { days: 30, label: "30日間" },
  { days: 90, label: "90日間" },
];
const AI_ACTIONS = ["mcp_os_read", "mcp_os_write", "brand_kit_mcp", "mcp_connected"] as const;

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
const fmtDay = (d: Date | null | undefined) => (d ? new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10) : "—");
const clientOf = (detail: string | null) => {
  const m = /^\[([^\]]+)\]/.exec(detail ?? "");
  return m ? m[1] : "AI";
};

export default async function AiUsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const days = PERIODS.some((p) => p.days === Number(sp.days)) ? Number(sp.days) : 30;
  const since = sinceDate(days);

  const [logs, chats, grants, users] = await Promise.all([
    db.auditLog.findMany({
      where: { createdAt: { gte: since }, action: { in: [...AI_ACTIONS] } },
      select: { email: true, action: true, entityId: true, detail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.chatbotMessage.groupBy({ by: ["conversationId"], where: { createdAt: { gte: since }, role: "user" }, _count: true }),
    db.oAuthGrant.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { userEmail: true, clientName: true, lastUsedAt: true, createdAt: true } }),
    db.user.findMany({
      where: { isActive: true, email: { not: "arch-kun@adarch.co.jp" } },
      select: { id: true, email: true, name: true, role: true, groupCompany: { select: { name: true, prefecture: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  // アーチくんの会話 → 利用者
  const convIds = chats.map((c) => c.conversationId);
  const convs = convIds.length ? await db.chatbotConversation.findMany({ where: { id: { in: convIds } }, select: { id: true, userId: true } }) : [];
  const chatByUser = new Map<string, number>();
  for (const c of chats) {
    const uid = convs.find((x) => x.id === c.conversationId)?.userId;
    if (uid) chatByUser.set(uid, (chatByUser.get(uid) ?? 0) + c._count);
  }

  type Row = { email: string; name: string; company: string; prefecture: string | null; role: string; read: number; write: number; kit: number; chat: number; clients: string[]; lastAt: Date | null; tools: Map<string, number> };
  const rows = new Map<string, Row>();
  const rowFor = (email: string): Row | null => {
    const u = users.find((x) => x.email === email);
    if (!u) return null;
    let r = rows.get(email);
    if (!r) {
      r = { email, name: u.name ?? email, company: u.groupCompany?.name ?? (u.role === "ADMIN" ? "本部" : "拠点なし"), prefecture: u.groupCompany?.prefecture ?? null, role: u.role, read: 0, write: 0, kit: 0, chat: 0, clients: [], lastAt: null, tools: new Map() };
      rows.set(email, r);
    }
    return r;
  };
  for (const l of logs) {
    const r = rowFor(l.email);
    if (!r) continue;
    if (l.action === "mcp_os_read") r.read++;
    else if (l.action === "mcp_os_write") r.write++;
    else if (l.action === "brand_kit_mcp") r.kit++;
    if (l.action !== "mcp_connected") {
      const c = clientOf(l.detail);
      if (!r.clients.includes(c)) r.clients.push(c);
      if (l.entityId) r.tools.set(l.entityId, (r.tools.get(l.entityId) ?? 0) + 1);
    }
    if (!r.lastAt || l.createdAt > r.lastAt) r.lastAt = l.createdAt;
  }
  for (const u of users) {
    const n = chatByUser.get(u.id) ?? 0;
    if (n > 0) {
      const r = rowFor(u.email);
      if (r) r.chat += n;
    }
  }
  for (const g of grants) {
    const r = rowFor(g.userEmail);
    if (!r) continue;
    const c = `${g.clientName ?? "AI"}（接続中）`;
    if (!r.clients.some((x) => x.startsWith(g.clientName ?? "AI"))) r.clients.push(c);
  }

  const active = [...rows.values()].sort((a, b) => b.read + b.write + b.chat + b.kit - (a.read + a.write + a.chat + a.kit));
  const activeEmails = new Set(active.map((r) => r.email));
  const silent = users.filter((u) => u.role !== "ADMIN" && !activeEmails.has(u.email));
  const totals = active.reduce((t, r) => ({ read: t.read + r.read, write: t.write + r.write, kit: t.kit + r.kit, chat: t.chat + r.chat }), { read: 0, write: 0, kit: 0, chat: 0 });
  const connectedCompanies = new Set(grants.map((g) => users.find((u) => u.email === g.userEmail)?.groupCompany?.name).filter(Boolean)).size;
  const toolTotals = new Map<string, number>();
  for (const r of active) for (const [k, v] of r.tools) toolTotals.set(k, (toolTotals.get(k) ?? 0) + v);
  const topTools = [...toolTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Bot className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">AI活用度</h2>
            <p className="text-xs text-zinc-500 mt-0.5">誰がAIで動いているか。AI連携（Claude/ChatGPT）とアーチくんの利用を拠点別に（ADMIN専用・金額なし）</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <Link key={p.days} href={`/dashboard/admin/ai-usage?days=${p.days}`} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${days === p.days ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "AI連携 接続中", value: `${connectedCompanies}社`, sub: `${grants.length}接続` },
          { label: "使った人", value: `${active.length}人`, sub: `${silent.length}人はまだ` },
          { label: "OS読み取り", value: totals.read.toLocaleString("ja-JP"), sub: "回" },
          { label: "OS書き込み（AI記録）", value: totals.write.toLocaleString("ja-JP"), sub: "回" },
          { label: "アーチくん", value: totals.chat.toLocaleString("ja-JP"), sub: "質問" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-zinc-500 font-semibold">{c.label}</p>
            <p className="text-2xl font-bold text-zinc-800">{c.value}<span className="text-xs font-medium text-zinc-400 ml-1">{c.sub}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">拠点別（使っている順）</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-zinc-100">
                  <th className="px-4 py-2 text-left font-semibold">拠点／名前</th>
                  <th className="px-3 py-2 text-right font-semibold">読取</th>
                  <th className="px-3 py-2 text-right font-semibold">記録</th>
                  <th className="px-3 py-2 text-right font-semibold">キット</th>
                  <th className="px-3 py-2 text-right font-semibold">アーチくん</th>
                  <th className="px-3 py-2 text-left font-semibold">使ったAI</th>
                  <th className="px-3 py-2 text-right font-semibold">最終</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {active.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-zinc-400">この期間の利用はまだありません</td></tr>
                )}
                {active.map((r, i) => (
                  <tr key={r.email} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-zinc-400 mr-1.5">{i + 1}</span>
                      <span className="text-zinc-800 font-medium">{r.company}</span>
                      <span className="text-xs text-zinc-500 ml-1.5">{r.name}{r.prefecture ? `・${r.prefecture}` : ""}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-700">{r.read}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-orange-700">{r.write}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-700">{r.kit}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-700">{r.chat}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600">{r.clients.join("、") || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-500">{fmtDay(r.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">よく使われたツール</p></div>
            <ul className="divide-y divide-zinc-100">
              {topTools.length === 0 && <li className="px-4 py-4 text-xs text-zinc-400">まだありません</li>}
              {topTools.map(([name, n]) => (
                <li key={name} className="px-4 py-2 flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-zinc-700">{name}</span>
                  <span className="text-zinc-600">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">まだ使っていない（{silent.length}人）</p></div>
            <ul className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
              {silent.map((u) => (
                <li key={u.email} className="px-4 py-2 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-800">{u.groupCompany?.name ?? "拠点なし"}</span>
                  <span className="ml-1.5">{u.name ?? u.email}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        読取＝OSの検索・一覧・詳細をAIから引いた回数。記録＝AIからOSに残した回数（[AI記録]印）。キット＝ブランドキットをAIから取得。アーチくん＝OS内チャットの質問数。
        明細は <Link href="/dashboard/admin/audit-logs?action=mcp_os_write" className="underline">操作ログ（詳細）</Link> で。
      </p>
    </div>
  );
}
