"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, Clock, Loader2, Video } from "lucide-react";
import type { ScreeningQuestion } from "@/lib/booking/slots";

// ----------------------------------------------------------------
// 公開予約ページ クライアント
//   STEP1 日時選択 → STEP2 申込フォーム → 完了
// ----------------------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const YOUBI = ["日", "月", "火", "水", "木", "金", "土"];

function jstParts(iso: string) {
  const t = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateKey: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    dateLabel: `${t.getUTCMonth() + 1}/${t.getUTCDate()}`,
    youbi: YOUBI[t.getUTCDay()],
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
    full: `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())}(${YOUBI[t.getUTCDay()]}) ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}

type Props = {
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  questions: ScreeningQuestion[];
  lineToken?: string | null;
};

export function BookingPageClient({
  slug,
  title,
  description,
  durationMinutes,
  questions,
  lineToken = null,
}: Props) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ startAt: string; meetUrl: string | null } | null>(null);

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    answers: {} as Record<string, string>,
  });

  const loadSlots = useCallback(async () => {
    setLoadError(null);
    setSlots(null);
    try {
      const res = await fetch(`/api/book/${slug}/slots`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "取得に失敗しました");
      setSlots(data.slots as string[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "空き枠の取得に失敗しました");
    }
  }, [slug]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const byDate = useMemo(() => {
    const map = new Map<string, { label: string; youbi: string; slots: string[] }>();
    for (const iso of slots ?? []) {
      const p = jstParts(iso);
      const entry = map.get(p.dateKey) ?? { label: p.dateLabel, youbi: p.youbi, slots: [] };
      entry.slots.push(iso);
      map.set(p.dateKey, entry);
    }
    return map;
  }, [slots]);

  const submit = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/book/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: selectedSlot,
          name: form.name,
          company: form.company,
          email: form.email,
          phone: form.phone,
          answers: form.answers,
          ...(lineToken ? { lineToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "SLOT_TAKEN") {
          setSelectedSlot(null);
          await loadSlots();
        }
        throw new Error(data.error ?? "予約に失敗しました");
      }
      setDone({ startAt: data.startAt, meetUrl: data.meetUrl ?? null });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "予約に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1.5 block text-sm font-medium text-zinc-700";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold tracking-widest text-blue-600">
            AD ARCH
          </p>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {durationMinutes}分
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-4 w-4" /> Google Meet
            </span>
          </div>
          {description && (
            <p className="mx-auto mt-4 max-w-lg whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
              {description}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {/* 完了画面 */}
          {done ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="mb-2 text-lg font-bold text-zinc-900">
                ご予約が確定しました
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600">
                {jstParts(done.startAt).full} 〜（日本時間）<br />
                確認メールとGoogleカレンダーの招待をお送りしました。
              </p>
              {done.meetUrl && (
                <p className="mt-4 text-sm">
                  <a
                    href={done.meetUrl}
                    className="font-medium text-blue-600 underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Meet 参加リンク
                  </a>
                </p>
              )}
            </div>
          ) : !selectedSlot ? (
            /* STEP1: 日時選択 */
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-900">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                ご希望の日時をお選びください
              </h2>
              {loadError ? (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadError}
                  <button
                    onClick={loadSlots}
                    className="ml-3 font-medium underline underline-offset-2"
                  >
                    再読み込み
                  </button>
                </div>
              ) : slots === null ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> 空き枠を確認しています…
                </div>
              ) : byDate.size === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-500">
                  現在ご案内できる枠がありません。お手数ですが後日改めてご確認ください。
                </p>
              ) : (
                <>
                  {/* 日付タブ */}
                  <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                    {[...byDate.entries()].map(([key, d]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedDate(key)}
                        className={`flex min-w-16 flex-col items-center rounded-xl border px-3 py-2 text-sm transition ${
                          (selectedDate ?? [...byDate.keys()][0]) === key
                            ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        <span>{d.label}</span>
                        <span className="text-xs text-zinc-400">({d.youbi})</span>
                      </button>
                    ))}
                  </div>
                  {/* 時間チップ */}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {(byDate.get(selectedDate ?? [...byDate.keys()][0])?.slots ?? []).map(
                      (iso) => (
                        <button
                          key={iso}
                          onClick={() => setSelectedSlot(iso)}
                          className="rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-800 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {jstParts(iso).time}
                        </button>
                      )
                    )}
                  </div>
                  <p className="mt-4 text-xs text-zinc-400">
                    表示はすべて日本時間です。
                  </p>
                </>
              )}
            </div>
          ) : (
            /* STEP2: 申込フォーム */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" /> 日時を選び直す
              </button>
              <div className="mb-6 rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                {jstParts(selectedSlot).full} 〜 {durationMinutes}分（日本時間）
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      お名前 <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      maxLength={100}
                      className={inputCls}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>会社名・屋号</label>
                    <input
                      maxLength={100}
                      className={inputCls}
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder="株式会社〇〇"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="email"
                      maxLength={255}
                      className={inputCls}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="taro@example.com"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>電話番号</label>
                    <input
                      maxLength={30}
                      className={inputCls}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="090-0000-0000"
                    />
                  </div>
                </div>

                {questions.map((q) => (
                  <div key={q.id}>
                    <label className={labelCls}>
                      {q.label}{" "}
                      {q.required && <span className="text-red-500">*</span>}
                    </label>
                    {q.type === "select" ? (
                      <select
                        required={q.required}
                        className={inputCls}
                        value={form.answers[q.id] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            answers: { ...form.answers, [q.id]: e.target.value },
                          })
                        }
                      >
                        <option value="">選択してください</option>
                        {(q.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : q.type === "textarea" ? (
                      <textarea
                        required={q.required}
                        rows={3}
                        maxLength={2000}
                        className={inputCls}
                        value={form.answers[q.id] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            answers: { ...form.answers, [q.id]: e.target.value },
                          })
                        }
                      />
                    ) : (
                      <input
                        required={q.required}
                        maxLength={500}
                        className={inputCls}
                        value={form.answers[q.id] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            answers: { ...form.answers, [q.id]: e.target.value },
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 予約を確定しています…
                  </span>
                ) : (
                  "この内容で予約する"
                )}
              </button>
              <p className="mt-3 text-center text-xs text-zinc-400">
                確定後、確認メールとGoogleカレンダー招待が届きます。
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Ad Arch株式会社
        </p>
      </div>
    </div>
  );
}
