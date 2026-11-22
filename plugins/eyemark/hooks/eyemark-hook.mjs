#!/usr/bin/env node
// Eyemark's hooks for Claude Code (docs/local-first.md, step 3). One script, four events:
//
//   prompt    UserPromptSubmit. Notes which UI files git already sees as changed, and HEAD: what
//             wasn't the agent's doing in the turn that starts.
//   edit      PostToolUse on Edit, Write and MultiEdit. A UI file the code checks read goes to
//             check_code through the running @eyemark/mcp server's socket; errors come back to
//             the agent at once. Every UI file edited is noted for the stop check.
//   measured  PostToolUse on Eyemark's measure. A PASS is noted.
//   stop      Stop. Finds in git what changed this turn without the edit hook seeing it (Bash,
//             scripts), and checks it. Errors there, or UI files changed since measure last
//             passed: block once, with what to do.
//
// It never fails the agent's turn: anything unexpected (no server running, a timeout, a file it
// can't read) ends in silence. What it reads: the hook's input, its notes, the UI files changed,
// and git's status and reflog. It sends nothing anywhere but the local socket.
//
// What a socket answers goes into the agent's context, and the temp folder can be shared (/tmp on
// Linux), so it trusts only what this user owns and no one else can write, and follows no symlink.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const RUN_DIR = process.env.EYEMARK_RUN_DIR || path.join(os.tmpdir(), "eyemark");
const NOTES = path.join(RUN_DIR, "sessions");
const WINDOWS = process.platform === "win32";
const PIPE = "\\\\.\\pipe\\eyemark-";

