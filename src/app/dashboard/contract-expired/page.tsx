import { FileWarning } from "lucide-react";

export default function ContractExpiredPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FileWarning className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 mb-3">
          契約期間が満了しました
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          ご契約の期間が満了したため、Ad Arch OSの機能をご利用いただけません。
          <br />
          契約の更新については、本部までお問い合わせください。
        </p>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-zinc-600">お問い合わせ先</p>
          <p className="text-sm text-zinc-800">Ad Arch株式会社</p>
          <p className="text-sm text-zinc-500">
            メール:{" "}
            <a href="mailto:hiroki.shirakawa@adarch.co.jp" className="text-indigo-600 hover:underline">
              hiroki.shirakawa@adarch.co.jp
            </a>
          </p>
          <p className="text-sm text-zinc-500">
            Google Chat: 各社スペースからお問い合わせください
          </p>
        </div>
      </div>
    </div>
  );
}
