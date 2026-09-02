"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkSaveCap } from "@/lib/leads/release-stale";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

// ---------------------------------------------------------------
// POST /api/leads/import
// CSVファイルからリードを一括インポート
//
// 受け付ける列名は「別名（エイリアス）」で吸収する。
// 周年ファインダー・営業リスト・AIに書かせたCSVで見出しの言い方が違うため、
// 「社名／会社名／企業名」のどれで来ても同じ項目として読む。
// ---------------------------------------------------------------

/** 列見出しのゆらぎを吸収するための正規化（BOM・空白・全角英数・大小文字） */
function normalizeHeader(h: string): string {
  return h
    .replace(/﻿/g, "")
    .replace(/[\s　]/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .toLowerCase();
}

/** 項目 → 受け付ける見出しの一覧。先に書いたものが優先。 */
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["会社名", "社名", "企業名", "法人名", "取引先名", "company", "name"],
  address: ["住所", "所在地", "address"],
  phone: ["電話番号", "電話", "tel", "phone", "連絡先電話"],
  websiteUrl: [
    "WebサイトURL",
    "Webサイト",
    "URL",
    "ホームページ",
    "HP",
    "サイト",
    "website",
  ],
  industry: ["業種", "業界", "industry"],
  area: ["エリア", "地域", "都道府県", "県", "area", "prefecture"],
  memo: ["メモ", "備考", "memo", "note"],
  representativeName: ["担当者名", "担当者", "代表者名", "代表者", "担当"],
  email: ["メール", "メールアドレス", "email", "mail", "Eメール"],
  employeeCount: ["従業員数", "社員数", "従業員"],
  foundedYear: ["設立年", "創業年"],
  foundedMonth: ["設立月", "創業月"],
  foundedRaw: ["設立の原文", "設立", "創業"],
  foundedSourceUrl: ["出典URL", "出典", "根拠URL"],
  // 周年ファインダー由来。リードの列には置き場が無いのでメモへ書き残す
  annivYears: ["周年"],
  annivOnYear: ["迎える年"],
  annivOnMonth: ["迎える月"],
  pressReleaseUrl: ["リリースURL", "プレスリリースURL"],
};

/** 実際のCSV見出し → 項目名 の対応表をつくる */
function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const target = normalizeHeader(alias);
      const hit = normalized.find(
        (h) => h.norm === target && !(h.raw in map)
      );
      if (hit) {
        map[hit.raw] = field;
        break;
      }
    }
  }
  return map;
}

