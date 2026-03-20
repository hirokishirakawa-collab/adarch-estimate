"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Crosshair } from "lucide-react";

interface StudioClient {
  id: string;
  name: string;
  businessType: string;
  area: string;
  target: string;
}

const BUSINESS_TYPES = [
  "飲食店（カフェ・レストラン）", "美容室・サロン", "クリニック・歯科",
  "エステ・リラクゼーション", "フィットネス・ジム", "学習塾・スクール",
  "不動産・住宅", "小売店・雑貨", "ブライダル・イベント", "その他",
];

export default function CompetitorPage() {
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [form, setForm] = useState({
    businessType: "", area: "", businessName: "", target: "", competitorUrls: "",
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/studio/clients").then((r) => r.json()).then(setClients);
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (selectedClient) {
      setForm((prev) => ({
        ...prev,
        businessType: selectedClient.businessType,
        area: selectedClient.area,
        businessName: selectedClient.name,
        target: selectedClient.target,
      }));
    }
  }, [selectedClient]);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");

    const res = await fetch("/api/studio/competitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioClientId: selectedClientId || undefined,
        ...form,
      }),
    });

    const reader = res.body?.getReader();
    if (!reader) { setLoading(false); return; }

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
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
      <Link href="/dashboard/studio" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Studio ホームに戻る
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
        <Crosshair className="h-6 w-6 text-orange-500" />
        競合分析
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4 sticky top-4">
            {/* Client select */}
            {clients.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">クライアントから入力</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">手動入力</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}（{c.area}）</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">業種 *</label>
              <select value={form.businessType} onChange={(e) => update("businessType", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">選択</option>
                {BUSINESS_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">エリア *</label>
              <input value={form.area} onChange={(e) => update("area", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 横浜市青葉区" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">店舗名</label>
              <input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: Hair Salon BLOOM" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">ターゲット</label>
              <input value={form.target} onChange={(e) => update("target", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 20-40代女性" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">競合アカウントURL（任意）</label>
              <textarea
                value={form.competitorUrls}
                onChange={(e) => update("competitorUrls", e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={"https://instagram.com/competitor1\nhttps://instagram.com/competitor2\n（1行に1アカウント）"}
              />
              <p className="text-xs text-zinc-400 mt-1">指定がなくても業種×エリアから一般的な競合パターンを分析します</p>
            </div>

            <button
              type="submit"
              disabled={loading || !form.businessType || !form.area}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  分析中...
                </span>
              ) : (
                "競合分析を実行"
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Crosshair className="h-16 w-16 text-orange-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 mb-2">競合分析</h3>
              <p className="text-zinc-500 text-sm">
                業種とエリアを入力すると、SNS上の競合状況・差別化戦略・<br/>
                ベンチマーク目標・即実行可能なアクションプランを分析します。
              </p>
            </div>
          )}

          {loading && !result && (
            <div className="bg-white rounded-xl border p-12 text-center animate-pulse">
              <Crosshair className="h-12 w-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900">接続中...</h3>
            </div>
          )}

          {result && (
            <div>
              {loading && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <span className="text-sm text-orange-700 font-medium">分析中...</span>
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

function markdownToHtml(md: string): string {
  return md
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
