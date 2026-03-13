"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createDeal } from "@/lib/actions/deal";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import {
  AlertTriangle, Building2, BarChart3, Target, UserCheck, Thermometer, Video,
  ChevronDown, ChevronUp,
} from "lucide-react";
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
  customers: { id: string; name: string }[];
  users: { id: string; name: string | null; email: string }[];
  preselectedCustomerId?: string;
}

export function DealForm({ customers, users, preselectedCustomerId }: Props) {
  const [state, action, pending] = useActionState(createDeal, null);
  const [hearingOpen, setHearingOpen] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("PROSPECTING");

  // ヒアリング用のマルチセレクト state（hidden input で送信）
  const [targetCustomers, setTargetCustomers] = useState<string[]>([]);
  const [currentChannels, setCurrentChannels] = useState<string[]>([]);
  const [interestedServices, setInterestedServices] = useState<string[]>([]);
  const [videoPurposes, setVideoPurposes] = useState<string[]>([]);
  const [videoPublishTo, setVideoPublishTo] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<string | null>(null);

  // 顧客選択時に既存商談をチェック
  const [existingDeals, setExistingDeals] = useState<{ id: string; title: string; status: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId ?? "");

  const checkDuplicate = useCallback(async (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) { setExistingDeals([]); return; }
    try {
      const res = await fetch(`/api/deals/check-duplicate?customerId=${customerId}`);
      const data = await res.json();
      setExistingDeals(data.deals ?? []);
    } catch { setExistingDeals([]); }
  }, []);

  useEffect(() => {
    if (preselectedCustomerId) checkDuplicate(preselectedCustomerId);
  }, [preselectedCustomerId, checkDuplicate]);

  return (
    <form action={action} className="space-y-6">
      {state?.error && !state.duplicate && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {state.error}
        </div>
      )}
      {state?.duplicate && (
        <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg space-y-2">
          <p>{state.error}</p>
          <input type="hidden" name="confirmDuplicate" value="true" />
          <button type="submit" disabled={pending} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {pending ? "作成中..." : "重複を承知の上で作成する"}
          </button>
        </div>
      )}

      {/* ========== ステータス選択（一番上） ========== */}
      <div>
        <label className="block text-xs font-semibold text-zinc-800 mb-2">
          どのフェーズの商談ですか？ <span className="text-red-500">*</span>
        </label>
        <input type="hidden" name="status" value={selectedStatus} />
        <div className="flex flex-wrap gap-2">
          {DEAL_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedStatus(opt.value)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                selectedStatus === opt.value
                  ? opt.color + " ring-2 ring-offset-1 ring-blue-400 scale-105"
                  : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========== 商談基本情報 ========== */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-800 border-b border-zinc-200 pb-2">商談情報</h3>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            顧客 <span className="text-red-500">*</span>
          </label>
          <select
            name="customerId"
            required
            defaultValue={preselectedCustomerId ?? ""}
            onChange={(e) => checkDuplicate(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">-- 選択してください --</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          {existingDeals.length > 0 && (
            <div className="mt-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-medium mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                この顧客には既に商談があります
              </div>
              <ul className="space-y-1">
                {existingDeals.map((d) => {
                  const label = DEAL_STATUS_OPTIONS.find((o) => o.value === d.status)?.label ?? d.status;
                  return (
                    <li key={d.id} className="flex items-center gap-2">
                      <span className="text-amber-600">{d.title}（{label}）</span>
                      <Link href={`/dashboard/deals/${d.id}`} className="text-blue-600 underline hover:text-blue-800">
                        この商談を開く
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-amber-500">フェーズの変更は既存の商談をドラッグ移動してください。</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            商談タイトル <span className="text-red-500">*</span>
          </label>
          <input name="title" type="text" placeholder="例: ○○社 Web広告運用支援" required className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">見積金額（円）</label>
            <input name="amount" type="number" min="0" placeholder="例: 500000" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">受注確度（%）</label>
            <input name="probability" type="number" min="0" max="100" placeholder="例: 70" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">受注予定日</label>
            <input name="expectedCloseDate" type="date" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">担当者</label>
            <select name="assignedToId" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">-- 未割り当て --</option>
              {users.map((u) => (<option key={u.id} value={u.id}>{u.name ?? u.email}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">メモ</label>
          <textarea name="notes" rows={2} placeholder="商談の経緯・次のアクションなど" className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      {/* ========== ヒアリングシート ========== */}
      <div className="border border-amber-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setHearingOpen(!hearingOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <span className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            📋 ヒアリングシート
            <span className="text-[10px] font-normal text-amber-500">（任意・後から編集可）</span>
          </span>
          {hearingOpen ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
        </button>

        {hearingOpen && (
          <div className="bg-amber-50/50 px-4 py-4">
            {/* hidden inputs for array/special fields */}
            {targetCustomers.map((v) => <input key={v} type="hidden" name="h_targetCustomers" value={v} />)}
            {currentChannels.map((v) => <input key={v} type="hidden" name="h_currentChannels" value={v} />)}
            {interestedServices.map((v) => <input key={v} type="hidden" name="h_interestedServices" value={v} />)}
            {videoPurposes.map((v) => <input key={v} type="hidden" name="h_videoPurposes" value={v} />)}
            {videoPublishTo.map((v) => <input key={v} type="hidden" name="h_videoPublishTo" value={v} />)}
            {temperature && <input type="hidden" name="h_temperature" value={temperature} />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* A. 顧客理解 */}
              <Section icon={<Building2 className="w-3.5 h-3.5 text-amber-700" />} title="顧客理解">
                <Field label="事業内容">
                  <textarea name="h_businessDescription" placeholder="具体的な事業内容を記入" rows={2} className={txCls} />
                </Field>
                <Field label="ターゲット顧客層">
                  <MultiSelect options={TARGET_CUSTOMER_OPTIONS} value={targetCustomers} onChange={setTargetCustomers} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="商圏"><HSelect name="h_tradeArea" options={TRADE_AREA_OPTIONS} /></Field>
                  <Field label="年商規模"><HSelect name="h_annualRevenue" options={ANNUAL_REVENUE_OPTIONS} /></Field>
                  <Field label="従業員数"><HSelect name="h_employeeCount" options={EMPLOYEE_COUNT_OPTIONS} /></Field>
                </div>
              </Section>

              {/* B. 現状把握 */}
              <Section icon={<BarChart3 className="w-3.5 h-3.5 text-amber-700" />} title="現状把握">
                <Field label="現在の集客手段">
                  <MultiSelect options={CURRENT_CHANNEL_OPTIONS} value={currentChannels} onChange={setCurrentChannels} />
                </Field>
                <Field label="月間広告費"><HSelect name="h_monthlyAdBudget" options={MONTHLY_AD_BUDGET_OPTIONS} /></Field>
                <Field label="過去に試した施策"><textarea name="h_pastEfforts" placeholder="過去の広告・販促施策" rows={2} className={txCls} /></Field>
                <Field label="競合で気になる会社"><input type="text" name="h_competitors" placeholder="競合名" className={inCls} /></Field>
              </Section>

              {/* C. 課題・ニーズ */}
              <Section icon={<Target className="w-3.5 h-3.5 text-amber-700" />} title="課題・ニーズ">
                <Field label="最も解決したい課題"><HSelect name="h_primaryChallenge" options={PRIMARY_CHALLENGE_OPTIONS} /></Field>
                <Field label="課題の詳細"><textarea name="h_challengeDetail" placeholder="具体的な課題や背景" rows={2} className={txCls} /></Field>
                <Field label="興味のあるサービス">
                  <MultiSelect options={INTERESTED_SERVICE_OPTIONS} value={interestedServices} onChange={setInterestedServices} />
                </Field>
                <Field label="希望開始時期"><HSelect name="h_desiredTimeline" options={DESIRED_TIMELINE_OPTIONS} /></Field>
              </Section>

              {/* E. 動画制作 */}
              <Section icon={<Video className="w-3.5 h-3.5 text-amber-700" />} title="動画制作">
                <Field label="動画の用途">
                  <MultiSelect options={VIDEO_PURPOSE_OPTIONS} value={videoPurposes} onChange={setVideoPurposes} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="希望する長さ"><HSelect name="h_videoDuration" options={VIDEO_DURATION_OPTIONS} /></Field>
                  <Field label="撮影の有無"><HSelect name="h_videoShootingType" options={VIDEO_SHOOTING_OPTIONS} /></Field>
                  <Field label="出演者"><HSelect name="h_videoCast" options={VIDEO_CAST_OPTIONS} /></Field>
                </div>
                <Field label="公開先">
                  <MultiSelect options={VIDEO_PUBLISH_OPTIONS} value={videoPublishTo} onChange={setVideoPublishTo} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="予算感（動画制作）"><HSelect name="h_videoBudget" options={VIDEO_BUDGET_OPTIONS} /></Field>
                  <Field label="納品希望日"><input type="date" name="h_videoDeadline" className={inCls} /></Field>
                </div>
                <Field label="参考にしたい動画・イメージ"><textarea name="h_videoReference" placeholder="URL やイメージの説明" rows={2} className={txCls} /></Field>
              </Section>

              {/* D. 意思決定 + F. 温度感 */}
              <div className="space-y-4 lg:col-span-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Section icon={<UserCheck className="w-3.5 h-3.5 text-amber-700" />} title="意思決定">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="決裁者"><input type="text" name="h_decisionMaker" placeholder="役職・名前" className={inCls} /></Field>
                      <Field label="決裁プロセス"><HSelect name="h_decisionProcess" options={DECISION_PROCESS_OPTIONS} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="予算確保状況"><HSelect name="h_budgetStatus" options={BUDGET_STATUS_OPTIONS} /></Field>
                      <Field label="検討中の他社"><input type="text" name="h_competingVendors" placeholder="他社名" className={inCls} /></Field>
                    </div>
                  </Section>

                  <Section icon={<Thermometer className="w-3.5 h-3.5 text-amber-700" />} title="温度感">
                    <Field label="温度感">
                      <div className="flex gap-1.5">
                        {TEMPERATURE_OPTIONS.map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setTemperature(temperature === opt.value ? null : opt.value)} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${temperature === opt.value ? opt.color + " ring-1 ring-offset-1" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"}`}>{opt.label}</button>
                        ))}
                      </div>
                    </Field>
                    <Field label="次回アクション"><input type="text" name="h_nextAction" placeholder="次にすること" className={inCls} /></Field>
                    <Field label="次回予定日"><input type="date" name="h_nextActionDate" className={inCls} /></Field>
                  </Section>
                </div>

                {/* G. ヒアリング管理 */}
                <div className="lg:col-span-2">
                  <Section icon={<Building2 className="w-3.5 h-3.5 text-amber-700" />} title="ヒアリング管理">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                      <Field label="ヒアリング回数">
                        <select name="h_hearingRound" className={inCls + " bg-white"}>
                          <option value="">選択</option>
                          {[1, 2, 3, 4, 5].map((n) => (<option key={n} value={n}>{n}回目</option>))}
                        </select>
                      </Field>
                      <div className="lg:col-span-3">
                        <Field label="自由記載欄">
                          <textarea name="h_freeNotes" placeholder="ヒアリングで気づいたこと、補足情報など自由に記入" rows={3} className={txCls} />
                        </Field>
                      </div>
                    </div>
                  </Section>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? "保存中..." : "商談を作成"}
        </button>
      </div>
    </form>
  );
}

// --- 共通スタイル ---
const inCls = "text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400";
const txCls = inCls + " resize-none";

// --- サブコンポーネント ---
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-lg bg-white/70 border border-amber-100 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[11px] font-semibold text-amber-800">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function HSelect({ name, options }: { name: string; options: readonly { value: string; label: string }[] }) {
  return (
    <select name={name} className="text-xs border border-zinc-200 rounded-md px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
      <option value="">選択してください</option>
      {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  );
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
