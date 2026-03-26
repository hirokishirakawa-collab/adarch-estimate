"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="text-center space-y-6">
        {/* Error icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-zinc-800">
            エラーが発生しました
          </h1>
          <p className="text-sm text-zinc-500">
            しばらく経ってからもう一度お試しください。
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="inline-flex items-center px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          もう一度試す
        </button>
      </div>
    </div>
  );
}
