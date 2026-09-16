"use client";

import { useRef, useState, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Copy, X, Check, Link2, ShieldCheck, ArrowRight } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const targetLabel = context?.label ?? navigationForPath(pathname).label;
  const prompt = buildAiWorkPrompt({
    label: navigationForPath(pathname).label,
    path: pathname,
    ...context,
  });
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setStatus(
        "コピーしました。接続したClaude／ChatGPTの会話に貼り付けてください。",
      );
    } catch {
      setCopied(false);
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
          setCopied(false);
          dialog.current?.showModal();
        }}
      >
        <Sparkles size={16} aria-hidden />
        {label}
      </button>
      <dialog
        ref={dialog}
        className={`os-ai-dialog os-ai-drawer ${copied ? "is-copied" : ""}`}
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="os-dialog-head">
          <span className="os-eyebrow"><Sparkles size={15} aria-hidden /> CONNECTED WORKSPACE</span>
          <button
            type="button"
            aria-label="閉じる"
            className="os-icon-button"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id={titleId}>この仕事を、AIへ。</h2>
        <p className="os-description">
          今見ている仕事を添えて、いつものClaude／ChatGPTへ。
        </p>
        <div className="os-ai-context-block">
          <p className="os-eyebrow">CONTEXT / 引き継ぐ対象</p>
          <div className="os-ai-context-row"><Link2 size={17} aria-hidden /><strong>{targetLabel}</strong></div>
          {context?.customerName && context.customerName !== targetLabel && <p className="os-ai-customer">顧客：{context.customerName}</p>}
          <div className="os-ai-scope"><ShieldCheck size={15} aria-hidden /><span>参照できる情報は、本人の閲覧権限に従います。</span></div>
        </div>
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
          <span className="os-eyebrow">REQUEST / AIに渡す依頼文</span>
          <textarea ref={text} readOnly value={prompt} rows={8} />
        </label>
        <button type="button" className="os-button-primary os-ai-copy" onClick={copy}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}{copied ? "依頼文をコピーしました" : "依頼文をコピー"}<ArrowRight size={16} aria-hidden />
        </button>
        <div className="os-ai-copy-line" aria-hidden />
        <p role="status" className="os-description os-copy-status">
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
