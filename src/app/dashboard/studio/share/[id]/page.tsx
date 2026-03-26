import { db as prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: shareToken } = await params;

  // Find production by share token in metadata
  const productions = await prisma.production.findMany({
    where: {
      metadata: { path: ["shareToken"], equals: shareToken },
    },
    include: { studioClient: true },
  });

  const production = productions[0];
  if (!production) notFound();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="border-b pb-6 mb-8">
          <p className="text-xs text-zinc-400 tracking-widest uppercase mb-2">Ad Arch Studio</p>
          <h1 className="text-2xl font-bold text-zinc-900">{production.title}</h1>
          <p className="text-zinc-500 mt-1">{production.studioClient.name} · {production.month}</p>
        </div>

        {/* Content */}
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(production.content), {
            allowedTags: ["h1", "h2", "h3", "strong", "em", "li", "br", "div", "table", "tr", "td"],
            allowedAttributes: { "*": ["class"] },
          }) }}
        />

        {/* Footer */}
        <div className="border-t mt-12 pt-6 text-center text-xs text-zinc-400">
          <p>Powered by Ad Arch Studio</p>
        </div>
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-6 mb-2 text-zinc-900">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-8 mb-3 text-zinc-900 border-b pb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-zinc-900">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*$)/gm, '<li class="ml-4 text-zinc-700">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 text-zinc-700">$1. $2</li>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split("|").filter((c) => c.trim()).map((c) => `<td class="border px-3 py-1.5 text-sm">${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="w-full border-collapse border my-3">$&</table>')
    .replace(/\n\n/g, '<div class="my-3"></div>')
    .replace(/\n/g, "<br/>");
}
