// ---------------------------------------------------------------
// 送付見送り（営業フォームで「この会社には送らない」とした記録）
//
// 見送りは端末ローカルではなく OS に残す。
//   - LeadLog(action="FORM_SKIPPED") に理由＋メモ
//   - Lead.memo の末尾に【送付見送り】の1行を追記（リード管理のメモ欄で見える）
// 「営業お断り」（全社の送付禁止リスト）や「却下」（status=SKIPPED・一覧から消える）
// とは別物。見送りはリードを消さない＝あとから解除できる。
// ---------------------------------------------------------------

export const OUTREACH_SKIP_REASONS = [
  { value: "CUSTOMER_ONLY", label: "お客様受付だった", hint: "フォームがお客様専用で、営業の窓口がない" },
  { value: "BAD_VIBE", label: "雰囲気が悪かった", hint: "サイトや対応の印象で、当たらない方がよいと判断" },
  { value: "OTHER", label: "その他", hint: "メモに理由を書く" },
] as const;

export type OutreachSkipReasonValue = (typeof OUTREACH_SKIP_REASONS)[number]["value"];

export function getOutreachSkipReason(value: string | null | undefined) {
  if (!value) return null;
  return OUTREACH_SKIP_REASONS.find((r) => r.value === value) ?? null;
}

export const FORM_SKIPPED = "FORM_SKIPPED";

/** LeadLog.detail の書式: `送付見送り［理由］メモ` */
export function buildSkipDetail(reason: OutreachSkipReasonValue, note: string): string {
  const label = getOutreachSkipReason(reason)?.label ?? "その他";
  return `送付見送り［${label}］${note}`.slice(0, 2000);
}

/** LeadLog.detail から理由ラベルとメモを取り出す（一覧の初期表示用） */
export function parseSkipDetail(detail: string | null): { reasonLabel: string; note: string } | null {
  if (!detail) return null;
  const m = detail.match(/^送付見送り［(.*?)］([\s\S]*)$/);
  if (!m) return null;
  return { reasonLabel: m[1], note: m[2].trim() };
}

/** Lead.memo に追記する1行。改行は使わない（リード管理のメモ欄は1行入力のため） */
export function buildSkipMemoLine(reasonLabel: string, note: string): string {
  const label = reasonLabel || "その他";
  const n = note.replace(/\s+/g, " ").trim();
  return n ? `【送付見送り】${label}：${n}` : `【送付見送り】${label}`;
}

const MEMO_SEP = " ／ ";

/** 既存メモの末尾に見送り行を足す */
export function appendSkipMemo(memo: string | null, line: string): string {
  const base = (memo ?? "").trim();
  return base ? `${base}${MEMO_SEP}${line}` : line;
}

/** 見送り解除: 追記した行だけを取り除く（他のメモは残す） */
export function removeSkipMemo(memo: string | null, line: string): string | null {
  const base = memo ?? "";
  if (!base.includes(line)) return memo;
  const out = base
    .split(MEMO_SEP)
    .filter((seg) => seg.trim() !== line.trim())
    .join(MEMO_SEP)
    .trim();
  return out ? out : null;
}
