import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <h1 className="text-xl font-semibold text-gray-800">
          ページが見つかりません
        </h1>
        <p className="text-sm text-gray-500">
          URLが正しいかご確認ください。
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">ダッシュボードへ戻る</Link>
        </Button>
      </div>
    </div>
  );
}
