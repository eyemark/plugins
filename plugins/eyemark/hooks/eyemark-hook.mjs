#!/usr/bin/env node
// Eyemark's hooks for Claude Code (docs/local-first.md, step 3). One script, three events:
//
//   edit      PostToolUse on Edit, Write and MultiEdit. A UI file the code checks read goes to
//             check_code through the running @eyemark/mcp server's socket; errors come back to
//             the agent at once. Every UI file edited is noted for the stop check.
//   measured  PostToolUse on Eyemark's measure. A PASS is noted.
//   stop      Stop. UI files changed since measure last passed: block once, with what to do.
//
// It never fails the agent's turn: anything unexpected (no server running, a timeout, a file it
// can't read) ends in silence. It reads nothing but the hook's input and its own notes, and sends
// nothing anywhere but the local socket.

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const RUN_DIR = process.env.EYEMARK_RUN_DIR || path.join(os.tmpdir(), "eyemark");
const NOTES = path.join(RUN_DIR, "sessions");
// What the code checks read (src/code.ts), and what only measure sees.
const CODE_FILE = /\.(tsx|jsx|js|mjs|cjs|css|scss|html)$/;
const UI_FILE = /\.(tsx|jsx|js|mjs|cjs|css|scss|html|vue|svelte|astro)$/;
const NOT_UI = /(^|\/)(node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec|stories|config)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|scripts)\//;
const MAX_ERRORS = 8;
const TIMEOUT_MS = Number(process.env.EYEMARK_HOOK_TIMEOUT_MS) || 20000;

const say = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

async function input() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

// This session's notes: the UI files edited and when, when measure last passed, when we last asked.
const noteFile = (session) => path.join(NOTES, `${String(session).replace(/[^\w.-]/g, "_")}.json`);
function readNotes(session) {
  try {
    return JSON.parse(fs.readFileSync(noteFile(session), "utf8"));
  } catch {
    return { edited: [], editedAt: 0, measuredAt: 0, askedAt: 0 };
  }
}
function writeNotes(session, notes) {
  fs.mkdirSync(NOTES, { recursive: true, mode: 0o700 });
  fs.writeFileSync(noteFile(session), JSON.stringify(notes), { mode: 0o600 });
}

// The running @eyemark/mcp servers, newest first; an entry whose server is gone is removed.
function servers() {
  let names;
  try {
    names = fs.readdirSync(RUN_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out = [];
  for (const f of names) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(RUN_DIR, f), "utf8"));
      process.kill(e.pid, 0);
      out.push({ ...e, at: fs.statSync(path.join(RUN_DIR, f)).mtimeMs });
    } catch (err) {
      if (err.code === "ESRCH") fs.rmSync(path.join(RUN_DIR, f), { force: true });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

function ask(socket, request) {
  return new Promise((resolve, reject) => {
    const s = net.connect(socket);
    let buf = "";
    const timer = setTimeout(() => {
      s.destroy();
      reject(new Error("timeout"));
    }, TIMEOUT_MS);
    s.setEncoding("utf8");
    s.on("data", (d) => (buf += d));
    s.on("end", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
    s.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    s.end(`${JSON.stringify(request)}\n`);
  });
}

async function checkCode(file) {
  for (const server of servers()) {
    try {
      return await ask(server.socket, { tool: "check_code", args: { files: [file] } });
    } catch {
      // That one didn't answer: try the next.
    }
  }
  return undefined;
}

async function onEdit(h) {
  const file = h.tool_input?.file_path;
  if (typeof file !== "string" || !UI_FILE.test(file) || NOT_UI.test(file.split(path.sep).join("/"))) return;
  const notes = readNotes(h.session_id);
  if (!notes.edited.includes(file)) notes.edited.push(file);
  notes.editedAt = Date.now();
  writeNotes(h.session_id, notes);
  if (!CODE_FILE.test(file)) return;
  const out = await checkCode(file);
  const errors = out?.structuredContent?.errors;
  if (!Array.isArray(errors) || !errors.length) return;
  const lines = errors.slice(0, MAX_ERRORS).map((e) => `- ${e.check} line ${e.line}: ${e.message}${e.fix ? ` Fix: ${e.fix}` : ""}`);
  const more = errors.length > MAX_ERRORS ? `\n…and ${errors.length - MAX_ERRORS} more: call check_code on the file to see them.` : "";
  say({
    decision: "block",
    reason: `Eyemark found ${errors.length} error${errors.length === 1 ? "" : "s"} in ${path.basename(file)} (check_code):\n${lines.join("\n")}${more}\nFix ${errors.length === 1 ? "it" : "them"} now; the file is checked again after your next edit.`,
  });
}

// measure's answer, however the agent got it: structured, or the text's PASS line.
function passed(response) {
  const r = typeof response === "string" ? safeParse(response) ?? response : response;
  if (r && typeof r === "object") {
    if (r.structuredContent?.pass === true) return true;
    const content = Array.isArray(r) ? r : r.content;
    if (Array.isArray(content)) return content.some((c) => typeof c?.text === "string" && /^PASS\b/m.test(c.text));
  }
  return typeof r === "string" && /^PASS\b/m.test(r);
}
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function onMeasured(h) {
  if (!passed(h.tool_response)) return;
  const notes = readNotes(h.session_id);
  notes.measuredAt = Date.now();
  writeNotes(h.session_id, notes);
}

function onStop(h) {
  if (h.stop_hook_active) return;
  const notes = readNotes(h.session_id);
  // Nothing changed since measure passed, or since we last asked: let it stop.
  if (!notes.edited.length || notes.editedAt <= Math.max(notes.measuredAt, notes.askedAt)) return;
  notes.askedAt = Date.now();
  writeNotes(h.session_id, notes);
  const names = notes.edited.slice(-5).map((f) => path.relative(h.cwd || process.cwd(), f) || f);
  say({
    decision: "block",
    reason: `Eyemark: UI files changed (${names.join(", ")}${notes.edited.length > 5 ? ", …" : ""}) and measure hasn't passed since. Before saying the work is done: make sure the dev server is running (start it in the background if it isn't), call measure on it with the routes these files touch, and fix every error until it passes. If the dev server can't start, say why measure didn't run.`,
  });
}

try {
  const h = await input();
  const event = process.argv[2];
  if (event === "edit") await onEdit(h);
  else if (event === "measured") onMeasured(h);
  else if (event === "stop") onStop(h);
} catch {
  // Never in the agent's way.
}
process.exit(0);
