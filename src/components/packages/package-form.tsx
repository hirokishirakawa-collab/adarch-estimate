"use client";

// ==============================================================
// パッケージの起案・編集フォーム（1枚で全項目）
//   ・「AIで下書き」＝一言のアイデアから中身・分担・営業文・規定まで埋める（価格は候補文だけ）
//   ・Json列（届くもの／オプション／分担／資料）は行エディタ → hidden に JSON で載せて送る
//   ・状態（提案中/稼働中/終了）は本部だけが触れる
// ==============================================================

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { savePackage } from "@/lib/actions/packages";
import { PackageImageField } from "./image-field";
import {
  CATEGORY_SUGGESTIONS,
  OWNER_LABEL,
  PRICE_TYPE_LABEL,
  STATUS_LABEL,
  type FulfillmentOwner,
  type PackageDeliverable,
  type PackageDoc,
  type PackageFulfillment,
  type PackageOption,
} from "@/lib/packages/types";
import type { SalesPackagePriceType, SalesPackageStatus } from "@/generated/prisma/client";

export type PackageFormValues = {
  id?: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  targetIndustries: string;
  painPoints: string;
  summary: string;
  deliverables: PackageDeliverable[];
  leadTime: string;
  options: PackageOption[];
  priceType: SalesPackagePriceType;
  initialPrice: string;
  monthlyPrice: string;
  priceNote: string;
  fulfillment: PackageFulfillment[];
  pitchText: string;
  talkTrack: string;
  rules: string;
  caseStudies: string;
  docs: PackageDoc[];
  proposalNote: string;
  status: SalesPackageStatus;
  imageUrl: string;
  calculator: string;
};

export function emptyPackageValues(): PackageFormValues {
  return {
    slug: "",
    name: "",
    tagline: "",
    category: "",
    imageUrl: "",
    calculator: "",
    targetIndustries: "",
    painPoints: "",
    summary: "",
    deliverables: [],
    leadTime: "",
    options: [],
    priceType: "ONE_TIME",
    initialPrice: "",
    monthlyPrice: "",
    priceNote: "",
    fulfillment: [],
    pitchText: "",
    talkTrack: "",
    rules: "",
    caseStudies: "",
    docs: [],
    proposalNote: "",
    status: "PROPOSED",
  };
}

