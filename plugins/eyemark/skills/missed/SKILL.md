---
name: missed
description: Send Eyemark something it let through, in one step. Use when the person types /eyemark:missed, says "Eyemark missed this", "the critique didn't catch it", or points at a design problem on a screen Eyemark passed (too much shown at once, a state nobody asked about, information missing where a decision is made, something left uncleaned). Takes their words, adds where on the screen, shows what it'll send, and sends it with report_feedback. No critique run needed first.
---

# Missed

The person saw something Eyemark didn't. That's the most useful thing Eyemark can hear: it's how a
miss becomes a fixture and then a check (`evals/README.md` in Eyemark's repo). Make sending it cost
them one line.

Whether the miss is right isn't decided here. The Eyemark team reads every report and decides
which become fixtures. Don't argue it, soften it or second-guess it; send it.

## Inputs

- **What they saw**, from the command's arguments or their last message. If there's none, ask once:
  "What did Eyemark miss, and where?" Nothing else.
- **Where**, from this session: the page open in the browser pane, the dev server or preview the
  session has been working on, or the file just edited. Don't go looking further than that.

## Steps

1. **Message.** Their words, as they wrote them, in their language. Don't rewrite, summarize or
   translate. If you add anything (the route, which part of the screen), it goes in the other
   fields, never in `message`.
2. **Where on the screen.** `route_or_file`: the route (`/settings/members`) or the file. `element`:
   the part of the screen in a few words ("the members table, 14 columns"). If the page is open,
   read it once to name the element; don't take screenshots, they aren't sent.
3. **Check.** Call `search_critique_checks` with a few of their words. If a check clearly fits, put
   its id in `check_id`. If none fits, leave it out and say "no check fits yet": that's useful too,
   it's how new checks start.
4. **Kind.** `missed`. If instead they say a finding Eyemark made was wrong, `wrong`; if it was
   right but hard to act on, `unclear`.
5. **Show, then send.** Show exactly what you'll send, field by field, and ask once. Send with
   `report_feedback` only on their yes. Then give them the feedback id in one line.

## Never send

- A screenshot, or the page's data: customer names, emails, figures, anything a person typed in.
  Describe the problem, not the content ("a table of customers, every column shown"), so it's safe
  to rebuild on a made-up page.
- An `excerpt` of code or markup, unless they say yes to that excerpt specifically.
- Anything that looks like a secret, a token or a credential.

## Rules

- One report per problem. Three things seen on one screen are three reports, sent together after
  one yes.
- Don't fix the screen in the same step unless they ask. Sending the report is the job.
- If `report_feedback` isn't available (Eyemark's MCP isn't connected, or the token isn't set), say
  so in one line and show them the text, so they can send it once it is.
