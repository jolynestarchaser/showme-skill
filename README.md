# showme

A Claude Code skill that turns a repository, task, runtime flow or git diff into an evidence-backed visual explanation: a Mermaid diagram, an interactive HTML explorer, and a plain-language walkthrough in English or Thai.

It is built for people who need to understand code they did not write: junior developers, career switchers, new team members, and anyone reviewing what an AI coding agent just changed.

## What it does

| Command | Result |
|---|---|
| `/showme` | Picks the most useful view from the conversation and repository |
| `/showme repo` | Mental model of the repository |
| `/showme task "add repository search"` | Implementation map for a task |
| `/showme flow auth` | How a flow actually executes |
| `/showme diff` | What was added, removed, modified, moved or renamed, and why it may have been built that way |
| `/showme change` | Impact and blast radius of a change |
| `/showme walkthrough "plugin system"` | Clickable HTML walkthrough |
| `/showme oop "payment domain"` | Class and domain model |
| `/showme translate th "text"` | Technical translation that leaves identifiers untouched |

Options: `--lang auto|th|en|th-en|en-th`, `--interactive`, `--static`, `--mermaid`, `--json`.

```text
/showme repo --interactive --lang th
/showme diff main..HEAD --interactive --lang th-en
/showme flow "authentication" --mermaid --lang en
```

Output goes to `.showme/<topic>/` inside the repository you run it in. Open `index.html` in a browser.

## Guided reading

Every page opens as a guided reader instead of a wall of sections, so you can see what happened, why, how it changed, what it affects and where the evidence is without interpreting the whole graph yourself.

- **Start here:** the title, a one-sentence TL;DR, the task, the scope, the node to look at first, and a "Start guided reading" button.
- **Five steps:** Problem → Root cause → Fix → Impact and risks → Evidence. Each step has one main idea, a short explanation and collapsed technical details. You can go back, jump to any step, or skip ahead at any time.
- **Focused graph:** the explorer opens on one critical path through the key node at a readable size, with a "View full graph" button for everything else.
- **Inspector:** selecting a node answers three questions first (What is it? Why does it matter? How is it connected?), then offers expandable sections. Every source path has a Copy button.
- **Reader controls:** text size, Auto/Light/Dark theme and reading width, remembered in your browser.

### Three reading modes

| Mode | What you see |
|---|---|
| **Scan** | An at-a-glance summary: problem, root cause, key changes, main risk, next action. Everything else is collapsed. |
| **Understand** (default) | One guided step at a time, with the graph limited to the critical path and evidence collapsed until you ask for it. |
| **Deep Dive** | Everything open: all five steps, the full graph, the git diff summary, changed symbols, risks, tests, unknowns and the complete evidence table. |

Switching mode only changes presentation. Nothing is removed, the content is derived from `graph.json` on every build, and a field the source does not provide is shown as "Not available in source".

Confidence labels (FACT, INFERENCE, UNKNOWN) are drawn in a neutral colour with different borders and glyphs, while change status (added, modified, deleted, moved) uses colour plus a word, so the two are never told apart by colour alone. Both themes meet WCAG AA contrast.

Links can point at a state: `index.html#step-3`, `index.html#mode-deep`, `index.html#node-<id>`.

## How it works

Every run writes one `graph.json`, and `scripts/showme.mjs` derives everything else from it: the Mermaid source, the HTML page, the explorer and `summary.md`. The explorer in `viewer/` is plain JavaScript and SVG with no dependencies, and the page still reads correctly with JavaScript disabled.

Conclusions are labelled FACT, INFERENCE or UNKNOWN. The skill is instructed never to invent an edge, an intention or an impact that the repository does not support.

## Install

Requires [Claude Code](https://claude.com/claude-code) and Node.js.

```bash
git clone https://github.com/jolynestarchaser/showme-skill ~/.claude/skills/showme
```

Then run `/reload-skills` in Claude Code.

### Companion skills

`/showme` is a router. It delegates to these skills when they are installed and falls back to doing the work directly when they are not. None of them are bundled here.

Visualization skills:

```bash
npx skills@latest add alexanderop/walkthrough --skill walkthrough --agent claude-code --global --yes
npx skills@latest add shidil/mermaid-diagram-skill --skill mermaid-diagram --agent claude-code --global --yes
npx skills@latest add rehanrnd/claude-code-arch-diagram --skill arch-diagram --agent claude-code --global --yes
npx skills@latest add ZhongliangGuo/oop-architect --skill oop-architect --agent claude-code --global --yes
```

`mermaid-diagram` matters most: its render script produces the static SVG. Without it the page and explorer are still built, but there is no static diagram.

Analysis skills, used by name if present: `spec-miner`, `architecture-designer`, `writing-plans`, `ux-flow-designer`, `legacy-modernizer`.

## Using the build script directly

```bash
node scripts/showme.mjs validate <dir>          # check <dir>/graph.json
node scripts/showme.mjs mmd <dir> [--force]     # derive map.mmd
node scripts/showme.mjs build <dir> [--static]  # write index.html and summary.md
```

`examples/diff-session-refresh/graph.json` is a complete bilingual example with synthetic paths. The format is documented in `references/graph-schema.md`.

## Status

The build pipeline, the page and the explorer have been tested on the bundled example. `diff` and `change` have not yet been exercised against a real git repository, and the "Installed skill notes" section of `SKILL.md` describes one specific machine's layout, so adjust paths there if yours differ.

## License

MIT. See [LICENSE](LICENSE).
