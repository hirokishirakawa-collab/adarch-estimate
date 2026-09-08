// ==============================================================
// MCP: OS書き込みツール（scope = os:write）
//   各代表のAIが営業の記録をOSへ書く（＝各拠点のデータの吸い上げ）。
//   会話の要約を活動履歴（ActivityLog / DealLog）に貯め、顧客・商談・リードの作成と
//   商談の更新（状態・確度・予定日・メモ追記・受注の決め手）、リードの結果記録まで。
//   決まり:
//     - 金額は書かない（読み取り側で「他拠点の金額は非表示」にしている考え方と揃える）
//     - 受注(CLOSED_WON)への変更はOS画面で行う（プロジェクト自動作成・通知の副作用が大きい）
//     - AIが書いた記録は本文の先頭に AI_PREFIX を付け、記録者名は接続した本人にする
//     - 履歴の読み取り（list_activities）は全社分。書き込みは自拠点の顧客・商談だけ（getBranchFilter）
// ==============================================================

import type { ActivityType, CustomerRank, CustomerStatus, DealStatus, LeadStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { OUTREACH_RESULT_OPTIONS, getOutreachResultOption } from "@/lib/constants/outreach-result";
import { applyOutreachResult } from "@/lib/leads/apply-outreach-result";
import type { McpViewer } from "./os-read-tools";

/** 利用者に見せてよい失敗（入力の不備・範囲外など）。それ以外の例外は一般的な文言にする */
export class WriteError extends Error {}

export const AI_PREFIX = "[AI記録] ";

const ACTIVITY_TYPES: ActivityType[] = ["CALL", "EMAIL", "VISIT", "MEETING", "OTHER"];
const DEAL_STATUSES_WRITABLE: DealStatus[] = ["PROSPECTING", "QUALIFYING", "PROPOSAL", "NEGOTIATION", "CLOSED_LOST", "DORMANT", "DEFERRED"];
const CUSTOMER_STATUSES: CustomerStatus[] = ["PROSPECT", "ACTIVE", "INACTIVE"];
const CUSTOMER_RANKS: CustomerRank[] = ["A", "B", "C"];

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const clampLimit = (n: number | undefined, def = 30, max = 100) => Math.min(max, Math.max(1, Math.floor(n ?? def)));
const staffOf = (v: McpViewer) => v.name ?? v.email;
const trimOrNull = (s: string | undefined) => (s?.trim() ? s.trim() : null);

function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new WriteError(msg);
}
function maxLen(s: string | null, n: number, label: string) {
  need(!s || s.length <= n, `${label}は${n}文字以内にしてください`);
}

/** "YYYY-MM-DD" → その日の正午(JST)。日付が前後にずれないように */
function parseDay(s: string | undefined, label: string): Date | null {
  if (!s) return null;
  need(/^\d{4}-\d{2}-\d{2}$/.test(s), `${label}は YYYY-MM-DD の形にしてください`);
  const d = new Date(`${s}T12:00:00+09:00`);
  need(!Number.isNaN(d.getTime()), `${label}が日付として読めません`);
  return d;
}

function withPrefix(content: string): string {
  const c = content.trim();
  return c.startsWith(AI_PREFIX.trim()) ? c : AI_PREFIX + c;
}

/** 書き込み先の拠点。本部(ADMIN)で拠点が無い場合は本部拠点に入れる（OS画面の新規登録と同じ） */
function writeBranchId(v: McpViewer): string {
  if (v.branchId) return v.branchId;
  need(v.role === "ADMIN", "拠点が割り当てられていません。本部にお問い合わせください");
  return "branch_hq";
}

async function ownedCustomer(v: McpViewer, id: string) {
  const c = await db.customer.findFirst({ where: { id, ...getBranchFilter(v), NOT: { branchId: ARCHIVE_BRANCH_ID } }, select: { id: true, name: true, branchId: true } });
  need(c, "顧客が見つかりません（貴社の拠点の範囲外か、存在しないIDです）");
  return c;
}

/** 読み取り用（全社分）。書き込みは owned* を使う */
async function anyCustomer(id: string) {
  const c = await db.customer.findFirst({ where: { id, NOT: { branchId: ARCHIVE_BRANCH_ID } }, select: { id: true, name: true, branchId: true } });
  need(c, "顧客が見つかりません");
  return c;
}
async function anyDeal(id: string) {
  const d = await db.deal.findFirst({ where: { id }, select: { id: true, title: true, status: true, notes: true, customerId: true, customer: { select: { name: true } } } });
  need(d, "商談が見つかりません");
  return d;
}

