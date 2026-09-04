// ==============================================================
// ブランドキット — 自由記述の匿名化（社名・個人名・連絡先・金額を伏せる）
//   OSの記録（学び・受注の決め手・ヒアリング）を材料に載せるときの安全網。
// ==============================================================

const CORP = "(?:株式会社|有限会社|合同会社|合資会社|一般社団法人|一般財団法人|医療法人|学校法人|社会福祉法人|NPO法人)";

export function maskFreeText(input: string | null | undefined, max = 160): string {
  if (!input) return "";
  let t = input.replace(/\r?\n+/g, " ").trim();
  t = t.replace(/https?:\/\/\S+/g, "（URL）");
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "（メール）");
  t = t.replace(/0\d{1,4}-?\d{1,4}-?\d{3,4}/g, "（電話）");
  t = t.replace(new RegExp(`${CORP}[^\\s、。（）()]{1,24}`, "g"), "〇〇社");
  t = t.replace(new RegExp(`[^\\s、。（）()]{1,24}${CORP}`, "g"), "〇〇社");
  t = t.replace(/[^\s、。（）()]{1,16}(様|御中|さま)/g, "先方");
  t = t.replace(/[0-9０-９,，]+(?:億|万)?円/g, "◯円");
  t = t.replace(/[0-9０-９,，]+万/g, "◯万");
  if (t.length > max) t = t.slice(0, max) + "…";
  return t;
}
