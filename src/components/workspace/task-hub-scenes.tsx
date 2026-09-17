import { createElement } from "react";
import { BookOpen, BriefcaseBusiness, Building2, CheckCheck, ClipboardCheck, ContactRound, FilePenLine, Film, Flag, FolderOpen, GraduationCap, Image, Layers, MessageSquareText, MonitorPlay, Play, Radar, Search, Send, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { HubTask } from "@/lib/workspace/task-catalog";

const icons: Record<string, [LucideIcon, LucideIcon, LucideIcon]> = {
  "client-billing": [FilePenLine, Send, Building2], "from-hq": [Building2, ClipboardCheck, CheckCheck],
  "to-hq": [ClipboardCheck, Send, Building2], "hq-support": [MessageSquareText, Users, CheckCheck],
  find: [Radar, Building2, Search], prepare: [FilePenLine, Sparkles, Send],
  reply: [MessageSquareText, Send, CheckCheck], manage: [BriefcaseBusiness, ContactRound, Flag],
  progress: [BriefcaseBusiness, ClipboardCheck, Flag], request: [ClipboardCheck, CheckCheck, Send],
  operate: [MonitorPlay, Play, Layers], team: [Users, ContactRound, MessageSquareText],
  materials: [FolderOpen, Image, FilePenLine], media: [Layers, MonitorPlay, Play],
  examples: [Film, Image, Sparkles], learn: [GraduationCap, BookOpen, CheckCheck],
};

/** Decorative objects, never customer records or live activity. */
export function TaskHubScene({ task }: { task: HubTask }) {
  const [primary, secondary, tertiary] = icons[task.id] ?? [FolderOpen, Sparkles, Flag];
  const icon = (Icon: LucideIcon) => createElement(Icon);
  return <span className={`sm-scene sm-scene-${task.scene}`} aria-hidden="true">
    {task.scene === "orbit" && <>
      <span className="sm-orbit sm-orbit-one" /><span className="sm-orbit sm-orbit-two" /><span className="sm-orbit sm-orbit-three" />
      <span className="sm-orbit-dot" /><span className="sm-core">{icon(primary)}</span><span className="sm-satellite">{icon(secondary)}</span>
    </>}
    {task.scene === "sheets" && <>
      <span className="sm-sheet sm-sheet-back" /><span className="sm-sheet sm-sheet-front">{icon(primary)}<span /><span /></span>
      <span className="sm-sheet-spark">{icon(secondary)}</span>
    </>}
    {task.scene === "messages" && <>
      <span className="sm-message sm-message-back">{icon(secondary)}<span /></span>
      <span className="sm-message sm-message-front">{icon(primary)}<span />{icon(tertiary)}</span>
    </>}
    {task.scene === "network" && <>
      <span className="sm-path sm-path-one" /><span className="sm-path sm-path-two" />
      <span className="sm-node sm-node-left">{icon(secondary)}</span><span className="sm-node sm-node-mid">{icon(primary)}</span><span className="sm-node sm-node-right">{icon(tertiary)}</span>
    </>}
  </span>;
}