async function ownedDeal(v: McpViewer, id: string) {
  const d = await db.deal.findFirst({ where: { id, ...getBranchFilter(v) }, select: { id: true, title: true, status: true, notes: true, customerId: true, customer: { select: { name: true } } } });
  need(d, "商談が見つかりません（貴社の拠点の範囲外か、存在しないIDです）");
  return d;
}

// ---- 活動の記録 ---------------------------------------------------------------

export interface LogActivityInput {
  customerId?: string;
  dealId?: string;
  type?: string;
  content: string;
  occurredAt?: string;
}

/** 顧客または商談に活動を1件記録する。dealId があれば商談ログ、なければ顧客の活動履歴 */
export async function logActivity(v: McpViewer, input: LogActivityInput) {
  const content = input.content?.trim();
  need(content, "記録する内容（content）を入れてください");
  maxLen(content, 4000, "内容");
  const type = (input.type ?? "OTHER").toUpperCase() as ActivityType;
  need(ACTIVITY_TYPES.includes(type), `type は ${ACTIVITY_TYPES.join(" / ")} のどれかにしてください`);
  const at = parseDay(input.occurredAt, "occurredAt");
  const staffName = staffOf(v);

  if (input.dealId) {
    const d = await ownedDeal(v, input.dealId);
    const row = await db.dealLog.create({ data: { dealId: d.id, type, content: withPrefix(content), staffName, ...(at ? { createdAt: at } : {}) }, select: { id: true, createdAt: true } });
    return { id: row.id, target: "deal" as const, dealId: d.id, dealTitle: d.title, customer: d.customer.name, type, at: day(row.createdAt) };
  }
  need(input.customerId, "customerId か dealId のどちらかを指定してください（search_customers / list_deals で探せます）");
  const c = await ownedCustomer(v, input.customerId);
  const row = await db.activityLog.create({ data: { customerId: c.id, type, content: withPrefix(content), staffName, ...(at ? { createdAt: at } : {}) }, select: { id: true, createdAt: true } });
  return { id: row.id, target: "customer" as const, customerId: c.id, customer: c.name, type, at: day(row.createdAt) };
}

// ---- 履歴の読み取り -----------------------------------------------------------

export interface ListActivitiesInput {
  customerId?: string;
  dealId?: string;
  limit?: number;
}

/** 顧客なら「顧客の活動履歴＋その顧客の全商談ログ」を時系列で、商談なら商談ログだけを返す */
export async function listActivities(_v: McpViewer, input: ListActivitiesInput) {
  const take = clampLimit(input.limit);
  const shape = (r: { type: ActivityType; content: string; staffName: string; createdAt: Date }, source: "customer" | "deal", dealTitle?: string) => ({
    source, dealTitle: dealTitle ?? null, type: r.type, content: stripSensitiveLines(r.content), staffName: r.staffName, at: day(r.createdAt),
  });

  if (input.dealId) {
    const d = await anyDeal(input.dealId);
    const logs = await db.dealLog.findMany({ where: { dealId: d.id }, orderBy: { createdAt: "desc" }, take, select: { type: true, content: true, staffName: true, createdAt: true } });
    return { deal: { id: d.id, title: d.title, customer: d.customer.name }, activities: logs.map((r) => shape(r, "deal", d.title)) };
  }
  need(input.customerId, "customerId か dealId のどちらかを指定してください");
  const c = await anyCustomer(input.customerId);
  const [acts, dealLogs] = await Promise.all([
    db.activityLog.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "desc" }, take, select: { type: true, content: true, staffName: true, createdAt: true } }),
    db.dealLog.findMany({ where: { deal: { customerId: c.id } }, orderBy: { createdAt: "desc" }, take, select: { type: true, content: true, staffName: true, createdAt: true, deal: { select: { title: true } } } }),
  ]);
  const merged = [...acts.map((r) => ({ ...shape(r, "customer"), _t: r.createdAt.getTime() })), ...dealLogs.map((r) => ({ ...shape(r, "deal", r.deal.title), _t: r.createdAt.getTime() }))]
    .sort((a, b) => b._t - a._t)
    .slice(0, take)
    .map((r) => { const { _t, ...rest } = r; void _t; return rest; });
  return { customer: { id: c.id, name: c.name }, activities: merged };
}

