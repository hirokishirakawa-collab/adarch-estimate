import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft } from "lucide-react";
import { CourseEditor } from "./course-editor";
import { LessonSection } from "./lesson-section";
import { TestSection } from "./test-section";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default async function AdminCourseEditPage({ params }: PageProps) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await db.user.findUnique({ where: { email: session.user.email! } });
  if (!user || user.role !== "ADMIN") redirect("/dashboard/learning");

  const course = await db.learningCourse.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { sortOrder: "asc" } },
      tests: {
        orderBy: { createdAt: "asc" },
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!course) notFound();

  // questions の choices を parse
  const tests = course.tests.map((t) => ({
    ...t,
    questions: t.questions.map((q) => ({
      ...q,
      choices: JSON.parse(q.choices) as string[],
    })),
  }));

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto w-full">
      <Link
        href="/dashboard/admin/learning"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        コース管理
      </Link>

      <CourseEditor course={course} />

      <div className="mt-8">
        <LessonSection courseId={course.id} lessons={course.lessons} />
      </div>

      <div className="mt-8">
        <TestSection courseId={course.id} tests={tests} />
      </div>
    </div>
  );
}
