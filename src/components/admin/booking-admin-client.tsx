"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  XCircle,
} from "lucide-react";
import {
  cancelBookingByAdmin,
  createBookingHost,
  ensureFranchiseBookingType,
  reissueConnectToken,
  updateBookingHost,
} from "@/lib/actions/booking";

// ----------------------------------------------------------------
// 面談予約管理 クライアント（ADMIN）
// ----------------------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const YOUBI = ["日", "月", "火", "水", "木", "金", "土"];

function fmtJst(iso: string): string {
  const t = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())}(${YOUBI[t.getUTCDay()]}) ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

type HostRow = {
  id: string;
  name: string;
  email: string;
  priority: number;
  isActive: boolean;
  connected: boolean;
  googleEmail: string | null;
  connectToken: string | null;
};

type BookingRow = {
  id: string;
  startAt: string;
  status: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  hostName: string;
  typeTitle: string;
  meetUrl: string | null;
  answers: { label: string; value: string }[];
};

type Props = {
  appBase: string;
  hosts: HostRow[];
  bookingTypes: { slug: string; title: string; isActive: boolean }[];
  bookings: BookingRow[];
};

export function BookingAdminClient({ appBase, hosts, bookingTypes, bookings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newHost, setNewHost] = useState({ name: "", email: "", priority: "100" });
  const [error, setError] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const addHost = () => {
    setError(null);
    startTransition(async () => {
      const res = await createBookingHost({
        name: newHost.name,
        email: newHost.email,
        priority: Number(newHost.priority),
      });
      if (!res.ok) setError(res.error ?? "作成に失敗しました");
      else setNewHost({ name: "", email: "", priority: "100" });
    });
  };

  const upcoming = bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.startAt).getTime() > Date.now()
  );

  const inputCls =
    "rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="space-y-8">
      {/* ---- 予約ページ ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">公開予約ページ</h2>
        {bookingTypes.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-zinc-500">
              予約タイプがまだありません。加盟面談（60分・平日10-18時・スクリーニング質問付き）を作成できます。
            </p>
            <button
              onClick={() => startTransition(() => ensureFranchiseBookingType().then(() => {}))}
              disabled={isPending}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              加盟面談ページを作成
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {bookingTypes.map((t) => {
              const url = `${appBase}/book/${t.slug}`;
              return (
                <li
                  key={t.slug}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-zinc-800">{t.title}</span>
                  <code className="rounded bg-white px-2 py-1 text-xs text-zinc-600">
                    {url}
                  </code>
                  <button
                    onClick={() => copy(`type-${t.slug}`, url)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied === `type-${t.slug}` ? "コピーしました" : "URLをコピー"}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> 開く
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- ホスト管理 ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-900">
          ホスト（面談担当者）
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          優先度の数値が小さい人から優先的にアサインされます。両者空きの場合は優先度1の担当へ。
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="py-2 pr-4">名前</th>
                <th className="py-2 pr-4">通知先メール</th>
                <th className="py-2 pr-4">優先度</th>
                <th className="py-2 pr-4">カレンダー接続</th>
                <th className="py-2 pr-4">稼働</th>
                <th className="py-2">接続リンク</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4 font-medium text-zinc-800">{h.name}</td>
                  <td className="py-3 pr-4 text-zinc-600">{h.email}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      defaultValue={h.priority}
                      min={1}
                      max={999}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== h.priority) {
                          startTransition(() =>
                            updateBookingHost(h.id, { priority: v }).then(() => {})
                          );
                        }
                      }}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    {h.connected ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">{h.googleEmail ?? "接続済み"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">未接続</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() =>
                        startTransition(() =>
                          updateBookingHost(h.id, { isActive: !h.isActive }).then(
                            () => {}
                          )
                        )
                      }
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        h.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {h.isActive ? "稼働中" : "停止中"}
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {h.connectToken && (
                        <button
                          onClick={() =>
                            copy(`host-${h.id}`, `${appBase}/book/connect/${h.connectToken}`)
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copied === `host-${h.id}` ? "コピーしました" : "リンクをコピー"}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            const res = await reissueConnectToken(h.id);
                            if (res.url) copy(`host-${h.id}`, res.url);
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
                      >
                        <Link2 className="h-3.5 w-3.5" /> 再発行
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {hosts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-zinc-400">
                    ホストがまだ登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ホスト追加 */}
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-zinc-50 p-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">名前</label>
            <input
              className={inputCls}
              value={newHost.name}
              onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
              placeholder="一村 〇〇"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">通知先メール</label>
            <input
              className={inputCls}
              value={newHost.email}
              onChange={(e) => setNewHost({ ...newHost, email: e.target.value })}
              placeholder="xxx@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">優先度</label>
            <input
              type="number"
              className={`${inputCls} w-20`}
              value={newHost.priority}
              onChange={(e) => setNewHost({ ...newHost, priority: e.target.value })}
            />
          </div>
          <button
            onClick={addHost}
            disabled={isPending || !newHost.name || !newHost.email}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> ホストを追加
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      {/* ---- 予約一覧 ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          予約一覧
          <span className="ml-2 text-xs font-normal text-zinc-500">
            今後の確定予約 {upcoming.length}件 / 直近100件表示
          </span>
        </h2>
        <div className="space-y-2">
          {bookings.map((b) => {
            const isPast = new Date(b.startAt).getTime() < Date.now();
            const open = expanded === b.id;
            return (
              <div
                key={b.id}
                className={`rounded-lg border px-4 py-3 ${
                  b.status === "CANCELLED"
                    ? "border-zinc-100 bg-zinc-50 opacity-60"
                    : isPast
                      ? "border-zinc-100 bg-white"
                      : "border-blue-100 bg-blue-50/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm font-medium text-zinc-800">
                    {fmtJst(b.startAt)}
                  </span>
                  <span className="text-sm text-zinc-700">
                    {b.name}
                    {b.company ? `（${b.company}）` : ""}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    担当: {b.hostName}
                  </span>
                  {b.status === "CANCELLED" && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                      キャンセル済み
                    </span>
                  )}
                  <button
                    onClick={() => setExpanded(open ? null : b.id)}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    詳細{" "}
                    {open ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {open && (
                  <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm text-zinc-700">
                    <p>メール: {b.email}</p>
                    {b.phone && <p>電話: {b.phone}</p>}
                    {b.meetUrl && (
                      <p>
                        Meet:{" "}
                        <a
                          href={b.meetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline underline-offset-2"
                        >
                          {b.meetUrl}
                        </a>
                      </p>
                    )}
                    {b.answers.map((a, i) => (
                      <p key={i}>
                        {a.label}: {a.value}
                      </p>
                    ))}
                    {b.status === "CONFIRMED" && !isPast && (
                      <button
                        onClick={() => {
                          if (confirm("この予約をキャンセルしますか？申込者とホストに通知メールが送られます。")) {
                            startTransition(() =>
                              cancelBookingByAdmin(b.id).then(() => {})
                            );
                          }
                        }}
                        disabled={isPending}
                        className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        この予約をキャンセルする
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {bookings.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-400">
              予約はまだありません
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
