"use client";

import { useState } from "react";
import { ClipboardList, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { HearingSheetForm } from "@/components/leads/hearing-sheet-form";
import type { saveCustomerHearingSheet } from "@/lib/actions/hearing";

interface HearingData {
  id: string;
  businessDescription: string | null;
  targetCustomers: string[];
  tradeArea: string | null;
  annualRevenue: string | null;
  employeeCount: string | null;
  currentChannels: string[];
  monthlyAdBudget: string | null;
  pastEfforts: string | null;
  competitors: string | null;
  primaryChallenge: string | null;
  challengeDetail: string | null;
  interestedServices: string[];
  desiredTimeline: string | null;
  decisionMaker: string | null;
  decisionProcess: string | null;
  budgetStatus: string | null;
  competingVendors: string | null;
  videoPurposes: string[];
  videoDuration: string | null;
  videoShootingType: string | null;
  videoCast: string | null;
  videoReference: string | null;
  videoDeadline: Date | null;
  videoPublishTo: string[];
  videoBudget: string | null;
  temperature: string | null;
  nextAction: string | null;
  nextActionDate: Date | null;
  updatedAt: Date;
}

interface Props {
  customerId: string;
  customerName: string;
  hearingSheets: HearingData[];
}

export function CustomerHearingSection({
  customerId,
  customerName,
  hearingSheets,
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(
    hearingSheets.length > 0 ? 0 : null
  );
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="space-y-2">
      {/* 既存シート */}
      {hearingSheets.map((sheet, idx) => (
        <div key={sheet.id}>
          <button
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                ヒアリング #{idx + 1}
              </span>
              <span className="text-[10px] text-amber-500">
                {sheet.updatedAt.toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {sheet.temperature && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border bg-white text-amber-700 border-amber-200">
                  {sheet.temperature === "hot" && "即決見込み"}
                  {sheet.temperature === "warm" && "前向き"}
                  {sheet.temperature === "cool" && "情報収集中"}
                  {sheet.temperature === "cold" && "冷たい"}
                </span>
              )}
            </div>
            {openIndex === idx ? (
              <ChevronUp className="w-4 h-4 text-amber-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-400" />
            )}
          </button>
          {openIndex === idx && (
            <div className="mt-1 rounded-lg overflow-hidden border border-amber-200">
              <CustomerHearingForm
                customerId={customerId}
                customerName={customerName}
                initial={sheet}
                sheetId={sheet.id}
                onClose={() => setOpenIndex(null)}
              />
            </div>
          )}
        </div>
      ))}

      {/* 新規追加ボタン */}
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-dashed border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新しいヒアリングを追加
        </button>
      ) : (
        <div className="rounded-lg overflow-hidden border border-amber-200">
          <CustomerHearingForm
            customerId={customerId}
            customerName={customerName}
            initial={null}
            onClose={() => setShowNewForm(false)}
          />
        </div>
      )}
    </div>
  );
}

// 顧客用のラッパー（saveCustomerHearingSheetを使う）
function CustomerHearingForm({
  customerId,
  customerName,
  initial,
  sheetId,
  onClose,
}: {
  customerId: string;
  customerName: string;
  initial: HearingData | null;
  sheetId?: string;
  onClose: () => void;
}) {
  // HearingSheetFormはleadId用なので、顧客用に独自のsave関数を渡す
  // → HearingSheetFormをリファクタして汎用化する必要がある
  // 一旦、saveCustomerHearingSheetを直接呼ぶラッパーを使う
  return (
    <CustomerHearingFormInner
      customerId={customerId}
      customerName={customerName}
      initial={initial}
      sheetId={sheetId}
      onClose={onClose}
    />
  );
}

import { useTransition } from "react";
import { saveCustomerHearingSheet as saveAction } from "@/lib/actions/hearing";
import { Save, Loader2, Building2, BarChart3, Target, UserCheck, Thermometer, Video } from "lucide-react";
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

