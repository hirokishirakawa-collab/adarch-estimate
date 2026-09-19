"use client";

import { createElement, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, Files, MessagesSquare, Network, Radar, Route, Search, X } from "lucide-react";
import type { NavigationItem } from "@/lib/navigation/catalog";
import { TASK_HUBS, toolsForItems, searchTools, type TaskGroup, type HubTask, type HubTool } from "@/lib/workspace/task-catalog";
import { hubItemIcon } from "./hub-visuals";
import styles from "./task-hub.module.css";

const TASK_ICONS = { orbit: Radar, sheets: Files, messages: MessagesSquare, network: Network };
const TASK_TITLE_LINES: Record<string, readonly string[]> = {
  "提案・連絡を準備する": ["提案・連絡を", "準備する"],
  "返事・営業結果を記録する": ["返事・営業結果", "を記録する"],
  "顧客・商談を見る": ["顧客・商談を", "見る"],
  "配信・運用をする": ["配信・運用を", "する"],
  "商品・媒体を選ぶ": ["商品・媒体を", "選ぶ"],
  "実績・事例を見る": ["実績・事例を", "見る"],
  "セミナーで伝える": ["セミナーで", "伝える"],
  "Meta広告・チラシ・DM・LINEを届ける": ["Meta広告・チラシ・", "DM・LINEを届ける"],
  "オウンドメディアに記事を書く": ["オウンドメディアに", "記事を書く"],
  "お客様への請求": ["お客様への", "請求"],
  "本部から各社へ": ["本部から", "各社へ"],
  "各社から本部へ": ["各社から", "本部へ"],
};

function TaskCard({ task, selected, controls, onSelect }: {
  task: HubTask; selected: boolean; controls: string; onSelect: () => void;
}) {
  const Icon = TASK_ICONS[task.scene];
  const lines = TASK_TITLE_LINES[task.title] ?? task.titleLines ?? [task.title];
  return <button type="button" className="sm-choice" aria-label={`${task.number} ${task.title}`}
    aria-pressed={selected} aria-controls={controls} onClick={onSelect}>
    <span className="sm-choice-top"><Icon aria-hidden /><span className="sm-choice-state">{selected && <ChevronDown aria-hidden />}<span>{task.number}</span></span></span>
    <strong>{lines.map((line) => <span key={line}>{line}</span>)}</strong>
    <span className="sm-sr">{task.caption}{selected ? "・選択中" : ""}</span>
  </button>;
}

function ToolRow({ tool }: { tool: HubTool }) {
  const icon = createElement(hubItemIcon(tool.item.href, tool.item.label), { "aria-hidden": true });
  const content = <>{icon}<span className="sm-tool-copy"><span className="sm-tool-title">{tool.title}</span><span className="sm-tool-description">{tool.description}</span></span><ArrowRight aria-hidden /></>;
  return tool.item.external ? <a className="sm-tool-row" href={tool.item.href} target="_blank" rel="noopener noreferrer">{content}</a>
    : <Link className="sm-tool-row" href={tool.item.href} prefetch={false}>{content}</Link>;
}

function FeaturedTool({ tool }: { tool: HubTool }) {
  const icon = createElement(hubItemIcon(tool.item.href, tool.item.label), { "aria-hidden": true });
  return <div className="sm-featured"><span className="sm-feature-icon">{icon}</span>
    <div className="sm-feature-copy"><span className="sm-feature-label">主な入口</span><span className="sm-tool-title">{tool.title}</span><span className="sm-tool-description">{tool.description}</span></div>
    {tool.item.external ? <a className="sm-open" href={tool.item.href} target="_blank" rel="noopener noreferrer" aria-label={tool.title}>開く<ArrowUpRight aria-hidden /></a>
      : <Link className="sm-open" href={tool.item.href} prefetch={false} aria-label={tool.title}>開く<ArrowRight aria-hidden /></Link>}
  </div>;
}

