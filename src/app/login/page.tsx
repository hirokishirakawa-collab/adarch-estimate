import { signIn } from "@/lib/auth";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left: Visual / Branding */}
      <div className="flex-1 bg-[#f5f0eb] flex items-center justify-center relative overflow-hidden min-h-[40vh] md:min-h-screen">
        <div className="relative z-10 px-10 py-16 md:px-16">
          {/* Logo */}
          <div className="mb-12">
            <Image
              src="/logo-adarch.png"
              alt="Ad Arch Group"
              width={220}
              height={44}
              className="h-9 w-auto"
            />
          </div>

          {/* Tagline */}
          <h1 className="text-[40px] md:text-[48px] font-black text-zinc-900 leading-[1.1] tracking-tight">
            Frame<br />
            <span className="font-light italic tracking-normal">the future.</span>
          </h1>

          <p className="mt-6 text-[13px] text-zinc-400 tracking-[4px] uppercase">
            Video Production & Advertising
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="w-full md:w-[460px] bg-white flex flex-col items-center justify-center px-10 py-16 md:py-0 border-l border-[#e8e0d8]">
        <div className="w-full max-w-[340px] flex flex-col items-start justify-center md:min-h-screen md:py-20">
          {/* OS Label */}
          <p className="text-[11px] font-semibold tracking-[3px] uppercase text-amber-700/60 mb-10">
            GROUP OS
          </p>

          {/* Heading */}
          <h2 className="text-[24px] font-bold text-zinc-900 mb-2">ログイン</h2>
          <p className="text-[14px] text-zinc-400 mb-10 leading-relaxed">
            Googleアカウントでグループ<br />OSにアクセスしましょう
          </p>

          {/* Google sign-in */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white hover:bg-zinc-800 font-semibold py-3.5 px-5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg text-sm"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google でログイン
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <span className="flex-1 h-px bg-zinc-200" />
            <span className="text-[10px] text-zinc-300 tracking-widest">INFO</span>
            <span className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* Domain note */}
          <div className="text-center text-[12px] text-zinc-400 bg-zinc-50 py-3 px-4 rounded-lg">
            <strong className="text-zinc-500">@adarch.co.jp</strong> のみ許可
          </div>
        </div>

          {/* Footer */}
          <p className="text-[11px] text-zinc-300 tracking-wider mt-16">
            Ad Arch Group &copy; 2026
          </p>
      </div>
    </div>
  );
}
