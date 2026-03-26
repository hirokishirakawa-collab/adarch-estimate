"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Wand2 } from "lucide-react";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

interface StudioClient {
  id: string;
  name: string;
  businessType: string;
  area: string;
  target: string;
  sellingPoints: string | null;
  snsAccounts: string | null;
  postsPerMonth: number;
}

const BUSINESS_TYPES = [
  "飲食店（カフェ・レストラン）", "美容室・サロン", "クリニック・歯科",
  "エステ・リラクゼーション", "フィットネス・ジム", "学習塾・スクール",
  "不動産・住宅", "小売店・雑貨", "ブライダル・イベント", "その他",
];

const MONTHS = [
  "2026年4月", "2026年5月", "2026年6月", "2026年7月", "2026年8月",
  "2026年9月", "2026年10月", "2026年11月", "2026年12月",
];

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get("clientId") || "";
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [mode, setMode] = useState<"client" | "manual">(initialClientId ? "client" : "client");
  const [form, setForm] = useState({
    businessType: "", businessName: "", area: "", target: "",
    sellingPoints: "", snsAccounts: "", month: "2026年4月", postsPerMonth: "12",
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [productionId, setProductionId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/clients").then((r) => r.json()).then(setClients);
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (selectedClient) {
      setForm({
        businessType: selectedClient.businessType,
        businessName: selectedClient.name,
        area: selectedClient.area,
        target: selectedClient.target,
        sellingPoints: selectedClient.sellingPoints || "",
        snsAccounts: selectedClient.snsAccounts || "",
        month: form.month,
        postsPerMonth: String(selectedClient.postsPerMonth),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");
    setActiveTab("all");
    setProductionId(null);

    const res = await fetch("/api/studio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioClientId: selectedClientId || undefined,
        ...form,
      }),
    });

    const reader = res.body?.getReader();
    if (!reader) {
      setResult("エラーが発生しました");
      setLoading(false);
      return;
    }

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
            if (data.done) {
              if (data.productionId) setProductionId(data.productionId);
              break;
            }
            if (data.text) {
              accumulated += data.text;
              setResult(accumulated);
            }
          } catch {
            // ignore parse errors on partial chunks
          }
        }
      }
    }

    setLoading(false);
  };

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const sections = result ? {
    calendar: extractSection(result, "1. コンテンツカレンダー"),
    cutsheet: extractSection(result, "2. カット表"),
    shooting: extractSection(result, "3. 撮影指示書"),
    caption: extractSection(result, "4. キャプション案"),
    kpi: extractSection(result, "5. 月次KPI目標"),
  } : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/dashboard/studio" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Studio ホームに戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-fuchsia-500" />
          SNS運用プラン生成
        </h1>
        <WikiHelpLink query="SNSプラン自動生成" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input */}
        <div data-tour="generate-input" className="lg:col-span-1">
          <div className="bg-white rounded-xl border p-5 sticky top-4">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode("client")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "client" ? "bg-fuchsia-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
              >
                登録済みクライアント
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "manual" ? "bg-fuchsia-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
              >
                手動入力
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "client" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">クライアント選択</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}（{c.area}）</option>
                    ))}
                  </select>
                </div>
              )}

              {(mode === "manual" || selectedClient) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">業種</label>
                    <select value={form.businessType} onChange={(e) => update("businessType", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                      <option value="">選択</option>
                      {BUSINESS_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">店舗名</label>
                    <input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">エリア</label>
                    <input value={form.area} onChange={(e) => update("area", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">ターゲット</label>
                    <input value={form.target} onChange={(e) => update("target", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">強み・売り</label>
                    <textarea value={form.sellingPoints} onChange={(e) => update("sellingPoints", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">対象月</label>
                  <select value={form.month} onChange={(e) => update("month", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">投稿数/月</label>
                  <select value={form.postsPerMonth} onChange={(e) => update("postsPerMonth", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="8">8本</option>
                    <option value="12">12本</option>
                    <option value="16">16本</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (mode === "manual" && !form.businessType)}
                className="w-full bg-fuchsia-600 text-white py-3 rounded-lg font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    生成中...
                  </span>
                ) : (
                  "運用プランを一括生成"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Output */}
        <div data-tour="generate-output" className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Wand2 className="h-16 w-16 text-fuchsia-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 mb-2">SNS運用プランを一括生成</h3>
              <p className="text-zinc-500">クライアントを選択するか手動入力して、生成ボタンを押してください。<br/>カレンダー・カット表・撮影指示書・キャプション・KPIが一括で出力されます。</p>
            </div>
          )}

          {loading && !result && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <div className="animate-pulse">
                <Wand2 className="h-12 w-12 text-fuchsia-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-900 mb-2">プランを生成中...</h3>
                <p className="text-zinc-500 text-sm">AIが接続中です...</p>
              </div>
            </div>
          )}

          {result && (
            <div>
              {/* Streaming indicator */}
              {loading && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-fuchsia-50 border border-fuchsia-200 rounded-lg">
                  <div className="w-2 h-2 bg-fuchsia-500 rounded-full animate-pulse" />
                  <span className="text-sm text-fuchsia-700 font-medium">生成中...</span>
                </div>
              )}

              {/* Tabs - only show when not streaming or enough content */}
              {!loading && (
                <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 border overflow-x-auto">
                  {[
                    { key: "all", label: "すべて" },
                    { key: "calendar", label: "カレンダー" },
                    { key: "cutsheet", label: "カット表" },
                    { key: "shooting", label: "撮影指示書" },
                    { key: "caption", label: "キャプション" },
                    { key: "kpi", label: "KPI" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
                        activeTab === tab.key ? "bg-fuchsia-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-xl border p-6">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(
                      activeTab === "all" || loading
                        ? result
                        : sections
                          ? sections[activeTab as keyof typeof sections] || ""
                          : ""
                    ),
                  }}
                />
              </div>

              {!loading && (
                <div className="flex gap-3 mt-4">
                  <button onClick={() => { navigator.clipboard.writeText(result); alert("コピーしました"); }} className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700">
                    全文コピー
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

function extractSection(text: string, heading: string): string {
  const lines = text.split("\n");
  let capturing = false;
  const captured: string[] = [];
  let headingLevel = 0;
  for (const line of lines) {
    if (line.includes(heading)) {
      capturing = true;
      headingLevel = (line.match(/^#+/) || [""])[0].length;
      captured.push(line);
      continue;
    }
    if (capturing) {
      const match = line.match(/^(#+)\s/);
      if (match && match[1].length <= headingLevel && captured.length > 1) break;
      captured.push(line);
    }
  }
  return captured.join("\n");
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
