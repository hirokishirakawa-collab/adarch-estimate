import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PackageForm, emptyPackageValues } from "@/components/packages/package-form";

export const metadata = { title: "パッケージを起案 | Ad-Arch" };

export default async function NewPackagePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const [me, bases] = await Promise.all([
    db.user.findUnique({ where: { email: session.user.email }, select: { role: true } }),
    db.salesPackage.findMany({ where: { status: { in: ["ACTIVE", "PROPOSED"] } }, select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="px-6 py-6 space-y-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/packages" className="hover:text-zinc-800">パッケージ</Link>
        <span>/</span>
        <span className="text-zinc-400">{isAdmin ? "新規作成" : "起案"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
          <Package className="text-orange-600" style={{ width: "1rem", height: "1rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{isAdmin ? "パッケージを作る" : "パッケージを起案する"}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isAdmin
              ? "中身・価格・分担・営業文・規定を決めて「稼働中」にすると、全員が同じ形で売れます。"
              : "「こういう売り物があれば売れる」を形にして出してください。一言のアイデアからAIが下書きを作ります。本部が承認すると稼働中になります。"}
          </p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <PackageForm initial={emptyPackageValues()} isAdmin={isAdmin} mode="create" basePackages={bases} />
      </div>
    </div>
  );
}
