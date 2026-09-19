const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");
const out = path.resolve(".workspace-tests.cjs");
(async () => {
  await esbuild.build({
    entryPoints: ["tests/workspace/invariants.test.tsx"],
    outfile: out,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    plugins: [
      {
        name: "isolated-data",
        setup(build) {
          const replacements = {
            "@/lib/db":
              "export const db = new Proxy({}, {get(_,model){return new Proxy({}, {get(_,method){return (...args)=>{const fn=globalThis.__testDb?.[model]?.[method];if(!fn)throw new Error(`Unexpected database call: ${String(model)}.${String(method)}`);return fn(...args)}}})}});",
            "@/lib/auth":
              "export const auth=async()=>globalThis.__testSession;",
            "@/lib/mcp/os-read-tools":
              "export const loadViewer=async()=>globalThis.__testViewer;",
            "next/navigation":
              'export function redirect(path){throw new Error("REDIRECT:"+path)};export const usePathname=()=>"/dashboard";',
          };
          build.onResolve(
            {
              filter:
                /^(?:@\/lib\/(?:db|auth|mcp\/os-read-tools)|next\/navigation)$/,
            },
            (args) => ({ path: args.path, namespace: "test-stub" }),
          );
          build.onLoad({ filter: /.*/, namespace: "test-stub" }, (args) => ({
            contents: replacements[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  require(out);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // bundle は CSS も別ファイルに吐くので、両方まとめて後片付けする
    for (const file of [out, out.replace(/\.cjs$/, ".css")])
      if (fs.existsSync(file)) fs.unlinkSync(file);
  });
