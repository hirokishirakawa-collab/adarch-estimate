import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-gray-200">403</p>
        <h1 className="text-xl font-semibold text-gray-800">
          アクセス権限がありません
        </h1>
        <p className="text-sm text-gray-500">
          このページを表示するには上位のロールが必要です。
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">ダッシュボードへ戻る</Link>
        </Button>
      </div>
    </div>
  );
}
