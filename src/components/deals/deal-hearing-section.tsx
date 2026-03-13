"use client";

import { useState, useTransition, useEffect } from "react";
import { ClipboardList, ChevronDown, ChevronUp, Save, Loader2, Building2, BarChart3, Target, UserCheck, Thermometer, Video, MessageSquare, Hash } from "lucide-react";
import { getDealHearingSheet, saveDealHearingSheet } from "@/lib/actions/hearing";
import {
  TARGET_CUSTOMER_OPTIONS,
  TRADE_AREA_OPTIONS,
  ANNUAL_REVENUE_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  CURRENT_CHANNEL_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  PRIMARY_CHALLENGE_OPTIONS,
  INTERESTED_SERVICE_OPTIONS,
  DESIRED_TIMELINE_OPTIONS,
  DECISION_PROCESS_OPTIONS,
  BUDGET_STATUS_OPTIONS,
  TEMPERATURE_OPTIONS,
  VIDEO_PURPOSE_OPTIONS,
  VIDEO_DURATION_OPTIONS,
  VIDEO_SHOOTING_OPTIONS,
  VIDEO_CAST_OPTIONS,
  VIDEO_PUBLISH_OPTIONS,
  VIDEO_BUDGET_OPTIONS,
} from "@/lib/constants/hearing";

interface Props {
  dealId: string;
  dealTitle: string;
}

