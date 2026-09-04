"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Package, Eye, CheckSquare, Square, Archive } from "lucide-react";
import { WikiArticleContent } from "@/components/wiki/wiki-article-content";
import { buildPreamble } from "@/lib/brand-kit/preamble";

export interface KitMaterial {
  id: string;
  label: string;
  note: string;
  version: string;
  body: string;
  downloadHref: string;
  group: "static" | "company" | "sales" | "package" | "media" | "finder" | "wiki";
}

const GROUP_ORDER: KitMaterial["group"][] = ["static", "company", "sales", "package", "media", "finder", "wiki"];
const GROUP_LABEL: Record<KitMaterial["group"], { title: string; sub: string }> = {
  static: { title: "共通の決まり", sub: "色・書体・写真・組み方。どの材料と一緒に貼ってもよい" },
  company: { title: "会社紹介", sub: "公開情報とOSの拠点データ。提案の「私たちは誰か」を一定にする" },
  sales: { title: "営業の言い回し", sub: "本部の型と、グループの記録からの学び（匿名）" },
  package: { title: "メニュー別", sub: "パッケージ台帳から自動生成。貴社の拠点と県の数字が入っています" },
  media: { title: "媒体別", sub: "シミュレーターと同じ料金から自動生成。金額はシミュレーターで組んでからお客様へ" },
  finder: { title: "切り口", sub: "周年・補助金・入札・広告賞。財源と送り時のほうから話を持っていく" },
  wiki: { title: "本部Wikiから", sub: "タグ「AI材料」を付けた本部の記事。記事が増えれば材料も増える" },
};

const dateTag = () => new Date().toISOString().slice(0, 10);
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 60);

