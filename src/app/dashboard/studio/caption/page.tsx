"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

interface StudioClient { id: string; name: string; }

export default function CaptionPage() {
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [postTheme, setPostTheme] = useState("");
  const [postFormat, setPostFormat] = useState("リール");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/studio/clients").then(r => r.json()).then(setClients); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");

    const res = await fetch("/api/studio/caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioClientId: selectedClientId || undefined, postTheme, postFormat, additionalNotes }),
    });

    const reader = res.body?.getReader();
    if (!reader) { setLoading(false); return; }
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.done) break;
            if (d.text) { acc += d.text; setResult(acc); }
          } catch { /* ignore */ }
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/studio" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />Studio ホーム
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-green-500" />
        キャプション生成
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4">
          {clients.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">クライアント</label>
              <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">指定なし</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">投稿テーマ *</label>
            <input value={postTheme} onChange={e => setPostTheme(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 新メニュー「春のフルーツパフェ」の紹介" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">投稿形式</label>
            <select value={postFormat} onChange={e => setPostFormat(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option>リール</option><option>フィード</option><option>ストーリーズ</option><option>カルーセル</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">補足</label>
            <textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 期間限定、4/1-4/30" />
          </div>
          <button type="submit" disabled={loading || !postTheme} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50">
            {loading ? "生成中..." : "キャプション3案を生成"}
          </button>
        </form>

        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <MessageSquare className="h-16 w-16 text-green-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 mb-2">キャプションを即生成</h3>
              <p className="text-zinc-500 text-sm">投稿テーマを入力するだけ。3案×異なるトーンで生成します。</p>
            </div>
          )}
          {result && (
            <div>
              {loading && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-700 font-medium">生成中...</span>
                </div>
              )}
              <div className="bg-white rounded-xl border p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(result) }} />
              {!loading && (
                <button onClick={() => { navigator.clipboard.writeText(result); alert("コピーしました"); }} className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  全文コピー
                </button>
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
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 text-zinc-700">$1</li>')
    .replace(/\n\n/g, '<div class="my-3"></div>')
    .replace(/\n/g, "<br/>");
}