export function TaskHub({ group, items, children }: { group: TaskGroup; items: NavigationItem[]; children?: ReactNode }) {
  const definition = TASK_HUBS[group];
  const tools = useMemo(() => toolsForItems(group, items), [group, items]);
  const [selectedTask, setSelectedTask] = useState(definition.tasks[0].id);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("purpose");
  const [selection, setSelection] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);
  const panelId = useId();
  const titleId = useId();
  const searching = query.trim().length > 0;
  const overview = searching || sort === "name";
  const availableTasks = definition.tasks.filter((candidate) => tools.some((tool) => tool.task === candidate.id));
  const task = availableTasks.find((candidate) => candidate.id === selectedTask) ?? availableTasks[0] ?? definition.tasks[0];
  const active = task.id;
  const rows = overview ? searchTools(tools, query) : tools.filter((tool) => tool.task === active);
  const visible = sort === "name" ? [...rows].sort((a, b) => a.title.localeCompare(b.title, "ja")) : rows;

  useEffect(() => {
    if (!selection || !panel.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    motion.current = panel.current.animate([{ opacity: .25, transform: "translateY(9px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
    return () => motion.current?.cancel();
  }, [selection]);

  // 入口の順序と位置は固定し、全入口の直下で候補だけを切り替える。
  const activeIndex = Math.max(0, availableTasks.findIndex((candidate) => candidate.id === active));
  const detail = <section className="sm-task-detail" data-overview={overview}
    style={{ "--sm-caret": `${(activeIndex + 0.5) / Math.max(availableTasks.length, 1) * 100}%` } as CSSProperties}
    aria-labelledby={titleId}>
      <div className="sm-section-title"><div className="sm-detail-heading"><span className="sm-section-number" aria-hidden>{overview ? <Search size={13} /> : task.number}</span><h2 id={titleId}>{searching ? "機能の検索結果" : sort === "name" ? "すべての機能・名前順" : task.title}</h2></div><span className="sm-detail-hint">{overview ? `${visible.length}件` : task.hint}</span></div>
      <div ref={panel} id={panelId}>
        {visible.length === 0 ? <p className="sm-empty">{tools.length ? "該当する機能がありません。別の言葉で検索してください。" : "利用できる機能がありません。"}</p> : overview ? visible.map((tool) => <ToolRow key={tool.item.href} tool={tool} />) : <>
          <FeaturedTool tool={visible[0]} />
          <div className="sm-secondary-tools">{visible.slice(1).map((tool) => <ToolRow key={tool.item.href} tool={tool} />)}</div>
        </>}
      </div>
      <p className="sm-sr" role="status">{overview ? `${visible.length}件の機能を表示` : `「${task.title}」の道具を表示`}</p>
  </section>;
  const select = (id: string) => { setSelectedTask(id); setQuery(""); setSort("purpose"); setSelection((n) => n + 1); };
  return <div className={styles.hub}><div className="sm-content">
    <header className="sm-heading"><div><h1>{definition.label}</h1><p>進めたい仕事を選ぶ</p></div>
      <div className="sm-filters"><label className="sm-search"><Search aria-hidden /><input ref={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="使いたい機能を検索" aria-label={`${definition.label}の機能を検索`} />
        {query && <button type="button" aria-label="検索をクリア" onClick={() => { setQuery(""); input.current?.focus(); }}><X aria-hidden /></button>}
      </label><label className="sm-sort">並び順<select aria-label="機能の並び順" value={sort} onChange={(event) => setSort(event.target.value)}><option value="purpose">目的別</option><option value="name">名前順</option></select></label></div>
    </header>
    <div className="sm-choices" role="group" aria-label="進めたい仕事"
      style={{ "--sm-task-count": Math.max(availableTasks.length, 1), "--sm-mobile-task-count": Math.min(Math.max(availableTasks.length, 1), 2) } as CSSProperties}>
      {availableTasks.map((candidate) => <TaskCard key={candidate.id} task={candidate} selected={!overview && active === candidate.id} controls={panelId} onSelect={() => select(candidate.id)} />)}
    </div>
    {detail}
    {children}
    <p className="sm-context-note"><Route aria-hidden /><span>{overview ? "以前の機能名でも、やりたいことでも探せます。" : task.next}</span></p>
  </div></div>;
}