// ---- 顧客の作成 -----------------------------------------------------------------

export interface CreateCustomerInput {
  name: string;
  nameKana?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  prefecture?: string;
  address?: string;
  notes?: string;
  status?: string;
  rank?: string;
}

export async function createCustomer(v: McpViewer, input: CreateCustomerInput) {
  const name = input.name?.trim();
  need(name, "会社名（name）は必須です");
  maxLen(name, 64, "会社名");
  const nameKana = trimOrNull(input.nameKana);
  const contactName = trimOrNull(input.contactName);
  const phone = trimOrNull(input.phone);
  const address = trimOrNull(input.address);
  const notes = trimOrNull(input.notes);
  maxLen(nameKana, 64, "フリガナ");
  maxLen(contactName, 64, "担当者名");
  maxLen(phone, 20, "電話番号");
  maxLen(address, 256, "住所");
  maxLen(notes, 1000, "備考");
  const status = (input.status ?? "PROSPECT").toUpperCase() as CustomerStatus;
  need(CUSTOMER_STATUSES.includes(status), `status は ${CUSTOMER_STATUSES.join(" / ")} のどれかにしてください`);
  const rank = (input.rank ?? "B").toUpperCase() as CustomerRank;
  need(CUSTOMER_RANKS.includes(rank), `rank は ${CUSTOMER_RANKS.join(" / ")} のどれかにしてください`);
  const branchId = writeBranchId(v);

  const dup = await db.customer.findFirst({ where: { branchId, name, NOT: { branchId: ARCHIVE_BRANCH_ID } }, select: { id: true } });
  need(!dup, `同じ名前の顧客「${name}」が既にあります（id: ${dup?.id}）。そちらに記録してください`);

  const c = await db.customer.create({
    data: {
      name, nameKana, contactName, phone, email: trimOrNull(input.email), website: trimOrNull(input.website),
      industry: trimOrNull(input.industry), prefecture: trimOrNull(input.prefecture), address, notes: notes ? withPrefix(notes) : null,
      status, rank, branchId, staffName: staffOf(v), source: "AI連携",
    },
    select: { id: true, name: true, status: true, rank: true },
  });
  return { id: c.id, name: c.name, status: c.status, rank: c.rank, next: "商談を起こすなら create_deal(customerId)、やり取りを残すなら log_activity(customerId)" };
}

// ---- 商談の作成・更新 -------------------------------------------------------------

export interface CreateDealInput {
  customerId: string;
  title: string;
  status?: string;
  probability?: number;
  expectedCloseDate?: string;
  notes?: string;
  allowDuplicate?: boolean;
}

export async function createDeal(v: McpViewer, input: CreateDealInput) {
  const title = input.title?.trim();
  need(title, "商談タイトル（title）は必須です");
  maxLen(title, 100, "商談タイトル");
  need(input.customerId, "customerId は必須です（search_customers で探せます）");
  const c = await ownedCustomer(v, input.customerId);
  const status = (input.status ?? "PROSPECTING").toUpperCase() as DealStatus;
  need(DEAL_STATUSES_WRITABLE.includes(status), `status は ${DEAL_STATUSES_WRITABLE.join(" / ")} のどれかにしてください（受注はOS画面で）`);
  const probability = input.probability ?? null;
  need(probability === null || (Number.isInteger(probability) && probability >= 0 && probability <= 100), "受注確度（probability）は0〜100の整数にしてください");
  const expectedCloseDate = parseDay(input.expectedCloseDate, "expectedCloseDate");
  const notes = trimOrNull(input.notes);
  maxLen(notes, 4000, "メモ");

  if (!input.allowDuplicate) {
    const active = await db.deal.findFirst({ where: { customerId: c.id, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } }, select: { id: true, title: true, status: true } });
    need(!active, `この顧客には進行中の商談「${active?.title}」（${active?.status}・id: ${active?.id}）があります。そちらを update_deal で進めるか、別件なら allowDuplicate: true で作成してください`);
  }

  const d = await db.deal.create({
    data: {
      title, status, probability, expectedCloseDate, notes: notes ? withPrefix(notes) : null,
      customerId: c.id, branchId: c.branchId, createdById: v.id, assignedToId: v.id,
    },
    select: { id: true, title: true, status: true },
  });
  return { id: d.id, title: d.title, status: d.status, customer: c.name, next: "やり取りは log_activity(dealId) で残せます" };
}

