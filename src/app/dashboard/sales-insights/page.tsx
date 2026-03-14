"use client";

import { useEffect, useState } from "react";

// ---- Types ----
interface IndustryInsight {
  industry: string;
  sent: number;
  replied: number;
  temperature: string;
  summary: string;
}

interface TopResponse {
  industry: string;
  responseSnippet: string;
  note: string;
}

interface SalesInsightRecord {
  id: string;
  authorName: string;
  period: string;
  totalSent: number;
  totalReplied: number;
  insights: IndustryInsight[];
  topResponses: TopResponse[];
  memo: string | null;
  createdAt: string;
  groupCompany: {
    name: string;
    ownerName: string;
    emoji: string | null;
  };
}

interface Summary {
  totalReports: number;
  totalSent: number;
  totalReplied: number;
  replyRate: number;
}

// ---- Temperature badge ----
const TEMP_STYLES: Record<string, string> = {
  hot: "bg-red-500/20 text-red-400 border-red-500/30",
  warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  cold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  neutral: "bg-zinc-700/60 text-zinc-400 border-zinc-600/40",
};

function TempBadge({ temp }: { temp: string }) {
  const style = TEMP_STYLES[temp] ?? TEMP_STYLES.neutral;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style}`}
    >
      {temp}
    </span>
  );
}

// ---- Page ----
export default function SalesInsightsPage() {
  const [data, setData] = useState<SalesInsightRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sales-insights?limit=100")
      .then((r) => r.json())
      .then((res) => {
        setData(res.insights ?? []);
        setSummary(res.summary ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">
          営業インサイト共有
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          各メンバーがClaudeで分析した営業結果を集約しています
        </p>
      </div>

      {/* Setup Guide */}
      <SetupGuide />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="レポート数" value={summary.totalReports} />
          <SummaryCard label="総送信数" value={summary.totalSent} />
          <SummaryCard label="総返信数" value={summary.totalReplied} />
          <SummaryCard
            label="返信率"
            value={`${summary.replyRate}%`}
            highlight
          />
        </div>
      )}

      {/* Reports */}
      {data.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-lg mb-2">まだレポートがありません</p>
          <p className="text-sm">
            各メンバーがClaudeの分析結果をAPIにアップロードすると、ここに表示されます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((record) => (
            <InsightCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Summary Card ----
function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-1 ${highlight ? "text-blue-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

// ---- Insight Card ----
function InsightCard({ record }: { record: SalesInsightRecord }) {
  const [open, setOpen] = useState(false);
  const replyRate =
    record.totalSent > 0
      ? Math.round((record.totalReplied / record.totalSent) * 100)
      : 0;
  const insights = (record.insights ?? []) as IndustryInsight[];
  const topResponses = (record.topResponses ?? []) as TopResponse[];
  const date = new Date(record.createdAt).toLocaleDateString("ja-JP");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header (clickable) */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">
            {record.groupCompany.emoji ?? "🏢"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {record.groupCompany.name}
              <span className="text-zinc-500 font-normal ml-2">
                {record.authorName}
              </span>
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {record.period} ・ {date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-zinc-500">送信 / 返信</p>
            <p className="text-sm font-semibold text-white">
              {record.totalSent} / {record.totalReplied}
              <span className="text-zinc-500 font-normal ml-1">
                ({replyRate}%)
              </span>
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Detail (expandable) */}
      {open && (
        <div className="px-5 pb-5 border-t border-zinc-800 space-y-4">
          {/* Industry breakdown */}
          {insights.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                業種別分析
              </p>
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    className="bg-zinc-800/50 rounded-md px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">
                        {ins.industry}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">
                          {ins.sent}件 → {ins.replied}件
                        </span>
                        <TempBadge temp={ins.temperature} />
                      </div>
                    </div>
                    {ins.summary && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {ins.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top responses */}
          {topResponses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                注目の返信
              </p>
              <div className="space-y-2">
                {topResponses.map((resp, i) => (
                  <div
                    key={i}
                    className="bg-zinc-800/50 rounded-md px-4 py-3"
                  >
                    <p className="text-xs text-zinc-500 mb-1">
                      {resp.industry}
                    </p>
                    <p className="text-sm text-white">
                      &ldquo;{resp.responseSnippet}&rdquo;
                    </p>
                    {resp.note && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {resp.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Memo */}
          {record.memo && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                メモ
              </p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {record.memo}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Setup Guide (collapsible) ----
function SetupGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-sm font-medium text-zinc-300">
            使い方・設定ガイド
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-zinc-800 space-y-5 text-sm">
          {/* Step 1 */}
          <div className="mt-4">
            <p className="font-semibold text-white mb-2">
              Step 1: Claudeに営業データを分析してもらう
            </p>
            <p className="text-zinc-400 mb-2">
              営業で送ったメール・返信内容・リストなどをClaudeに渡して、以下のように依頼してください：
            </p>
            <div className="bg-zinc-800 rounded-md p-3 text-xs text-zinc-300 whitespace-pre-wrap font-mono">
{`この営業データを分析して、以下のJSON形式で出力してください。

{
  "chatSpaceId": "（自分のGoogle ChatスペースID）",
  "authorName": "（自分の名前）",
  "period": "2026-03",
  "totalSent": 送信した件数,
  "totalReplied": 返信があった件数,
  "insights": [
    {
      "industry": "業種名",
      "sent": その業種への送信数,
      "replied": 返信数,
      "temperature": "hot / warm / cold",
      "summary": "この業種での所感（1〜2文）"
    }
  ],
  "topResponses": [
    {
      "industry": "業種名",
      "responseSnippet": "実際の返信内容（要約可）",
      "note": "補足メモ"
    }
  ],
  "memo": "全体の所感（任意）"
}`}
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <p className="font-semibold text-white mb-2">
              Step 2: 分析結果をアップロードする
            </p>
            <p className="text-zinc-400 mb-2">
              Claudeが出力したJSONを、以下のコマンドで送信します。
              ターミナルまたはClaudeに実行してもらってください：
            </p>
            <div className="bg-zinc-800 rounded-md p-3 text-xs text-zinc-300 whitespace-pre-wrap font-mono overflow-x-auto">
{`curl -X POST https://adarch-estimate-production.up.railway.app/api/sales-insights \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: （本部から共有されたAPIキー）" \\
  -d '（↑のJSON）'`}
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <p className="font-semibold text-white mb-2">
              Step 3: このページで全員の結果を確認
            </p>
            <p className="text-zinc-400">
              アップロードされた分析結果はこのページに自動で表示されます。
              他のメンバーがどの業種でどんな反応を得ているかを確認して、自分の営業に活かしてください。
            </p>
          </div>

          {/* Notes */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-xs font-semibold text-blue-400 mb-1">補足</p>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
              <li><strong>chatSpaceId</strong> は自分の戦略スペースのIDです（本部に確認してください）</li>
              <li><strong>APIキー</strong> は本部から共有されます。外部に公開しないでください</li>
              <li>月に1回程度、その月の営業結果をまとめてアップロードする運用を推奨します</li>
              <li>送信エラーが出る場合はJSONの形式を確認するか、本部に連絡してください</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