// Files that are UI whatever they hold, and scripts that are only when they render or drive a page.
const ALWAYS_UI = /\.(tsx|jsx|css|scss|html|vue|svelte|astro)$/;
const MAYBE_UI = /\.(js|mjs)$/;
// The code checks don't read these: only measure sees them.
const MEASURE_ONLY = /\.(vue|svelte|astro)$/;
// Matched on the path inside the project, never on the folders above it.
const NOT_UI = /(^|\/)(node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec|stories|config)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|scripts)\//;
const RENDERS = /(\breturn|=>)\s*\(?\s*<[A-Za-z>]|\bcreateRoot\s*\(|\bdocument\.(querySelector|getElementById|createElement|body|documentElement)\b|\.innerHTML\s*=|\.classList\.(add|remove|toggle)\s*\(/;

const MAX_ERRORS = 8;
const MAX_FILES = 40;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = Number(process.env.EYEMARK_HOOK_TIMEOUT_MS) || 20000;

const say = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);
// A file name is the repository's text, on its way into the agent's context: one line, no controls.
const plain = (s) => String(s).replace(/[\u0000-\u001f\u007f]+/g, " ");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function input() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------------------------
// The folder

// This user's own, of the kind expected, and not a link to somewhere else. A folder is also closed
// to everyone else. On Windows the temp folder is already the user's, and there are no such modes.
function ours(file, kind) {
  let st;
  try {
    st = fs.lstatSync(file);
  } catch {
    return false;
  }
  if (!st[kind]()) return false;
  if (WINDOWS) return true;
  return st.uid === process.getuid() && (kind !== "isDirectory" || !(st.mode & 0o077));
}

function ownFolder(dir) {
  try {
    fs.mkdirSync(dir, { mode: 0o700 });
  } catch (e) {
    if (e.code !== "EEXIST") return false;
  }
  return ours(dir, "isDirectory");
}

// This session's notes: the UI files edited and when, when measure last passed, when we last
// asked, what each file was when last checked, and git as the turn began.
const noteFile = (session) => path.join(NOTES, `${String(session).replace(/[^\w.-]/g, "_")}.json`);
function readNotes(session) {
  const empty = { edited: [], editedAt: 0, measuredAt: 0, askedAt: 0, checked: {} };
  const file = noteFile(session);
  if (!ours(file, "isFile")) return empty;
  try {
    return { ...empty, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return empty;
  }
}
// A new file renamed over the old: never through a link, never half written.
function writeNotes(session, notes) {
  const next = path.join(NOTES, `.${crypto.randomBytes(8).toString("hex")}.tmp`);
  fs.writeFileSync(next, JSON.stringify(notes), { mode: 0o600, flag: "wx" });
  fs.renameSync(next, noteFile(session));
}

// The running @eyemark/mcp servers, newest first; an entry whose server is gone is removed.
function servers() {
  const out = [];
  for (const f of fs.readdirSync(RUN_DIR)) {
    const pid = Number(/^(\d+)\.json$/.exec(f)?.[1]);
    const entry = path.join(RUN_DIR, f);
    if (!pid || !ours(entry, "isFile")) continue;
    try {
      process.kill(pid, 0);
      // Never an address from the entry where it can be worked out: the socket sits beside it.
      const socket = WINDOWS ? String(JSON.parse(fs.readFileSync(entry, "utf8")).socket) : path.join(RUN_DIR, `${pid}.sock`);
      if (WINDOWS ? !socket.startsWith(PIPE) : !ours(socket, "isSocket")) continue;
      out.push({ socket, at: fs.statSync(entry).mtimeMs });
    } catch (e) {
      if (e.code === "ESRCH") fs.rmSync(entry, { force: true });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

function ask(socket, request, ms) {
  return new Promise((resolve, reject) => {
    const s = net.connect(socket);
    let buf = "";
    const timer = setTimeout(() => {
      s.destroy();
      reject(new Error("timeout"));
    }, ms);
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

// check_code's errors, or undefined when no server answered.
async function checkCode(args) {
  const until = Date.now() + TIMEOUT_MS;
  for (const server of servers()) {
    if (Date.now() >= until) break;
    try {
      const out = await ask(server.socket, { tool: "check_code", args }, until - Date.now());
      if (Array.isArray(out?.structuredContent?.errors)) return out.structuredContent.errors;
    } catch {
      // That one didn't answer: try the next.
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// What counts as UI

const slashes = (p) => p.split(path.sep).join("/");
function real(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

// The project a file is in: its git repository, else the session's folder when it holds the file.
function projectOf(file, cwd) {
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (path.dirname(dir) === dir) break;
  }
  return cwd && file.startsWith(path.join(real(cwd), path.sep)) ? real(cwd) : undefined;
}

// Could be UI, by its path alone.
const candidate = (rel) => (ALWAYS_UI.test(rel) || MAYBE_UI.test(rel)) && !NOT_UI.test(rel);

function isUi(root, rel) {
  if (!candidate(rel)) return false;
  if (ALWAYS_UI.test(rel)) return true;
  try {
    const st = fs.statSync(path.join(root, rel));
    if (!st.isFile() || st.size > MAX_BYTES) return false;
    const code = fs.readFileSync(path.join(root, rel), "utf8").replace(/^\s*(\/\/|\/?\*).*$/gm, "");
    return RENDERS.test(code);
  } catch {
    return false;
  }
}

// What a file is now, to tell whether it changed. Links and anything but a file are left alone.
function fingerprint(file) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile()) return undefined;
    return st.size > MAX_BYTES ? `${st.size}:${st.mtimeMs}` : crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// git: what changed in a turn

// Never takes the index's lock from the agent, and never runs a repository's fsmonitor command.
function git(root, ...args) {
  try {
    return execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "log.showSignature=false", "-C", root, ...args], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

function dirty(root) {
  const status = git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames");
  return status?.split("\0").filter(Boolean).map((e) => e.slice(3)).filter(candidate);
}

function snapshot(cwd) {
  const root = cwd && git(cwd, "rev-parse", "--show-toplevel")?.trim();
  if (!root) return undefined;
  const changed = dirty(root);
  if (!changed) return undefined;
  const files = {};
  for (const rel of changed) files[rel] = fingerprint(path.join(root, rel));
  return { root, head: git(root, "rev-parse", "-q", "--verify", "HEAD")?.trim() ?? "", files };
}

// The files in commits made here since `from`. Switches, pulls, merges and rebases bring in other
// people's work: only the reflog's own commits count.
function committed(root, from) {
  const head = git(root, "rev-parse", "-q", "--verify", "HEAD")?.trim() ?? "";
  if (!head || head === from) return [];
  const out = [];
  for (const entry of (git(root, "log", "-g", "-n", "50", "--format=%H%x09%gs", "HEAD", "--") ?? "").split("\n")) {
    const [sha, subject = ""] = entry.split("\t");
    if (!sha || sha === from) break;
    if (!/^commit( \((amend|initial)\))?:/.test(subject)) continue;
    const names = git(root, "diff-tree", "--root", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", sha, "--");
    out.push(...(names ?? "").split("\0").filter(Boolean));
  }
  return out;
}

// The UI files that differ from the turn's start by the agent's doing.
function changedSince(base) {
  const { root, head, files } = base;
  const found = new Set(committed(root, head));
  // In the middle of a merge, a rebase or a cherry-pick, what's changed is mostly someone else's.
  const midway = ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD"].some((ref) => git(root, "rev-parse", "-q", "--verify", ref));
  if (!midway) for (const rel of dirty(root) ?? []) found.add(rel);
  const out = [];
  for (const rel of found) {
    if (!candidate(rel)) continue;
    const file = path.join(root, rel);
    const now = fingerprint(file);
    if (!now || now === files[rel] || !isUi(root, rel)) continue;
    out.push({ rel, file, now, at: Math.min(Math.floor(fs.statSync(file).mtimeMs), Date.now()) });
  }
  return out;
}

// Adds what git saw to the notes, dated by each file's own time: a measure run after it counts.
function noteChanges(notes, changes) {
  for (const { file, at } of changes) {
    if (!notes.edited.includes(file)) notes.edited.push(file);
    notes.editedAt = Math.max(notes.editedAt, at);
  }
}

// ---------------------------------------------------------------------------------------------
// The events

function onPrompt(h) {
  const notes = readNotes(h.session_id);
  // The last turn was interrupted before it could stop: what it changed still counts.
  if (notes.open && notes.base) noteChanges(notes, changedSince(notes.base));
  notes.base = snapshot(h.cwd);
  notes.open = true;
  writeNotes(h.session_id, notes);
}

async function onEdit(h) {
  if (typeof h.tool_input?.file_path !== "string") return;
  const file = real(h.tool_input.file_path);
  const root = projectOf(file, h.cwd);
  if (!root) return;
  const rel = slashes(path.relative(root, file));
  if (!isUi(root, rel)) return;
  const notes = readNotes(h.session_id);
  if (!notes.edited.includes(file)) notes.edited.push(file);
  notes.editedAt = Date.now();
  writeNotes(h.session_id, notes);
  if (MEASURE_ONLY.test(rel)) return;
  const was = fingerprint(file);
  const errors = await checkCode({ files: [file] });
  if (!errors) return;
  // Read again: another hook may have written while check_code ran.
  const latest = readNotes(h.session_id);
  latest.checked[file] = was;
  writeNotes(h.session_id, latest);
  if (!errors.length) return;
  const lines = errors.slice(0, MAX_ERRORS).map((e) => `- ${e.check} line ${e.line}: ${e.message}${e.fix ? ` Fix: ${e.fix}` : ""}`);
  const more = errors.length > MAX_ERRORS ? `\n…and ${errors.length - MAX_ERRORS} more: call check_code on the file to see them.` : "";
  say({
    decision: "block",
    reason: `Eyemark found ${plural(errors.length, "error")} in ${plain(path.basename(file))} (check_code):\n${lines.join("\n")}${more}\nFix ${errors.length === 1 ? "it" : "them"} now; the file is checked again after your next edit.`,
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
  notes.edited = [];
  writeNotes(h.session_id, notes);
}

async function onStop(h) {
  const notes = readNotes(h.session_id);
  const changes = notes.base ? changedSince(notes.base) : [];
  noteChanges(notes, changes);

  const reasons = [];
  // Already continuing because of this hook: note what changed, ask nothing.
  if (!h.stop_hook_active) {
    // What changed without the edit hook seeing it as it is now.
    const unseen = changes.filter((c) => !MEASURE_ONLY.test(c.rel) && notes.checked[c.file] !== c.now).slice(0, MAX_FILES);
    const errors = unseen.length ? await checkCode({ root: notes.base.root, files: unseen.map((c) => c.file) }) : undefined;
    if (errors) for (const c of unseen) notes.checked[c.file] = c.now;
    if (errors?.length) {
      const lines = errors.slice(0, MAX_ERRORS).map((e) => `- ${e.check} ${plain(e.file)} line ${e.line}: ${e.message}${e.fix ? ` Fix: ${e.fix}` : ""}`);
      const more = errors.length > MAX_ERRORS ? `\n…and ${errors.length - MAX_ERRORS} more: call check_code on the files to see them.` : "";
      reasons.push(`Eyemark found ${plural(errors.length, "error")} in files changed this turn (check_code):\n${lines.join("\n")}${more}\nFix ${errors.length === 1 ? "it" : "them"}.`);
    }
    // Changed since measure passed, and since we last asked.
    if (notes.edited.length && notes.editedAt > Math.max(notes.measuredAt, notes.askedAt)) {
      notes.askedAt = Date.now();
      const from = real(h.cwd || process.cwd());
      const names = notes.edited.slice(-5).map((f) => plain(path.relative(from, f) || f));
      reasons.push(`Eyemark: UI files changed (${names.join(", ")}${notes.edited.length > 5 ? ", …" : ""}) and measure hasn't passed since. Before saying the work is done: make sure the dev server is running (start it in the background if it isn't), call measure on it with the routes these files touch, and fix every error until it passes. If the dev server can't start, say why measure didn't run.`);
    }
  }

  // What was seen is seen: what follows is compared with now.
  if (notes.base) notes.base = snapshot(notes.base.root);
  notes.open = reasons.length > 0;
  writeNotes(h.session_id, notes);
  if (reasons.length) say({ decision: "block", reason: reasons.join("\n\n") });
}

try {
  const h = await input();
  const on = { prompt: onPrompt, edit: onEdit, measured: onMeasured, stop: onStop }[process.argv[2]];
  if (on && ownFolder(RUN_DIR) && ownFolder(NOTES)) await on(h);
} catch {
  // Never in the agent's way.
}
