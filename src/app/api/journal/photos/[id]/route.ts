import { viewer,respond } from "@/lib/journal/http";
import { photo } from "@/lib/journal/service";
export const runtime="nodejs";
export async function GET(_req:Request,ctx:{params:Promise<{id:string}>}) {
  try{return new Response(new Uint8Array(await photo(await viewer(),(await ctx.params).id)),{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
  catch(e){return respond(async()=>{throw e;});}
}
