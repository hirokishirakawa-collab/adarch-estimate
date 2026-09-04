import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { Palette, Download, FileText, Presentation, Info } from "lucide-react";
import { BrandKitPicker, type KitMaterial } from "./BrandKitPicker";
import { buildPackageMaterials, buildMediaMaterials, resolveViewer } from "@/lib/brand-kit/materials";

export const metadata = {
  title: "ブランドキット | Ad Arch OS",
};

// 配布物は public/downloads/kit/ に日付つきで置く。差し替えたらここのファイル名と版を更新する
const KIT_DIR = path.join(process.cwd(), "public", "downloads", "kit");

const MATERIALS: Omit<KitMaterial, "body">[] = [
  {
    id: "brand-rules",
    label: "ブランドの決まり（資料の型）",
    note: "色・書体・写真・組み方。AIに貼ってから指示文を送る",
    version: "2026-09-04版",
    downloadHref: "/downloads/kit/brand-rules_2026-09-04.md",
    group: "static",
  },
];

const FILES = [
  {
    label: "TVer広告 エリア別網羅プラン（配布用テンプレ）",
    note: "19枚。表紙の写真・実績3枠・貴社ロゴを差し替えるだけで使える。差し替え手順はスライドのノートに記載",
    version: "2026年9月",
    items: [
      { kind: "PPTX", href: "/downloads/kit/tver-area-plan-template_2026-09.pptx", size: "1.9 MB", icon: Presentation },
      { kind: "PDF", href: "/downloads/kit/tver-area-plan-template_2026-09.pdf", size: "0.9 MB", icon: FileText },
    ],
  },
];

async function readKitFile(href: string): Promise<string> {
  const file = path.join(KIT_DIR, path.basename(href));
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "（ファイルが見つかりません。本部にお知らせください）";
  }
}

export default async function BrandKitPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email ?? "";
  const [staticMaterials, packageMaterials, mediaMaterials, viewer] = await Promise.all([
    Promise.all(MATERIALS.map(async (m) => ({ ...m, body: await readKitFile(m.downloadHref) }))),
    buildPackageMaterials(email),
    buildMediaMaterials(email),
    resolveViewer(email),
  ]);
  const materials: KitMaterial[] = [...staticMaterials, ...packageMaterials, ...mediaMaterials];
  const sender = { company: viewer?.sender?.company ?? null, prefecture: viewer?.sender?.prefecture ?? null };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <Palette className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">ブランドキット</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            材料を選んで持っていくと、お使いのAIがアドアーチグループ仕様になります。メニュー別・媒体別の材料は、開くたびにOSの台帳・シミュレーターの料金・貴社の拠点・グループの実データから組み直します
          </p>
        </div>
      </div>

      {/* 使い方 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
          <div className="text-sm text-zinc-700 leading-relaxed space-y-1">
            <p>
              <strong>1.</strong> 使う材料にチェックを入れる。
              <strong className="ml-2">2.</strong> 下の「AIをアドアーチ仕様にする」でコピーし、お使いのAI（Claude / ChatGPT / Gemini）に貼る。
              <strong className="ml-2">3.</strong> 材料の末尾にある「指示文」のどれかを送る。出てきた文面をテンプレの資料に入れる。
            </p>
            <p className="text-xs text-zinc-500">
              コピーの冒頭には「AIへの指示」（差出人・数字の扱い・言ってはいけないこと・見た目の決まり）が自動で付きます。数字・価格の正本は Ad Arch OS です。使う直前にここから取り直してください。
            </p>
          </div>
        </div>
      </div>

      {/* AIに貼る材料 */}
      <BrandKitPicker materials={materials} sender={sender} />

      {/* ダウンロード */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <Download className="w-4 h-4 text-zinc-500" />
          テンプレートのダウンロード
        </h3>
        {FILES.map((f) => (
          <div key={f.label} className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-900">{f.label}</p>
              <p className="text-xs text-zinc-500 mt-1">{f.note}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{f.version}　／　書体 IBM Plex Sans JP（無料）。入っていないPCでは代替書体になるため、外に出すときはPDFを併送</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {f.items.map((it) => (
                <a
                  key={it.kind}
                  href={it.href}
                  download
                  className={[
                    "inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors",
                    it.kind === "PPTX"
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <it.icon className="w-4 h-4" />
                  {it.kind}
                  <span className="font-normal opacity-70">{it.size}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 決まりの要点（ページを開いた瞬間に見える版） */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <p className="text-xs font-bold text-zinc-500 tracking-wider mb-3">要点だけ</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["色", "白・薄グレー・墨の3色。橙は「合図」で1ページ1〜2か所。見出しや帯を橙で塗らない"],
            ["書体", "IBM Plex Sans JP。見出し600・本文400。極太は使わない"],
            ["写真", "原色のまま。入れ替えるのは表紙と実績3枠だけ。文字入り画像を表紙に使わない"],
            ["ロゴ", "自社ロゴは点線の枠に原色で。本部のロゴは消さない・色を変えない"],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-zinc-900 pt-2">
              <p className="text-xs font-bold text-zinc-900">{k}</p>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
