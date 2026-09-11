#!/usr/bin/env node
/**
 * Deploy ตัว UI ขึ้น GitHub Pages (branch gh-pages)
 * - build ด้วย base = /<repo>/ (โปรเจกต์ Pages เสิร์ฟที่ https://<user>.github.io/<repo>/)
 * - push โฟลเดอร์ dist ขึ้น branch gh-pages (force) — API ยังอยู่ที่ Apps Script เหมือนเดิม
 *
 * ใช้: npm run deploy:pages
 * ถ้าชื่อ repo ไม่ใช่ trade-journal ให้แก้ REPO ด้านล่าง (และ base ใน package.json)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO = "Omegu/trade-journal"; // <user>/<repo>
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

console.log(`→ build (base /${REPO.split("/")[1]}/)`);
run(`npx vite build --base=/${REPO.split("/")[1]}/`, ROOT);

// กัน Jekyll ประมวลผลไฟล์ใน Pages
writeFileSync(path.join(DIST, ".nojekyll"), "");

console.log("→ push dist ขึ้น branch gh-pages");
run("git init -b gh-pages", DIST);
run("git add -A", DIST);
run('git -c user.name="deploy" -c user.email="deploy@local" commit -m "deploy"', DIST);
run(`git push -f https://github.com/${REPO}.git gh-pages`, DIST);

console.log(`✓ เสร็จ — รอ 1-2 นาทีแล้วเปิด https://${REPO.split("/")[0]}.github.io/${REPO.split("/")[1]}/`);
