"use client";

import { useState } from "react";
import { Save, Loader2, X, Plus, Trash2 } from "lucide-react";

interface ProposalContent {
  cover: { title: string; subtitle: string; date: string; to: string };
  companyIntro: { heading: string; description: string; strengths: string[] };
  proposal: { heading: string; challenge: string; solutions: { title: string; description: string }[] };
  cases: { heading: string; items: { title: string; description: string }[] };
  nextSteps: { heading: string; steps: string[]; contact: string };
}

interface ProposalEditorProps {
  proposal: {
    id: string;
    companyName: string;
    content: ProposalContent;
  };
  onClose: () => void;
  onSaved: () => void;
}

export function ProposalEditor({ proposal, onClose, onSaved }: ProposalEditorProps) {
  const [companyName, setCompanyName] = useState(proposal.companyName);
  const [content, setContent] = useState<ProposalContent>(
    JSON.parse(JSON.stringify(proposal.content))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateCover = (field: keyof ProposalContent["cover"], value: string) => {
    setContent((prev) => ({ ...prev, cover: { ...prev.cover, [field]: value } }));
  };

  const updateCompanyIntro = (field: keyof ProposalContent["companyIntro"], value: string | string[]) => {
    setContent((prev) => ({ ...prev, companyIntro: { ...prev.companyIntro, [field]: value } }));
  };

  const updateProposal = (field: keyof ProposalContent["proposal"], value: string) => {
    setContent((prev) => ({ ...prev, proposal: { ...prev.proposal, [field]: value } }));
  };

  const updateSolution = (index: number, field: "title" | "description", value: string) => {
    setContent((prev) => {
      const solutions = [...prev.proposal.solutions];
      solutions[index] = { ...solutions[index], [field]: value };
      return { ...prev, proposal: { ...prev.proposal, solutions } };
    });
  };

  const addSolution = () => {
    setContent((prev) => ({
      ...prev,
      proposal: {
        ...prev.proposal,
        solutions: [...prev.proposal.solutions, { title: "", description: "" }],
      },
    }));
  };

  const removeSolution = (index: number) => {
    setContent((prev) => ({
      ...prev,
      proposal: {
        ...prev.proposal,
        solutions: prev.proposal.solutions.filter((_, i) => i !== index),
      },
    }));
  };

  const updateCase = (index: number, field: "title" | "description", value: string) => {
    setContent((prev) => {
      const items = [...prev.cases.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, cases: { ...prev.cases, items } };
    });
  };

  const addCase = () => {
    setContent((prev) => ({
      ...prev,
      cases: {
        ...prev.cases,
        items: [...prev.cases.items, { title: "", description: "" }],
      },
    }));
  };

  const removeCase = (index: number) => {
    setContent((prev) => ({
      ...prev,
      cases: { ...prev.cases, items: prev.cases.items.filter((_, i) => i !== index) },
    }));
  };

  const updateNextSteps = (field: keyof ProposalContent["nextSteps"], value: string | string[]) => {
    setContent((prev) => ({ ...prev, nextSteps: { ...prev.nextSteps, [field]: value } }));
  };

  const updateStep = (index: number, value: string) => {
    setContent((prev) => {
      const steps = [...prev.nextSteps.steps];
      steps[index] = value;
      return { ...prev, nextSteps: { ...prev.nextSteps, steps } };
    });
  };

  const addStep = () => {
    setContent((prev) => ({
      ...prev,
      nextSteps: { ...prev.nextSteps, steps: [...prev.nextSteps.steps, ""] },
    }));
  };

  const removeStep = (index: number) => {
    setContent((prev) => ({
      ...prev,
      nextSteps: { ...prev.nextSteps, steps: prev.nextSteps.steps.filter((_, i) => i !== index) },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim(), content }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "保存に失敗しました");
        return;
      }
      onSaved();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
          <p className="text-sm font-bold text-zinc-800">提案書を編集</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-3 py-2 text-xs text-red-600 bg-red-50 rounded-lg">{error}</div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* 提案先企業名 */}
          <Section title="提案先企業名">
            <Input value={companyName} onChange={setCompanyName} placeholder="株式会社ABC" />
          </Section>

          {/* 表紙 */}
          <Section title="表紙">
            <Label text="宛先" />
            <Input value={content.cover.to} onChange={(v) => updateCover("to", v)} placeholder="株式会社ABC 御中" />
            <Label text="タイトル" />
            <Input value={content.cover.title} onChange={(v) => updateCover("title", v)} placeholder="ご提案書" />
            <Label text="サブタイトル" />
            <Input value={content.cover.subtitle} onChange={(v) => updateCover("subtitle", v)} placeholder="映像制作・広告プロモーションのご提案" />
            <Label text="日付" />
            <Input value={content.cover.date} onChange={(v) => updateCover("date", v)} placeholder="2026年3月" />
          </Section>

          {/* 会社紹介 */}
          <Section title="会社紹介">
            <Label text="セクション見出し" />
            <Input value={content.companyIntro.heading} onChange={(v) => updateCompanyIntro("heading", v)} />
            <Label text="紹介文" />
            <Textarea value={content.companyIntro.description} onChange={(v) => updateCompanyIntro("description", v)} rows={3} />
            <Label text="強み（カード表示）" />
            {content.companyIntro.strengths.map((s, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={s}
                  onChange={(v) => {
                    const strengths = [...content.companyIntro.strengths];
                    strengths[i] = v;
                    updateCompanyIntro("strengths", strengths);
                  }}
                />
                <button
                  onClick={() => updateCompanyIntro("strengths", content.companyIntro.strengths.filter((_, j) => j !== i))}
                  className="p-2 text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <AddButton onClick={() => updateCompanyIntro("strengths", [...content.companyIntro.strengths, ""])} label="強みを追加" />
          </Section>

          {/* 課題 & 提案 */}
          <Section title="課題 & 提案">
            <Label text="セクション見出し" />
            <Input value={content.proposal.heading} onChange={(v) => updateProposal("heading", v)} />
            <Label text="課題" />
            <Textarea value={content.proposal.challenge} onChange={(v) => updateProposal("challenge", v)} rows={2} />
            <Label text="ソリューション" />
            {content.proposal.solutions.map((sol, i) => (
              <div key={i} className="bg-zinc-50 rounded-lg p-3 mb-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input value={sol.title} onChange={(v) => updateSolution(i, "title", v)} placeholder="ソリューション名" />
                    <Textarea value={sol.description} onChange={(v) => updateSolution(i, "description", v)} placeholder="説明" rows={2} />
                  </div>
                  <button onClick={() => removeSolution(i)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <AddButton onClick={addSolution} label="ソリューションを追加" />
          </Section>

          {/* 実績・事例 */}
          <Section title="実績・事例">
            <Label text="セクション見出し" />
            <Input value={content.cases.heading} onChange={(v) => setContent((prev) => ({ ...prev, cases: { ...prev.cases, heading: v } }))} />
            {content.cases.items.map((item, i) => (
              <div key={i} className="bg-zinc-50 rounded-lg p-3 mb-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input value={item.title} onChange={(v) => updateCase(i, "title", v)} placeholder="事例タイトル" />
                    <Textarea value={item.description} onChange={(v) => updateCase(i, "description", v)} placeholder="説明" rows={2} />
                  </div>
                  <button onClick={() => removeCase(i)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <AddButton onClick={addCase} label="事例を追加" />
          </Section>

          {/* ネクストステップ */}
          <Section title="ネクストステップ">
            <Label text="セクション見出し" />
            <Input value={content.nextSteps.heading} onChange={(v) => updateNextSteps("heading", v)} />
            <Label text="ステップ" />
            {content.nextSteps.steps.map((step, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <span className="flex-shrink-0 w-6 h-8 flex items-center justify-center text-xs font-bold text-zinc-400">
                  {i + 1}
                </span>
                <Input value={step} onChange={(v) => updateStep(i, v)} placeholder={`ステップ ${i + 1}`} />
                <button onClick={() => removeStep(i)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <AddButton onClick={addStep} label="ステップを追加" />
            <Label text="連絡先" />
            <Textarea
              value={content.nextSteps.contact}
              onChange={(v) => updateNextSteps("contact", v)}
              placeholder="担当: 山田太郎 / tel: 03-xxxx-xxxx / mail: xxx@example.com"
              rows={2}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── 共通UIパーツ ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-800 mb-3 pb-2 border-b border-zinc-100">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <p className="text-xs text-zinc-500 mt-3 mb-1">{text}</p>;
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
    />
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors mt-2"
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
