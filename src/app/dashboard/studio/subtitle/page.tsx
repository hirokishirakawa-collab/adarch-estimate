"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Captions, Upload, Download } from "lucide-react";

interface StudioClient { id: string; name: string; }

export default function SubtitlePage() {
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/studio/clients").then(r => r.json()).then(setClients); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult("");

    const formData = new FormData();
    formData.append("file", file);
    if (selectedClientId) formData.append("studioClientId", selectedClientId);

    const res = await fetch("/api/studio/subtitle", { method: "POST", body: formData });
    const data = await res.json();

    if (data.srt) {
      setResult(data.srt);
    } else {
      setResult(data.message || "エラーが発生しました");
    }
    setLoading(false);
  };

  const downloadSRT = () => {
    const blob = new Blob([result], { type: "text/srt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name?.replace(/\.[^/.]+$/, "") || "subtitle") + ".srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/studio" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />Studio ホーム
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
        <Captions className="h-6 w-6 text-cyan-500" />
        自動字幕生成
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
            <label className="block text-sm font-medium text-zinc-700 mb-1">動画/音声ファイル *</label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-cyan-400 transition">
              <Upload className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
              <input type="file" accept="video/*,audio/*" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
              <p className="text-xs text-zinc-400 mt-2">MP4, MOV, MP3, WAV（最大25MB）</p>
            </div>
            {file && <p className="text-xs text-zinc-500 mt-1">{file.name}（{(file.size / 1024 / 1024).toFixed(1)}MB）</p>}
          </div>
          <button type="submit" disabled={loading || !file} className="w-full bg-cyan-600 text-white py-3 rounded-lg font-medium hover:bg-cyan-700 transition disabled:opacity-50">
            {loading ? "音声認識中..." : "字幕を生成（SRT）"}
          </button>
          <p className="text-xs text-zinc-400">Whisper API（OpenAI）で音声認識します。日本語対応。</p>
        </form>

        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Captions className="h-16 w-16 text-cyan-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 mb-2">動画から字幕を自動生成</h3>
              <p className="text-zinc-500 text-sm">動画/音声をアップロードすると、AI音声認識でSRT字幕ファイルを生成します。<br/>DaVinci Resolve / Premiere Pro にそのまま読み込めます。</p>
            </div>
          )}
          {loading && (
            <div className="bg-white rounded-xl border p-12 text-center animate-pulse">
              <Captions className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900">音声認識中...</h3>
              <p className="text-sm text-zinc-500 mt-2">ファイルサイズに応じて10-60秒かかります</p>
            </div>
          )}
          {result && !loading && (
            <div>
              <div className="bg-zinc-900 rounded-xl p-6 font-mono text-sm text-green-400 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={downloadSRT} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700">
                  <Download className="h-4 w-4" />SRTダウンロード
                </button>
                <button onClick={() => { navigator.clipboard.writeText(result); alert("コピーしました"); }} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  全文コピー
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
