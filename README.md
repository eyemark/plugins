# Eyemark for Claude Code

A senior designer in your coding agent.

- **After every edit to a UI file**, Eyemark's code checks run on that file and the agent fixes what they find before it moves on: focus styles, field sizes, labels, transitions, icon buttons, copy.
- **Before the agent says it's done**, it measures the pages it changed on your dev server, in a real browser at desktop and phone width.
- **The skills:** `shape` before building, `critique` after, `fix`, and `research`.

Your code and your dev server stay on your machine.

## Install

In Claude Code:

```
/plugin marketplace add eyemark/plugins
/plugin install eyemark@eyemark
```

When you enable it, Claude Code asks for your Eyemark token; it's kept in your system's credential store. Needs Node 22 or later.

Keep your dev server running while you build: the code checks work without it, the rendered checks need it.

If you added Eyemark before with `claude mcp add eyemark …`, remove that entry (`claude mcp remove eyemark`): the plugin runs the same server.
