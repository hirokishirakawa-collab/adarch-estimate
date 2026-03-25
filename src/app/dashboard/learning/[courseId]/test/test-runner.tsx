"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitTest } from "@/lib/actions/learning";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

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
  const [currentIdx, setCurrentIdx] = useState(0);
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

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === questions.length;
  const q = questions[currentIdx];

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

  // Result screen
  if (result) {
    const correctCount = questions.filter((_, i) => answers[i] === result.correctAnswers[i]).length;

    return (
      <div className="space-y-6">
        {/* Score card */}
        <div className={`rounded-2xl p-8 text-center ${
          result.passed
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
            : "bg-gradient-to-br from-zinc-700 to-zinc-800"
        }`}>
          <div className="text-5xl mb-3">{result.passed ? "🎉" : "📝"}</div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {result.passed ? "合格おめでとうございます！" : "不合格"}
          </h2>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div>
              <div className="text-4xl font-bold text-white">{result.score}%</div>
              <div className="text-xs text-white/70 mt-1">スコア</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-4xl font-bold text-white">{correctCount}/{questions.length}</div>
              <div className="text-xs text-white/70 mt-1">正解数</div>
            </div>
          </div>
          <p className="text-xs text-white/60 mt-3">合格ライン: {passingScore}%</p>
        </div>

        {/* Review */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-zinc-700">回答の確認</h3>
          {questions.map((q, i) => {
            const isCorrect = answers[i] === result.correctAnswers[i];
            return (
              <div key={q.id} className={`rounded-xl border p-4 ${
                isCorrect ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  {isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <p className="text-sm font-semibold text-zinc-800">Q{i + 1}. {q.question}</p>
                </div>
                <div className="ml-6 space-y-1">
                  {q.choices.map((choice, ci) => {
                    const isUserAnswer = ci === answers[i];
                    const isCorrectAnswer = ci === result.correctAnswers[i];
                    let style = "text-xs text-zinc-500";
                    if (isCorrectAnswer) style = "text-xs font-bold text-emerald-700";
                    else if (isUserAnswer && !isCorrect) style = "text-xs text-red-600 line-through";
                    return (
                      <p key={ci} className={style}>
                        {String.fromCharCode(65 + ci)}. {choice}
                        {isCorrectAnswer && " ✓"}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => router.push(`/dashboard/learning/${courseId}`)}
          className="w-full py-3 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-colors"
        >
          コースに戻る
        </button>
      </div>
    );
  }

  // Question screen
  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500">
            {answeredCount}/{questions.length} 回答済み
          </span>
          <span className="text-xs text-zinc-400">
            Q{currentIdx + 1} / {questions.length}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question nav dots */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIdx(i)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
              i === currentIdx
                ? "bg-blue-600 text-white shadow-sm"
                : answers[i] !== null
                  ? "bg-blue-100 text-blue-700"
                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current question */}
      <div className="bg-white rounded-2xl border p-6">
        <p className="text-[15px] font-bold text-zinc-800 mb-5">
          <span className="text-blue-600">Q{currentIdx + 1}.</span> {q.question}
        </p>
        <div className="space-y-2.5">
          {q.choices.map((choice, ci) => (
            <button
              key={ci}
              onClick={() => {
                const next = [...answers];
                next[currentIdx] = ci;
                setAnswers(next);
              }}
              className={`w-full text-left px-5 py-3.5 text-sm rounded-xl border-2 transition-all ${
                answers[currentIdx] === ci
                  ? "border-blue-500 bg-blue-50 text-blue-800 font-semibold shadow-sm"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-3 text-xs font-bold ${
                answers[currentIdx] === ci
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-200 text-zinc-500"
              }`}>
                {String.fromCharCode(65 + ci)}
              </span>
              {choice}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" /> 前の問題
        </button>

        {currentIdx < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(currentIdx + 1)}
            className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
          >
            次の問題 <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isPending}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isPending ? "採点中..." : `回答を提出する (${answeredCount}/${questions.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