function combine(items: KitMaterial[], sender: { company: string | null; prefecture: string | null }): string {
  const head = buildPreamble({ company: sender.company, prefecture: sender.prefecture, labels: items.map((m) => m.label), date: dateTag() });
  return [head, ...items.map((m) => m.body)].join("\n\n\n<!-- ======================== 次の材料 ======================== -->\n\n\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function BrandKitPicker({ materials, sender }: { materials: KitMaterial[]; sender: { company: string | null; prefecture: string | null } }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(materials.filter((m) => m.group === "static").map((m) => m.id)));
  const [previewId, setPreviewId] = useState<string>(materials.find((m) => m.group === "package")?.id ?? materials[0]?.id ?? "");
  const [copied, setCopied] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const preview = materials.find((m) => m.id === previewId) ?? materials[0];
  const chosen = useMemo(() => materials.filter((m) => selected.has(m.id)), [materials, selected]);
  const groups = GROUP_ORDER.map((g) => ({ g, items: materials.filter((m) => m.group === g) })).filter((x) => x.items.length);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setGroup = (g: KitMaterial["group"], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of materials.filter((x) => x.group === g)) {
        if (on) next.add(m.id);
        else next.delete(m.id);
      }
      return next;
    });

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
  };
  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(key);
    } catch {
      window.prompt("コピーできない場合は、この文をすべて選択してコピーしてください", text);
    }
  };
  const downloadCombined = () => {
    if (!chosen.length) return;
    triggerDownload(new Blob([combine(chosen, sender)], { type: "text/markdown;charset=utf-8" }), `アドアーチ仕様_AI設定_${dateTag()}.md`);
  };
  const downloadZip = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file(`00_最初に貼る_アドアーチ仕様_AI設定_${dateTag()}.md`, buildPreamble({ company: sender.company, prefecture: sender.prefecture, labels: chosen.map((m) => m.label), date: dateTag() }));
      chosen.forEach((m, i) => zip.file(`${String(i + 1).padStart(2, "0")}_${safeName(m.label)}_${dateTag()}.md`, m.body));
      zip.file("README.txt", `アドアーチグループ仕様 AI設定（${dateTag()}）\n\n1. 「00_最初に貼る」を、お使いのAI（Claude / ChatGPT / Gemini）に貼る\n2. 続けて、使う材料の .md を貼る（まとめて貼ってもよい）\n3. 各材料の末尾にある「指示文」のどれかを送る\n\n数字・価格の正本は Ad Arch OS です。古いコピーの数字は使わないでください。\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, `AdArch_AI用材料_${dateTag()}.zip`);
    } finally {
      setBusy(false);
    }
  };

  const btn = "inline-flex items-center gap-1.5 text-xs font-bold rounded-lg transition-colors";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start">
        {/* ===== 左: 材料を選ぶ ===== */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
            <p className="text-sm font-bold text-zinc-900">材料を選ぶ</p>
            <div className="flex items-center gap-2 text-[11px]">
              <button onClick={() => setSelected(new Set(materials.map((m) => m.id)))} className="text-zinc-600 hover:text-zinc-900 font-bold">すべて選ぶ</button>
              <span className="text-zinc-300">|</span>
              <button onClick={() => setSelected(new Set())} className="text-zinc-600 hover:text-zinc-900 font-bold">解除</button>
            </div>
          </div>
          {groups.map(({ g, items }) => {
            const allOn = items.every((m) => selected.has(m.id));
            return (
              <div key={g} className="border-b border-zinc-100 last:border-b-0">
                <div className="px-5 pt-3 pb-1 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-zinc-500">{GROUP_LABEL[g].title}</p>
                    <p className="text-[11px] text-zinc-400">{GROUP_LABEL[g].sub}</p>
                  </div>
                  <button onClick={() => setGroup(g, !allOn)} className="shrink-0 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1">
                    {allOn ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {allOn ? "この節を解除" : "この節をすべて"}
                  </button>
                </div>
                <ul>
                  {items.map((m) => {
                    const on = selected.has(m.id);
                    const isPrev = preview?.id === m.id;
                    return (
                      <li key={m.id} className={["flex items-center gap-3 px-5 py-2.5 border-t border-zinc-100", isPrev ? "bg-orange-50/60" : "hover:bg-zinc-50"].join(" ")}>
                        <button onClick={() => toggle(m.id)} aria-label={on ? "選択を外す" : "選択する"} className="shrink-0">
                          {on ? <CheckSquare className="w-5 h-5 text-orange-600" /> : <Square className="w-5 h-5 text-zinc-300" />}
                        </button>
                        <button onClick={() => setPreviewId(m.id)} className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-bold text-zinc-900 truncate">{m.label}</p>
                          <p className="text-[11px] text-zinc-500 truncate">{m.note}</p>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setPreviewId(m.id)} title="プレビュー" className={`${btn} px-2 py-1.5 border ${isPrev ? "border-orange-300 text-orange-700 bg-white" : "border-zinc-200 text-zinc-600 hover:bg-white"}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => copyText(m.body, m.id)} title="この材料だけコピー" className={`${btn} px-2 py-1.5 border border-zinc-200 text-zinc-600 hover:bg-white`}>
                            {copied === m.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a href={m.downloadHref} download title=".md をダウンロード" className={`${btn} px-2 py-1.5 border border-zinc-200 text-zinc-600 hover:bg-white`}>
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ===== 右: プレビュー ===== */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden lg:sticky lg:top-4">
          {preview ? (
            <>
              <div className="px-5 py-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{preview.label}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{preview.version}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={preview.downloadHref} download className={`${btn} px-3 py-1.5 border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
                    <FileText className="w-3.5 h-3.5" />.md
                  </a>
                  <button onClick={() => copyText(preview.body, "preview")} className={`${btn} px-3 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800`}>
                    {copied === "preview" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === "preview" ? "コピーしました" : "この材料をコピー"}
                  </button>
                </div>
              </div>
              <div className="px-5 py-4 max-h-[64vh] overflow-y-auto">
                <WikiArticleContent body={preview.body} />
              </div>
            </>
          ) : (
            <div className="p-8 text-sm text-zinc-500">左の一覧から材料を選ぶと、ここに中身が出ます</div>
          )}
        </div>
      </div>

      {/* ===== まとめて持っていく（画面下に固定） ===== */}
      <div className="sticky bottom-3 z-10">
        <div className="bg-zinc-900 text-white rounded-xl px-5 py-3 flex flex-wrap items-center gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-orange-400" />
            <span className="font-bold tabular-nums">{chosen.length}件</span>
            <span className="text-zinc-400 text-xs">選択中{chosen.length ? `：${chosen.map((m) => m.label).join("／")}` : ""}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button disabled={!chosen.length} onClick={() => copyText(combine(chosen, sender), "all")} className={`${btn} px-4 py-2 bg-orange-500 text-zinc-900 hover:bg-orange-400 disabled:opacity-40`}>
              {copied === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "all" ? "コピーしました" : "AIをアドアーチ仕様にする（全文コピー）"}
            </button>
            <button disabled={!chosen.length} onClick={downloadCombined} className={`${btn} px-4 py-2 bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-40`}>
              <Download className="w-3.5 h-3.5" />設定文＋材料を1本の .md で
            </button>
            <button disabled={!chosen.length || busy} onClick={downloadZip} className={`${btn} px-4 py-2 border border-zinc-500 text-white hover:bg-zinc-800 disabled:opacity-40`}>
              <Archive className="w-3.5 h-3.5" />
              {busy ? "作成中…" : "ZIPで個別に"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
