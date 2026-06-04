"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function LeadExportButtons() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);

  async function handleExport(format: "csv" | "pdf") {
    setLoading(format);
    try {
      // 現在のフィルター条件を引き継ぐ
      const params = new URLSearchParams();
      params.set("format", format);
      const q = searchParams.get("q");
      const status = searchParams.get("status");
      const industry = searchParams.get("industry");
      const area = searchParams.get("area");
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (industry) params.set("industry", industry);
      if (area) params.set("area", area);

      const res = await fetch(`/api/leads/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `leads.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("エクスポートに失敗しました");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport("csv")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        {loading === "csv" ? "出力中..." : "CSV"}
      </button>
      <button
        onClick={() => handleExport("pdf")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        {loading === "pdf" ? "出力中..." : "PDF"}
      </button>
    </div>
  );
}