function CustomerHearingFormInner({
  customerId,
  customerName,
  initial,
  sheetId,
  onClose,
}: {
  customerId: string;
  customerName: string;
  initial: HearingData | null;
  sheetId?: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    businessDescription: initial?.businessDescription ?? "",
    targetCustomers: initial?.targetCustomers ?? [],
    tradeArea: initial?.tradeArea ?? null,
    annualRevenue: initial?.annualRevenue ?? null,
    employeeCount: initial?.employeeCount ?? null,
    currentChannels: initial?.currentChannels ?? [],
    monthlyAdBudget: initial?.monthlyAdBudget ?? null,
    pastEfforts: initial?.pastEfforts ?? "",
    competitors: initial?.competitors ?? "",
    primaryChallenge: initial?.primaryChallenge ?? null,
    challengeDetail: initial?.challengeDetail ?? "",
    interestedServices: initial?.interestedServices ?? [],
    desiredTimeline: initial?.desiredTimeline ?? null,
    decisionMaker: initial?.decisionMaker ?? "",
    decisionProcess: initial?.decisionProcess ?? null,
    budgetStatus: initial?.budgetStatus ?? null,
    competingVendors: initial?.competingVendors ?? "",
    videoPurposes: initial?.videoPurposes ?? [],
    videoDuration: initial?.videoDuration ?? null,
    videoShootingType: initial?.videoShootingType ?? null,
    videoCast: initial?.videoCast ?? null,
    videoReference: initial?.videoReference ?? "",
    videoDeadline: initial?.videoDeadline
      ? new Date(initial.videoDeadline).toISOString().slice(0, 10)
      : "",
    videoPublishTo: initial?.videoPublishTo ?? [],
    videoBudget: initial?.videoBudget ?? null,
    temperature: initial?.temperature ?? null,
    nextAction: initial?.nextAction ?? "",
    nextActionDate: initial?.nextActionDate
      ? new Date(initial.nextActionDate).toISOString().slice(0, 10)
      : "",
  });

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      const result = await saveAction(
        customerId,
        {
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
        },
        sheetId
      );
      if (result.error) alert(result.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="bg-amber-50 px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-amber-800">
          📋 ヒアリング — {customerName}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saved ? "保存しました" : "保存"}
          </button>
          <button onClick={onClose} className="text-amber-400 hover:text-amber-600">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* A. 顧客理解 */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">顧客理解</span>
          </div>
          <div>
            <Label>事業内容</Label>
            <textarea value={form.businessDescription} onChange={(e) => setForm({ ...form, businessDescription: e.target.value })} placeholder="具体的な事業内容を記入" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
          </div>
          <div>
            <Label>ターゲット顧客層</Label>
            <MultiSelect options={TARGET_CUSTOMER_OPTIONS} value={form.targetCustomers} onChange={(v) => setForm({ ...form, targetCustomers: v })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>商圏</Label><Select options={TRADE_AREA_OPTIONS} value={form.tradeArea} onChange={(v) => setForm({ ...form, tradeArea: v })} /></div>
            <div><Label>年商規模</Label><Select options={ANNUAL_REVENUE_OPTIONS} value={form.annualRevenue} onChange={(v) => setForm({ ...form, annualRevenue: v })} /></div>
            <div><Label>従業員数</Label><Select options={EMPLOYEE_COUNT_OPTIONS} value={form.employeeCount} onChange={(v) => setForm({ ...form, employeeCount: v })} /></div>
          </div>
        </div>

        {/* B. 現状把握 */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">現状把握</span>
          </div>
          <div>
            <Label>現在の集客手段</Label>
            <MultiSelect options={CURRENT_CHANNEL_OPTIONS} value={form.currentChannels} onChange={(v) => setForm({ ...form, currentChannels: v })} />
          </div>
          <div><Label>月間広告費</Label><Select options={MONTHLY_AD_BUDGET_OPTIONS} value={form.monthlyAdBudget} onChange={(v) => setForm({ ...form, monthlyAdBudget: v })} /></div>
          <div><Label>過去に試した施策</Label><textarea value={form.pastEfforts} onChange={(e) => setForm({ ...form, pastEfforts: e.target.value })} placeholder="過去の広告・販促施策" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></div>
          <div><Label>競合で気になる会社</Label><input type="text" value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} placeholder="競合名" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
        </div>

        {/* C. 課題・ニーズ */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">課題・ニーズ</span>
          </div>
          <div><Label>最も解決したい課題</Label><Select options={PRIMARY_CHALLENGE_OPTIONS} value={form.primaryChallenge} onChange={(v) => setForm({ ...form, primaryChallenge: v })} /></div>
          <div><Label>課題の詳細</Label><textarea value={form.challengeDetail} onChange={(e) => setForm({ ...form, challengeDetail: e.target.value })} placeholder="具体的な課題や背景" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></div>
          <div><Label>興味のあるサービス</Label><MultiSelect options={INTERESTED_SERVICE_OPTIONS} value={form.interestedServices} onChange={(v) => setForm({ ...form, interestedServices: v })} /></div>
          <div><Label>希望開始時期</Label><Select options={DESIRED_TIMELINE_OPTIONS} value={form.desiredTimeline} onChange={(v) => setForm({ ...form, desiredTimeline: v })} /></div>
        </div>

        {/* E. 動画制作 */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Video className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">動画制作</span>
          </div>
          <div><Label>動画の用途</Label><MultiSelect options={VIDEO_PURPOSE_OPTIONS} value={form.videoPurposes} onChange={(v) => setForm({ ...form, videoPurposes: v })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>希望する長さ</Label><Select options={VIDEO_DURATION_OPTIONS} value={form.videoDuration} onChange={(v) => setForm({ ...form, videoDuration: v })} /></div>
            <div><Label>撮影の有無</Label><Select options={VIDEO_SHOOTING_OPTIONS} value={form.videoShootingType} onChange={(v) => setForm({ ...form, videoShootingType: v })} /></div>
            <div><Label>出演者</Label><Select options={VIDEO_CAST_OPTIONS} value={form.videoCast} onChange={(v) => setForm({ ...form, videoCast: v })} /></div>
          </div>
          <div><Label>公開先</Label><MultiSelect options={VIDEO_PUBLISH_OPTIONS} value={form.videoPublishTo} onChange={(v) => setForm({ ...form, videoPublishTo: v })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>予算感（動画制作）</Label><Select options={VIDEO_BUDGET_OPTIONS} value={form.videoBudget} onChange={(v) => setForm({ ...form, videoBudget: v })} /></div>
            <div><Label>納品希望日</Label><input type="date" value={form.videoDeadline} onChange={(e) => setForm({ ...form, videoDeadline: e.target.value })} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
          </div>
          <div><Label>参考にしたい動画・イメージ</Label><textarea value={form.videoReference} onChange={(e) => setForm({ ...form, videoReference: e.target.value })} placeholder="URL やイメージの説明" rows={2} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" /></div>
        </div>

        {/* D. 意思決定 + F. 温度感 */}
        <div className="space-y-4">
          <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <UserCheck className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[11px] font-semibold text-amber-800">意思決定</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>決裁者</Label><input type="text" value={form.decisionMaker} onChange={(e) => setForm({ ...form, decisionMaker: e.target.value })} placeholder="役職・名前" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
              <div><Label>決裁プロセス</Label><Select options={DECISION_PROCESS_OPTIONS} value={form.decisionProcess} onChange={(v) => setForm({ ...form, decisionProcess: v })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>予算確保状況</Label><Select options={BUDGET_STATUS_OPTIONS} value={form.budgetStatus} onChange={(v) => setForm({ ...form, budgetStatus: v })} /></div>
              <div><Label>検討中の他社</Label><input type="text" value={form.competingVendors} onChange={(e) => setForm({ ...form, competingVendors: e.target.value })} placeholder="他社名" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
            </div>
          </div>

          <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Thermometer className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[11px] font-semibold text-amber-800">温度感</span>
            </div>
            <div>
              <Label>温度感</Label>
              <div className="flex gap-1.5">
                {TEMPERATURE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setForm({ ...form, temperature: form.temperature === opt.value ? null : opt.value })} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${form.temperature === opt.value ? opt.color + " ring-1 ring-offset-1" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"}`}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div><Label>次回アクション</Label><input type="text" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="次にすること" className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
            <div><Label>次回予定日</Label><input type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "保存しました！" : "ヒアリングシートを保存"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-zinc-500 mb-1">{children}</label>;
}

function MultiSelect({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => toggle(opt.value)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${value.includes(opt.value) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"}`}>{opt.label}</button>
      ))}
    </div>
  );
}

function Select({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400">
      <option value="">選択してください</option>
      {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  );
}
