"use client";

// 本部: 資料の登録・管理（ソート／一括選択／一括削除・やり直し・出どころ変更／日付フィルタ）
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Link2, AlignLeft, Loader2, RefreshCw, Trash2, Pencil, X, Check } from "lucide-react";
import { OriginBadge } from "./origin-badge";
import { ORIGIN_UI, STATUS_UI, fmtDate, type KnowledgeItem, type KnowledgeOrigin, type KnowledgeStatus } from "./types";

type SortKey = "createdAt" | "updatedAt" | "title" | "publisher" | "charCount";
type Kind = "FILE" | "URL" | "TEXT";

export function KnowledgeAdmin({ focusId }: { focusId?: string }) {
  // ---- 登録フォーム ----
  const [kind, setKind] = useState<Kind>("FILE");
  const [origin, setOrigin] = useState<KnowledgeOrigin>("EXTERNAL");
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [note, setNote] = useState("");
  const [hqOnly, setHqOnly] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ---- 一覧 ----
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fOrigin, setFOrigin] = useState<KnowledgeOrigin | "">("");
  const [fStatus, setFStatus] = useState<KnowledgeStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (fOrigin) sp.set("origin", fOrigin);
    if (fStatus) sp.set("status", fStatus);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("sort", sort);
    sp.set("dir", dir);
    const res = await fetch(`/api/knowledge?${sp.toString()}`);
    if (res.ok) setItems((await res.json()).items);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fOrigin, fStatus, from, to, sort, dir]);

  // 整理中があるあいだは8秒ごとに更新
  const hasPending = useMemo(() => items.some((i) => i.status === "PENDING"), [items]);
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending]);

  // ?focus=<id> は一度だけ開く（開いたらURLから消す。閉じたあと件数が変わっても再び開かない）
  const router = useRouter();
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (focusedOnce.current || !focusId || !items.length) return;
    const it = items.find((i) => i.id === focusId);
    if (!it) return;
    focusedOnce.current = true;
    setEditing(it);
    router.replace("/dashboard/admin/knowledge");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, items.length]);

  // ---- 登録 ----
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const common = (fd: FormData) => {
        fd.set("kind", kind);
        fd.set("origin", origin);
        fd.set("title", title);
        fd.set("publisher", publisher);
        fd.set("publishedAt", publishedAt);
        fd.set("note", note);
        fd.set("hqOnly", hqOnly ? "1" : "0");
      };
      if (kind === "FILE") {
        if (files.length === 0) throw new Error("ファイルを選んでください");
        let ok = 0;
        for (const f of files) {
          const fd = new FormData();
          common(fd);
          if (files.length > 1) fd.set("title", ""); // 複数のときはファイル名→AIの読み取りで題名を付ける
          fd.set("file", f);
          const res = await fetch("/api/knowledge", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(`${f.name}: ${data.error ?? "失敗"}`);
          ok++;
        }
        setMsg({ ok: true, text: `${ok}件を登録しました。全文の取り出しとAIの整理を始めています（PDFは数分かかります）` });
        setFiles([]);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        const fd = new FormData();
        common(fd);
        if (kind === "URL") fd.set("url", url);
        else fd.set("text", text);
        const res = await fetch("/api/knowledge", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "失敗");
        setMsg({ ok: true, text: "登録しました。AIの整理を始めています" });
        setUrl("");
        setText("");
      }
      setTitle("");
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "失敗しました" });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 一括 ----
  const bulk = async (action: "delete" | "reprocess" | "setOrigin" | "setHqOnly", value?: unknown) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`${ids.length}件を削除します。原本・全文・整理も消えます。よろしいですか？`)) return;
    setBusy(true);
    const res = await fetch("/api/knowledge/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, action, value }) });
    setBusy(false);
    if (!res.ok) {
      alert((await res.json()).error ?? "失敗しました");
      return;
    }
    setSelected(new Set());
    await load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    const res = await fetch(`/api/knowledge/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: editing.title, origin: editing.origin, publisher: editing.publisher ?? "", publishedAt: editing.publishedAt ?? "", note: editing.note ?? "", hqOnly: editing.hqOnly }),
    });
    setBusy(false);
    if (!res.ok) {
      alert((await res.json()).error ?? "失敗しました");
      return;
    }
    setEditing(null);
    await load();
  };

  const reprocessOne = async (id: string) => {
    setBusy(true);
    await fetch(`/api/knowledge/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reprocess" }) });
    setBusy(false);
    await load();
  };

  const header = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
        else {
          setSort(key);
          setDir(key === "title" || key === "publisher" ? "asc" : "desc");
        }
      }}
      className="text-left font-bold text-zinc-500 hover:text-zinc-800"
    >
      {label}
      {sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </button>
  );

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300";

  return (
    <div className="space-y-5">
      {/* 登録 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-zinc-800">資料を登録</p>
          <div className="flex items-center gap-1 text-xs ml-2">
            {(
              [
                ["FILE", "ファイル", Upload],
                ["URL", "URL", Link2],
                ["TEXT", "テキスト", AlignLeft],
              ] as const
            ).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setKind(k)} className={`px-2.5 py-1.5 rounded-lg border font-bold inline-flex items-center gap-1 ${kind === k ? "bg-zinc-800 text-white border-zinc-800" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* 出どころ＝最重要 */}
        <div className="grid sm:grid-cols-2 gap-2">
          {(["EXTERNAL", "OWN"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOrigin(o)}
              className={`text-left rounded-lg border-2 px-3 py-2.5 ${origin === o ? (o === "OWN" ? "border-emerald-500 bg-emerald-50/50" : "border-amber-500 bg-amber-50/50") : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
            >
              <div className="flex items-center gap-2">
                <OriginBadge origin={o} />
                <span className="text-sm font-bold text-zinc-800">{ORIGIN_UI[o].label}</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{ORIGIN_UI[o].hint}</p>
            </button>
          ))}
        </div>

        {kind === "FILE" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.pptx,.docx,.txt,.md,.csv,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-xs text-zinc-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-white file:text-xs file:font-bold hover:file:bg-zinc-900"
            />
            <p className="text-[10px] text-zinc-400 mt-1">PDF / PPTX / DOCX / TXT / MD / CSV・1件30MBまで・複数可（複数のときは題名をAIが付けます）。PDFはAIが図表ごと文字起こしするため数分かかります</p>
          </div>
        )}
        {kind === "URL" && <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…（媒体の料金ページ・仕様ページなど）" className={inputCls} />}
        {kind === "TEXT" && <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="貼り付け（メールで届いた条件・議事録・電話で聞いた仕様など）" className={inputCls} />}

        <div className="grid sm:grid-cols-3 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "TEXT" ? "題名（必須）" : "題名（空ならAIが付ける）"} className={inputCls} />
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="発行元（媒体社名・会社名）" className={inputCls} />
          <input value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} placeholder="年月・版（例: 2026年4月版）" className={inputCls} />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="本部メモ（使いどころ・注意。全員に見えます）" className={inputCls} />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
            <input type="checkbox" checked={hqOnly} onChange={(e) => setHqOnly(e.target.checked)} /> 本部限定（加盟条件・原価表など。代表以外の検索・質問・一覧に出さない）
          </label>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 登録する
          </button>
        </div>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}
      </div>

      {/* 一覧 */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
            className="flex items-center gap-1 flex-1 min-w-[200px]"
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="題名・発行元・本文" className="flex-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs" />
            <button type="submit" className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-bold">検索</button>
          </form>
          <select value={fOrigin} onChange={(e) => setFOrigin(e.target.value as KnowledgeOrigin | "")} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs">
            <option value="">出どころ: すべて</option>
            <option value="OWN">自社</option>
            <option value="EXTERNAL">他社・媒体</option>
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as KnowledgeStatus | "")} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs">
            <option value="">状態: すべて</option>
            <option value="READY">使える</option>
            <option value="PENDING">整理中</option>
            <option value="FAILED">失敗</option>
          </select>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs" />
            〜
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs" />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="px-4 py-2 border-b border-amber-100 bg-amber-50/60 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-zinc-700">{selected.size}件を選択</span>
            <button disabled={busy} onClick={() => bulk("reprocess")} className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> やり直す</button>
            <button disabled={busy} onClick={() => bulk("setOrigin", "OWN")} className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700">自社にする</button>
            <button disabled={busy} onClick={() => bulk("setOrigin", "EXTERNAL")} className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-700">他社・媒体にする</button>
            <button disabled={busy} onClick={() => bulk("setHqOnly", true)} className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50">本部限定にする</button>
            <button disabled={busy} onClick={() => bulk("setHqOnly", false)} className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50">全員に公開</button>
            <button disabled={busy} onClick={() => bulk("delete")} className="ml-auto px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> 削除</button>
          </div>
        )}

        <div className="grid grid-cols-[28px_1fr_130px_80px_80px_90px_70px] gap-2 px-4 py-2 border-b border-zinc-100 text-[11px] items-center">
          <input type="checkbox" aria-label="全選択" checked={items.length > 0 && selected.size === items.length} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} />
          {header("title", "資料")}
          {header("publisher", "発行元")}
          <span className="font-bold text-zinc-500">状態</span>
          {header("charCount", "分量")}
          {header("createdAt", "登録日")}
          <span />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400 text-xs gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 読み込み中</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">資料がありません</div>
        ) : (
          items.map((it) => {
            const st = STATUS_UI[it.status];
            return (
              <div key={it.id} className={`grid grid-cols-[28px_1fr_130px_80px_80px_90px_70px] gap-2 px-4 py-2.5 border-b border-zinc-50 items-start text-xs ${selected.has(it.id) ? "bg-amber-50/40" : "hover:bg-zinc-50/60"}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.has(it.id)}
                  onChange={() =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (n.has(it.id)) n.delete(it.id);
                      else n.add(it.id);
                      return n;
                    })
                  }
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <OriginBadge origin={it.origin} size="xs" />
                    {it.hqOnly && <span className="text-[10px] px-1.5 rounded border border-zinc-300 text-zinc-500">本部限定</span>}
                    <Link href={`/dashboard/knowledge/${it.id}`} className="font-bold text-zinc-800 hover:underline truncate">{it.title}</Link>
                    {it.publishedAt && <span className="text-zinc-400">{it.publishedAt}</span>}
                  </div>
                  {it.summary ? <p className="text-zinc-500 mt-0.5 line-clamp-1">{it.summary}</p> : it.errorMessage ? <p className="text-rose-600 mt-0.5">{it.errorMessage}</p> : null}
                  <p className="text-[10px] text-zinc-400 mt-0.5">{it.kind === "FILE" ? it.fileName : it.kind === "URL" ? it.sourceUrl : "テキスト"} ／ {it.createdByName}</p>
                </div>
                <div className="text-zinc-600 truncate">{it.publisher ?? "—"}</div>
                <div><span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span></div>
                <div className="text-zinc-500">{it.pageCount ? `${it.pageCount}p` : `${Math.round(it.charCount / 1000)}千字`}</div>
                <div className="text-zinc-500">{fmtDate(it.createdAt)}</div>
                <div className="flex items-center gap-1">
                  <button title="編集" onClick={() => setEditing(it)} className="p-1 rounded hover:bg-zinc-100 text-zinc-500"><Pencil className="w-3.5 h-3.5" /></button>
                  <button title="やり直す" disabled={busy || it.status === "PENDING"} onClick={() => reprocessOne(it.id)} className="p-1 rounded hover:bg-zinc-100 text-zinc-500 disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 編集 */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-zinc-800">資料を編集</p>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-zinc-100"><X className="w-4 h-4" /></button>
            </div>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputCls} placeholder="題名" />
            <div className="grid grid-cols-2 gap-2">
              {(["EXTERNAL", "OWN"] as const).map((o) => (
                <button key={o} onClick={() => setEditing({ ...editing, origin: o })} className={`rounded-lg border-2 px-3 py-2 text-left ${editing.origin === o ? (o === "OWN" ? "border-emerald-500 bg-emerald-50/50" : "border-amber-500 bg-amber-50/50") : "border-zinc-200"}`}>
                  <OriginBadge origin={o} />
                  <p className="text-[10px] text-zinc-500 mt-1">{ORIGIN_UI[o].hint}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={editing.publisher ?? ""} onChange={(e) => setEditing({ ...editing, publisher: e.target.value })} className={inputCls} placeholder="発行元" />
              <input value={editing.publishedAt ?? ""} onChange={(e) => setEditing({ ...editing, publishedAt: e.target.value })} className={inputCls} placeholder="年月・版" />
            </div>
            <textarea value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} rows={3} className={inputCls} placeholder="本部メモ" />
            <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" checked={editing.hqOnly} onChange={(e) => setEditing({ ...editing, hqOnly: e.target.checked })} /> 本部限定
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs">やめる</button>
              <button disabled={busy} onClick={saveEdit} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
