"use client";

import { useEffect, useState } from "react";

// ---- Types ----
interface IndustryInsight {
  industry: string;
  area?: string;
  sent: number;
  replied: number;
  temperature: string;
  method?: string;
  hook?: string;
  summary: string;
}

interface TopResponse {
  companyName?: string;
  industry: string;
  area?: string;
  companyScale?: string;
  companyUrl?: string;
  contactMethod?: string;
  sentDate?: string;
  replyDate?: string;
  replyHours?: number;
  replyDays?: number;
  sentSummary?: string;
  responseSnippet: string;
  responseType?: string;
  nextAction?: string;
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

  const loadData = () => {
    fetch("/api/sales-insights?limit=100")
      .then((r) => r.json())
      .then((res) => {
        setData(res.insights ?? []);
        setSummary(res.summary ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
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

      {/* Upload Form */}
      <UploadForm onUploaded={loadData} />

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
            下の「使い方ガイド」を参考に、Claudeの分析結果を貼り付けて送信してください
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

// ---- Upload Form ----
function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [json, setJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async () => {
    setMessage(null);

    // JSON parse check
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      setMessage({ type: "error", text: "JSONの形式が正しくありません。Claudeの出力をそのまま貼り付けてください。" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/sales-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: result.error ?? "送信に失敗しました" });
      } else {
        setMessage({ type: "success", text: `${result.companyName} のレポートを登録しました（${result.period}）` });
        setJson("");
        onUploaded();
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
      <p className="text-sm font-semibold text-white">
        分析結果をアップロード
      </p>
      <p className="text-xs text-zinc-400">
        Claudeが出力したJSONをそのまま貼り付けて送信してください
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='{"period": "2026-W11", "totalSent": 50, ...}'
        rows={6}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
      />
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <p
              className={`text-xs ${message.type === "success" ? "text-green-400" : "text-red-400"}`}
            >
              {message.text}
            </p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !json.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-md transition-colors"
        >
          {submitting ? "送信中..." : "送信"}
        </button>
      </div>
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {ins.industry}
                        </span>
                        {ins.area && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded">
                            {ins.area}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">
                          {ins.sent}件 → {ins.replied}件
                        </span>
                        <TempBadge temp={ins.temperature} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      {ins.method && (
                        <span className="text-[11px] text-zinc-500">
                          手法: <span className="text-zinc-400">{ins.method}</span>
                        </span>
                      )}
                      {ins.hook && (
                        <span className="text-[11px] text-zinc-500">
                          刺さった点: <span className="text-zinc-400">{ins.hook}</span>
                        </span>
                      )}
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
                返信の詳細
              </p>
              <div className="space-y-2">
                {topResponses.map((resp, i) => (
                  <div
                    key={i}
                    className="bg-zinc-800/50 rounded-md px-4 py-3 space-y-2"
                  >
                    {/* Company header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {resp.companyName ? (
                          <span className="text-sm font-medium text-white">
                            {resp.companyName}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded">
                          {resp.industry}
                        </span>
                        {resp.area && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded">
                            {resp.area}
                          </span>
                        )}
                        {resp.companyScale && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded">
                            {resp.companyScale}
                          </span>
                        )}
                      </div>
                      {/* Reply speed badge */}
                      {(resp.replyHours != null || resp.replyDays != null) && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          (resp.replyHours != null && resp.replyHours <= 24) || (resp.replyDays != null && resp.replyDays <= 1)
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : (resp.replyDays != null && resp.replyDays <= 3)
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-zinc-700/60 text-zinc-400 border-zinc-600/40"
                        }`}>
                          {resp.replyHours != null
                            ? `${resp.replyHours}時間で返信`
                            : `${resp.replyDays}日で返信`}
                        </span>
                      )}
                    </div>

                    {/* Company URL */}
                    {resp.companyUrl && (
                      <p className="text-[11px] text-zinc-500 truncate">
                        {resp.companyUrl}
                      </p>
                    )}

                    {/* Dates & method */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-500">
                      {resp.contactMethod && (
                        <span>手法: <span className="text-zinc-400">{resp.contactMethod}</span></span>
                      )}
                      {resp.sentDate && (
                        <span>送付: <span className="text-zinc-400">{resp.sentDate}</span></span>
                      )}
                      {resp.replyDate && (
                        <span>返信: <span className="text-zinc-400">{resp.replyDate}</span></span>
                      )}
                      {resp.responseType && (
                        <span>反応: <span className="text-zinc-400">{resp.responseType}</span></span>
                      )}
                    </div>

                    {/* What was sent */}
                    {resp.sentSummary && (
                      <div>
                        <p className="text-[11px] text-zinc-500 mb-0.5">送った内容:</p>
                        <p className="text-xs text-zinc-400">{resp.sentSummary}</p>
                      </div>
                    )}

                    {/* Response */}
                    <div>
                      <p className="text-[11px] text-zinc-500 mb-0.5">返信内容:</p>
                      <p className="text-sm text-white">
                        &ldquo;{resp.responseSnippet}&rdquo;
                      </p>
                    </div>

                    {resp.note && (
                      <p className="text-xs text-zinc-400">
                        {resp.note}
                      </p>
                    )}
                    {resp.nextAction && (
                      <p className="text-xs text-blue-400/80">
                        → 次のアクション: {resp.nextAction}
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

// ---- Setup Guide ----
function SetupGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-gradient-to-br from-blue-950/80 to-violet-950/60 border border-blue-500/30 rounded-xl overflow-hidden shadow-lg shadow-blue-500/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <span className="text-lg">🚀</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              はじめての方へ — 3ステップで営業知見を共有
            </p>
            <p className="text-xs text-blue-300/70 mt-0.5">
              毎週の営業データをClaudeで分析 → ここに貼るだけ → グループ全体で学び合い
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-blue-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 text-sm">
          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-4 mt-2">
            {/* Step 1 */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <p className="font-semibold text-white text-sm">Claudeに分析依頼</p>
              </div>
              <p className="text-xs text-blue-200/60 leading-relaxed">
                営業で送ったメール・返信内容・リストなどをClaudeに渡して、
                下のテンプレートで分析を依頼してください。
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <p className="font-semibold text-white text-sm">ここに貼って送信</p>
              </div>
              <p className="text-xs text-blue-200/60 leading-relaxed">
                Claudeが出力したJSONをコピーして、上のテキストエリアに貼り付け、
                「送信」を押すだけ。企業情報は自動で紐づきます。
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                <p className="font-semibold text-white text-sm">全員の結果を確認</p>
              </div>
              <p className="text-xs text-blue-200/60 leading-relaxed">
                どの業種が反応いいか、どんな文面が刺さるか。
                グループ全員の営業知見がここに集まります。
              </p>
            </div>
          </div>

          {/* Template */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Claudeへの依頼テンプレート</span>
              <span className="text-[10px] text-blue-300/50 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">コピーしてそのまま使えます</span>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-lg p-4 text-xs text-blue-100/80 whitespace-pre-wrap font-mono overflow-x-auto">
{`この営業データを分析して、以下のJSON形式で出力してください。
業種ごとに分類し、どんな営業手法で、何が刺さったかを分析してください。
返信があった企業は1社ずつ詳細に記録してください。

{
  "period": "2026-W11",
  "totalSent": 送信した総件数,
  "totalReplied": 返信があった総件数,
  "insights": [
    {
      "industry": "業種名（例: 飲食、不動産、美容、IT）",
      "area": "エリア（例: 東京都、関西、全国）",
      "sent": その業種への送信数,
      "replied": 返信数,
      "temperature": "hot / warm / cold",
      "method": "営業手法（例: メール、フォーム、DM、電話）",
      "hook": "刺さったポイント（例: SNS運用提案、動画制作の実績訴求）",
      "summary": "この業種での分析・所感（2〜3文）"
    }
  ],
  "topResponses": [
    {
      "companyName": "会社名",
      "industry": "業種名",
      "area": "所在地（例: 東京都渋谷区）",
      "companyScale": "企業規模（例: 個人経営、中小10名、大手500名）",
      "companyUrl": "会社HP（あれば）",
      "contactMethod": "営業手法（例: メール、問い合わせフォーム、DM）",
      "sentDate": "送付日（例: 3/10）",
      "replyDate": "返信日（例: 3/11）",
      "replyHours": 送付から返信までの時間数（24時間以内の場合）,
      "replyDays": 送付から返信までの日数（1日以上の場合）,
      "sentSummary": "送った営業文の要約（何を提案したか）",
      "responseSnippet": "実際の返信内容（要約可）",
      "responseType": "反応の種類（例: 興味あり、資料請求、見積依頼、断り）",
      "nextAction": "次に取るべきアクション（例: 資料送付、打ち合わせ設定）",
      "note": "補足（何が決め手だったか、気づき等）"
    }
  ],
  "memo": "今週の全体所感・気づき・来週試したいこと"
}`}
            </div>
            <p className="text-[11px] text-blue-300/40 mt-2">
              ※ 各フィールドの説明はClaudeへのヒントです。データから自動で判断してくれます。
            </p>
          </div>

          {/* Tips */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-xs font-bold text-emerald-400 mb-1.5">💡 こんなデータを渡すと精度UP</p>
              <ul className="text-[11px] text-emerald-300/70 space-y-1 list-disc list-inside">
                <li>送信したメールの本文や件名</li>
                <li>返信メールの全文</li>
                <li>送信先リスト（会社名・業種・エリア）</li>
                <li>問い合わせフォームで送った内容</li>
              </ul>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-400 mb-1.5">📅 運用ルール</p>
              <ul className="text-[11px] text-amber-300/70 space-y-1 list-disc list-inside">
                <li><strong>毎週</strong>提出（periodは <code className="bg-black/20 px-1 rounded">2026-W11</code> 形式）</li>
                <li>返信がなかった週もinsightsだけ提出OK</li>
                <li>エラーが出たらClaudeに「JSONを修正して」と伝えればOK</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
