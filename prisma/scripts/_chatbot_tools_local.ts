// ローカル検証専用: アーチくんと同じツール定義を Anthropic API に渡し、tool_use → 実行 → 返答の往復を確認する
import Anthropic from "@anthropic-ai/sdk";
import { OS_TOOLS, OS_AI_RULES, toAnthropicTools } from "../../src/lib/mcp/tool-catalog";
import { loadViewer } from "../../src/lib/mcp/os-read-tools";
async function main() {
  const tools = toAnthropicTools(OS_TOOLS);
  console.log("tools:", tools.length, "| sample schema:", JSON.stringify(tools.find((t) => t.name === "log_activity")!.input_schema).slice(0, 200));
  const viewer = (await loadViewer("demo@adarch.co.jp"))!;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: process.argv[2] ?? "唐津製菓の商談はどうなってる？" }];
  for (let i = 0; i < 5; i++) {
    const res = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 800, system: "あなたはアーチくん。丁寧語で短く。" + OS_AI_RULES, messages, tools: tools as Anthropic.Messages.Tool[] });
    const text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("");
    if (text) console.log("TEXT:", text.slice(0, 400));
    if (res.stop_reason !== "tool_use") break;
    const uses = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const def = OS_TOOLS.find((t) => t.name === u.name)!;
      console.log("TOOL:", u.name, JSON.stringify(u.input));
      const parsed = def.input.safeParse(u.input);
      const out = parsed.success ? await def.run(viewer, parsed.data as never) : { error: parsed.error.message };
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 6000) });
    }
    messages = [...messages, { role: "assistant", content: res.content }, { role: "user", content: results }];
  }
}
main();
