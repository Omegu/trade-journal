#!/usr/bin/env node
/**
 * Build เว็บแอปเป็นชุดไฟล์สำหรับ deploy ขึ้น Google Apps Script
 * - รัน vite build
 * - รวม CSS/JS ทั้งหมดเข้า Index.html ไฟล์เดียว (HtmlService เสิร์ฟไฟล์เดียว ไม่มี asset แยก)
 * - คัดลอก Code.gs + สร้าง appsscript.json ลง gas-app/
 *
 * ใช้: npm run build:gas
 * แล้วคัดลอกไฟล์ใน gas-app/ ไปวางใน Apps Script editor (ดูขั้นตอนใน apps-script/README.md)
 */
import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "gas-app");

console.log("→ vite build");
execSync("npx vite build", { cwd: ROOT, stdio: "inherit" });

let html = await readFile(path.join(DIST, "index.html"), "utf8");
const cssHrefs = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map((m) => m[1]);
const jsSrcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g)].map((m) => m[1]);
if (jsSrcs.length === 0) throw new Error("ไม่พบ JS bundle ใน dist/index.html");

const readAsset = (ref) => readFile(path.join(DIST, ref.replace(/^\/+/, "")), "utf8");
let css = "";
for (const href of cssHrefs) css += await readAsset(href);
let js = "";
for (const src of jsSrcs) js += await readAsset(src);

// กันโค้ด JS ที่มีสตริง "</script>" ปิด tag ก่อนเวลาจากในไฟล์ HTML
js = js.replace(/<\/script>/gi, "<\\/script>");

html = html
  .replace(/<link[^>]+rel="modulepreload"[^>]*>/g, "")
  .replace(/<link[^>]+\.css[^>]*>/g, "")
  .replace(/<script[^>]+src="[^"]+\.js"[^>]*><\/script>/g, "")
  // ใช้ replacer function เพื่อไม่ให้ $& / $1 ใน CSS/JS ถูกตีความเป็นรูปแบบแทนที่
  .replace("</head>", () => `<style>\n${css}\n</style>\n</head>`)
  .replace("</body>", () => `<script type="module">\n${js}\n</script>\n</body>`);

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "Index.html"), html);
await writeFile(path.join(OUT, "Code.gs"), await readFile(path.join(ROOT, "apps-script", "Code.gs")));
await writeFile(
  path.join(OUT, "appsscript.json"),
  JSON.stringify(
    {
      timeZone: "Asia/Bangkok",
      dependencies: {},
      exceptionLogging: "STACKDRIVER",
      runtimeVersion: "V8",
      webapp: { executeAs: "USER_DEPLOYING", access: "ANYONE_ANONYMOUS" },
    },
    null,
    2
  ) + "\n"
);

const kb = (s) => (Buffer.byteLength(s, "utf8") / 1024).toFixed(0);
console.log(`✓ gas-app/Index.html (${kb(html)} KB — รวม css ${kb(css)} KB + js ${kb(js)} KB)`);
console.log("✓ gas-app/Code.gs");
console.log("✓ gas-app/appsscript.json");
console.log("→ คัดลอก 3 ไฟล์ใน gas-app/ ไปวางใน Apps Script editor แล้ว Deploy เป็น Web app");
