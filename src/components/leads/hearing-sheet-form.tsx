"use client";

import { useState, useTransition } from "react";
import { ChevronUp, Loader2, Save, Building2, BarChart3, Target, UserCheck, Thermometer, Video } from "lucide-react";
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
import { saveHearingSheet } from "@/lib/actions/hearing";

interface HearingData {
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
  videoDeadline: Date | string | null;
  videoPublishTo: string[];
  videoBudget: string | null;
  temperature: string | null;
  nextAction: string | null;
  nextActionDate: Date | string | null;
}

interface Props {
  leadId: string;
  leadName: string;
  initial: HearingData | null;
  onClose: () => void;
}

const sectionIcons = {
  who: Building2,
  now: BarChart3,
  want: Target,
  decision: UserCheck,
  video: Video,
  temperature: Thermometer,
};

function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            value.includes(opt.value)
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  options,
  value,
  onChange,
  placeholder = "選択してください",
}: {
  options: readonly { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-zinc-500 mb-1">
      {children}
    </label>
  );
}

export function HearingSheetForm({ leadId, leadName, initial, onClose }: Props) {
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
      ? (typeof initial.videoDeadline === "string"
          ? initial.videoDeadline.slice(0, 10)
          : new Date(initial.videoDeadline).toISOString().slice(0, 10))
      : "",
    videoPublishTo: initial?.videoPublishTo ?? [],
    videoBudget: initial?.videoBudget ?? null,
    temperature: initial?.temperature ?? null,
    nextAction: initial?.nextAction ?? "",
    nextActionDate: initial?.nextActionDate
      ? (typeof initial.nextActionDate === "string"
          ? initial.nextActionDate.slice(0, 10)
          : new Date(initial.nextActionDate).toISOString().slice(0, 10))
      : "",
  });

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      const result = await saveHearingSheet(leadId, {
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
      });
      if (result.error) {
        alert(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const WhoIcon = sectionIcons.who;
  const NowIcon = sectionIcons.now;
  const WantIcon = sectionIcons.want;
  const DecisionIcon = sectionIcons.decision;
  const TempIcon = sectionIcons.temperature;

  return (
    <div className="bg-amber-50 border-t border-b border-amber-200 px-5 py-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📋</span>
          <span className="text-xs font-semibold text-amber-800">
            ヒアリングシート — {leadName}
          </span>
          {initial && (
            <span className="text-[10px] text-amber-500 ml-1">（記録済み）</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saved ? "保存しました" : "保存"}
          </button>
          <button
            onClick={onClose}
            className="text-amber-400 hover:text-amber-600"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* A. 顧客理解 */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <WhoIcon className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">顧客理解</span>
          </div>
          <div>
            <Label>事業内容</Label>
            <TextArea
              value={form.businessDescription}
              onChange={(v) => setForm({ ...form, businessDescription: v })}
              placeholder="具体的な事業内容を記入"
            />
          </div>
          <div>
            <Label>ターゲット顧客層</Label>
            <MultiSelect
              options={TARGET_CUSTOMER_OPTIONS}
              value={form.targetCustomers}
              onChange={(v) => setForm({ ...form, targetCustomers: v })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>商圏</Label>
              <Select
                options={TRADE_AREA_OPTIONS}
                value={form.tradeArea}
                onChange={(v) => setForm({ ...form, tradeArea: v })}
              />
            </div>
            <div>
              <Label>年商規模</Label>
              <Select
                options={ANNUAL_REVENUE_OPTIONS}
                value={form.annualRevenue}
                onChange={(v) => setForm({ ...form, annualRevenue: v })}
              />
            </div>
            <div>
              <Label>従業員数</Label>
              <Select
                options={EMPLOYEE_COUNT_OPTIONS}
                value={form.employeeCount}
                onChange={(v) => setForm({ ...form, employeeCount: v })}
              />
            </div>
          </div>
        </div>

        {/* B. 現状把握 */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <NowIcon className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">現状把握</span>
          </div>
          <div>
            <Label>現在の集客手段</Label>
            <MultiSelect
              options={CURRENT_CHANNEL_OPTIONS}
              value={form.currentChannels}
              onChange={(v) => setForm({ ...form, currentChannels: v })}
            />
          </div>
          <div>
            <Label>月間広告費</Label>
            <Select
              options={MONTHLY_AD_BUDGET_OPTIONS}
              value={form.monthlyAdBudget}
              onChange={(v) => setForm({ ...form, monthlyAdBudget: v })}
            />
          </div>
          <div>
            <Label>過去に試した施策</Label>
            <TextArea
              value={form.pastEfforts}
              onChange={(v) => setForm({ ...form, pastEfforts: v })}
              placeholder="過去の広告・販促施策"
            />
          </div>
          <div>
            <Label>競合で気になる会社</Label>
            <TextInput
              value={form.competitors}
              onChange={(v) => setForm({ ...form, competitors: v })}
              placeholder="競合名"
            />
          </div>
        </div>

        {/* C. 課題・ニーズ */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <WantIcon className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">課題・ニーズ</span>
          </div>
          <div>
            <Label>最も解決したい課題</Label>
            <Select
              options={PRIMARY_CHALLENGE_OPTIONS}
              value={form.primaryChallenge}
              onChange={(v) => setForm({ ...form, primaryChallenge: v })}
            />
          </div>
          <div>
            <Label>課題の詳細</Label>
            <TextArea
              value={form.challengeDetail}
              onChange={(v) => setForm({ ...form, challengeDetail: v })}
              placeholder="具体的な課題や背景"
            />
          </div>
          <div>
            <Label>興味のあるサービス</Label>
            <MultiSelect
              options={INTERESTED_SERVICE_OPTIONS}
              value={form.interestedServices}
              onChange={(v) => setForm({ ...form, interestedServices: v })}
            />
          </div>
          <div>
            <Label>希望開始時期</Label>
            <Select
              options={DESIRED_TIMELINE_OPTIONS}
              value={form.desiredTimeline}
              onChange={(v) => setForm({ ...form, desiredTimeline: v })}
            />
          </div>
        </div>

        {/* E. 動画制作 */}
        <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Video className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] font-semibold text-amber-800">動画制作</span>
          </div>
          <div>
            <Label>動画の用途</Label>
            <MultiSelect
              options={VIDEO_PURPOSE_OPTIONS}
              value={form.videoPurposes}
              onChange={(v) => setForm({ ...form, videoPurposes: v })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>希望する長さ</Label>
              <Select
                options={VIDEO_DURATION_OPTIONS}
                value={form.videoDuration}
                onChange={(v) => setForm({ ...form, videoDuration: v })}
              />
            </div>
            <div>
              <Label>撮影の有無</Label>
              <Select
                options={VIDEO_SHOOTING_OPTIONS}
                value={form.videoShootingType}
                onChange={(v) => setForm({ ...form, videoShootingType: v })}
              />
            </div>
            <div>
              <Label>出演者</Label>
              <Select
                options={VIDEO_CAST_OPTIONS}
                value={form.videoCast}
                onChange={(v) => setForm({ ...form, videoCast: v })}
              />
            </div>
          </div>
          <div>
            <Label>公開先</Label>
            <MultiSelect
              options={VIDEO_PUBLISH_OPTIONS}
              value={form.videoPublishTo}
              onChange={(v) => setForm({ ...form, videoPublishTo: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>予算感（動画制作）</Label>
              <Select
                options={VIDEO_BUDGET_OPTIONS}
                value={form.videoBudget}
                onChange={(v) => setForm({ ...form, videoBudget: v })}
              />
            </div>
            <div>
              <Label>納品希望日</Label>
              <input
                type="date"
                value={form.videoDeadline}
                onChange={(e) => setForm({ ...form, videoDeadline: e.target.value })}
                className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <Label>参考にしたい動画・イメージ</Label>
            <TextArea
              value={form.videoReference}
              onChange={(v) => setForm({ ...form, videoReference: v })}
              placeholder="URL やイメージの説明"
            />
          </div>
        </div>

        {/* D. 意思決定 + F. 温度感 */}
        <div className="space-y-4">
          <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <DecisionIcon className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[11px] font-semibold text-amber-800">意思決定</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>決裁者</Label>
                <TextInput
                  value={form.decisionMaker}
                  onChange={(v) => setForm({ ...form, decisionMaker: v })}
                  placeholder="役職・名前"
                />
              </div>
              <div>
                <Label>決裁プロセス</Label>
                <Select
                  options={DECISION_PROCESS_OPTIONS}
                  value={form.decisionProcess}
                  onChange={(v) => setForm({ ...form, decisionProcess: v })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>予算確保状況</Label>
                <Select
                  options={BUDGET_STATUS_OPTIONS}
                  value={form.budgetStatus}
                  onChange={(v) => setForm({ ...form, budgetStatus: v })}
                />
              </div>
              <div>
                <Label>検討中の他社</Label>
                <TextInput
                  value={form.competingVendors}
                  onChange={(v) => setForm({ ...form, competingVendors: v })}
                  placeholder="他社名"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <TempIcon className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[11px] font-semibold text-amber-800">温度感</span>
            </div>
            <div>
              <Label>温度感</Label>
              <div className="flex gap-1.5">
                {TEMPERATURE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, temperature: form.temperature === opt.value ? null : opt.value })}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                      form.temperature === opt.value ? opt.color + " ring-1 ring-offset-1" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>次回アクション</Label>
              <TextInput
                value={form.nextAction}
                onChange={(v) => setForm({ ...form, nextAction: v })}
                placeholder="次にすること"
              />
            </div>
            <div>
              <Label>次回予定日</Label>
              <input
                type="date"
                value={form.nextActionDate}
                onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })}
                className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* フッター保存ボタン */}
      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saved ? "保存しました！" : "ヒアリングシートを保存"}
        </button>
      </div>
    </div>
  );
}
