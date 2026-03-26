"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart2, ClipboardPaste } from "lucide-react";

const MONTHS = [
  "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
  "2026-09", "2026-10", "2026-11", "2026-12",
];

const SAMPLE_JSON = `{
  "followers": 1250,
  "followersGain": 85,
  "reach": 12500,
  "impressions": 28000,
  "engagementRate": 4.2,
  "saves": 320,
  "shares": 45,
  "profileVisits": 890,
  "websiteClicks": 120
}`;

export default function ReportPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState("2026-04");
  const [rawInsights, setRawInsights] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/studio/clients`).then(r => r.json()).then((clients: { id: string; name: string }[]) => {
      const c = clients.find((c: { id: string }) => c.id === clientId);
      if (c) setClientName(c.name);
    });
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");

    const res = await fetch("/api/studio/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioClientId: clientId, month, rawInsights }),
    });

    const reader = res.body?.getReader();
    if (!reader) { setLoading(false); return; }

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.text) { accumulated += data.text; setResult(accumulated); }
          } catch { /* ignore */ }
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href={`/dashboard/studio/clients/${clientId}`} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {clientName || "クライアント"}に戻る
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
        <BarChart2 className="h-6 w-6 text-blue-500" />
        月次レポート生成
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4 sticky top-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">対象月</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                <ClipboardPaste className="inline h-3.5 w-3.5 mr-1" />
                Instagram Insights データ
              </label>
              <p className="text-xs text-zinc-400 mb-2">
                JSON形式 or テキストで貼り付け。数値はどちらでもAIが分析します。
              </p>
              <textarea
                value={rawInsights}
                onChange={(e) => setRawInsights(e.target.value)}
                rows={12}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
                placeholder={SAMPLE_JSON}
                required
              />
              <button
                type="button"
                onClick={() => setRawInsights(SAMPLE_JSON)}
                className="text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                サンプルデータを挿入
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !rawInsights.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  レポート生成中...
                </span>
              ) : (
                "月次レポートを生成"
              )}
            </button>

            <div className="text-xs text-zinc-400 space-y-1">
              <p>• JSONで貼り付けると数値がDBに自動保存されます</p>
              <p>• テキストの場合はAI分析のみ（数値保存なし）</p>
              <p>• 前月データがあれば自動で比較します</p>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <BarChart2 className="h-16 w-16 text-blue-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 mb-2">月次レポートを自動生成</h3>
              <p className="text-zinc-500 text-sm">
                Instagram InsightsのデータをJSON or テキストで貼り付けてください。<br/>
                KPI分析・トップ投稿分析・改善提案・来月の戦略を自動生成します。
              </p>
            </div>
          )}

          {loading && !result && (
            <div className="bg-white rounded-xl border p-12 text-center animate-pulse">
              <BarChart2 className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900">接続中...</h3>
            </div>
          )}

          {result && (
            <div>
              {loading && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm text-blue-700 font-medium">レポート生成中...</span>
                </div>
              )}

              <div className="bg-white rounded-xl border p-6">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(result) }}
                />
              </div>

              {!loading && (
                <div className="flex gap-3 mt-4">
                  <button onClick={() => { navigator.clipboard.writeText(result); alert("コピーしました"); }} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    全文コピー
                  </button>
                  <button onClick={() => window.print()} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    PDF印刷
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function markdownToHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-6 mb-2 text-zinc-900">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-8 mb-3 text-zinc-900 border-b pb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-zinc-900">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*$)/gm, '<li class="ml-4 text-zinc-700">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 text-zinc-700"><span class="font-medium">$1.</span> $2</li>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split("|").filter((c) => c.trim()).map((c) => `<td class="border px-3 py-1.5 text-sm">${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="w-full border-collapse border my-3">$&</table>')
    .replace(/\n\n/g, '<div class="my-3"></div>')
    .replace(/\n/g, "<br/>");
}
