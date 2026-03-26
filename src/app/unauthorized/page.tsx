import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a10] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(217,170,75,0.06)_0%,transparent_70%)]" />
      <div className="relative text-center space-y-6">
        {/* Shield icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
        </div>
        <p className="text-5xl font-bold text-amber-500/80">403</p>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white/90">
            アクセス権限がありません
          </h1>
          <p className="text-sm text-white/40">
            このページを表示するには上位のロールが必要です。
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
