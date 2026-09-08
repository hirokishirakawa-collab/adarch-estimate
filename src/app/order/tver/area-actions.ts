"use server";

// TVer小口申込 — 画面から呼ぶ小さな読み取り（ログイン不要）
//   市区町村一覧・エリアの目安・法人番号からの社名住所・複数エリア相談の送信

import { headers } from "next/headers";
import { municipalitiesOf, prefectureOptions } from "@/lib/packages/tver-area";
import { estimateForArea, type TverOrderAreaEstimate } from "@/lib/tver-order/plans";
import { logAudit } from "@/lib/audit";
import { notifyCeo } from "@/lib/google-chat";
import { sendMail } from "@/lib/resend";
import { HQ } from "@/lib/tver-order/terms";
import { appUrl, loadOrderSender } from "@/lib/tver-order/service";

export async function getMunicipalities(pref: string): Promise<{ code: string; name: string; population: number }[]> {
  if (!prefectureOptions().includes(pref)) return [];
  return municipalitiesOf(pref);
}

export async function getAreaEstimate(pref: string, code: string): Promise<TverOrderAreaEstimate | null> {
  if (!prefectureOptions().includes(pref)) return null;
  if (!municipalitiesOf(pref).some((m) => m.code === code)) return null;
  return estimateForArea(pref, code);
}

// ---------------------------------------------------------------
// 法人番号 → 社名・住所（国税庁 Web-API → 公表サイトの順）
// ---------------------------------------------------------------
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export async function lookupCorporateNumber(number: string): Promise<{ name?: string; postalCode?: string; address?: string; error?: string }> {
  const n = number.replace(/\D/g, "");
  if (!/^\d{13}$/.test(n)) return { error: "法人番号は13桁の数字です" };
  const appId = process.env.NTA_APP_ID;
  if (appId) {
    try {
      const res = await fetch(`https://api.houjin-bangou.nta.go.jp/4/num?id=${appId}&number=${n}&type=02&history=0`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const lines = (await res.text()).trim().split("\n");
        if (lines.length >= 2) {
          const f = parseCsvLine(lines[1]);
          // 仕様書の並び: 7=商号, 10=都道府県, 11=市区町村, 12=丁目番地等, 16=郵便番号（1始まり）
          const name = (f[6] ?? "").trim();
          if (name && !/^\d+$/.test(name)) {
            const address = [f[9], f[10], f[11]].map((v) => (v ?? "").trim()).filter(Boolean).join("");
            const pc = (f[15] ?? "").replace(/\D/g, "");
            return { name, address: address || undefined, postalCode: pc.length === 7 ? `${pc.slice(0, 3)}-${pc.slice(3)}` : undefined };
          }
        }
      }
    } catch (e) {
      console.error("[order/tver] NTA API error:", e instanceof Error ? e.message : e);
    }
  }
  try {
    const res = await fetch(`https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${n}`, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "AdArchOS/1.0" } });
    if (res.ok) {
      const html = await res.text();
      const name = html.match(/商号又は名称<\/th>[^<]*<td[^>]*>([^<]+)<\/td>/)?.[1]?.trim();
      const addr = html.match(/本店又は主たる事務所の所在地<\/th>[^<]*<td[^>]*>([^<]+)<\/td>/)?.[1]?.trim();
      if (name) return { name, address: addr?.replace(/\s+/g, "") || undefined };
    }
  } catch (e) {
    console.error("[order/tver] NTA scrape error:", e instanceof Error ? e.message : e);
  }
  return { error: "法人情報が見つかりませんでした。手入力してください" };
}

// ---------------------------------------------------------------
// 複数エリアで相談したい（申込は1市のみ。2市以上は担当拠点・本部が個別に組む）
// ---------------------------------------------------------------
export type ConsultState = { success?: boolean; error?: string } | null;

export async function submitMultiAreaConsult(_prev: ConsultState, formData: FormData): Promise<ConsultState> {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const from = s("from") || null;
  const company = s("company").slice(0, 120);
  const person = s("person").slice(0, 80);
  const email = s("email").slice(0, 200);
  const phone = s("phone").slice(0, 40);
  const areas = s("areas").slice(0, 1000);
  const budget = s("budget").slice(0, 60);
  if (!company || !person) return { error: "会社名とお名前を入力してください" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "メールアドレスの形式が正しくありません" };
  if (!areas) return { error: "配信したいエリアを入力してください" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const sender = await loadOrderSender(from);
  const body = `会社名: ${company}\nお名前: ${person}\nメール: ${email}\n電話: ${phone || "—"}\n希望エリア: ${areas}\nご予算の目安: ${budget || "—"}\n案内元: ${sender ? sender.company : "本部（from無し）"}`;
  logAudit({ action: "tver_order_multi_area_consult", email: "form@order", name: company, entity: "tver_order_consult", ipAddress: ip ?? undefined, detail: body.replace(/\n/g, " / ") });
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const to = [HQ.email, ...(sender?.email ? [sender.email] : [])];
  try {
    await sendMail({
      to,
      subject: `【TVer小口申込】複数エリアのご相談: ${company}`,
      html: `<div style="font-family:'IBM Plex Sans JP','Hiragino Sans',sans-serif;font-size:14px;line-height:1.8;color:#111"><p>申込ページ（/order/tver）から「複数エリアで相談したい」が届きました。担当拠点${sender ? `（${esc(sender.company)}）` : ""}から連絡してください。</p><p>${esc(body)}</p></div>`,
      replyTo: email,
    });
    await sendMail({
      to: email,
      subject: "【Ad Arch】複数エリアのご相談を受け付けました（TVer広告 エリア限定プラン）",
      html: `<div style="font-family:'IBM Plex Sans JP','Hiragino Sans',sans-serif;font-size:14px;line-height:1.8;color:#111"><p>${esc(company)}<br>${esc(person)} 様</p><p>複数エリアでの配信のご相談を受け付けました。${sender ? `${esc(sender.company)}${sender.person ? `（${esc(sender.person)}）` : ""}` : HQ.company}より、エリアの組み合わせと料金の目安をご連絡します。</p><p style="color:#6a6a6a;font-size:12px">${esc(body)}</p><p style="color:#6a6a6a;font-size:12px">${HQ.company}　${HQ.email}　／　${HQ.phone}</p></div>`,
      replyTo: sender?.email ?? HQ.email,
    });
  } catch (e) {
    console.error("[order/tver] consult mail failed:", e instanceof Error ? e.message : e);
  }
  notifyCeo(`🗺️ *TVer小口申込 複数エリアの相談* ${company}（${person}）\n${areas}${budget ? `／予算 ${budget}` : ""}\n${sender ? `案内元: ${sender.company}` : "案内元なし"}\n${email} ${phone}\n👉 ${appUrl()}/dashboard/admin/tver-orders`).catch(() => {});
  return { success: true };
}
