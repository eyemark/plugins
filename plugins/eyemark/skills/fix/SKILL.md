---
name: fix
description: Fix the Eyemark findings an agent may fix on its own, and hand everything else to a person with options. Use before opening a pull request that changes UI (the agent that built the change runs it on its own branch), on a pull request after the Eyemark check ran, when someone says "fix the design findings", or when given findings from check_code, measure, or eyemark's JSON. Applies only fixes marked `fix: auto` in the catalog, verifies each by measuring again, and writes one decision list for the rest.
---

# Fix

The Eyemark comment splits findings in two. **The agent can fix these**: mechanical,
one right answer, they change how faithfully the design is rendered (scrollbar-gutter,
tabular-nums, a missing lang, transitions instead of keyframes). **Needs a decision**: they
change copy, color, layout, behavior, or a budget. This skill fixes the first pile and only
prepares the second.

## When to run it

- **Before the pull request (preferred).** The agent that built the change runs this on its
  own branch, against the local dev server, before pushing. The pull request arrives with the
  mechanical fixes already in, and the decisions in its description, where the reviewer
  reads them. No second agent, no extra commits after review starts.
- **On the pull request (safety net).** For changes that skipped the step above, written by
  people or by agents without this skill, the workflow in `templates/github/` runs it in CI
  after the Eyemark comment.

## Inputs

- The findings. Before a pull request, produce them yourself, with what you have:
  - **Eyemark's MCP tools** (the plugin, `@eyemark/mcp`): `check_code` on the files you changed, and
    `measure` on the local dev server with the routes you changed.
  - **The `eyemark` CLI** (a repository that installs the package, CI):
    `eyemark measure --url http://localhost:<port> --routes <the routes you changed> --no-perf --json`
    and `eyemark copy --json`.
  On a pull request, the workflow downloads `eyemark-findings.json` and `eyemark-copy.json` as an
  artifact.
- The catalog, for each check's `fix` (`auto` or `review`): `list_automated_checks` on the MCP
  server, or `checks/automated.yaml` in the Eyemark package, which also has its `rule` and `why`.
  Without the package, the finding's message says what's wrong and why.
- The repo, checked out on the pull request's branch.

## Steps

1. **Split.** If you measured yourself, keep that run to compare against (with the CLI,
   `eyemark measure --save`). Group findings by check id. A check is yours only if the catalog says
   `fix: auto` (and `copy/no-three-dots`). Everything else goes to step 5, untouched.

2. **Find the source.** For each finding, use its route, the `where` text (element,
   selector, or file:line), and the check's rule to find the code that produces it. Prefer
   the shared place (a token, a base style, a component) over patching each instance, when
   that's what the rule implies (one `scrollbar-gutter: stable` on `html`, one
   `antialiased` on `body`, `font: inherit` on form controls).

3. **Fix, smallest change that passes the rule.** No redesign, no new dependencies, no
   copy rewrites, no color or token changes. If, once you look, the fix isn't mechanical
   (the overflow comes from a layout choice, the label text isn't obvious from context, the
   transition is part of a designed sequence), stop and move that finding to step 5 with
   what you learned.

4. **Verify.** Run the repo's tests, then check again: `check_code` on the files you touched and
   `measure` on the routes that had findings, compared with step 1's. (With the CLI,
   `eyemark measure --only-failed --save` re-measures only those routes and lists what's fixed,
   what's new, and the score.) A fix counts only if its finding is gone and nothing new appeared.
   Revert any fix that fails either.

5. **Hand the rest to a person.** Write one decision list, ordered by severity: for each
   check, what's wrong in a sentence, where (count and routes), why it matters (from the
   catalog's `why`), two or three options with their trade-off, and your recommendation.
   Number the options so a person can answer "proximity: 2".

6. **Report.** Commit fixes in one commit per check, with the message
   `eyemark: fix <check id>` and the finding it resolves. Then:
   - **Before the pull request:** put the report (fixed, moved, decisions) under a "Design"
     heading in the pull request's description.
   - **On a pull request:** post (or update) one reply: what you fixed (check, files,
     verified), what you moved to decisions and why, and the decision list.

## Output

```markdown
### Eyemark · fixed 4, 3 need a decision

**Fixed** (one commit each, verified by checking again)
- `type/font-smoothing`: `antialiased` on body (src/index.css).
- ...

**Moved to decisions**
- `layout/reflow` on /settings: the overflow comes from a fixed-width table, not box-sizing.

**Needs a decision**
1. `layout/proximity` (warning, 3× on /, /settings): items in the filter card sit 24px
   apart inside 12px of padding, so they read as unrelated. Why: ...
   1. Tighten the gap to 8px (keeps the card's size).
   2. Increase the padding to 24px (more air, card grows).
   3. Leave it: the card is a toolbar.
   Recommendation: 1.
```

## Rules

- Never touch a `fix: review` finding, even when the change looks small.
- Never change copy, colors, tokens, layout, or spacing values on your own.
- One commit per check, so a person can revert one without the others.
- Don't fix what the pull request didn't cause, unless the fix is one line in a shared base
  style; say so in the report.
- If the tests fail before you start, don't fix anything: report that instead.

## Next

The work is done when `measure` passes and the decision list is where a person will read it (the
pull request's description, or its Eyemark reply). If a fix changed what a person sees, run
`critique` again on those views.
