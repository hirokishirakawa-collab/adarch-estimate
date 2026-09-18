import { body,respond,viewer,sameOrigin } from "@/lib/journal/http";
import { listEntries,saveDraft,getEntry,submit,archiveDrafts } from "@/lib/journal/service";
import { z } from "zod";
export const runtime="nodejs";
export async function GET(req:Request) {return respond(async()=>{const v=await viewer(),id=new URL(req.url).searchParams.get("id");return id?getEntry(v,id):listEntries(v);});}
export async function POST(req:Request) {return respond(async()=>{sameOrigin(req); const v=await viewer();return saveDraft(v,await body(req));});}
export async function PATCH(req:Request) {return respond(async()=>{sameOrigin(req);const v=await viewer();const a=z.object({id:z.string().uuid(),revision:z.number().int().positive()}).parse(await body(req));return submit(v,a.id,a.revision);});}
export async function DELETE(req:Request) {return respond(async()=>{sameOrigin(req);const v=await viewer();const a=z.object({ids:z.array(z.string().uuid()).min(1).max(100)}).parse(await body(req));return archiveDrafts(v,a.ids);});}
