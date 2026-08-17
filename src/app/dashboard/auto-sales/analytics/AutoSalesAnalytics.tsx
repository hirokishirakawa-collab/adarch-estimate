"use client";

import Link from "next/link";
import { ArrowLeft, Send, MessageSquare, Percent, CalendarCheck } from "lucide-react";

interface Props {
  summary: {
    totalSent: number;
    totalResponses: number;
    responseRate: number;
    totalAppointments: number;
  };
  templateBreakdown: {
    name: string;
    sent: number;
    responses: number;
    rate: number;
  }[];
  industryBreakdown: {
    industry: string;
    sent: number;
    responses: number;
    rate: number;
  }[];
  areaBreakdown: {
    area: string;
    sent: number;
    responses: number;
    rate: number;
  }[];
  /** 本部のみ。拠点ごとの稼働と反響。 */
  branchBreakdown?: {
    branch: string;
    sent: number;
    responses: number;
    rate: number;
  }[];
}

export function AutoSalesAnalytics({
  summary,
  templateBreakdown,
  industryBreakdown,
  areaBreakdown,
  branchBreakdown = [],
}: Props) {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/dashboard/auto-sales"
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-zinc-900">
              自動営業 分析
            </h1>
          </div>
          <p className="text-sm text-zinc-500 ml-8">
            送信実績と反響率をテンプレート・業種・エリア別に分析
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="総送信数"
          value={summary.totalSent}
          icon={Send}
          color="blue"
        />
        <SummaryCard
          label="反響数"
          value={summary.totalResponses}
          icon={MessageSquare}
          color="emerald"
        />
        <SummaryCard
          label="反響率"
          value={`${summary.responseRate}%`}
          icon={Percent}
          color="amber"
        />
        <SummaryCard
          label="アポ獲得"
          value={summary.totalAppointments}
          icon={CalendarCheck}
          color="violet"
        />
      </div>

      {/* 拠点別（本部のみ） */}
      {branchBreakdown.length > 0 && (
        <BreakdownTable
          title="拠点別"
          headers={["拠点", "送信数", "反響数", "反響率"]}
          rows={branchBreakdown.map((t) => [
            t.branch,
            t.sent.toLocaleString(),
            t.responses.toLocaleString(),
            `${t.rate}%`,
          ])}
        />
      )}

      {/* テンプレート別 */}
      <BreakdownTable
        title="テンプレート別"
        headers={["テンプレート名", "送信数", "反響数", "反響率"]}
        rows={templateBreakdown.map((t) => [
          t.name,
          t.sent.toLocaleString(),
          t.responses.toLocaleString(),
          `${t.rate}%`,
        ])}
      />

      {/* 業種別 */}
      <BreakdownTable
        title="業種別"
        headers={["業種", "送信数", "反響数", "反響率"]}
        rows={industryBreakdown.map((t) => [
          t.industry,
          t.sent.toLocaleString(),
          t.responses.toLocaleString(),
          `${t.rate}%`,
        ])}
      />

      {/* エリア別 */}
      <BreakdownTable
        title="エリア別"
        headers={["エリア", "送信数", "反響数", "反響率"]}
        rows={areaBreakdown.map((t) => [
          t.area,
          t.sent.toLocaleString(),
          t.responses.toLocaleString(),
          `${t.rate}%`,
        ])}
      />
    </div>
  );
}

// ─── サマリーカード ─────────────────────────────
function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      iconBg: "bg-blue-100",
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      iconBg: "bg-emerald-100",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      iconBg: "bg-amber-100",
    },
    violet: {
      bg: "bg-violet-50",
      border: "border-violet-200",
      text: "text-violet-700",
      iconBg: "bg-violet-100",
    },
  };

  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.iconBg}`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        <p className={`text-xs font-medium ${c.text} opacity-70`}>{label}</p>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ─── 集計テーブル ─────────────────────────────
function BreakdownTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-2">{title}</h2>
        <p className="text-sm text-zinc-400">データがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-zinc-50 transition-colors">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-6 py-3 text-sm ${
                      ci === 0
                        ? "text-left font-medium text-zinc-900"
                        : "text-right text-zinc-600"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
