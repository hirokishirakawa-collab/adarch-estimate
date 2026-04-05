"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save, ClipboardCheck, ChevronDown, ChevronRight } from "lucide-react";
import {
  createTest,
  updateTest,
  deleteTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "@/lib/actions/learning";

type Question = {
  id: string;
  testId: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  sortOrder: number;
};

type Test = {
  id: string;
  courseId: string;
  title: string;
  passingScore: number;
  maxAttempts: number;
  questions: Question[];
};

export function TestSection({ courseId, tests }: { courseId: string; tests: Test[] }) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-zinc-800">テスト</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          テスト追加
        </button>
      </div>

      {showCreate && (
        <CreateTestForm courseId={courseId} onDone={() => setShowCreate(false)} />
      )}

      <div className="space-y-3">
        {tests.length === 0 && !showCreate ? (
          <div className="bg-zinc-50 rounded-xl border border-dashed border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-500">テストがまだありません</p>
          </div>
        ) : (
          tests.map((test) => <TestRow key={test.id} test={test} />)
        )}
      </div>
    </section>
  );
}

function CreateTestForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createTest({ courseId, title: title.trim(), passingScore, maxAttempts });
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 mb-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-2 items-end">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="テスト名（例：媒体A 取扱テスト）"
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          required
        />
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">合格ライン%</label>
          <input
            type="number"
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            min={0}
            max={100}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 mb-0.5">最大受験回数</label>
          <input
            type="number"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            min={1}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
        >
          {isPending ? "追加中…" : "追加"}
        </button>
      </div>
    </form>
  );
}

function TestRow({ test }: { test: Test }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(test.title);
  const [passingScore, setPassingScore] = useState(test.passingScore);
  const [maxAttempts, setMaxAttempts] = useState(test.maxAttempts);
  const [showNewQ, setShowNewQ] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function onSave() {
    startSave(async () => {
      await updateTest(test.id, { title: title.trim(), passingScore, maxAttempts });
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm(`テスト「${test.title}」を削除しますか？\n問題と受験履歴も削除されます。`)) return;
    startDelete(async () => {
      await deleteTest(test.id);
    });
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
          <ClipboardCheck className="w-4 h-4 text-blue-600" />
        </div>
        {editing ? (
          <div className="flex-1 grid grid-cols-[1fr_80px_80px] gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="px-2 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-zinc-800 truncate">{test.title}</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {test.questions.length}問 · 合格{test.passingScore}% · 最大{test.maxAttempts}回
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
              >
                <Save className="w-3 h-3" />
                保存
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="px-2.5 py-1 text-[11px] font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors"
              >
                編集
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 問題一覧 */}
      {expanded && (
        <div className="border-t border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
          {test.questions.map((q, i) => (
            <QuestionRow key={q.id} question={q} index={i} />
          ))}
          {showNewQ ? (
            <CreateQuestionForm
              testId={test.id}
              nextOrder={(test.questions.at(-1)?.sortOrder ?? -1) + 1}
              onDone={() => setShowNewQ(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNewQ(true)}
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-blue-700 bg-white border border-dashed border-blue-300 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              問題を追加
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateQuestionForm({
  testId,
  nextOrder,
  onDone,
}: {
  testId: string;
  nextOrder: number;
  onDone: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateChoice(i: number, v: string) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = choices.map((c) => c.trim()).filter(Boolean);
    if (!question.trim() || trimmed.length < 2) {
      alert("質問と選択肢2つ以上が必要です");
      return;
    }
    startTransition(async () => {
      await createQuestion({
        testId,
        question: question.trim(),
        choices: trimmed,
        correctIndex: Math.min(correctIndex, trimmed.length - 1),
        explanation: explanation.trim() || undefined,
        sortOrder: nextOrder,
      });
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border-2 border-blue-300 rounded-xl p-4 space-y-2">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="質問文"
        rows={2}
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
        required
      />
      <div className="space-y-1.5">
        {choices.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct-new"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              className="flex-shrink-0"
            />
            <span className="text-xs font-bold text-zinc-500 w-4">{String.fromCharCode(65 + i)}</span>
            <input
              type="text"
              value={c}
              onChange={(e) => updateChoice(i, e.target.value)}
              placeholder={`選択肢${String.fromCharCode(65 + i)}`}
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
      <input
        type="text"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="解説（任意）"
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
        >
          {isPending ? "追加中…" : "追加"}
        </button>
      </div>
    </form>
  );
}

function QuestionRow({ question, index }: { question: Question; index: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.question);
  const [choices, setChoices] = useState<string[]>(
    question.choices.length >= 4 ? question.choices : [...question.choices, ...Array(4 - question.choices.length).fill("")]
  );
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function updateChoice(i: number, v: string) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  }

  function onSave() {
    const trimmed = choices.map((c) => c.trim()).filter(Boolean);
    if (!text.trim() || trimmed.length < 2) {
      alert("質問と選択肢2つ以上が必要です");
      return;
    }
    startSave(async () => {
      await updateQuestion(question.id, {
        question: text.trim(),
        choices: trimmed,
        correctIndex: Math.min(correctIndex, trimmed.length - 1),
        explanation: explanation.trim() || null,
      });
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm("この問題を削除しますか？")) return;
    startDelete(async () => {
      await deleteQuestion(question.id);
    });
  }

  if (!editing) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <span className="text-[11px] font-bold text-zinc-400 flex-shrink-0 mt-0.5">Q{index + 1}.</span>
              <p className="text-sm text-zinc-800 flex-1">{question.question}</p>
            </div>
            <div className="mt-2 ml-6 space-y-0.5">
              {question.choices.map((c, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs ${
                    i === question.correctIndex ? "text-emerald-700 font-bold" : "text-zinc-600"
                  }`}
                >
                  <span className="w-4">{String.fromCharCode(65 + i)}.</span>
                  <span>{c}</span>
                  {i === question.correctIndex && <span className="text-[10px] text-emerald-600">✓正解</span>}
                </div>
              ))}
            </div>
            {question.explanation && (
              <p className="text-[11px] text-zinc-400 mt-2 ml-6 italic">💡 {question.explanation}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
            >
              編集
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg p-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
      />
      <div className="space-y-1.5">
        {choices.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
            />
            <span className="text-xs font-bold text-zinc-500 w-4">{String.fromCharCode(65 + i)}</span>
            <input
              type="text"
              value={c}
              onChange={(e) => updateChoice(i, e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
      <input
        type="text"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="解説（任意）"
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