export interface UpdateDealInput {
  id: string;
  status?: string;
  probability?: number;
  expectedCloseDate?: string;
  appendNote?: string;
}

/** 状態・確度・予定日の更新と、メモの追記（上書きはしない） */
export async function updateDeal(v: McpViewer, input: UpdateDealInput) {
  const d = await ownedDeal(v, input.id);
  const data: Prisma.DealUpdateInput = {};
  const changed: string[] = [];

  if (input.status !== undefined) {
    const status = input.status.toUpperCase() as DealStatus;
    need(status !== "CLOSED_WON", "受注（CLOSED_WON）への変更はOS画面で行ってください（プロジェクト作成と通知が動きます）");
    need(DEAL_STATUSES_WRITABLE.includes(status), `status は ${DEAL_STATUSES_WRITABLE.join(" / ")} のどれかにしてください`);
    need(d.status !== "CLOSED_WON", "受注済みの商談は変更できません。OS画面で扱ってください");
    data.status = status;
    if (status === "CLOSED_LOST") data.closedAt = new Date();
    changed.push(`status: ${d.status} → ${status}`);
  }
  if (input.probability !== undefined) {
    need(Number.isInteger(input.probability) && input.probability >= 0 && input.probability <= 100, "受注確度（probability）は0〜100の整数にしてください");
    data.probability = input.probability;
    changed.push(`probability: ${input.probability}`);
  }
  if (input.expectedCloseDate !== undefined) {
    data.expectedCloseDate = parseDay(input.expectedCloseDate, "expectedCloseDate");
    changed.push(`expectedCloseDate: ${input.expectedCloseDate || "なし"}`);
  }
  const note = trimOrNull(input.appendNote);
  if (note) {
    maxLen(note, 4000, "追記メモ");
    const stamp = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
    const line = `${AI_PREFIX}${stamp} ${note}`;
    data.notes = d.notes?.trim() ? `${d.notes.trimEnd()}\n${line}` : line;
    changed.push("notes: 追記");
  }
  need(changed.length > 0, "変更する項目がありません（status / probability / expectedCloseDate / appendNote のどれか）");

  const u = await db.deal.update({ where: { id: d.id }, data, select: { id: true, title: true, status: true, probability: true, expectedCloseDate: true } });
  return { id: u.id, title: u.title, status: u.status, probability: u.probability, expectedCloseDate: day(u.expectedCloseDate), changed };
}

export async function setClosingFactor(v: McpViewer, input: { id: string; closingFactor: string }) {
  const d = await ownedDeal(v, input.id);
  const text = input.closingFactor?.trim();
  need(text, "受注の決め手（closingFactor）を入れてください");
  maxLen(text, 2000, "受注の決め手");
  const u = await db.deal.update({ where: { id: d.id }, data: { closingFactor: withPrefix(text) }, select: { id: true, title: true, status: true } });
  return { id: u.id, title: u.title, status: u.status, saved: true };
}

// ---- リード（OS外で取ったリードの登録と、結果の吸い上げ） ------------------------------

const LEAD_STATUSES_WRITABLE: LeadStatus[] = ["UNTOUCHED", "CALLED", "APPOINTMENT", "DEAL_CONVERTED", "SKIPPED"];
const LEAD_RESULTS = OUTREACH_RESULT_OPTIONS.map((o) => o.value);

export interface CreateLeadInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  area?: string;
  memo?: string;
  status?: string;
}

