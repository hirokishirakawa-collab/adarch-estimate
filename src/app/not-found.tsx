import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a10] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(217,170,75,0.06)_0%,transparent_70%)]" />
      <div className="relative text-center space-y-6">
        <p className="text-7xl font-bold text-amber-500/80">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white/90">
            ページが見つかりません
          </h1>
          <p className="text-sm text-white/40">
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
