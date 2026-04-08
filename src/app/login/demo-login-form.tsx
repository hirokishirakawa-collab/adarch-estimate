"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function DemoLoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("demo", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setIsLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <input
        name="email"
        type="email"
        placeholder="メールアドレス"
        required
        className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700/50"
      />
      <input
        name="password"
        type="password"
        placeholder="パスワード"
        required
        className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700/50"
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-semibold py-3.5 px-5 rounded-xl transition-all text-sm disabled:opacity-50"
      >
        {isLoading ? "ログイン中..." : "メールでログイン"}
      </button>
    </form>
  );
}
