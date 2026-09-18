import {test} from "node:test";
import assert from "node:assert/strict";
import {publisher,sameOrigin,bytes} from "../../src/lib/journal/http";
test("同期APIは専用Bearer必須、ブラウザ書き込みは同一オリジン",()=>{
 const token="x".repeat(40);process.env.JOURNAL_PUBLISH_TOKEN=token;process.env.NEXT_PUBLIC_APP_URL="https://test.example.invalid";
 assert.throws(()=>publisher(new Request("https://test.example.invalid/api/journal/publish")),/認証/);
 assert.throws(()=>publisher(new Request("https://test.example.invalid",{headers:{authorization:"Bearer wrong"}})),/認証/);
 assert.doesNotThrow(()=>publisher(new Request("https://test.example.invalid",{headers:{authorization:`Bearer ${token}`}})));
 assert.throws(()=>sameOrigin(new Request("https://test.example.invalid",{headers:{origin:"https://other.example.invalid"}})),/開き直し/);
 assert.doesNotThrow(()=>sameOrigin(new Request("https://test.example.invalid",{headers:{origin:"https://test.example.invalid"}})));
 delete process.env.JOURNAL_PUBLISH_TOKEN;delete process.env.NEXT_PUBLIC_APP_URL;
});
test("Content-Lengthがなくてもサイズ上限を適用",async()=>{
 const request=new Request("https://example.invalid",{method:"POST",body:"12345"});
 await assert.rejects(()=>bytes(request,4),/大きすぎ/);
 const ok=new Request("https://example.invalid",{method:"POST",body:"123"});assert.equal((await bytes(ok,4)).toString(),"123");
});
