"use client";

import { useState, useTransition } from "react";
import { registerMailTrackingText } from "@/lib/actions/mail-tracking";

/** MailSuite の通知の件名を貼って、開封・クリックを登録する（AIを使わない人向け） */
export function MailTrackingForm() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-zinc-700">
        {open ? "▼" : "▶"} MailSuiteの開封・クリックを登録する
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            MailSuiteを入れている方は、Gmailに届く通知の件名を1行ずつ貼ってください。
            例：<code className="text-zinc-700">info@example.co.jpが「◯◯市の方だけに…」を読みました</code>
            <br />
            相手がメールアドレスで出ている通知だけ、送った先に照合して登録します。AI連携を使っている方は「MailSuiteの履歴を登録して」と頼んでも入ります。開封は目安です（相手側の自動チェックでも開封になります）。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full text-xs border border-zinc-200 rounded px-2 py-1.5"
            placeholder="通知の件名を貼る"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending || !text.trim()}
              onClick={() =>
                start(async () => {
                  const res = await registerMailTrackingText(text);
                  if (res.error) { setMessage(res.error); return; }
                  const r = res.result!;
                  setMessage(
                    `登録 ${r.recorded}件・登録済み ${r.duplicated}件` +
                      (r.skipped.length ? `・照合できず ${r.skipped.length}件` : "") +
                      (res.unreadable ? `・読み取れない行 ${res.unreadable}` : ""),
                  );
                  if (r.recorded > 0) setText("");
                })
              }
              className="text-xs px-3 py-1.5 bg-zinc-800 text-white rounded disabled:opacity-40"
            >
              {pending ? "登録中…" : "登録する"}
            </button>
            {message && <span className="text-[11px] text-zinc-600">{message}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
