import { respond,viewer,sameOrigin,bytes } from "@/lib/journal/http";
import { uploadPhoto } from "@/lib/journal/service";
import { JournalError } from "@/lib/journal/model";
export const runtime="nodejs";
export async function POST(req:Request) {return respond(async()=>{
  sameOrigin(req);const v=await viewer();
  if(Number(req.headers.get("content-length")??0)>8_100_000) throw new JournalError("写真は8MB以内にしてください",413);
  const data=await bytes(req,8_100_000);
  const bounded=new Request(req.url,{method:"POST",headers:req.headers,body:new Uint8Array(data)});
  const form=await bounded.formData(),file=form.get("photo");
  if(!(file instanceof File) || file.size>8_000_000) throw new JournalError("写真は8MB以内にしてください");
  return uploadPhoto(v,Buffer.from(await file.arrayBuffer()).toString("base64"));
});}
