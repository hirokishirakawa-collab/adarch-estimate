import { body,respond,viewer,sameOrigin } from "@/lib/journal/http";
import { review } from "@/lib/journal/service";
export async function POST(req:Request) {return respond(async()=>{sameOrigin(req);return review(await viewer(),await body(req));});}
