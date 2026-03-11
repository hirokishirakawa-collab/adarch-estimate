"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f9fafb",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: "3.75rem",
                fontWeight: "bold",
                color: "#e5e7eb",
                margin: 0,
              }}
            >
              500
            </p>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#1f2937",
                marginTop: "1rem",
              }}
            >
              システムエラーが発生しました
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
              しばらく経ってからもう一度お試しください。
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: "1.5rem",
                padding: "0.5rem 1rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                backgroundColor: "white",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              もう一度試す
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