export function DealHearingSection({ dealId, dealTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [hasData, setHasData] = useState(false);

  const [form, setForm] = useState({
    businessDescription: "",
    targetCustomers: [] as string[],
    tradeArea: null as string | null,
    annualRevenue: null as string | null,
    employeeCount: null as string | null,
    currentChannels: [] as string[],
    monthlyAdBudget: null as string | null,
    pastEfforts: "",
    competitors: "",
    primaryChallenge: null as string | null,
    challengeDetail: "",
    interestedServices: [] as string[],
    desiredTimeline: null as string | null,
    decisionMaker: "",
    decisionProcess: null as string | null,
    budgetStatus: null as string | null,
    competingVendors: "",
    videoPurposes: [] as string[],
    videoDuration: null as string | null,
    videoShootingType: null as string | null,
    videoCast: null as string | null,
    videoReference: "",
    videoDeadline: "",
    videoPublishTo: [] as string[],
    videoBudget: null as string | null,
    temperature: null as string | null,
    nextAction: "",
    nextActionDate: "",
    hearingRound: null as number | null,
    freeNotes: "",
  });

  useEffect(() => {
    if (open && !loaded) {
      getDealHearingSheet(dealId).then((data) => {
        if (data) {
          setHasData(true);
          setForm({
            businessDescription: data.businessDescription ?? "",
            targetCustomers: data.targetCustomers ?? [],
            tradeArea: data.tradeArea,
            annualRevenue: data.annualRevenue,
            employeeCount: data.employeeCount,
            currentChannels: data.currentChannels ?? [],
            monthlyAdBudget: data.monthlyAdBudget,
            pastEfforts: data.pastEfforts ?? "",
            competitors: data.competitors ?? "",
            primaryChallenge: data.primaryChallenge,
            challengeDetail: data.challengeDetail ?? "",
            interestedServices: data.interestedServices ?? [],
            desiredTimeline: data.desiredTimeline,
            decisionMaker: data.decisionMaker ?? "",
            decisionProcess: data.decisionProcess,
            budgetStatus: data.budgetStatus,
            competingVendors: data.competingVendors ?? "",
            videoPurposes: data.videoPurposes ?? [],
            videoDuration: data.videoDuration,
            videoShootingType: data.videoShootingType,
            videoCast: data.videoCast,
            videoReference: data.videoReference ?? "",
            videoDeadline: data.videoDeadline
              ? new Date(data.videoDeadline).toISOString().slice(0, 10)
              : "",
            videoPublishTo: data.videoPublishTo ?? [],
            videoBudget: data.videoBudget,
            temperature: data.temperature,
            nextAction: data.nextAction ?? "",
            nextActionDate: data.nextActionDate
              ? new Date(data.nextActionDate).toISOString().slice(0, 10)
              : "",
            hearingRound: data.hearingRound ?? null,
            freeNotes: data.freeNotes ?? "",
          });
        }
        setLoaded(true);
      });
    }
  }, [open, loaded, dealId]);

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      const result = await saveDealHearingSheet(dealId, {
        businessDescription: form.businessDescription || null,
        targetCustomers: form.targetCustomers,
        tradeArea: form.tradeArea,
        annualRevenue: form.annualRevenue,
        employeeCount: form.employeeCount,
        currentChannels: form.currentChannels,
        monthlyAdBudget: form.monthlyAdBudget,
        pastEfforts: form.pastEfforts || null,
        competitors: form.competitors || null,
        primaryChallenge: form.primaryChallenge,
        challengeDetail: form.challengeDetail || null,
        interestedServices: form.interestedServices,
        desiredTimeline: form.desiredTimeline,
        decisionMaker: form.decisionMaker || null,
        decisionProcess: form.decisionProcess,
        budgetStatus: form.budgetStatus,
        competingVendors: form.competingVendors || null,
        videoPurposes: form.videoPurposes,
        videoDuration: form.videoDuration,
        videoShootingType: form.videoShootingType,
        videoCast: form.videoCast,
        videoReference: form.videoReference || null,
        videoDeadline: form.videoDeadline || null,
        videoPublishTo: form.videoPublishTo,
        videoBudget: form.videoBudget,
        temperature: form.temperature,
        nextAction: form.nextAction || null,
        nextActionDate: form.nextActionDate || null,
        hearingRound: form.hearingRound,
        freeNotes: form.freeNotes || null,
      });
      if (result.error) alert(result.error);
      else {
        setSaved(true);
        setHasData(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 border-b border-zinc-100 bg-amber-50/60 flex items-center justify-between hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
          <h2 className="text-xs font-semibold text-amber-700">ヒアリングシート</h2>
          {hasData && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 border border-amber-200">記録済み</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
      </button>

      {open && (
        <div className="bg-amber-50 px-5 py-4">
          {!loaded ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="text-xs text-amber-600">読み込み中...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {saved ? "保存しました" : "保存"}
                </button>
              </div>

              {/* G. ヒアリング管理（最上部） */}
              <div className="mb-4">
                <Section icon={<MessageSquare className="w-3.5 h-3.5 text-amber-700" />} title="ヒアリング管理">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <Field label="ヒアリング回数">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" onClick={() => setForm({ ...form, hearingRound: form.hearingRound === n ? null : n })} className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${form.hearingRound === n ? "bg-amber-600 text-white border-amber-600" : "bg-white text-zinc-500 border-zinc-200 hover:border-amber-300"}`}>{n}</button>
                          ))}
                        </div>
                        <span className="text-[10px] text-zinc-400">回目</span>
                      </div>
                    </Field>
                    <div className="lg:col-span-3">
                      <Field label="自由記載欄">
                        <textarea value={form.freeNotes} onChange={(e) => setForm({ ...form, freeNotes: e.target.value })} placeholder="ヒアリングで気づいたこと、補足情報、次回への申し送りなど自由に記入" rows={3} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                      </Field>
                    </div>
                  </div>
                </Section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* A. 顧客理解 */}
                <Section icon={<Building2 className="w-3.5 h-3.5 text-amber-700" />} title="顧客理解">
                  <Field label="事業内容"><textarea value={form.businessDescription} onChange={(e) => setForm({ ...form, businessDescription: e.target.value })} placeholder="具体的な事業内容" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></Field>
                  <Field label="ターゲット顧客層"><MultiSelect options={TARGET_CUSTOMER_OPTIONS} value={form.targetCustomers} onChange={(v) => setForm({ ...form, targetCustomers: v })} /></Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="商圏"><Sel options={TRADE_AREA_OPTIONS} value={form.tradeArea} onChange={(v) => setForm({ ...form, tradeArea: v })} /></Field>
                    <Field label="年商規模"><Sel options={ANNUAL_REVENUE_OPTIONS} value={form.annualRevenue} onChange={(v) => setForm({ ...form, annualRevenue: v })} /></Field>
                    <Field label="従業員数"><Sel options={EMPLOYEE_COUNT_OPTIONS} value={form.employeeCount} onChange={(v) => setForm({ ...form, employeeCount: v })} /></Field>
                  </div>
                </Section>

                {/* B. 現状把握 */}
                <Section icon={<BarChart3 className="w-3.5 h-3.5 text-amber-700" />} title="現状把握">
                  <Field label="現在の集客手段"><MultiSelect options={CURRENT_CHANNEL_OPTIONS} value={form.currentChannels} onChange={(v) => setForm({ ...form, currentChannels: v })} /></Field>
                  <Field label="月間広告費"><Sel options={MONTHLY_AD_BUDGET_OPTIONS} value={form.monthlyAdBudget} onChange={(v) => setForm({ ...form, monthlyAdBudget: v })} /></Field>
                  <Field label="過去に試した施策"><textarea value={form.pastEfforts} onChange={(e) => setForm({ ...form, pastEfforts: e.target.value })} placeholder="過去の施策" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></Field>
                  <Field label="競合"><input type="text" value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} placeholder="競合名" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></Field>
                </Section>

                {/* C. 課題・ニーズ */}
                <Section icon={<Target className="w-3.5 h-3.5 text-amber-700" />} title="課題・ニーズ">
                  <Field label="最も解決したい課題"><Sel options={PRIMARY_CHALLENGE_OPTIONS} value={form.primaryChallenge} onChange={(v) => setForm({ ...form, primaryChallenge: v })} /></Field>
                  <Field label="課題の詳細"><textarea value={form.challengeDetail} onChange={(e) => setForm({ ...form, challengeDetail: e.target.value })} placeholder="具体的な課題" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></Field>
                  <Field label="興味のあるサービス"><MultiSelect options={INTERESTED_SERVICE_OPTIONS} value={form.interestedServices} onChange={(v) => setForm({ ...form, interestedServices: v })} /></Field>
                  <Field label="希望開始時期"><Sel options={DESIRED_TIMELINE_OPTIONS} value={form.desiredTimeline} onChange={(v) => setForm({ ...form, desiredTimeline: v })} /></Field>
                </Section>

                {/* E. 動画制作 */}
                <Section icon={<Video className="w-3.5 h-3.5 text-amber-700" />} title="動画制作">
                  <Field label="動画の用途"><MultiSelect options={VIDEO_PURPOSE_OPTIONS} value={form.videoPurposes} onChange={(v) => setForm({ ...form, videoPurposes: v })} /></Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="希望する長さ"><Sel options={VIDEO_DURATION_OPTIONS} value={form.videoDuration} onChange={(v) => setForm({ ...form, videoDuration: v })} /></Field>
                    <Field label="撮影の有無"><Sel options={VIDEO_SHOOTING_OPTIONS} value={form.videoShootingType} onChange={(v) => setForm({ ...form, videoShootingType: v })} /></Field>
                    <Field label="出演者"><Sel options={VIDEO_CAST_OPTIONS} value={form.videoCast} onChange={(v) => setForm({ ...form, videoCast: v })} /></Field>
                  </div>
                  <Field label="公開先"><MultiSelect options={VIDEO_PUBLISH_OPTIONS} value={form.videoPublishTo} onChange={(v) => setForm({ ...form, videoPublishTo: v })} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="予算感（動画制作）"><Sel options={VIDEO_BUDGET_OPTIONS} value={form.videoBudget} onChange={(v) => setForm({ ...form, videoBudget: v })} /></Field>
                    <Field label="納品希望日"><input type="date" value={form.videoDeadline} onChange={(e) => setForm({ ...form, videoDeadline: e.target.value })} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></Field>
                  </div>
                  <Field label="参考にしたい動画・イメージ"><textarea value={form.videoReference} onChange={(e) => setForm({ ...form, videoReference: e.target.value })} placeholder="URL やイメージの説明" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></Field>
                </Section>

                {/* D+F */}
                <div className="space-y-4">
                  <Section icon={<UserCheck className="w-3.5 h-3.5 text-amber-700" />} title="意思決定">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="決裁者"><input type="text" value={form.decisionMaker} onChange={(e) => setForm({ ...form, decisionMaker: e.target.value })} placeholder="役職・名前" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></Field>
                      <Field label="決裁プロセス"><Sel options={DECISION_PROCESS_OPTIONS} value={form.decisionProcess} onChange={(v) => setForm({ ...form, decisionProcess: v })} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="予算確保状況"><Sel options={BUDGET_STATUS_OPTIONS} value={form.budgetStatus} onChange={(v) => setForm({ ...form, budgetStatus: v })} /></Field>
                      <Field label="検討中の他社"><input type="text" value={form.competingVendors} onChange={(e) => setForm({ ...form, competingVendors: e.target.value })} placeholder="他社名" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></Field>
                    </div>
                  </Section>
                  <Section icon={<Thermometer className="w-3.5 h-3.5 text-amber-700" />} title="温度感">
                    <Field label="温度感">
                      <div className="flex gap-1.5">
                        {TEMPERATURE_OPTIONS.map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setForm({ ...form, temperature: form.temperature === opt.value ? null : opt.value })} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${form.temperature === opt.value ? opt.color + " ring-1 ring-offset-1" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"}`}>{opt.label}</button>
                        ))}
                      </div>
                    </Field>
                    <Field label="次回アクション"><input type="text" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="次にすること" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></Field>
                    <Field label="次回予定日"><input type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></Field>
                  </Section>
                </div>

              </div>

              <div className="flex justify-end mt-4">
                <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saved ? "保存しました！" : "ヒアリングシートを保存"}
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
    <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
      <div className="flex items-center gap-1.5 mb-2">{icon}<span className="text-[11px] font-semibold text-amber-800">{title}</span></div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</label>{children}</div>;
}

function MultiSelect({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => value.includes(v) ? onChange(value.filter((x) => x !== v)) : onChange([...value, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => toggle(opt.value)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${value.includes(opt.value) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"}`}>{opt.label}</button>
      ))}
    </div>
  );
}

function Sel({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400">
      <option value="">選択</option>
      {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  );
}
