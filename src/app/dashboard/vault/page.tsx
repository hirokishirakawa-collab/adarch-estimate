import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HardDriveDownload, ShieldCheck, Apple, Monitor, CircleCheck, TriangleAlert, Info } from "lucide-react";

export const metadata = {
  title: "AdArch Vault | Ad Arch OS",
};

const VERSION = "0.1.0";

const downloads = [
  {
    os: "macOS",
    icon: Apple,
    file: "/downloads/vault/AdArch-Vault-macos.zip",
    note: "Apple Silicon / Intel 共通",
    size: "3.1 MB",
    // Mac は最も使われるので、いちばん目に入る配色にする
    button: "bg-zinc-900 hover:bg-zinc-800",
    ring: "hover:border-zinc-400",
    badge: "bg-zinc-100 text-zinc-700",
  },
  {
    os: "Windows",
    icon: Monitor,
    file: "/downloads/vault/vault-windows-x64.exe",
    note: "通常はこちら（Intel / AMD）",
    size: "10 MB",
    button: "bg-blue-600 hover:bg-blue-700",
    ring: "hover:border-blue-400",
    badge: "bg-blue-50 text-blue-700",
  },
  {
    os: "Windows (ARM)",
    icon: Monitor,
    file: "/downloads/vault/vault-windows-arm64.exe",
    note: "Snapdragon 搭載機など",
    size: "6.7 MB",
    button: "bg-blue-500 hover:bg-blue-600",
    ring: "hover:border-blue-300",
    badge: "bg-blue-50 text-blue-600",
  },
];

export default async function VaultPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <ShieldCheck className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">AdArch Vault</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            撮影素材を正しくコピーし、記録を残すためのグループ公式ツール（v{VERSION}）
          </p>
        </div>
      </div>

      {/* 何をするものか */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <p className="text-sm text-zinc-700 leading-relaxed">
          カメラのカードから複数の保存先へ<strong>同時にコピーし、書き込んだ内容をディスクから読み返して検証</strong>します。
          コピー元は1回しか読まないので、保存先が2台でもカードへの負担は変わりません。
        </p>
        <p className="text-sm text-zinc-700 leading-relaxed mt-3">
          転送のたびに、<strong>いつ・誰が・どのPCから・どのドライブへ・何を入れたか</strong>を記録した英語のログを、
          保存先それぞれに残します。クライアントから素材の完全性を問われた際、そのまま提出できる証跡になります。
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            "1つのコピー元から複数の保存先へ同時コピー",
            "キャッシュを迂回して実ディスクから読み返して検証",
            "撮影カードは保存先に選べない（上書き事故の防止）",
            "中断しても再開でき、壊れたファイルだけ書き直す",
            "保管中の素材を定期的に読み直して劣化を検出",
            "Mac と Windows で記録の相互運用が可能",
          ].map((t) => (
            <div key={t} className="flex items-start gap-2">
              <CircleCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-xs text-zinc-600">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ダウンロード */}
      <div>
        <h3 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-1.5">
          <HardDriveDownload className="w-4 h-4 text-zinc-500" />
          ダウンロード
        </h3>
        {/* ブラウザのダウンロード警告について。
            これは Chrome 等の Safe Browsing によるもので、Apple の公証とは別物。
            公証は「Mac でアプリを開くとき」に効くもので、この警告は消さない。 */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-900 leading-relaxed">
            <strong>ダウンロード時に「不審なダウンロードをブロックしました」と出た場合</strong>
            <br />
            ファイルに問題があるわけではなく、配布を始めたばかりで実績が少ないためにブラウザが警告を出しています。
            ダウンロード欄の<strong>「保存」または「継続」</strong>を選んでください。ご利用が進むにつれて表示されなくなります。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {downloads.map((d) => (
            <div
              key={d.file}
              className={`flex flex-col bg-white border border-zinc-200 rounded-xl p-4 transition-all hover:shadow-md ${d.ring}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <d.icon className="w-4 h-4 text-zinc-600" />
                  <span className="text-sm font-bold text-zinc-900">{d.os}</span>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${d.badge}`}>
                  {d.size}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5 mb-3 flex-1">{d.note}</p>
              <a
                href={d.file}
                download
                className={`flex items-center justify-center gap-1.5 w-full ${d.button} text-white text-sm font-bold rounded-lg py-2.5 transition-colors shadow-sm`}
              >
                <HardDriveDownload className="w-4 h-4" />
                ダウンロード
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* 導入手順 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Apple className="w-4 h-4 text-zinc-600" />
            <h3 className="text-sm font-bold text-zinc-900">Mac での導入</h3>
          </div>
          <ol className="space-y-2 text-xs text-zinc-600 list-decimal list-inside leading-relaxed">
            <li>zip をダウンロードして展開します</li>
            <li>
              <strong>AdArch Vault.app</strong> を「アプリケーション」フォルダに入れます
            </li>
            <li>ダブルクリックで起動します</li>
          </ol>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-zinc-600" />
            <h3 className="text-sm font-bold text-zinc-900">Windows での導入</h3>
          </div>
          <ol className="space-y-2 text-xs text-zinc-600 list-decimal list-inside leading-relaxed">
            <li>exe をダウンロードします</li>
            <li>
              ファイルを<strong>右クリック → プロパティ</strong>を開きます
            </li>
            <li>
              下部の「セキュリティ」にある<strong>「許可する」にチェック</strong>を入れて OK
            </li>
            <li>ダブルクリックで起動します</li>
          </ol>
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              手順3を省くと「Windows によって PC が保護されました」という警告が出ます。
              その場合は「詳細情報」→「実行」で進めます。
            </p>
          </div>
        </div>
      </div>

      {/* 最初に1回だけ */}
      <div className="bg-zinc-900 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-2">最初に1回だけ、動作確認をお願いします</h3>
        <p className="text-xs text-zinc-300 leading-relaxed">
          素材を預かる道具なので、お使いの環境で正しく動くことを確かめてから本番でお使いください。
        </p>
        <ol className="mt-3 space-y-2 text-xs text-zinc-300 list-decimal list-inside leading-relaxed">
          <li>
            アプリを起動し、手元のカードの<strong>小さめのフォルダを1回転送</strong>してください。
            「すべての保存先で、全ファイルの一致を確認しました」と出れば正常です
          </li>
          <li>
            うまく動かない場合は、ターミナル（Windows はコマンドプロンプト）で
            <code className="mx-1 px-1.5 py-0.5 bg-zinc-800 rounded text-amber-300 font-mono text-[11px]">
              vault selftest
            </code>
            を実行し、その結果を本部までお送りください
          </li>
        </ol>
      </div>

      <p className="text-[11px] text-zinc-400">
        グループ内でのご利用に限ります。外部への配布・転売はご遠慮ください。
      </p>
    </div>
  );
}
