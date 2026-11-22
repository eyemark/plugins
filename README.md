# Eyemark for Claude Code

A senior designer in your coding agent.

- **After an edit to a UI file**, Eyemark's code checks run on that file and their errors go straight back to the agent: focus styles, field sizes, labels, transitions, icon buttons, copy.
- **Before the agent says it's done**, it's asked once to measure the pages it changed on your dev server, in a real browser at desktop and phone width. In a git repository, UI files it changed with shell commands are found and checked then too.
- **The skills:** `shape` before building, `critique` after, `fix`, and `research`.

Your code and your dev server stay on your machine.

## Install

In Claude Code:

```
/plugin marketplace add eyemark/plugins
/plugin install eyemark@eyemark
```

Then enter your Eyemark token, if Claude Code didn't ask for it during the install:

```
/plugin configure eyemark@eyemark
```

It's kept in your system's credential store. Restart Claude Code once it's set. Needs Node 22 or later.

Plugins from this marketplace don't update on their own unless you turn that on: `/plugin`, then Marketplaces, eyemark, and enable auto-update. The checks themselves always come from Eyemark up to date, with nothing to install.

What the hooks don't see: shell edits outside a git repository, to files git ignores, or in a worktree the agent moved to in the middle of a turn. The code checks don't read Vue, Svelte or Astro files; `measure` covers those.

Keep your dev server running while you build: the code checks work without it, the rendered checks need it.

If you added Eyemark before with `claude mcp add eyemark …`, remove that entry (`claude mcp remove eyemark`): the plugin runs the same server.
