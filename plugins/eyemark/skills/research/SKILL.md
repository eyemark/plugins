---
name: research
description: Research how other products solve a feature's job before deciding how it works. Use while shaping a feature, at the brief's Precedents step, or when someone asks "how do others do this?". Searches by the job, takes direct and adjacent precedents, captures the flow, states, copy and mistakes of each, and returns them in a fixed table the brief's decisions cite.
---

# Research

A designer looks at how others solved the job before deciding. Not to copy a screen, but
to see which patterns people already know, what they cost, and where they break. This is
that step, done the same way every time, so the brief can cite what it learned.

You do the searching. Eyemark gives the method and the starting points: `plan_feature`
lists curated precedents for the patterns that match the feature's parts.

## Inputs

- The job, from the brief's first step: who, and what they're trying to get done.
- The patterns that match, from `plan_feature`, with their curated precedents.
- The web, and a UX reference source if one is connected (like the Built for Mars MCP).
- This product's own design references and how it already works. What a person decided
  comes first; what the code merely does is evidence, not a rule.

## Steps

1. **Search by the job, not the feature's name.** "Remove someone from a team without
   losing their work", not "delete user modal". Write two or three searches in the
   person's words, and one with the pattern's name.

2. **Take two kinds of source.**
   - **Direct:** products doing the same job for similar people. Start from the curated
     precedents `plan_feature` lists for the matching patterns, then add what the searches
     turn up.
   - **Adjacent:** products in another domain that use the same pattern for a different
     job (a bank's undo for a payment, for an undo on delete). They show the pattern
     without the habits of one industry.
   Two or three in all is enough; at least one of each kind when there is one.

3. **Capture the same things from each.**
   - **Flow and entry point:** where the person starts, the steps, where they end up.
   - **States:** empty, loading, error and no permission. What each one says and offers.
   - **Copy:** the button labels, the headings, the error and empty-state messages.
   - **What it gets wrong:** the step that confuses, the state that's missing, the
     complaint people make about it.
   Look at the product itself or its help pages, not a screenshot gallery. Note where
   you couldn't see something rather than guessing.

4. **Write them in the brief's format.** One row each, in the Precedents table. Then each
   decision in the brief that a precedent informed cites it by product name: "Undo in a
   toast, as Gmail and Linear do".

| Product | Link | What they do | Why it suits their people | Borrow | Avoid |
|---|---|---|---|---|---|

## Limits

- **Precedents inform a decision; they don't make it.** What a person decided for this
  product wins. Where a precedent disagrees with what the code merely does, the better of
  the two wins: the one that clears the floor and fits these people. Say which, and why.
- A precedent that fits their people may not fit ours. "Why it suits their people" is
  where that shows; if it doesn't hold here, don't borrow it.
- Link to the source. Don't paste paid content or screenshots into the repository.

## Next

Go back to `shape`, step 5: put the table in the brief and cite each precedent in the decisions it
informed.