/** 数字だけ取り出す（「1,200人」「約50名」→ 1200 / 50） */
function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const digits = v
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email ?? "";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const staffName = user.name ?? email;

  // 取得の蓋: 未送付を抱えたまま新しく取り込めない
  const cap = await checkSaveCap(user.id);
  if (cap.blocked) {
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: [cap.message] },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "CSVファイルが選択されていません" },
        { status: 400 }
      );
    }

    // ファイルをバッファとして読み込み
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // エンコーディング判定: UTF-8 BOM → UTF-8、それ以外は Shift-JIS を試す
    let csvText: string;
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      // UTF-8 BOM
      csvText = buffer.subarray(3).toString("utf-8");
    } else {
      // UTF-8 として試す → 日本語の見出しが読めていれば UTF-8 と判断。
      // 「会社名」だけを見ると周年ファインダーの「社名」を取りこぼすので、
      // 短い語（社名・住所・電話）で判定する。
      const utf8Text = buffer.toString("utf-8");
      const head = utf8Text.slice(0, 2000);
      if (/社名|住所|電話|業種|企業名/.test(head)) {
        csvText = utf8Text;
      } else {
        // Shift-JIS としてデコード
        csvText = iconv.decode(buffer, "Shift_JIS");
      }
    }

    // CSV パース
    let records: Record<string, string>[];
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
      });
    } catch (parseError) {
      const msg =
        parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        { imported: 0, skipped: 0, errors: [`CSVパースエラー: ${msg}`] },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors: ["データ行がありません（見出しだけのCSVです）"],
      });
    }

    // 見出しの対応づけ。会社名の列が無いときは全行エラーにせず1本の説明で返す。
    const headers = Object.keys(records[0]);
    const headerMap = buildHeaderMap(headers);
    const nameHeader = Object.keys(headerMap).find(
      (h) => headerMap[h] === "name"
    );
    if (!nameHeader) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors: [
          "会社名の列が見つかりません。「会社名」または「社名」という見出しの列が必要です。",
          `このCSVの見出し: ${headers.join(" / ")}`,
        ],
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 重複チェックを1行ずつ問い合わせると件数ぶん往復して遅い。
    // 取り込む社名ぶんを一度に引いて、メモリ上で突き合わせる。
    const namesInCsv = Array.from(
      new Set(
        records
          .map((row) => row[nameHeader]?.trim())
          .filter((n): n is string => !!n)
      )
    );
    const existingLeads = await db.lead.findMany({
      where: { name: { in: namesInCsv } },
      select: { name: true, address: true },
    });
    const dupKey = (name: string, address: string | null) =>
      `${name}\u0000${address ?? ""}`;
    const existingKeys = new Set(
      existingLeads.map((l) => dupKey(l.name, l.address))
    );

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // ヘッダー行 + 0-indexed

      // 見出しの対応づけを適用
      const mapped: Record<string, string> = {};
      for (const [header, field] of Object.entries(headerMap)) {
        const value = row[header]?.trim();
        if (value) mapped[field] = value;
      }

      // 必須チェック: 会社名
      if (!mapped.name) {
        errors.push(`${rowNum}行目: 会社名が空です`);
        continue;
      }

      const address = mapped.address || null;

      // 重複チェック (name + address)
      if (existingKeys.has(dupKey(mapped.name, address))) {
        skipped++;
        continue;
      }

      // 周年ファインダー由来の列はメモに残す（リード側に置き場が無いため）
      const extras: string[] = [];
      if (mapped.annivYears) {
        const on = [
          mapped.annivOnYear ? `${mapped.annivOnYear}年` : "",
          mapped.annivOnMonth ? `${mapped.annivOnMonth}月` : "",
        ].join("");
        extras.push(on ? `${on}に${mapped.annivYears}` : mapped.annivYears);
      }
      if (mapped.foundedRaw) extras.push(`設立: ${mapped.foundedRaw}`);
      const memo =
        [mapped.memo, extras.join(" / ")].filter(Boolean).join("\n") || null;

      try {
        const created = await db.lead.create({
          data: {
            name: mapped.name,
            address,
            phone: mapped.phone || null,
            websiteUrl: mapped.websiteUrl || null,
            industry: mapped.industry || null,
            area: mapped.area || null,
            memo,
            representativeName: mapped.representativeName || null,
            email: mapped.email || null,
            employeeCount: toInt(mapped.employeeCount),
            foundedYear: toInt(mapped.foundedYear),
            foundedMonth: toInt(mapped.foundedMonth),
            foundedRaw: mapped.foundedRaw || null,
            foundedSourceUrl: mapped.foundedSourceUrl || null,
            pressReleaseUrl: mapped.pressReleaseUrl || null,
            source: "CSV_IMPORT",
            status: "UNTOUCHED",
            createdById: user.id,
            // 取り込んだ代表を担当として自動反映（検索保存と同じ挙動に揃える）
            assigneeId: user.id,
          },
        });

        // 同じCSV内に同じ会社が2度出てきたら2件目以降はスキップに回す
        existingKeys.add(dupKey(mapped.name, address));

        // ログ記録
        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CREATED",
            detail: "CSVインポートから作成",
            staffName,
          },
        });

        imported++;
      } catch (dbError) {
        const msg =
          dbError instanceof Error ? dbError.message : String(dbError);
        errors.push(`${rowNum}行目(${mapped.name}): ${msg}`);
      }
    }

    // 件数の多いCSVでエラーが数百行返ると画面が読めなくなるので頭だけ返す
    const MAX_ERRORS = 20;
    const trimmedErrors =
      errors.length > MAX_ERRORS
        ? [...errors.slice(0, MAX_ERRORS), `ほか${errors.length - MAX_ERRORS}件`]
        : errors;

    return NextResponse.json({ imported, skipped, errors: trimmedErrors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[leads/import] Error:", msg, e);
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: [`サーバーエラー: ${msg}`] },
      { status: 500 }
    );
  }
}
