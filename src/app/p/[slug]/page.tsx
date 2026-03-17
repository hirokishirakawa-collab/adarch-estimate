import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicProposalView } from "@/components/proposals/public-proposal-view";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const proposal = await db.proposal.findUnique({
    where: { slug },
    select: { title: true, companyName: true, isPublished: true },
  });

  if (!proposal || !proposal.isPublished) {
    return { title: "提案書" };
  }

  return {
    title: proposal.title || `${proposal.companyName} 提案書`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicProposalPage({ params }: Props) {
  const { slug } = await params;

  const proposal = await db.proposal.findUnique({
    where: { slug },
    select: {
      id: true,
      companyName: true,
      title: true,
      content: true,
      isPublished: true,
      publishedAt: true,
    },
  });

  if (!proposal || !proposal.isPublished) {
    notFound();
  }

  return <PublicProposalView proposal={proposal} slug={slug} />;
}
