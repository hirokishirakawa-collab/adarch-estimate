"use client";

import { createElement, useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Route, Search, X } from "lucide-react";
import type { NavigationItem } from "@/lib/navigation/catalog";
import { TASK_HUBS, toolsForItems, searchTools, type TaskGroup, type HubTask, type HubTool } from "@/lib/workspace/task-catalog";
import { hubItemIcon } from "./hub-visuals";
import { TaskHubScene } from "./task-hub-scenes";
import styles from "./task-hub.module.css";

function TaskCard({ task, selected, controls, onSelect }: {
  task: HubTask; selected: boolean; controls: string; onSelect: () => void;
}) {
  const frame = useRef<number | null>(null);
  const card = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  function resetPointer() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    for (const key of ["--rx", "--ry", "--px", "--py", "--mx", "--my"]) card.current?.style.removeProperty(key);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(hover: hover)").matches) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      element.style.setProperty("--mx", `${x * 100}%`);
      element.style.setProperty("--my", `${y * 100}%`);
      element.style.setProperty("--rx", `${(.5 - y) * 3.2}deg`);
      element.style.setProperty("--ry", `${(x - .5) * 4}deg`);
      element.style.setProperty("--px", `${(x - .5) * 6.4}px`);
      element.style.setProperty("--py", `${(y - .5) * 4.8}px`);
      frame.current = null;
    });
  }
  return <button ref={card} type="button" className="sm-choice" aria-pressed={selected} aria-controls={controls}
    onClick={onSelect} onPointerMove={move} onPointerLeave={resetPointer} onPointerCancel={resetPointer} onBlur={resetPointer}>
    <span className="sm-choice-top"><span className="sm-step">{task.number}<span>{task.english}</span></span><span className="sm-card-arrow"><ArrowUpRight aria-hidden /></span></span>
    <TaskHubScene task={task} />
    <span className="sm-choice-copy"><strong>{task.titleLines ? task.titleLines.map((line) => <span key={line}>{line}</span>) : task.title}</strong><span className="sm-choice-caption">{task.caption}</span></span>
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
    <div className="sm-feature-copy"><span className="sm-tool-title">{tool.title}</span><span className="sm-tool-description">{tool.description}</span></div>
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
    motion.current = panel.current.animate([{ opacity: .25, transform: "translateY(9px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
    return () => motion.current?.cancel();
  }, [selection]);

  const select = (id: string) => { setSelectedTask(id); setQuery(""); setSort("purpose"); setSelection((n) => n + 1); };
  return <div className={styles.hub}><div className="sm-content">
    <header className="sm-heading"><div><p className="sm-eyebrow">{definition.english}</p><h1>{definition.label}<span className="sm-title-dot">.</span></h1><p>{definition.invitation}</p></div>
      <div className="sm-filters"><label className="sm-search"><Search aria-hidden /><input ref={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="使いたい機能を検索" aria-label={`${definition.label}の機能を検索`} />
        {query && <button type="button" aria-label="検索をクリア" onClick={() => { setQuery(""); input.current?.focus(); }}><X aria-hidden /></button>}
      </label><label className="sm-sort">並び順<select aria-label="機能の並び順" value={sort} onChange={(event) => setSort(event.target.value)}><option value="purpose">目的別</option><option value="name">名前順</option></select></label></div>
    </header>
    <div className="sm-choices" role="group" aria-label="進めたい仕事">{availableTasks.map((candidate) => <TaskCard key={candidate.id} task={candidate} selected={!overview && active === candidate.id} controls={panelId} onSelect={() => select(candidate.id)} />)}</div>
    {children}
    <section className="sm-task-detail" aria-labelledby={titleId}>
      <div className="sm-section-title"><div className="sm-detail-heading"><span className="sm-section-number" aria-hidden>{overview ? <Search size={13} /> : task.number}</span><h2 id={titleId}>{searching ? "機能の検索結果" : sort === "name" ? "すべての機能・名前順" : task.title}</h2></div><span className="sm-detail-hint">{overview ? `${visible.length}件` : task.hint}</span></div>
      <div ref={panel} id={panelId}>
        {visible.length === 0 ? <p className="sm-empty">{tools.length ? "該当する機能がありません。別の言葉で検索してください。" : "利用できる機能がありません。"}</p> : overview ? visible.map((tool) => <ToolRow key={tool.item.href} tool={tool} />) : <>
          <FeaturedTool tool={visible[0]} />
          {visible.slice(1, 3).map((tool) => <ToolRow key={tool.item.href} tool={tool} />)}
          {visible.length > 3 && <details key={active}><summary>ほかの道具を見る<span>{visible.length - 3}</span></summary>{visible.slice(3).map((tool) => <ToolRow key={tool.item.href} tool={tool} />)}</details>}
        </>}
      </div>
      <p className="sm-sr" role="status">{overview ? `${visible.length}件の機能を表示` : `「${task.title}」の道具を表示`}</p>
    </section>
    <p className="sm-context-note"><Route aria-hidden /><span>{overview ? "以前の機能名でも、やりたいことでも探せます。" : task.next}</span></p>
  </div></div>;
}
