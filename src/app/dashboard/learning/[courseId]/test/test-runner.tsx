"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitTest } from "@/lib/actions/learning";

interface Question {
  id: string;
  question: string;
  choices: string[];
}

interface Props {
  testId: string;
  courseId: string;
  questions: Question[];
  passingScore: number;
}

export function TestRunner({ testId, courseId, questions, passingScore }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(questions.length).fill(null)
  );
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correctAnswers: number[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allAnswered = answers.every((a) => a !== null);

  const handleSubmit = () => {
    if (!allAnswered) return;
    startTransition(async () => {
      try {
        const res = await submitTest(testId, answers as number[]);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  if (result) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <div className={`text-6xl mb-4 ${result.passed ? "" : ""}`}>
          {result.passed ? "🎉" : "📝"}
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">
          {result.passed ? "合格！" : "不合格"}
        </h2>
        <p className="text-lg mb-1">
          スコア: <span className={`font-bold ${result.passed ? "text-emerald-600" : "text-red-600"}`}>{result.score}%</span>
        </p>
        <p className="text-sm text-zinc-500 mb-6">
          合格ライン: {passingScore}%
        </p>

        {/* 正誤一覧 */}
        <div className="text-left space-y-3 mb-8">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === result.correctAnswers[i];
            return (
              <div key={q.id} className={`p-4 rounded-lg border ${isCorrect ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
                <p className="text-sm font-semibold text-zinc-800 mb-1">
                  {isCorrect ? "✓" : "✗"} Q{i + 1}. {q.question}
                </p>
                <p className="text-xs text-zinc-500">
                  あなたの回答: {q.choices[answers[i]!]}
                  {!isCorrect && <span className="text-emerald-600 ml-2">正解: {q.choices[result.correctAnswers[i]]}</span>}
                </p>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => router.push(`/dashboard/learning/${courseId}`)}
          className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
        >
          コースに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {questions.map((q, qi) => (
        <div key={q.id} className="bg-white rounded-xl border p-5">
          <p className="text-sm font-bold text-zinc-800 mb-3">
            Q{qi + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.choices.map((choice, ci) => (
              <button
                key={ci}
                onClick={() => {
                  const next = [...answers];
                  next[qi] = ci;
                  setAnswers(next);
                }}
                className={`w-full text-left px-4 py-3 text-sm rounded-lg border transition-all ${
                  answers[qi] === ci
                    ? "border-blue-500 bg-blue-50 text-blue-800 font-semibold"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {String.fromCharCode(65 + ci)}. {choice}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || isPending}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "採点中..." : "回答を提出する"}
        </button>
      </div>
    </div>
  );
}
