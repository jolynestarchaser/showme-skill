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
