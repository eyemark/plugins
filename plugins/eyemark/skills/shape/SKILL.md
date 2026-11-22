---
name: shape
description: Shape a feature before anyone builds it. Use when a ticket, Slack thread, or idea is about to become UI, when someone asks "how should this work?", or before an agent starts building a user-facing feature. Produces a short feature brief (job, objects, placement, patterns, states, disclosure, copy, open questions) grounded in the product's context and the Eyemark principles.
---

# Shape

Most UX damage happens before the first line of code. By the time an agent is picking
components, it has already decided this is a modal, and that the record gets edited
here. This skill makes those decisions on purpose.

The output is a **feature brief**: short enough to paste into a Linear ticket, specific
enough to build against, and the thing `critique` will check the result against.

## Inputs

- The request: a ticket, a thread, a sentence. Read all of it, including comments.
- Product context: whatever the company gives you about the product, from a company
  context layer, docs, a PRODUCT.md, or the ticket. Look for the product's nouns, where each
  thing is edited, and decisions already made. If there's none, say so in the brief.
- The principles and patterns. With the Eyemark MCP, name the feature's parts (a list, a
  destructive action, a form) and call `plan_feature`: it returns the patterns, decisions,
  states and checks that apply. Without it, list them (`list_principles`, `list_patterns`) and
  open any whose `applies_when` or `use_when` matches the feature.
- The running product, if you can reach it: look at the screens this feature touches
  before deciding anything about them. They are the best record of how it already works.

## Steps

Work through these in order. Each one can stop you, and that's the point.

A single page or slide deck, not part of an app: skip objects, where it lives, states and risk. Write the job, the one message, the sections or slides in order, the precedents, and the words.

1. **The job.** Who is this for, and what are they trying to get done? One sentence,
   in their words. If the request only describes a solution ("add a button that..."),
   work back to the job. If you can't be sure, write the most likely job and mark it as
   Eyemark's guess.

2. **The objects.** Which of the product's objects does this touch? For each one, note
   where the product already edits each field it touches. If the feature needs a noun the
   product doesn't have, check it isn't an existing object under another name. For a
   genuinely new object, decide its name, where it lives and what can be done to it
   (principle `object-model`).

3. **Where it lives.** Put the feature where its object lives. Name the route or view.
   If it shows an object outside its home, it shows a reference, not a second editor.
   New top-level navigation is a call: make it and say why (principle `wayfinding`).

4. **Patterns.** For each part of the feature (a list, a destructive action, a creation
   flow, a settings area), find where the product already solves it. Match that if it
   clears the floor and passes the pattern's checks. If it doesn't, or nothing solves it
   yet, use a Eyemark pattern whose `use_when` matches (and whose `avoid_when` doesn't),
   apply its decisions for the platform you're building for, and note where it departs
   from the product. If neither fits, name the closest good existing screen and match it.
   What the code does isn't a decision; only what a person decided is (principle
   `consistency`).

5. **Precedents.** Research it the way a designer would before deciding, with the
   `research` prompt (or skill). Search by the job from step 1, not the feature's name.
   Take two or three precedents, direct (the same job) and adjacent (another domain, the
   same pattern), starting from the ones `plan_feature` lists. From each, capture the flow
   and entry point, the states, the copy, and what it gets wrong. Fill the Precedents table
   below, and cite them by name in the decisions they informed. Precedents inform a
   decision; they never override what a person decided for this product. Don't paste paid
   content into the repo.

6. **States.** Write the state matrix: first use, loading, empty after filtering, error,
   partial, populated, too much, no permission. One line each on what the person sees
   and can do (principle `states`).

7. **Disclosure.** What's in the first layer (enough to finish the common job), and
   what's one step away. Name each disclosure trigger (principle
   `progressive-disclosure`). Decide the primary action (principle `hierarchy`). Keep the
   first layer short: a title and one line, then the controls. No paragraph above them, no
   explanation repeated beside a control, no card inside a card, no colored side stripes.
   A multi-step job gets numbered steps, one decision each, only where order is the meaning.
   `plan_feature` lists the tells of generated UI to keep out.

8. **Risk.** List destructive or outward-facing actions and how each one recovers:
   reversible means do it and offer undo, permanent means confirm naming the object
   (principle `errors`). Match how the product already handles the same action if it
   recovers this way; if it doesn't, decide by this rule and say so. Note defaults that touch money, privacy, or
   other people (principle `defaults-and-choice`).

9. **Words.** The nouns (the ones the product already uses), the primary
   button label, and the first-use empty state copy (principle `copy`).

10. **Calls.** Collect every `escalate` condition you hit in steps 1 to 9. Make each call
    and write it in the brief with its reason. They don't hold up building: the person
    reads them and can say no.

## Output

```markdown
## Brief: <feature name>

**Job.** <who> wants to <job> so that <outcome>.

**Objects.** <Object> (edited in <surface>), <Object> (referenced only).

**Lives in.** <route or view>. <why there>

**Patterns.** <part>: <"matches <existing screen>", or a Eyemark pattern>, <as <precedent> does>.

**Precedents.**
| Product | Link | What they do | Why it suits their people | Borrow | Avoid |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

**Primary action.** <label>

**First layer / one step away.**
- Shown: ...
- Behind "<trigger label>": ...

**States.**
| State | Sees | Can do |
|---|---|---|
| First use | ... | ... |
| Loading | ... | ... |
| Empty (filtered) | ... | ... |
| Error | ... | ... |
| No permission | ... | ... |

**Risky actions.** <action>: <undo / confirm naming the object / type-to-confirm>.

**Copy.** Nouns: ... Empty state: "..."

**Calls made.** (none) or <call>: <what Eyemark decided> because <reason>.

**Open questions.** Only what the code and the request can't tell you (a business rule, a price, who may do it), each with Eyemark's answer, which is what gets built unless someone says otherwise.
```

Keep it under a screen. If the brief is long, the feature is probably two features.

## Where this runs

- **In Claude Code**, before building: write the brief, then build against it.
- **On a Linear ticket**: post the brief as a comment, with open questions at the top.
- **In a Slack thread**: answer with the job, where it lives, and the open questions.
  Offer the full brief rather than pasting it.

The rules are the same everywhere. Only the length changes.

## Next

Build against the brief. After each edit to a UI file, fix what `check_code` finds in it (Eyemark's
plugin runs it for you on Edit and Write; otherwise call it, where the server has it). After each
part, run `measure` on the dev server with the routes it touches and fix what it finds. When the feature is built, run `critique` on the running UI.
