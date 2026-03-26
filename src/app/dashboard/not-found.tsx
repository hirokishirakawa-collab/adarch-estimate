import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="text-center space-y-6">
        <p className="text-7xl font-bold text-amber-500/80">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-zinc-800">
            ページが見つかりません
          </h1>
          <p className="text-sm text-zinc-500">
            URLが正しいかご確認ください。
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}
