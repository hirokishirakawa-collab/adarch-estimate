"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  body: string;
}

export function WikiArticleContent({ body }: Props) {
  return (
    <div className="prose prose-sm max-w-none prose-zinc prose-headings:font-bold prose-a:text-blue-600 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900">
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  );
}
