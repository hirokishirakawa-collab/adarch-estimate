import { publisher,respond,body } from "@/lib/journal/http";
import { manifest,acknowledge,deliveryPhoto } from "@/lib/journal/service";
import { z } from "zod";
export const runtime="nodejs";
export async function GET(req:Request) {
  try {
    publisher(req);const id=new URL(req.url).searchParams.get("photo");
    if(id){z.string().uuid().parse(id);return new Response(new Uint8Array(await deliveryPhoto(id)),{headers:{"Content-Type":"image/jpeg","Cache-Control":"no-store"}});}
    return respond(manifest);
  } catch(e) {return respond(async()=>{throw e;});}
}
export async function POST(req:Request) {return respond(async()=>{publisher(req);const a=z.object({version:z.string().regex(/^[0-9a-f]{64}$/)}).parse(await body(req));return acknowledge(a.version);});}