/** OSを使わずに（紹介・飛び込み・自分で見つけた等）取ったリードをOSに登録する。担当は登録した本人 */
export async function createLead(v: McpViewer, input: CreateLeadInput) {
  const name = input.name?.trim();
  need(name, "会社名（name）は必須です");
  maxLen(name, 100, "会社名");
  const address = trimOrNull(input.address);
  const memo = trimOrNull(input.memo);
  maxLen(memo, 2000, "メモ");
  const status = (input.status ?? "UNTOUCHED").toUpperCase() as LeadStatus;
  need(LEAD_STATUSES_WRITABLE.includes(status), `status は ${LEAD_STATUSES_WRITABLE.join(" / ")} のどれかにしてください`);

  // 同名＋同住所は1件（DBの一意制約）。既にあればそれを返す
  const dup = await db.lead.findFirst({ where: { name, address: address ?? null }, select: { id: true, status: true, assignee: { select: { name: true } } } });
  if (dup) return { id: dup.id, name, status: dup.status, assignee: dup.assignee?.name ?? null, existed: true, next: "既にあるリードです。結果は record_lead_result(leadId) で記録できます" };

  const staffName = staffOf(v);
  const l = await db.lead.create({
    data: {
      name, address, phone: trimOrNull(input.phone), email: trimOrNull(input.email), websiteUrl: trimOrNull(input.website),
      industry: trimOrNull(input.industry), area: trimOrNull(input.area), memo: memo ? withPrefix(memo) : null,
      status, source: "MANUAL", signalKind: "FOUND", signalAt: new Date(),
      assigneeId: v.id, createdById: v.id,
      logs: { create: { action: "CREATED", detail: `${AI_PREFIX}AI連携から登録（OS外で獲得）`, staffName } },
    },
    select: { id: true, name: true, status: true },
  });
  return { id: l.id, name: l.name, status: l.status, existed: false, next: "結果が出たら record_lead_result(leadId, result)。商談になったら create_customer → create_deal" };
}

export interface RecordLeadResultInput {
  leadId: string;
  result?: string;
  status?: string;
  note?: string;
}

/** リードの結果を記録する。OS画面の結果ボタンと同じ処理（ステータス移動・事例DBへの反映まで）を通す */
export async function recordLeadResult(v: McpViewer, input: RecordLeadResultInput) {
  need(input.leadId, "leadId は必須です（list_leads で探せます）");
  const lead = await db.lead.findUnique({ where: { id: input.leadId } });
  need(lead, "リードが見つかりません");
  need(v.role === "ADMIN" || lead.assigneeId === v.id || lead.createdById === v.id || lead.assigneeId === null, "このリードは別の担当者のものです。結果はその担当者のAIか、OS画面から記録してください");
  need(input.result || input.status || input.note?.trim(), "result / status / note のどれかを入れてください");

  const staffName = staffOf(v);
  const changed: string[] = [];

  // 担当が空なら本人を担当にする（誰の結果かを残す）
  if (lead.assigneeId === null && v.role !== "ADMIN") {
    await db.lead.update({ where: { id: lead.id }, data: { assigneeId: v.id } });
    await db.leadLog.create({ data: { leadId: lead.id, action: "ASSIGNED", detail: `${AI_PREFIX}結果の記録に合わせて担当に設定`, staffName } });
    changed.push("担当: 自分");
  }

  if (input.result) {
    const option = getOutreachResultOption(input.result.toUpperCase());
    need(option, `result は ${LEAD_RESULTS.join(" / ")} のどれかにしてください（返信あり / 返信NG / 無反応 / 断り / 受注）`);
    need(lead.outreachResult !== option.value, `この結果「${option.label}」は既に記録済みです`);
    const res = await applyOutreachResult(lead, option, { id: v.id, name: v.name, groupCompanyId: v.groupCompanyId }, v.email, { allowUndo: false });
    need(!res.error, res.error ?? "保存に失敗しました");
    changed.push(`結果: ${option.label}`);
  }

  if (input.status) {
    const status = input.status.toUpperCase() as LeadStatus;
    need(LEAD_STATUSES_WRITABLE.includes(status), `status は ${LEAD_STATUSES_WRITABLE.join(" / ")} のどれかにしてください`);
    const cur = await db.lead.findUnique({ where: { id: lead.id }, select: { status: true } });
    if (cur && cur.status !== status) {
      await db.lead.update({ where: { id: lead.id }, data: { status } });
      await db.leadLog.create({ data: { leadId: lead.id, action: "STATUS_CHANGED", detail: `${AI_PREFIX}${cur.status} → ${status}`, staffName } });
      changed.push(`status: ${cur.status} → ${status}`);
    }
  }

  const note = trimOrNull(input.note);
  if (note) {
    maxLen(note, 4000, "メモ");
    await db.leadLog.create({ data: { leadId: lead.id, action: "NOTE", detail: withPrefix(note), staffName } });
    changed.push("メモ: 追加");
  }

  const after = await db.lead.findUnique({ where: { id: lead.id }, select: { id: true, name: true, status: true, outreachResult: true, outreachResultAt: true } });
  return { id: after!.id, name: after!.name, status: after!.status, outreachResult: after!.outreachResult, outreachResultAt: day(after!.outreachResultAt), changed };
}
