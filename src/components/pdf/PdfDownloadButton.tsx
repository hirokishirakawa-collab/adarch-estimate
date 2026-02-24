"use client";

import dynamic from "next/dynamic";
import type { SimulatorPdfData } from "./SimulatorPdf";

export interface PdfDownloadButtonProps {
  data: SimulatorPdfData;
  fileName: string;
}

// @react-pdf/renderer はブラウザ専用 → SSR 無効で動的 import
// PDFDownloadLink は <a> タグを出力するため、子要素に <button> を置くと
// HTML 仕様違反になりクリックが動作しない → <span> で代替する
const PdfLinkInner = dynamic(
  async () => {
    const { PDFDownloadLink } = await import("@react-pdf/renderer");
    const { SimulatorPdfDocument } = await import("./SimulatorPdf");

    function PdfLinkComponent({ data, fileName }: PdfDownloadButtonProps) {
      return (
        <PDFDownloadLink
          document={<SimulatorPdfDocument data={data} />}
          fileName={fileName}
          style={{ display: "block", width: "100%", textDecoration: "none" }}
        >
          {({ loading, error }: { loading: boolean; error: Error | null }) => (
            <span
              className={[
                "w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors",
                "flex items-center justify-center gap-1.5 cursor-pointer select-none",
                error
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : loading
                  ? "bg-blue-400 text-white cursor-wait"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
              ].join(" ")}
            >
              {error ? "PDF生成エラー（詳細はコンソール確認）" : loading ? "PDF生成中..." : "PDF出力"}
            </span>
          )}
        </PDFDownloadLink>
      );
    }
    return PdfLinkComponent;
  },
  {
    ssr: false,
    loading: () => (
      <span className="w-full py-2.5 px-4 bg-zinc-100 text-zinc-400 text-xs font-semibold rounded-lg flex items-center justify-center">
        読み込み中...
      </span>
    ),
  }
);

export function PdfDownloadButton(props: PdfDownloadButtonProps) {
  return <PdfLinkInner {...props} />;
}
