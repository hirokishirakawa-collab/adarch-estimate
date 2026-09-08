// ==============================================================
// ブランドキット — 見ている人向けの材料「全部」を1本に組む（画面とMCPの共通口）
// ==============================================================

import { promises as fs } from "fs";
import path from "path";
import { buildPackageMaterials, buildMediaMaterials, buildExtraMaterials, resolveViewer, type KitMaterialItem } from "./materials";
import { buildPreamble } from "./preamble";

// 配布物は public/downloads/kit/ に日付つきで置く。差し替えたらここのファイル名と版を更新する
const KIT_DIR = path.join(process.cwd(), "public", "downloads", "kit");

export const STATIC_MATERIALS: Omit<KitMaterialItem, "body">[] = [
  {
    id: "brand-rules",
    label: "ブランドの決まり（資料の型）",
    note: "色・書体・写真・組み方。AIに貼ってから指示文を送る",
    version: "2026-09-04版",
    downloadHref: "/downloads/kit/brand-rules_2026-09-04.md",
    group: "static",
  },
];

export async function readKitFile(href: string): Promise<string> {
  const file = path.join(KIT_DIR, path.basename(href));
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "（ファイルが見つかりません。本部にお知らせください）";
  }
}

export interface AllMaterials {
  materials: KitMaterialItem[];
  sender: { company: string | null; prefecture: string | null };
}

/** 画面の並び順で全材料（共通の決まり→会社→営業→メニュー別→媒体別→切り口→Wiki） */
export async function buildAllMaterials(email: string): Promise<AllMaterials> {
  const [staticMaterials, packageMaterials, mediaMaterials, extraMaterials, viewer] = await Promise.all([
    Promise.all(STATIC_MATERIALS.map(async (m) => ({ ...m, body: await readKitFile(m.downloadHref) }))),
    buildPackageMaterials(email),
    buildMediaMaterials(email),
    buildExtraMaterials(email),
    resolveViewer(email),
  ]);
  const materials: KitMaterialItem[] = [
    ...staticMaterials,
    ...extraMaterials.filter((m) => m.group === "company" || m.group === "sales"),
    ...packageMaterials,
    ...mediaMaterials,
    ...extraMaterials.filter((m) => m.group === "finder" || m.group === "wiki"),
  ];
  return { materials, sender: { company: viewer?.sender?.company ?? null, prefecture: viewer?.sender?.prefecture ?? null } };
}

/** 画面の「AIをアドアーチ仕様にする」と同じ束ね方（設定文＋材料） */
export function combineMaterials(items: KitMaterialItem[], sender: AllMaterials["sender"]): string {
  const date = new Date().toISOString().slice(0, 10);
  const head = buildPreamble({ company: sender.company, prefecture: sender.prefecture, labels: items.map((m) => m.label), date });
  return [head, ...items.map((m) => m.body)].join("\n\n\n<!-- ======================== 次の材料 ======================== -->\n\n\n");
}
