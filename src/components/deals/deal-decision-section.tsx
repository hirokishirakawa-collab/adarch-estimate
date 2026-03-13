"use client";

import { useState, useTransition, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Save, Loader2, FileCheck, Calendar, Users, StickyNote } from "lucide-react";
import { getDecisionSheet, saveDecisionSheet } from "@/lib/actions/hearing";

const CONTRACT_TYPE_OPTIONS = [
  { value: "spot", label: "スポット" },
  { value: "monthly", label: "月額" },
  { value: "yearly", label: "年間契約" },
  { value: "other", label: "その他" },
] as const;

interface Props {
  dealId: string;
  dealTitle: string;
}

export function DealDecisionSection({ dealId, dealTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [hasData, setHasData] = useState(false);

  const [form, setForm] = useState({
    projectName: "",
    confirmedAmount: null as number | null,
    contractType: null as string | null,
    paymentTerms: "",
    deliverables: "",
    kickoffDate: "",
    deliveryDate: "",
    projectLead: "",
    teamMembers: "",
    clientApproval: false,
    internalApproval: false,
    specialNotes: "",
  });

  useEffect(() => {
    if (open && !loaded) {
      getDecisionSheet(dealId).then((data) => {
        if (data) {
          setHasData(true);
          setForm({
            projectName: data.projectName ?? "",
            confirmedAmount: data.confirmedAmount ? Number(data.confirmedAmount) : null,
            contractType: data.contractType,
            paymentTerms: data.paymentTerms ?? "",
            deliverables: data.deliverables ?? "",
            kickoffDate: data.kickoffDate
              ? new Date(data.kickoffDate).toISOString().slice(0, 10)
              : "",
            deliveryDate: data.deliveryDate
              ? new Date(data.deliveryDate).toISOString().slice(0, 10)
              : "",
            projectLead: data.projectLead ?? "",
            teamMembers: data.teamMembers ?? "",
            clientApproval: data.clientApproval,
            internalApproval: data.internalApproval,
            specialNotes: data.specialNotes ?? "",
          });
        }
        setLoaded(true);
      });
    }
  }, [open, loaded, dealId]);

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      const result = await saveDecisionSheet(dealId, {
        projectName: form.projectName || null,
        confirmedAmount: form.confirmedAmount,
        contractType: form.contractType,
        paymentTerms: form.paymentTerms || null,
        deliverables: form.deliverables || null,
        kickoffDate: form.kickoffDate || null,
        deliveryDate: form.deliveryDate || null,
        projectLead: form.projectLead || null,
        teamMembers: form.teamMembers || null,
        clientApproval: form.clientApproval,
        internalApproval: form.internalApproval,
        specialNotes: form.specialNotes || null,
      });
      if (result.error) alert(result.error);
      else {
        setSaved(true);
        setHasData(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const inputCls = "text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-emerald-400";
  const textareaCls = inputCls + " resize-none";

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 border-b border-zinc-100 bg-emerald-50/60 flex items-center justify-between hover:bg-emerald-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <h2 className="text-xs font-semibold text-emerald-700">決定シート（プロジェクト化）</h2>
          {hasData && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 border border-emerald-200">記録済み</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-emerald-400" />}
      </button>

      {open && (
        <div className="bg-emerald-50 px-5 py-4">
          {!loaded ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
              <span className="text-xs text-emerald-600">読み込み中...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {saved ? "保存しました" : "保存"}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 受注内容 */}
                <Section icon={<FileCheck className="w-3.5 h-3.5 text-emerald-700" />} title="受注内容">
                  <Field label="正式プロジェクト名">
                    <input type="text" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} placeholder={dealTitle} className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="確定金額（円）">
                      <input type="number" min="0" value={form.confirmedAmount ?? ""} onChange={(e) => setForm({ ...form, confirmedAmount: e.target.value ? Number(e.target.value) : null })} placeholder="例: 500000" className={inputCls} />
                    </Field>
                    <Field label="契約形態">
                      <select value={form.contractType ?? ""} onChange={(e) => setForm({ ...form, contractType: e.target.value || null })} className={inputCls + " bg-white"}>
                        <option value="">選択</option>
                        {CONTRACT_TYPE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </Field>
                  </div>
                  <Field label="支払条件">
                    <input type="text" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="例: 納品後30日、着手金50%+納品後50%" className={inputCls} />
                  </Field>
                  <Field label="成果物・納品物">
                    <textarea value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} placeholder="納品する成果物を1行ずつ記入&#10;例: CM動画（30秒）&#10;例: LP制作（1ページ）" rows={3} className={textareaCls} />
                  </Field>
                </Section>

                {/* スケジュール + 体制 */}
                <div className="space-y-4">
                  <Section icon={<Calendar className="w-3.5 h-3.5 text-emerald-700" />} title="スケジュール">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="キックオフ日">
                        <input type="date" value={form.kickoffDate} onChange={(e) => setForm({ ...form, kickoffDate: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="納品予定日">
                        <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className={inputCls} />
                      </Field>
                    </div>
                  </Section>

                  <Section icon={<Users className="w-3.5 h-3.5 text-emerald-700" />} title="体制">
                    <Field label="プロジェクトリーダー">
                      <input type="text" value={form.projectLead} onChange={(e) => setForm({ ...form, projectLead: e.target.value })} placeholder="担当者名" className={inputCls} />
                    </Field>
                    <Field label="チームメンバー">
                      <textarea value={form.teamMembers} onChange={(e) => setForm({ ...form, teamMembers: e.target.value })} placeholder="メンバーを1行ずつ記入" rows={2} className={textareaCls} />
                    </Field>
                  </Section>
                </div>

                {/* 確認事項 - 全幅 */}
                <div className="lg:col-span-2">
                  <Section icon={<StickyNote className="w-3.5 h-3.5 text-emerald-700" />} title="確認・承認">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.clientApproval} onChange={(e) => setForm({ ...form, clientApproval: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-xs font-medium text-zinc-700">クライアント承認済み</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.internalApproval} onChange={(e) => setForm({ ...form, internalApproval: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-xs font-medium text-zinc-700">社内承認済み</span>
                        </label>
                      </div>
                      <div className="lg:col-span-2">
                        <Field label="特記事項・注意点">
                          <textarea value={form.specialNotes} onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} placeholder="納品時の注意点、クライアント側の制約など" rows={3} className={textareaCls} />
                        </Field>
                      </div>
                    </div>
                  </Section>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saved ? "保存しました！" : "決定シートを保存"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Shared sub-components
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-lg bg-white/70 border border-emerald-100 p-3">
      <div className="flex items-center gap-1.5 mb-2">{icon}<span className="text-[11px] font-semibold text-emerald-800">{title}</span></div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</label>{children}</div>;
}