interface Props {
  initial: PackageFormValues;
  isAdmin: boolean;
  mode: "create" | "edit";
  /** AI下書きの「派生元」に選べる既存パッケージ */
  basePackages: { slug: string; name: string }[];
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent placeholder:text-zinc-400";
const labelCls = "block text-xs font-semibold text-zinc-600 mb-1";
const smallCls = "px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-300 w-full";

type Draft = {
  name: string;
  tagline: string;
  category: string;
  targetIndustries: string[];
  painPoints: string;
  summary: string;
  deliverables: PackageDeliverable[];
  leadTime: string;
  options: PackageOption[];
  priceType: SalesPackagePriceType;
  priceHint: string;
  fulfillment: PackageFulfillment[];
  pitchText: string;
  talkTrack: string;
  rules: string;
};

export function PackageForm({ initial, isAdmin, mode, basePackages }: Props) {
  const [state, formAction, isPending] = useActionState(savePackage, null);
  const [v, setV] = useState<PackageFormValues>(initial);
  const set = <K extends keyof PackageFormValues>(k: K, val: PackageFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  // ── AI 下書き ──
  const [idea, setIdea] = useState("");
  const [baseSlug, setBaseSlug] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  const [priceHint, setPriceHint] = useState("");

  async function draft() {
    if (idea.trim().length < 4) {
      setDraftMsg("アイデアを一言で書いてください（例: 周年企業向けの記念動画＋TVer）");
      return;
    }
    if (v.name && !confirm("いま入っている内容をAIの下書きで置き換えます。よろしいですか？（価格は消えません）")) return;
    setDrafting(true);
    setDraftMsg(null);
    try {
      const res = await fetch("/api/packages/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, baseSlug: baseSlug || undefined }),
      });
      const data = (await res.json()) as { draft?: Draft; error?: string; basedOn?: number };
      if (!res.ok || !data.draft) {
        setDraftMsg(data.error ?? "下書きの生成に失敗しました");
        return;
      }
      const d = data.draft;
      setV((p) => ({
        ...p,
        name: d.name || p.name,
        tagline: d.tagline,
        category: d.category,
        targetIndustries: d.targetIndustries.join("、"),
        painPoints: d.painPoints,
        summary: d.summary,
        deliverables: d.deliverables,
        leadTime: d.leadTime,
        options: d.options,
        priceType: d.priceType,
        fulfillment: d.fulfillment,
        pitchText: d.pitchText,
        talkTrack: d.talkTrack,
        rules: d.rules,
        proposalNote: p.proposalNote || `アイデア: ${idea}`,
      }));
      setPriceHint(d.priceHint);
      setDraftMsg(`下書きを入れました（既存パッケージ${data.basedOn ?? 0}本を参考）。価格は下の欄に人が入れてください`);
    } catch {
      setDraftMsg("下書きの生成に失敗しました");
    } finally {
      setDrafting(false);
    }
  }

  // ── 行エディタ ──
  function rows<T>(key: "deliverables" | "options" | "fulfillment" | "docs", make: () => T) {
    return {
      add: () => setV((p) => ({ ...p, [key]: [...(p[key] as T[]), make()] })),
      update: (i: number, patch: Partial<T>) =>
        setV((p) => ({ ...p, [key]: (p[key] as T[]).map((r, j) => (j === i ? { ...r, ...patch } : r)) })),
      remove: (i: number) => setV((p) => ({ ...p, [key]: (p[key] as T[]).filter((_, j) => j !== i) })),
    };
  }
  const dl = rows<PackageDeliverable>("deliverables", () => ({ name: "", qty: 1, unit: "本", spec: "" }));
  const op = rows<PackageOption>("options", () => ({ name: "", price: null, note: "" }));
  const ff = rows<PackageFulfillment>("fulfillment", () => ({ task: "", owner: "BRANCH", note: "" }));
  const dc = rows<PackageDoc>("docs", () => ({ title: "", url: "" }));

  return (
    <form action={formAction} className="space-y-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="deliverables" value={JSON.stringify(v.deliverables)} />
      <input type="hidden" name="options" value={JSON.stringify(v.options)} />
      <input type="hidden" name="fulfillment" value={JSON.stringify(v.fulfillment)} />
      <input type="hidden" name="docs" value={JSON.stringify(v.docs)} />

      {/* ── AI 下書き ── */}
      <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50/80 to-white p-4 space-y-3">
        <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          AIで下書き（一言のアイデア → 中身・分担・営業文・規定まで）
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="例: 周年を迎える会社向けに、記念動画＋地元TVer配信をセットで"
            className={inputCls}
          />
          <select value={baseSlug} onChange={(e) => setBaseSlug(e.target.value)} className={`${inputCls} sm:w-56`}>
            <option value="">派生元なし</option>
            {basePackages.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name} をもとに
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={draft}
            disabled={drafting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
          >
            {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {drafting ? "作成中…" : "下書きを作る"}
          </button>
        </div>
        {draftMsg && <p className="text-xs text-zinc-600">{draftMsg}</p>}
      </div>

      {/* ── 顔 ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-zinc-800">① 顔（何を売るか）</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>
              パッケージ名 <span className="text-red-500">*</span>
            </label>
            <input name="name" required maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="例: 採用動画パッケージ" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>サムネイル（参考イメージ）</label>
            <PackageImageField
              value={v.imageUrl}
              onChange={(url) => set("imageUrl", url)}
              context={{ name: v.name, tagline: v.tagline, category: v.category, painPoints: v.painPoints, summary: v.summary }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>一言（売り文句）</label>
            <input name="tagline" maxLength={80} value={v.tagline} onChange={(e) => set("tagline", e.target.value)} className={inputCls} placeholder="例: 求人票では伝わらない「働く姿」を90秒で" />
          </div>
          <div>
            <label className={labelCls}>分類</label>
            <input name="category" list="pkg-categories" maxLength={40} value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls} placeholder="採用 / サイネージ / TVer …" />
            <datalist id="pkg-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>URL用の名前（英数字・任意）</label>
            <input name="slug" maxLength={40} value={v.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} placeholder="空欄なら自動（例: recruit-video）" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>対象業種（読点区切り）</label>
            <input name="targetIndustries" maxLength={400} value={v.targetIndustries} onChange={(e) => set("targetIndustries", e.target.value)} className={inputCls} placeholder="例: 建設、介護、運送、製造" />
          </div>
          <div>
            <label className={labelCls}>想定顧客の悩み（誰の・何に効くか）</label>
            <textarea name="painPoints" rows={4} value={v.painPoints} onChange={(e) => set("painPoints", e.target.value)} className={inputCls} placeholder="例: 求人媒体に出しても応募が来ない。会社の雰囲気が伝わらず、面接前に辞退される" />
          </div>
          <div>
            <label className={labelCls}>概要（何が届くか）</label>
            <textarea name="summary" rows={4} value={v.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} />
          </div>
        </div>
      </section>

      {/* ── 中身 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-800">② 届くもの・納期・オプション</h3>
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] text-zinc-500">
              <tr>
                <th className="px-2 py-1.5 text-left w-[28%]">品目</th>
                <th className="px-2 py-1.5 text-right w-14">数量</th>
                <th className="px-2 py-1.5 text-left w-16">単位</th>
                <th className="px-2 py-1.5 text-left">仕様</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {v.deliverables.map((d, i) => (
                <tr key={i} className="border-t border-zinc-100">
                  <td className="p-1"><input value={d.name} onChange={(e) => dl.update(i, { name: e.target.value })} className={smallCls} placeholder="採用動画（90秒）" /></td>
                  <td className="p-1"><input type="number" min={0} value={d.qty} onChange={(e) => dl.update(i, { qty: Number(e.target.value) })} className={`${smallCls} text-right`} /></td>
                  <td className="p-1"><input value={d.unit} onChange={(e) => dl.update(i, { unit: e.target.value })} className={smallCls} /></td>
                  <td className="p-1"><input value={d.spec} onChange={(e) => dl.update(i, { spec: e.target.value })} className={smallCls} placeholder="撮影半日・16:9・字幕付き" /></td>
                  <td className="p-1 text-center"><button type="button" onClick={() => dl.remove(i)} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
              {v.deliverables.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-3 text-xs text-zinc-400">まだ品目がありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={dl.add} className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800"><Plus className="w-3.5 h-3.5" />品目を追加</button>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            納期の目安
            <input name="leadTime" maxLength={80} value={v.leadTime} onChange={(e) => set("leadTime", e.target.value)} className={`${smallCls} w-56`} placeholder="発注から4週間" />
          </label>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-zinc-600">追加オプション</p>
          {v.options.map((o, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={o.name} onChange={(e) => op.update(i, { name: e.target.value })} className={`${smallCls} sm:w-1/3`} placeholder="オプション名" />
              <input value={o.price ?? ""} onChange={(e) => op.update(i, { price: e.target.value === "" ? null : Number(e.target.value.replace(/[^\d]/g, "")) })} className={`${smallCls} w-28 text-right`} placeholder="価格（税抜）" />
              <input value={o.note} onChange={(e) => op.update(i, { note: e.target.value })} className={smallCls} placeholder="内容" />
              <button type="button" onClick={() => op.remove(i)} className="text-zinc-400 hover:text-red-500 px-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={op.add} className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800"><Plus className="w-3.5 h-3.5" />オプションを追加</button>
        </div>
      </section>

      {/* ── 価格 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-800">③ 価格（税抜）</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>価格の型</label>
            <select name="priceType" value={v.priceType} onChange={(e) => set("priceType", e.target.value as SalesPackagePriceType)} className={inputCls}>
              {(Object.keys(PRICE_TYPE_LABEL) as SalesPackagePriceType[]).map((k) => (
                <option key={k} value={k}>{PRICE_TYPE_LABEL[k]}</option>
              ))}
            </select>
          </div>
          {v.priceType !== "MONTHLY" && (
            <div>
              <label className={labelCls}>{v.priceType === "ONE_TIME" ? "価格" : "初期費用"}</label>
              <input name="initialPrice" inputMode="numeric" value={v.initialPrice} onChange={(e) => set("initialPrice", e.target.value)} className={`${inputCls} text-right`} placeholder="未設定" />
            </div>
          )}
          {v.priceType !== "ONE_TIME" && (
            <div>
              <label className={labelCls}>月額</label>
              <input name="monthlyPrice" inputMode="numeric" value={v.monthlyPrice} onChange={(e) => set("monthlyPrice", e.target.value)} className={`${inputCls} text-right`} placeholder="未設定" />
            </div>
          )}
          <div className={v.priceType === "INITIAL_PLUS_MONTHLY" ? "" : "sm:col-span-2"}>
            <label className={labelCls}>価格の補足</label>
            <input name="priceNote" maxLength={200} value={v.priceNote} onChange={(e) => set("priceNote", e.target.value)} className={inputCls} placeholder="例: 交通費別／最低3ヶ月" />
          </div>
        </div>
        {priceHint && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 whitespace-pre-wrap">
            <span className="font-bold">AIの価格の考え方（候補・確定は人）</span>
            {"\n"}{priceHint}
          </div>
        )}
        <p className="text-[11px] text-zinc-400">価格を空欄のまま「提案中」で出してよいです。稼働中にするときに本部が入れます。</p>
      </section>

      {/* ── 分担 ── */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-zinc-800">④ 分担（誰が何をやるか）</h3>
        {v.fulfillment.map((f, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={f.task} onChange={(e) => ff.update(i, { task: e.target.value })} className={`${smallCls} sm:w-2/5`} placeholder="やること（例: 撮影・編集）" />
            <select value={f.owner} onChange={(e) => ff.update(i, { owner: e.target.value as FulfillmentOwner })} className={`${smallCls} w-28`}>
              {(Object.keys(OWNER_LABEL) as FulfillmentOwner[]).map((k) => (
                <option key={k} value={k}>{OWNER_LABEL[k]}</option>
              ))}
            </select>
            <input value={f.note} onChange={(e) => ff.update(i, { note: e.target.value })} className={smallCls} placeholder="補足（発注先・期限など）" />
            <button type="button" onClick={() => ff.remove(i)} className="text-zinc-400 hover:text-red-500 px-1"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button type="button" onClick={ff.add} className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800"><Plus className="w-3.5 h-3.5" />分担を追加</button>
      </section>

      {/* ── 売り方 ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-zinc-800">⑤ 売り方（営業文・切り口・規定・事例）</h3>
        <div>
          <label className={labelCls}>営業文（フォーム営業向け・1段落・<code className="bg-zinc-100 px-1 rounded">{"{name}"}</code> は相手の会社名）</label>
          <textarea name="pitchText" rows={5} value={v.pitchText} onChange={(e) => set("pitchText", e.target.value)} className={inputCls} />
          <p className="text-[11px] text-zinc-400 mt-1">稼働中になると、営業フォームの「訴求」にこのパッケージが並び、本文の中段にこの文が入ります。</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>商談の切り口</label>
            <textarea name="talkTrack" rows={6} value={v.talkTrack} onChange={(e) => set("talkTrack", e.target.value)} className={inputCls} placeholder="最初の質問／刺さる言い方／よくある反論と返し" />
          </div>
          <div>
            <label className={labelCls}>統一規定（値引き上限・名称・言ってはいけないこと）</label>
            <textarea name="rules" rows={6} value={v.rules} onChange={(e) => set("rules", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>成功事例（売れた相手・決め手・結果）</label>
            <textarea name="caseStudies" rows={4} value={v.caseStudies} onChange={(e) => set("caseStudies", e.target.value)} className={inputCls} placeholder="まだ無ければ空欄で。受注したら足す" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-zinc-600">資料リンク（Drive・PDF・参考ページ）</p>
          {v.docs.map((d, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={d.title} onChange={(e) => dc.update(i, { title: e.target.value })} className={`${smallCls} sm:w-1/3`} placeholder="資料名" />
              <input value={d.url} onChange={(e) => dc.update(i, { url: e.target.value })} className={smallCls} placeholder="https://…" />
              <button type="button" onClick={() => dc.remove(i)} className="text-zinc-400 hover:text-red-500 px-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={dc.add} className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800"><Plus className="w-3.5 h-3.5" />資料を追加</button>
        </div>
      </section>

      {/* ── 起案・状態 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-800">⑥ 起案の背景{isAdmin ? "・状態" : ""}</h3>
        <textarea name="proposalNote" rows={3} value={v.proposalNote} onChange={(e) => set("proposalNote", e.target.value)} className={inputCls} placeholder="誰の要望か・なぜ売れそうか・どの地域で試すか" />
        {isAdmin ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              状態
              <select name="status" value={v.status} onChange={(e) => set("status", e.target.value as SalesPackageStatus)} className={`${smallCls} w-40`}>
                {(Object.keys(STATUS_LABEL) as SalesPackageStatus[]).map((k) => (
                  <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                ))}
              </select>
              <span className="text-zinc-400">稼働中＝営業フォーム・見積・チャットに並びます</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              エリア別の目安
              <select name="calculator" value={v.calculator} onChange={(e) => set("calculator", e.target.value)} className={`${smallCls} w-56`}>
                <option value="">出さない</option>
                <option value="tver-area">TVer（市を選ぶと月額別の到達人数・住民比）</option>
              </select>
              <span className="text-zinc-400">詳細画面と公開ページに、県・市を選ぶ表が出ます</span>
            </label>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">保存すると「提案中」として全員に見えます。本部が承認すると稼働中になります。</p>
        )}
      </section>

      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{state.error}</div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link href={v.id ? `/dashboard/packages/${initial.slug}` : "/dashboard/packages"} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900">
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-[#1F3A5F] text-white rounded-lg hover:bg-[#16304f] disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {mode === "create" ? (isAdmin ? "保存する" : "提案として出す") : "更新する"}
        </button>
      </div>
    </form>
  );
}
