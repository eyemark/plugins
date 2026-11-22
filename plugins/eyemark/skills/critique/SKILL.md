---
name: critique
description: Critique a running feature's UX against the Eyemark principles and patterns, and how the product already works. Use after a user-facing feature is built, on a PR that changes UI, or when someone asks "is this good?" or "review the UX". Walks the real UI in a browser, forces the states, and returns ranked findings (P0/P1/P2), each tied to a principle check and backed by evidence.
---

# Critique

Look at what was built, not at what anyone says was built. Generative tools are good at
explaining design reasoning they didn't apply. This skill only trusts the rendered
screen.

## Inputs

- **What to review.** A URL or route on a running app, or a PR. For a PR, read the diff
  to find which routes and components changed, then start the app (or use the preview
  deployment) and review those routes.
- **The brief**, if `shape` produced one. Findings against the brief come first.
- **Product context.** Whatever the company gives you about the product (a company
  context layer, docs, a PRODUCT.md): its nouns, where things are edited, decisions
  already made. If there's none, the existing screens are the context.
- **The principles.** Every principle whose `applies_when` matches. Use their `checks`
  as your checklist, with the `severity` each one declares.

You need a browser you can drive (Playwright, or a browser tool). Without one, say so
and do a code-only review, clearly labeled as weaker.

**Who runs it.** Not the agent that built it, when there's a choice. If you built the feature
and can start a subagent, give this critique to a fresh one, with only the brief, the diff and
the running UI: not your reasoning or your notes. A reviewer who saw how it was made reads the
intent into the screen. Fix what it finds, run it again on what changed, and post its findings
by check id in the pull request.

## Steps

1. **Map the feature.** List the views, the objects on each, and the main job. If there
   is a brief, use its job. Otherwise infer it from the PR or ticket and state it.

2. **Walk the main job.** Do it end to end as a person would. Screenshot each step.
   Note every place you hesitated, and why.

3. **Force the states.** The happy path is the least interesting part. On a single page or
   deck with no data, force only phone width, dark mode, reduced motion, long text and the keyboard.
   - First use: empty data (fresh account, or intercept the API with an empty list).
   - Filtered empty: a filter that matches nothing.
   - Error: block or 500 the data request, and a submit request.
   - Slow: throttle the network.
   - Long content: a 120-character name, 500 rows.
   - Keyboard only: tab through the main job.
   - Double submit, back button, refresh with state.

4. **Collect layer 1 evidence.** Measure, don't eyeball. Run Eyemark's `measure` tool on the
   views you walked (`url` the dev server, `routes` the paths; from a shell, `eyemark measure
   --url <base> --routes <paths> --no-perf`). It renders each view at desktop and phone width and
   runs the rendered checks: contrast, reflow, focus, targets, labels, the tells of generated UI,
   and the rest of the catalog. Report its findings under their check ids, every instance it
   lists. If a view wasn't in the run, say so; don't restate a pass you didn't measure. With no
   `measure` (the hosted server has none; the `@eyemark/mcp` npm server has it), `start_review` on the pull request's preview, then
   `get_review`. Anything you measured by hand goes under a `layer1/<check>` id.

5. **Run two passes, independently.** If you can spawn subagents, give each pass to a
   separate one so they don't bias each other. Otherwise do them one after the other
   and don't revise the first after reading the second.
   - **Principles pass.** Go through the matching principles' `checks`. Pass, fail, or
     not applicable, with evidence.
     Then the tells of generated UI (`plan_feature` lists them under Keep out, each with its
     check id). Most are measured in step 4; report the rest you can see under the same ids.
   - **Product pass.** Compare against how the product already works:
     - The product context, if any: each field edited where the product edits it, the
       product's nouns used everywhere, destructive actions recovering the way the
       product's other actions do (reversible: no confirm, offer undo; permanent:
       confirm naming the object).
     - Patterns: for any part that uses a Eyemark pattern (a settings rail,
       filters in the URL, row actions), run that pattern's checks, cited as
       `pattern-id/check-id`.
     - The references the brief picked (its Precedents, and any screen it said to follow):
       does the result do what they do where the brief said to? Name the reference in the
       finding. A departure the brief didn't decide is a finding; one the brief decided isn't.
     - The two most similar existing screens: does this solve the same problem the same way,
       or a better way that it says? An unexplained departure is a finding; a better one
       isn't. Where the existing screens are the weaker ones, that's a finding on them.

     If a UX reference source is connected (for example the Built for Mars MCP), you
     may cite a well-known product's solution as supporting evidence for a fix. Never
     as a finding on its own.

6. **Merge and rank.** Deduplicate. Rank by severity, then by how many people hit it.
   Drop anything you can't point to on a screen.

7. **Calls.** List the principle `escalate` conditions the feature meets, with the call the
   build made on each and whether it holds. A call missing or weak is a finding, with your
   call as the fix.

## Finding format

```markdown
### P1 · Second place to edit a project's owner
**Check:** object-model / one-edit-surface
**Where:** /projects/42 → Settings tab → "Owner" select
**Evidence:** screenshot 04. The project's name and owner are already edited in the project page header.
**Why it matters:** two editors with different validation. People won't know which one wins.
**Fix:** replace the select with the owner chip that opens the header editor.
```

## Report

```markdown
## Critique: <feature> (<url or PR>)

Job reviewed: <one sentence>
Reviewed: <routes> · States forced: <list> · Browser: <yes/no>

**P0** (n) · **P1** (n) · **P2** (n)

<findings, P0 first>

### Calls
<condition: the call made, and whether it holds; or "None">

### Passed
<checks that passed, one line each, so the author knows what was covered>

### Candidate patterns
<anything built here that a Eyemark pattern should cover and doesn't yet>
```

## Rules

- Every finding names a check. If it doesn't fit any check, it goes under a "Taste"
  heading at the end, clearly labeled as opinion, at most 3 items.
- No finding without evidence a person can reproduce.
- Don't rewrite the feature. Suggest the smallest fix that passes the check.
- When a person's decision for this product and a principle disagree, the person's
  decision wins, unless it's below the floor; note it under Calls. What the code merely
  does isn't a decision: where it disagrees with a principle, the principle wins.
- On a PR, post the report as a single review comment. Inline comments only for
  findings tied to a specific line.

## Before calling it done

On your own change, the work isn't done until this critique has run on the running UI and
`measure` ends in PASS (or `get_review` on the preview shows no errors). Fix every error and P0,
measure again, then say which warnings and P1/P2 findings remain, by check id, when you report
the work done.

## Next

Run `fix`: it applies the findings the catalog marks `fix: auto` and writes the decision list for
the rest.
