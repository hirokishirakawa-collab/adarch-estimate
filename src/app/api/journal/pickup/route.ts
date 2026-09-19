import { body,respond,viewer,sameOrigin } from "@/lib/journal/http";
import { getPickup,setPickup } from "@/lib/journal/service";
export async function GET() {return respond(async()=>getPickup(await viewer()));}
export async function POST(req:Request) {return respond(async()=>{sameOrigin(req);return setPickup(await viewer(),await body(req));});}
