// ==============================================================
// 郵送DM の材料を1回で揃える（AI連携 prepare_dm）
//   入力: リード（選んだ相手先）＋市（チラシの商圏）
//   出力: ①Webレター用CSV（Shift-JIS・見出しなし・15列） ②汎用CSV（UTF-8） ③チラシPDF（拠点社名・QR入り）
//         ④発送先リンク＋手順＋概算 ⑤OSの送付記録（メール・フォームと同じ台帳。チャネル=DM）
//   発送ボタンは人が押す。本部は間に入らない（各代表が自分で入稿・支払い）
// ==============================================================

import QRCode from "qrcode";
import iconv from "iconv-lite";
import { db } from "@/lib/db";
import type { McpViewer } from "@/lib/mcp/os-read-tools";
import { WriteError, AI_PREFIX } from "@/lib/mcp/os-write-tools";
import { resolvePref, resolveCity } from "@/lib/mcp/os-campaign-tools";
import { normalizeDomain } from "@/lib/auto-sales-domain";
import { FORM_SENT } from "@/lib/leads/apply-outreach-result";
import { buildFlyerData } from "@/lib/tver/flyer-data";
import { buildFlyerHtml } from "@/lib/tver/flyer-html";
import { renderHtmlToPdf } from "@/lib/pdf/chrome";
import { saveDmKitFile } from "@/lib/storage";
import { DM_SEND_LINKS, isFlyerTemplate, DEFAULT_FLYER_TEMPLATE, type FlyerTemplateKey } from "@/lib/constants/tver-flyer";
import { parseJapaneseAddress, lookupPostalCode } from "./address";

function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new WriteError(msg);
}
const day = (d: Date) => d.toISOString().slice(0, 10);

export interface PrepareDmInput {
  leadIds: string[];
  prefecture: string;
  city: string;
  industry?: string;
  catchCopy?: string;
  landingUrl?: string;
  template?: string;
  adSeconds?: number;
  budgetJpy?: number;
  /** 宛名の敬称（既定「御中」） */
  honorific?: string;
  /** 自作チラシ（/api/dm/upload で上げたPDFのURL）。あるときはOSのチラシを作らない */
  customFlyerUrl?: string;
  /** 記録の出どころ（画面=SCREEN／AI連携=AI） */
  source?: "SCREEN" | "AI";
}

const MAX_LEADS = 200;
const MAX_GEOCODE = 120; // 郵便番号の補完に使う Geocoding の上限（1回の呼び出し）

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function cut(s: string, n: number): string {
  return Array.from(s).slice(0, n).join("");
}

