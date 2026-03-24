"use client";

import ReactMarkdown from "react-markdown";
import { useState, type ComponentPropsWithoutRef } from "react";

interface Props {
  body: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 px-2 py-1 text-[10px] font-bold rounded-md bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function WikiArticleContent({ body }: Props) {
  return (
    <div
      className={[
        "prose prose-sm max-w-none",
        // headings
        "prose-headings:font-extrabold",
        "prose-h1:text-2xl prose-h1:bg-gradient-to-r prose-h1:from-violet-600 prose-h1:to-pink-500 prose-h1:bg-clip-text prose-h1:text-transparent prose-h1:pb-2",
        "prose-h2:text-lg prose-h2:text-zinc-800 prose-h2:border-l-4 prose-h2:border-violet-400 prose-h2:pl-3 prose-h2:py-1",
        "prose-h3:text-base prose-h3:text-violet-700",
        // body
        "prose-p:text-zinc-600 prose-p:leading-relaxed",
        "prose-strong:text-zinc-900",
        "prose-a:text-violet-600 prose-a:font-semibold prose-a:no-underline hover:prose-a:underline",
        // lists
        "prose-li:text-zinc-600 prose-li:marker:text-violet-400",
        // inline code
        "prose-code:bg-violet-50 prose-code:text-violet-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none",
        // blockquote
        "prose-blockquote:border-l-violet-400 prose-blockquote:bg-violet-50/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic",
        // table
        "prose-th:bg-zinc-800 prose-th:text-white prose-th:font-semibold prose-th:text-xs prose-th:py-2",
        "prose-td:text-xs prose-td:py-2",
        "prose-tr:border-zinc-200",
        // hr
        "prose-hr:border-zinc-200",
      ].join(" ")}
    >
      <ReactMarkdown
        components={{
          pre({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
            const codeEl = Array.isArray(children)
              ? children.find(
                  (c) => typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "code"
                )
              : children;
            const text =
              codeEl &&
              typeof codeEl === "object" &&
              "props" in codeEl &&
              typeof (codeEl as { props: { children?: string } }).props?.children === "string"
                ? (codeEl as { props: { children: string } }).props.children
                : "";
            return (
              <div className="relative group rounded-xl overflow-hidden my-4">
                <pre
                  className="!bg-zinc-900 !text-zinc-100 !text-xs !leading-relaxed !p-4 !rounded-xl overflow-x-auto scrollbar-thin"
                  {...props}
                >
                  {children}
                </pre>
                {text && <CopyButton text={text} />}
              </div>
            );
          },
          code({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="!bg-transparent !text-zinc-100 !p-0 !text-xs" {...props}>
                  {children}
                </code>
              );
            }
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
