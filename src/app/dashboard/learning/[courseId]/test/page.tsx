import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft } from "lucide-react";
import { TestRunner } from "./test-runner";

interface PageProps {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ testId?: string }>;
}

export default async function TestPage({ params, searchParams }: PageProps) {
  const { courseId } = await params;
  const { testId } = await searchParams;

  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!testId) notFound();

  const test = await db.learningTest.findUnique({
    where: { id: testId },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          question: true,
          choices: true,
          explanation: true,
          sortOrder: true,
        },
      },
    },
  });
  if (!test || test.courseId !== courseId) notFound();

  const questions = test.questions.map((q) => ({
    id: q.id,
    question: q.question,
    choices: JSON.parse(q.choices) as string[],
    explanation: q.explanation,
  }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href={`/dashboard/learning/${courseId}`}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        コースに戻る
      </Link>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h1 className="text-xl font-bold text-zinc-900">{test.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {questions.length}問 · 合格ライン {test.passingScore}% · 最大{test.maxAttempts}回受験可能
        </p>
      </div>

      <TestRunner
        testId={test.id}
        courseId={courseId}
        questions={questions}
        passingScore={test.passingScore}
      />
    </div>
  );
}
