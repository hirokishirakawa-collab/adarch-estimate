"use client";

import dynamic from "next/dynamic";
import type { SimulatorPdfData } from "./SimulatorPdf";

export interface PdfDownloadButtonProps {
  data: SimulatorPdfData;
  fileName: string;
}

// @react-pdf/renderer はブラウザ専用 → SSR 無効で動的 import
const PdfLinkInner = dynamic(
  () =>
    Promise.all([
      import("@react-pdf/renderer"),
      import("./SimulatorPdf"),
    ]).then(([{ PDFDownloadLink }, { SimulatorPdfDocument }]) => {
      function PdfLinkComponent({ data, fileName }: PdfDownloadButtonProps) {
        return (
          <PDFDownloadLink
            document={<SimulatorPdfDocument data={data} />}
            fileName={fileName}
          >
            {({ loading }: { loading: boolean }) => (
              <button
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loading ? "PDF生成中..." : "PDF出力"}
              </button>
            )}
          </PDFDownloadLink>
        );
      }
      return PdfLinkComponent;
    }),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        className="w-full py-2.5 px-4 bg-zinc-100 text-zinc-400 text-xs font-semibold rounded-lg"
      >
        読み込み中...
      </button>
    ),
  }
);

export function PdfDownloadButton(props: PdfDownloadButtonProps) {
  return <PdfLinkInner {...props} />;
}
