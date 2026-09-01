import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PackageForm, type PackageFormValues } from "@/components/packages/package-form";
import { parseDeliverables, parseDocs, parseFulfillment, parseOptions } from "@/lib/packages/types";

export default async function EditPackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const { slug } = await params;
  const [me, pkg, bases] = await Promise.all([
    db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } }),
    db.salesPackage.findUnique({ where: { slug } }),
    db.salesPackage.findMany({ where: { status: { in: ["ACTIVE", "PROPOSED"] }, NOT: { slug } }, select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!pkg || !me) notFound();
  const isAdmin = me.role === "ADMIN";
  const canEdit = isAdmin || (pkg.proposedById === me.id && pkg.status === "PROPOSED");
  if (!canEdit) redirect(`/dashboard/packages/${slug}`);

  const initial: PackageFormValues = {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    tagline: pkg.tagline ?? "",
    category: pkg.category,
    targetIndustries: pkg.targetIndustries.join("、"),
    painPoints: pkg.painPoints ?? "",
    summary: pkg.summary ?? "",
    deliverables: parseDeliverables(pkg.deliverables),
    leadTime: pkg.leadTime ?? "",
    options: parseOptions(pkg.options),
    priceType: pkg.priceType,
    initialPrice: pkg.initialPrice != null ? String(pkg.initialPrice) : "",
    monthlyPrice: pkg.monthlyPrice != null ? String(pkg.monthlyPrice) : "",
    priceNote: pkg.priceNote ?? "",
    fulfillment: parseFulfillment(pkg.fulfillment),
    pitchText: pkg.pitchText ?? "",
    talkTrack: pkg.talkTrack ?? "",
    rules: pkg.rules ?? "",
    caseStudies: pkg.caseStudies ?? "",
    docs: parseDocs(pkg.docs),
    proposalNote: pkg.proposalNote ?? "",
    status: pkg.status,
    imageUrl: pkg.imageUrl ?? "",
    calculator: pkg.calculator ?? "",
  };

  return (
    <div className="px-6 py-6 space-y-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/packages" className="hover:text-zinc-800">パッケージ</Link>
        <span>/</span>
        <Link href={`/dashboard/packages/${pkg.slug}`} className="hover:text-zinc-800">{pkg.name}</Link>
        <span>/</span>
        <span className="text-zinc-400">編集</span>
      </div>
      <h2 className="text-lg font-bold text-zinc-900">{pkg.name} を編集</h2>
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <PackageForm initial={initial} isAdmin={isAdmin} mode="edit" basePackages={bases} />
      </div>
    </div>
  );
}
