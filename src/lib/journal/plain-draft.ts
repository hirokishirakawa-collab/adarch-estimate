import type { JournalContent } from "./model";

/** Paste ordinary paragraphs, with optional Markdown title, H2 and quotations. */
export function parseFinalDraft(text:string):{title?:string;blocks:JournalContent["blocks"]}{
  const result:{title?:string;blocks:JournalContent["blocks"]}={blocks:[]};
  let lines:string[]=[],type:"paragraph"|"quote"="paragraph";
  const flush=()=>{const value=lines.join("\n").trim();if(value)result.blocks.push({type,text:value});lines=[];};
  for(const [index,line] of text.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").trim().split("\n").entries()){
    if(index===0&&/^#\s+/.test(line)){result.title=line.replace(/^#\s+/,"").trim();continue;}
    if(!line.trim()){flush();continue;}
    if(/^##\s+/.test(line)){flush();result.blocks.push({type:"heading",text:line.replace(/^##\s+/,"").trim()});continue;}
    const next=/^>\s?/.test(line)?"quote":"paragraph";
    if(next!==type)flush();type=next;
    lines.push(next==="quote"?line.replace(/^>\s?/,""):line);
  }
  flush();return result;
}
