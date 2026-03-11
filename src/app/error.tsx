"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-gray-200">500</p>
        <h1 className="text-xl font-semibold text-gray-800">
          エラーが発生しました
        </h1>
        <p className="text-sm text-gray-500">
          しばらく経ってからもう一度お試しください。
        </p>
        <Button variant="outline" onClick={() => reset()}>
          もう一度試す
        </Button>
      </div>
    </div>
  );
}
