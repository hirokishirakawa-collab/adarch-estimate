"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

interface Props {
  simulatorName: string;
  totalAmount: number;
  conditions?: string[];
  notes?: string;
  disabled?: boolean;
}

export function SimulatorPDFButton({
  simulatorName,
  totalAmount,
  conditions,
  notes,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/simulator/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatorName, totalAmount, conditions, notes }),
      });
      if (!res.ok) throw new Error("PDF生成に失敗しました");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimate_${simulatorName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF出力に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileText className="w-3.5 h-3.5" />
      )}
      {loading ? "PDF生成中..." : "PDF概算見積"}
    </button>
  );
}
