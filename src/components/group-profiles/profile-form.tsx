"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { SNS_PLATFORMS, PREFECTURES, GENRE_OPTIONS } from "@/lib/constants/group-profile";

// ---------------------------------------------------------------
// 型
// ---------------------------------------------------------------
interface ProfileData {
  id: string;
  name: string;
  ownerName: string;
  genre: string | null;
  specialty: string | null;
  workHistory: string | null;
  prefecture: string | null;
  bio: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  lineId: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
}

interface ProfileFormProps {
  profile: ProfileData;
  action: (prev: { error?: string; success?: boolean } | null, formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  backHref: string;
  onDelete?: () => Promise<{ error?: string; success?: boolean }>;
}

// ---------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------
const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 " +
  "bg-white text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";

const labelCls = "block text-xs font-semibold text-zinc-600 mb-1";

// ---------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------
export function ProfileForm({ profile, action, backHref, onDelete }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const router = useRouter();

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm("プロフィール情報をクリアしますか？企業名・代表者名は残ります。")) return;
    const result = await onDelete();
    if (result?.success) router.push("/dashboard/group-profiles");
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          戻る
        </Link>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              クリア
            </button>
          )}
        </div>
      </div>

      {/* 企業情報（読み取り専用） */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-bold text-zinc-900">{profile.ownerName}</p>
        <p className="text-xs text-zinc-500">{profile.name}</p>
      </div>

      {/* フォーム */}
      <form action={formAction} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
        {/* ジャンル */}
        <div>
          <label className={labelCls}>ジャンル</label>
          <select
            name="genre"
            defaultValue={profile.genre ?? ""}
            disabled={isPending}
            className={inputCls}
          >
            <option value="">選択してください</option>
            {GENRE_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-400 mt-1">あなたの主な活動領域を選んでください</p>
        </div>

        {/* 都道府県 */}
        <div>
          <label className={labelCls}>都道府県</label>
          <select
            name="prefecture"
            defaultValue={profile.prefecture ?? ""}
            disabled={isPending}
            className={inputCls}
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
        </div>

        {/* 自己紹介 */}
        <div>
          <label className={labelCls}>自己紹介</label>
          <textarea
            name="bio"
            defaultValue={profile.bio ?? ""}
            placeholder="自己紹介を入力してください（趣味、得意分野、メッセージなど）"
            rows={3}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        {/* 得意な仕事 */}
        <div>
          <label className={labelCls}>得意な仕事</label>
          <textarea
            name="specialty"
            defaultValue={profile.specialty ?? ""}
            placeholder="例: 企業VP制作、SNS広告運用、イベント映像、不動産業界の営業 など"
            rows={3}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        {/* これまでの仕事 */}
        <div>
          <label className={labelCls}>これまでの仕事</label>
          <textarea
            name="workHistory"
            defaultValue={profile.workHistory ?? ""}
            placeholder="例: 2020年〜映像制作会社で企業VP担当、2023年〜独立してAd-Archに加盟 など"
            rows={3}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        {/* SNS リンク */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            SNS / リンク
          </h3>
          <div className="space-y-3">
            {SNS_PLATFORMS.map((platform) => (
              <div key={platform.key}>
                <label className={labelCls}>{platform.label}</label>
                <input
                  name={platform.key}
                  type={platform.key === "lineId" ? "text" : "url"}
                  defaultValue={(profile[platform.key as keyof ProfileData] as string) ?? ""}
                  placeholder={platform.placeholder}
                  disabled={isPending}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 送信 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            保存する
          </button>
          {state?.success && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              保存しました
            </span>
          )}
          {state?.error && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {state.error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
