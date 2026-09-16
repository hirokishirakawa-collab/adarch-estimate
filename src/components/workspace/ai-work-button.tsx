"use client";

import { useRef, useState, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Copy, X, Check } from "lucide-react";
import { navigationForPath } from "@/lib/navigation/catalog";
import {
  buildAiWorkPrompt,
  type AiWorkContext,
} from "@/lib/navigation/ai-context";

export function AiWorkButton({
  context,
  connected,
  label = "AIで進める",
  secondary = false,
}: {
  context?: Partial<AiWorkContext>;
  connected?: boolean;
  label?: string;
  secondary?: boolean;
}) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState("");
  const titleId = useId();
  const prompt = buildAiWorkPrompt({
    label: navigationForPath(pathname).label,
    path: pathname,
    ...context,
  });
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus(
        "コピーしました。接続したClaude／ChatGPTの会話に貼り付けてください。",
      );
    } catch {
      text.current?.focus();
      text.current?.select();
      setStatus(
        "依頼文を選択しました。コピーして、接続したAIへ貼り付けてください。",
      );
    }
  }
  return (
    <>
      <button
        type="button"
        className={secondary ? "os-button-secondary" : "os-button-primary"}
        onClick={() => {
          setStatus("");
          dialog.current?.showModal();
        }}
      >
        <Sparkles size={16} aria-hidden />
        {label}
      </button>
      <dialog
        ref={dialog}
        className="os-ai-dialog"
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="os-dialog-head">
          <span className="os-eyebrow">AI WORKSPACE</span>
          <button
            type="button"
            aria-label="閉じる"
            className="os-icon-button"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id={titleId}>いつものAIで、続きを。</h2>
        <p className="os-description">
          対象を含む依頼文をコピーして、OSにつないだClaude／ChatGPTへ渡します。
        </p>
        {connected === false && (
          <p className="os-notice">
            AIの接続がまだありません。
            <Link
              href="/dashboard/ai-connect"
              onClick={() => dialog.current?.close()}
            >
              接続を設定する →
            </Link>
          </p>
        )}
        <label className="os-field">
          AIに渡す依頼文
          <textarea ref={text} readOnly value={prompt} rows={9} />
        </label>
        <button type="button" className="os-button-primary" onClick={copy}>
          {status ? <Check size={16} /> : <Copy size={16} />}依頼文をコピー
        </button>
        <p role="status" className="os-description">
          {status}
        </p>
        <div className="os-dialog-footer">
          <Link
            href="/dashboard/ai-connect"
            onClick={() => dialog.current?.close()}
          >
            AI接続を確認
          </Link>
          <span>コピーだけでは送信・記録されません</span>
        </div>
      </dialog>
    </>
  );
}