export async function prepareDm(v: McpViewer, input: PrepareDmInput) {
  need(Array.isArray(input.leadIds) && input.leadIds.length > 0, "leadIds は必須です（plan_campaign / list_leads で選んだ相手先）");
  need(input.leadIds.length <= MAX_LEADS, `1回に扱えるのは${MAX_LEADS}件までです。分けて呼んでください`);
  const pref = resolvePref(input.prefecture);
  need(pref, "都道府県名が一致しません（例: 佐賀県）");
  const muni = resolveCity(pref, input.city);
  need(muni, `市区町村が見つかりません（${pref}内の市区町村名。例: 唐津市）`);
  const catchCopy = (input.catchCopy ?? "").trim();
  need(catchCopy.length <= 40, "catchCopy は40字以内");
  need(!/[¥￥]\s?\d|\d+円/.test(catchCopy), "catchCopy に金額を入れないでください（金額はチラシがOSの数字で描きます）");
  const landingUrl = (input.landingUrl ?? "").trim();
  need(!landingUrl || /^https?:\/\//.test(landingUrl), "landingUrl は http(s) のURL");
  const template: FlyerTemplateKey = input.template && isFlyerTemplate(input.template) ? input.template : DEFAULT_FLYER_TEMPLATE;
  const honorific = ["御中", "様", ""].includes(input.honorific ?? "御中") ? (input.honorific ?? "御中") : "御中";

  // ---- 相手先 ----
  const ids = Array.from(new Set(input.leadIds));
  const leads = await db.lead.findMany({ where: { id: { in: ids } } });
  need(leads.length > 0, "リードが見つかりません");
  const blacklist = await db.autoSalesBlacklist.findMany({ select: { domain: true } });
  const blocked = new Set(blacklist.map((b) => normalizeDomain(b.domain) ?? b.domain));

  type Row = { leadId: string; name: string; address: string; parsed: ReturnType<typeof parseJapaneseAddress>; postal: string | null; note: string | null };
  const rows: Row[] = [];
  const skipped: { leadId: string; name: string; reason: string }[] = [];
  for (const l of leads) {
    if (l.assigneeId && l.assigneeId !== v.id && v.role !== "ADMIN") { skipped.push({ leadId: l.id, name: l.name, reason: "別の担当者のリード" }); continue; }
    if (["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"].includes(l.status)) { skipped.push({ leadId: l.id, name: l.name, reason: "営業対象外（除外済み／商談化済み）" }); continue; }
    const dom = normalizeDomain(l.websiteUrl ?? "");
    if (dom && blocked.has(dom)) { skipped.push({ leadId: l.id, name: l.name, reason: "営業お断りリスト" }); continue; }
    const addr = (l.address ?? "").trim();
    if (!addr) { skipped.push({ leadId: l.id, name: l.name, reason: "住所が無い" }); continue; }
    const parsed = parseJapaneseAddress(addr, l.prefecture ?? pref);
    rows.push({ leadId: l.id, name: l.name, address: addr, parsed, postal: parsed.postal3 && parsed.postal4 ? parsed.postal3 + parsed.postal4 : null, note: parsed.incomplete ? "住所が不完全（市区町村まで取れない）" : null });
  }
  need(rows.length > 0, `送れる相手先がありません（${skipped.map((s) => `${s.name}: ${s.reason}`).slice(0, 5).join(" / ")}）`);

  // ---- 郵便番号の補完（住所に無いものだけ・上限あり・並列5） ----
  const needZip = rows.filter((r) => !r.postal && !r.parsed.incomplete).slice(0, MAX_GEOCODE);
  for (let i = 0; i < needZip.length; i += 5) {
    await Promise.all(
      needZip.slice(i, i + 5).map(async (r) => {
        const z = await lookupPostalCode(`${r.parsed.pref}${r.parsed.city}${r.parsed.town}${r.parsed.block}`);
        if (z) r.postal = z;
      })
    );
  }
  for (const r of rows) if (!r.postal && !r.note) r.note = "郵便番号が取れない（手で補う）";
  const ready = rows.filter((r) => r.postal && !r.parsed.incomplete);
  const needsFix = rows.filter((r) => !r.postal || r.parsed.incomplete);

  // ---- ①Webレター用CSV（Shift-JIS・見出しなし・15列・宛先データのみ） ----
  const groupName = cut(`${muni.name}DM${day(new Date()).replace(/-/g, "").slice(2)}`, 10);
  const wlLines = ready.map((r) => {
    const p = r.parsed;
    const cols = [
      r.postal!.slice(0, 3), r.postal!.slice(3),
      cut(p.pref, 4), cut(p.city, 20), cut(p.town || "－", 30), cut(p.block, 30), cut(p.building, 35),
      cut(r.name, 35), "", "", "", "", "ご担当者", honorific === "" ? "" : "様", groupName,
    ];
    // Webレターは「氏名等」必須なので会社名＋「ご担当者 様」。会社名敬称は空（御中は氏名側に付けない仕様）
    return cols.map((c) => csvCell(c)).join(",");
  });
  const webletterCsv = iconv.encode(wlLines.join("\r\n") + "\r\n", "Shift_JIS");

  // ---- ②汎用CSV（UTF-8 BOM・見出しあり。ラクスル等の宛名テンプレに貼り替える用） ----
  const genHeader = ["郵便番号", "都道府県", "市区町村", "町域", "丁目・番地", "ビル", "会社名", "宛名", "敬称", "住所（元）", "要確認", "リードID"];
  const genLines = rows.map((r) => {
    const p = r.parsed;
    return [r.postal ? `${r.postal.slice(0, 3)}-${r.postal.slice(3)}` : "", p.pref, p.city, p.town, p.block, p.building, r.name, "ご担当者", honorific, r.address, r.note ?? "", r.leadId].map(csvCell).join(",");
  });
  const genericCsv = Buffer.from("﻿" + [genHeader.join(","), ...genLines].join("\r\n") + "\r\n", "utf8");

  // ---- ③チラシPDF（既存のTVerチラシの型・拠点社名＋QR） ----
  const company = v.groupCompanyId ? await db.groupCompany.findUnique({ where: { id: v.groupCompanyId }, select: { name: true, ownerName: true } }) : null;
  const issuerName = company?.name ?? "Ad Archグループ";
  const qrUrl = landingUrl || null;
  const qr = qrUrl ? { dataUrl: await QRCode.toDataURL(qrUrl, { width: 240, margin: 1, errorCorrectionLevel: "M" }), label: "詳しくはこちら（スマホで読み取り）" } : null;
  const flyerData = buildFlyerData({
    municipalityCodes: [muni.code],
    adSeconds: input.adSeconds === 30 || input.adSeconds === 60 ? input.adSeconds : 15,
    budget: input.budgetJpy && input.budgetJpy > 0 ? input.budgetJpy : null,
    clientName: null,
    industry: input.industry?.trim() || null,
    monthlyOverride: null,
    totalOverride: null,
    catchCopy: catchCopy || null,
    issuerName,
    issuerContact: `${issuerName} ${company?.ownerName ?? v.name ?? ""} ${v.email}`.trim(),
    deliveredAt: null,
    createdAt: new Date(),
  });
  need(flyerData, "この市の商圏データが無く、チラシを組めません");
  const flyer = { ...flyerData, qr };
  let flyerUrl: string | null = null;
  let flyerNote: string | null = null;
  const customFlyer = (input.customFlyerUrl ?? "").trim();
  if (customFlyer) {
    need(customFlyer.startsWith("/api/storage/dm-kits/"), "customFlyerUrl は /api/dm/upload で上げたPDFのURLだけ使えます");
    flyerUrl = customFlyer;
  } else {
    try {
      const pdf = await renderHtmlToPdf(buildFlyerHtml(flyer, template));
      if (pdf) flyerUrl = await saveDmKitFile(`DM_${muni.name}_チラシ.pdf`, pdf, "pdf");
      else flyerNote = "チラシPDFを作れませんでした（PDF生成の環境）。OSの「TVerチラシ制作サポート」で同じ市のチラシを作ってください";
    } catch (e) {
      console.error("[prepare_dm] flyer", e instanceof Error ? e.message : e);
      flyerNote = "チラシPDFを作れませんでした。OSの「TVerチラシ制作サポート」で同じ市のチラシを作ってください";
    }
  }
  const webletterUrl = await saveDmKitFile(`DM_${muni.name}_Webレター用宛先.csv`, webletterCsv, "csv");
  const genericUrl = await saveDmKitFile(`DM_${muni.name}_宛名_汎用.csv`, genericCsv, "csv");

  // ---- ⑤OSの送付記録（メール・フォームと同じ台帳。詳細に【DM】） ----
  const staffName = v.name ?? v.email;
  const now = new Date();
  for (const r of ready) {
    const lead = leads.find((l) => l.id === r.leadId)!;
    if (lead.assigneeId === null) {
      await db.lead.update({ where: { id: lead.id }, data: { assigneeId: v.id } });
      await db.leadLog.create({ data: { leadId: lead.id, action: "ASSIGNED", detail: `${AI_PREFIX}郵送DMの準備に合わせて担当に設定`, staffName } });
    }
    const dom = normalizeDomain(lead.websiteUrl ?? "");
    if (dom && v.branchId) {
      await db.autoSalesSentDomain.create({ data: { domain: dom, companyName: lead.name, branchId: v.branchId, source: "LEAD_FORM", sourceId: lead.id, sentBy: v.email } }).catch(() => null);
    }
    await db.leadLog.create({
      data: {
        action: FORM_SENT,
        detail: `${AI_PREFIX}【DM・郵送】${muni.name}向けチラシDM（${template}）${catchCopy ? `／コピー: ${catchCopy}` : ""}${qrUrl ? `／QR: ${qrUrl}` : ""}\n宛先: 〒${r.postal} ${r.address}`.slice(0, 2000),
        staffName,
        leadId: lead.id,
      },
    });
    await db.lead.update({ where: { id: lead.id }, data: { sentAt: now, outreachResult: null, outreachResultAt: null, ...(lead.status === "UNTOUCHED" ? { status: "CALLED" as const } : {}) } });
  }

  const estColor = ready.length * 190;
  const needsFixOut = needsFix.map((r) => ({ leadId: r.leadId, name: r.name, address: r.address, reason: r.note }));
  const kit = await db.dmKit.create({
    data: {
      createdById: v.id, createdByName: staffName, createdByEmail: v.email, branchId: v.branchId, groupCompanyId: v.groupCompanyId,
      source: input.source === "AI" ? "AI" : "SCREEN",
      prefecture: pref, city: muni.name, industry: input.industry?.trim() || null, catchCopy: catchCopy || null, landingUrl: qrUrl, template,
      flyerUrl, flyerSource: customFlyer ? "UPLOADED" : "GENERATED", webletterCsvUrl: webletterUrl, genericCsvUrl: genericUrl,
      readyCount: ready.length, needsFixCount: needsFix.length, skippedCount: skipped.length,
      leadIds: ready.map((r) => r.leadId), needsFix: needsFixOut, skipped,
    },
    select: { id: true },
  });
  return {
    kitId: kit.id,
    kitUrl: `/dashboard/leads/dm/${kit.id}`,
    area: `${pref} ${muni.name}`,
    counts: { ready: ready.length, needsFix: needsFix.length, skipped: skipped.length },
    files: {
      flyerPdf: flyerUrl,
      webletterCsv: webletterUrl,
      genericCsv: genericUrl,
      note: flyerNote,
    },
    needsFix: needsFixOut,
    skipped,
    send: DM_SEND_LINKS.map((l) => ({ label: l.label, url: l.url, how: l.spec, csv: l.csvNote })),
    estimate: { webletterColorA4x1: `¥${estColor.toLocaleString("ja-JP")}（税込・${ready.length}通×¥190。2026年9月の公式表示。実額は画面で確認）` },
    recorded: { sentAt: day(now), leads: ready.length, ledger: "メール・フォームと同じ送付台帳に【DM・郵送】で記録済み" },
    steps: [
      "1) flyerPdf を開いて中身を確認（拠点社名・QR・市の数字）。材料は kitUrl（OSの郵送DM履歴）からいつでも再ダウンロードでき、送ったら「発送済み」を押す",
      "2) Webレターにログイン → アドレス帳 → CSVアップロードに webletterCsv（Shift-JIS・見出しなし）",
      "3) 差出し → 本文に flyerPdf（A4・カラー）→ 宛先をアドレス帳のグループから選ぶ → 支払い（あなたのアカウントで。本部は送らない）",
      "4) needsFix の会社は郵便番号・住所を手で補ってから追加。届いたら record_lead_result(leadId, result)",
    ],
    next: "発送はあなた（この拠点）がWebレターかラクスルDMから行う。本部は送らない。反応が来たら record_lead_result で結果を記録（メール・フォームと同じ）",
  };
}
