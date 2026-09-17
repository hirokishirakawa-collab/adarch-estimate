import { BriefcaseBusiness, Building2, CheckCheck, ContactRound, FilePenLine, Flag, MessageSquareText, Radar, Send, Sparkles } from "lucide-react";
import type { SalesTaskId } from "@/lib/workspace/sales-tasks";

/** Decorative scenes, never customer records or live activity. */
export function SalesHubScene({ task }: { task: SalesTaskId }) {
  return <span className={`sm-scene sm-scene-${task}`} aria-hidden="true">
    {task === "find" && <>
      <span className="sm-orbit sm-orbit-one" /><span className="sm-orbit sm-orbit-two" /><span className="sm-orbit sm-orbit-three" />
      <span className="sm-orbit-dot" /><span className="sm-core"><Radar /></span><span className="sm-satellite"><Building2 /></span>
    </>}
    {task === "prepare" && <>
      <span className="sm-sheet sm-sheet-back" /><span className="sm-sheet sm-sheet-front"><FilePenLine /><span /><span /></span>
      <span className="sm-sheet-spark"><Sparkles /></span>
    </>}
    {task === "reply" && <>
      <span className="sm-message sm-message-back"><Send /><span /></span>
      <span className="sm-message sm-message-front"><MessageSquareText /><span /><CheckCheck /></span>
    </>}
    {task === "manage" && <>
      <span className="sm-path sm-path-one" /><span className="sm-path sm-path-two" />
      <span className="sm-node sm-node-left"><ContactRound /></span><span className="sm-node sm-node-mid"><BriefcaseBusiness /></span><span className="sm-node sm-node-right"><Flag /></span>
    </>}
  </span>;
}
