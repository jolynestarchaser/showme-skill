---
name: showme
description: Visual-first repository, task, runtime-flow, architecture, and code-change mapper. Use when the user explicitly asks /showme to understand a codebase, task or git diff through diagrams, dependency maps, evidence-backed flows, interactive explorers, or Thai/English walkthroughs instead of prose alone.
argument-hint: "[auto|repo|task|flow|change|diff|walkthrough|oop|translate] [topic] [--lang auto|th|en|th-en|en-th] [--interactive|--static|--json|--mermaid]"
disable-model-invocation: true
---

# Show Me

Turn the current repository, feature, task, runtime flow, or code change into an evidence-backed visual explanation.

The command is visual-first.

A response consisting only of prose is a failure unless no meaningful diagram can possibly be produced. (`translate` mode is the one exception: it is text-only.)

`/showme` is also a teaching tool. One of its main jobs is helping junior developers, career switchers, new team members and vibe coders understand what an AI coding agent changed, how the change fits the repository, and why it may have been built that way. Treat the git diff as one of the most important sources of evidence.

## Reference files

Read these on demand; do not load all of them for every run.

| File | Read when |
|---|---|
| `~/.claude/skills/showme/references/graph-schema.md` | writing `graph.json` |
| `~/.claude/skills/showme/references/interactive.md` | generating files under `.showme/` (build steps, explorer features, renderer choice) |
| `~/.claude/skills/showme/references/diff-learning.md` | mode is `diff` or `change` |
| `~/.claude/skills/showme/references/language.md` | output is Thai or bilingual, or mode is `translate` |
| `~/.claude/skills/showme/examples/diff-session-refresh/graph.json` | a concrete `graph.json` is needed as a model |

## Arguments

Read `$ARGUMENTS` as:

```text
/showme [mode] [topic] [options]
```

Modes:

- `auto`
- `repo`
- `task`
- `flow`
- `change`
- `diff`
- `walkthrough`
- `oop`
- `translate`

If the first argument is not a recognized mode, treat the whole argument string as a topic and use `auto`.

If no arguments are supplied, use `auto` and infer the most useful view from the current conversation and repository.

Options:

| Option | Meaning |
|---|---|
| `--lang auto\|th\|en\|th-en\|en-th` | Output language. Default `auto`: reply in the language of the request. |
| `--interactive` | Build the JavaScript explorer. |
| `--static` | Build a script-free page with the Mermaid diagram only. |
| `--mermaid` | Same as `--static`, and also print the Mermaid source in the reply. |
| `--json` | Write and validate `graph.json` only; no rendering. Report its path. |

For `diff`, everything after the mode that is not one of these options is passed to git (`--staged`, a revision, a range such as `main..HEAD`, or a path).

Examples:

```text
/showme repo --interactive --lang th
/showme task "Implement GitHub sync" --interactive --lang th-en
/showme flow "authentication" --mermaid --lang en
/showme diff
/showme diff --staged
/showme diff main..HEAD --interactive
/showme change --interactive --lang th
/showme repo --json
/showme translate en "ระบบนี้ทำหน้าที่วิเคราะห์ dependency ของ repository"
```

## Core principle

/showme is ONE entry point, but it must NOT blindly run every installed skill.

Use the minimum combination of skills required to produce the best evidence-backed visual.

Think of `/showme` as an orchestrator/router.

## Evidence first

Before drawing:

1. Inspect the actual repository.
2. Identify relevant entry points, files, symbols, modules, APIs, stores, services, database objects, configs and dependencies.
3. Separate facts observed in code from architectural inference.
4. Never invent an edge in a graph just because it would make architectural sense.
5. Every important node should be traceable to real repository evidence where possible.

Label conclusions by confidence:

- **FACT**: directly visible in code, the diff, tests, configuration, a task description, a commit message, or the current conversation.
- **INFERENCE**: a likely reason derived from repository structure and surrounding code.
- **UNKNOWN**: cannot be established from the available evidence.

Never present an inference as a fact, and never invent an author's or agent's intention. Do not display information that repository evidence cannot support.

Prefer `spec-miner` for codebase archaeology and dependency discovery.

## Routing

### auto

Determine what the user is trying to understand.

Choose the smallest useful pipeline from the modes below.

Do not ask the user to choose a mode when the intent can reasonably be inferred. If the conversation has just produced code changes and the user gives no topic, prefer `diff`.

### repo

Goal:
Show the mental model of the repository.

Preferred pipeline:

spec-miner
→ architecture-designer
→ arch-diagram when useful
→ mermaid-diagram

Find:

- entry points
- major modules
- application layers
- important internal dependencies
- external services
- storage
- queues/events if present
- boundaries
- important shared infrastructure

Avoid dumping the entire directory tree.

Compress the repository into approximately 5–15 meaningful concepts per diagram.

For large repositories, create multiple focused diagrams instead of one unreadable graph.

Typical diagrams:

1. System/component overview
2. Internal module dependencies
3. Important runtime/data flow
4. Deployment topology only when deployment evidence exists

`arch-diagram` is supplementary. Use it mainly for component overview, module dependencies, request/data flow and deployment topology. Do not automatically use it for every `/showme` request.

### task

Goal:
Turn an engineering task into a visual implementation map.

Preferred pipeline:

spec-miner
→ writing-plans
→ architecture-designer when cross-layer impact exists
→ mermaid-diagram

Show:

Task
→ affected systems
→ affected modules/files
→ implementation steps
→ dependencies
→ tests
→ verification

Clearly distinguish (node `status`):

- existing
- modify
- create
- uncertain (`partial` or `unknown`)

Prefer a dependency/task graph over a long numbered implementation plan.

### flow

Goal:
Explain how something actually executes.

Preferred pipeline:

spec-miner
→ ux-flow-designer
→ mermaid-diagram

Select the correct visualization automatically:

- sequence diagram for actor/service/API interactions
- flowchart for processing pipelines
- state diagram for lifecycle/state transitions
- ER diagram for data relationships

Trace from trigger/input to final effect/output.

### change

Goal:
Show what changed and what the change impacts (blast radius).

Inspect git status and diff when this is a git repository.

Preferred pipeline:

git evidence
→ spec-miner
→ architecture-designer only if architectural boundaries changed
→ mermaid-diagram

Visualize:

changed file/symbol
→ module
→ dependent module
→ user-visible/runtime effect

Identify:

- direct changes
- downstream impact
- tests affected
- risk areas
- untouched related systems

Do not claim impact without evidence.

Read `references/diff-learning.md`; `change` and `diff` share that pipeline.

### diff

Goal:
Teach the reader what changed, how it fits the repository, and why it may have been built that way.

Preferred pipeline:

git evidence
→ changed files → changed symbols
→ repository context (callers, dependencies, tests, types, related modules)
→ behavior change
→ impact graph
→ educational explanation

Read `references/diff-learning.md` before starting and follow it. In short:

- Run read-only git commands only.
- Explain each meaningful change in its repository context, never as an isolated line.
- Say explicitly what was ADDED (`+`), REMOVED (`-`), MODIFIED (`~`), and MOVED or RENAMED (`→`), grouped by symbol or behaviour, not by line. The reader must understand the actual diff without reading raw `+`/`-` lines; restating diff syntax or line counts is not an explanation.
- Open with a compact semantic diff summary, then a per-file summary (CHANGE / ROLE / WHY IT MATTERS / IMPACT). Group lockfiles and other trivial files under minor changes.
- For every removal, say whether the behaviour disappeared or moved, and pair removed code with its replacement. Never assume deleted code means deleted functionality.
- Show conceptual before/after behaviour instead of raw diff text, with a DELTA block for important paths.
- Explain new files, deleted code, renames, moves and extractions as structural changes.
- Explain what behaviour the tests protect.
- Separate FACT, INFERENCE and UNKNOWN. Say "This change achieves…" or "A likely reason is…", not "The agent wanted…".
- Write for someone who knows basic programming but not this repository; explain a framework concept only when the change depends on it.
- Order the reply: Big picture → Change map → Added → Removed → Modified → Moved/Renamed → Before → After → Repository impact → What the agent achieved → What you should learn → Risks / things to check. Drop sections that would be empty; never output an empty heading.
- Produce an impact map whenever several files or modules changed, including `unchanged` nodes needed to show the path to the effect.

Use `diff` when the user mainly wants to understand the code; use `change` when they mainly want impact analysis.

### walkthrough

Goal:
Create a richer interactive explanation.

Preferred pipeline:

spec-miner
→ walkthrough

Use the installed `walkthrough` skill to generate its interactive HTML explanation.

Walkthrough is preferred when:

- onboarding to an unfamiliar subsystem
- explaining “how does X work?”
- the user wants clickable nodes
- code snippets/files should be browsable from the diagram
- a static Mermaid diagram would hide too much useful context

Keep the conceptual graph small enough to understand quickly.

Place the resulting HTML under `.showme/<topic-slug>/walkthrough.html` instead of the repository root.

### oop

Goal:
Generate or refresh an object-oriented architecture view.

Preferred pipeline:

spec-miner
→ oop-architect
→ mermaid-diagram if additional rendering is useful

`oop-architect` is OPTIONAL. Only use it when the repository or requested subsystem is meaningfully object-oriented and class/domain modeling would clarify the system.

Good fits: Java, C#, Kotlin, class-heavy TypeScript/Python, domain models, service/repository abstractions, stateful object graphs.

Poor fits: tiny scripts, mostly functional code, simple React component collections, pipelines where class structure is not the main architecture.

Do not force UML/classes onto functional, script-oriented, React-component-only, or otherwise non-OOP codebases.

If OOP is not appropriate, automatically fall back to `repo` mode and explain that choice in one sentence.

### translate

Goal:
Translate technical text between Thai and English.

```text
/showme translate th|en|th-en|en-th "text"
```

Text only: no repository inspection, no files, no diagram. Preserve technical identifiers and translate only the natural-language content. Rules and examples are in `references/language.md`.

## Visualization stack

In priority order:

1. Mermaid for fast static diagrams
2. HTML + CSS + JavaScript for interactive exploration
3. `graph.json` as the reusable intermediate graph format

`graph.json` is the source of truth. The Mermaid diagram, the page, the explorer and `summary.md` are derived from it with `~/.claude/skills/showme/scripts/showme.mjs`, so they cannot drift apart. Do not hand-write viewer JavaScript per run; the explorer ships with the skill.

Do not require a frontend framework for basic output. Output is standalone HTML that opens locally in a browser.

### Choosing static or interactive

When neither `--interactive` nor `--static` is given:

Use the static Mermaid page when:

- the graph is small
- the user needs a quick answer
- interaction provides little benefit

Use the interactive explorer when:

- the repository is large
- the graph has multiple layers
- the user needs dependency exploration
- there are meaningful node details (always true for a multi-file `diff`)
- change impact has several dependency paths
- walkthrough behavior would improve understanding

The interactive page already contains the static diagram as its fallback, so for a repository overview one build serves both purposes.

Renderer choice beyond the bundled explorer (Cytoscape.js, D3.js, React Flow) is covered in `references/interactive.md`. Default to the bundled explorer; never add React just to display a small graph, and never add visualization dependencies to the application itself unless the user explicitly asks.

## Building the output

Follow the numbered steps in `references/interactive.md`. Summary:

concept map
→ `graph.json`
→ `showme.mjs validate`
→ `map.mmd` (`showme.mjs mmd`, or hand-written for sequence/state/ER/class)
→ render to `map.svg` with the `mermaid-diagram` skill
→ inspect, fix syntax/layout, re-render
→ `showme.mjs build` (add `--static` for a script-free page)
→ open `index.html`

Use the `mermaid-diagram` skill as the rendering and visual-validation layer. Do not stop after generating Mermaid source if rendering tooling is available.

Choose diagram direction intentionally.

Do not create a uniform wall of boxes.

Use grouping/subgraphs only when they clarify a real architectural boundary.

Prefer meaningful edge labels when the relationship is not obvious.

## Diagram density

Target:

5–15 primary nodes per static diagram.

If a diagram would exceed roughly 15 important nodes, split it (for example System overview + Data flow, or Frontend + Backend + Infrastructure) or move the detail into the interactive explorer and keep the static diagram as the overview.

Never optimize for completeness at the expense of readability.

## Evidence annotations

For important nodes, include concise evidence such as:

`src/services/repository.ts`
`RepositoryService.search()`

or equivalent file/symbol references, in the node's `evidence` array.

Do not put giant code snippets directly inside graph nodes.

Detailed evidence belongs in the explorer's evidence panel and the page's node table.

## Output directory

When generating files, use:

```text
.showme/<topic-slug>/
├── index.html
├── showme.js      (interactive only)
├── showme.css
├── graph.json
├── map.mmd
├── map.svg
└── summary.md
```

`index.html` is the deliverable in both static and interactive form. It reads correctly with JavaScript disabled: semantic summary, inlined SVG, per-change cards and a full node table are plain HTML, and the explorer is layered on top.

Do not leave PNG files in `.showme/`.

Do not modify application code.

Keep all generated visualization code isolated under `.showme/`.

Create `.showme/` only when artifacts are actually being generated.

Do not automatically commit generated output.

## Language

`/showme` supports Thai and English. Resolve `--lang` first (default `auto`: Thai request → Thai, English request → English, mixed → the dominant language with English technical terms kept), then use that language for the reply, `summary.md` and the localised fields of `graph.json`.

Never translate file paths, symbol names, package names, APIs, commands, technology names or code.

For `th-en` and `en-th`, supply both languages in `graph.json`; the page then offers a `TH | EN` switch that works in the browser without regenerating the graph.

Details, the keep-in-English term list and the bilingual layout are in `references/language.md`.

## Final response contract

Always lead with the visual or a link/path to the generated visual artifact.

When files were generated:

```text
SHOW ME

Visual:
.showme/<topic-slug>/index.html

Static:
.showme/<topic-slug>/map.svg

Graph data:
.showme/<topic-slug>/graph.json
```

Then provide only a concise explanation, in the selected language, with:

1. Key insight
2. Hotspots
3. Risks / unknowns
4. Next action

For repository analysis, mention the most important entry point.

For task analysis, mention the highest-risk dependency.

For flow analysis, mention the trigger and terminal effect.

For change analysis, mention the blast radius.

For diff analysis, use the eleven-part teaching structure from `references/diff-learning.md` instead of the four points above.

For walkthrough mode, mention where the interactive HTML was generated.

Avoid repeating everything already obvious from the diagram.

## Fallbacks

If an expected skill is unavailable:

1. Continue instead of failing.
2. Apply the equivalent methodology directly.
3. State which optional skill was unavailable at the end.
4. Still produce a useful visual.

If Mermaid rendering is unavailable, still run `showme.mjs build`: the page and the explorer do not depend on it. Say that `map.svg` and the static fallback diagram were skipped, and include the Mermaid source in the reply.

If Node is unavailable, `showme.mjs` cannot run: output valid Mermaid source and the summary in the reply and say that no page was built.

If the directory is not a git repository, `diff` and `change` cannot run: say so and offer `repo` or `flow`.

If the repository is too large, scope analysis around the requested feature/topic rather than scanning everything indiscriminately.

## Installed skill notes

These reflect how the delegated skills are installed on this machine. Where a delegated skill's own defaults conflict with the rules above, the rules above win.

- `mermaid-diagram`: the render script lives at `~/.claude/skills/mermaid-diagram/references/render_mermaid.sh` (the skill's own text refers to a `mermaid-diagram-skill` folder; ignore that path). Run it with `bash <script> <input.mmd> <output.svg>`; always pass an `.svg` output path, because the script defaults to PNG when the second argument is omitted. It calls `npx --yes -p @mermaid-js/mermaid-cli mmdc`, so it needs Node and network access on first use.
- `walkthrough`: by default it writes `walkthrough-{topic}.html` to the project root. Under `/showme`, write it to `.showme/<topic-slug>/walkthrough.html` instead.
- `oop-architect`: by default it writes its UML into the project's `CLAUDE.md`. Under `/showme`, write the diagrams to `.showme/<topic-slug>/` and leave `CLAUDE.md` untouched unless the user explicitly asks to update it.
- Skills invoked by name here (`spec-miner`, `architecture-designer`, `writing-plans`, `ux-flow-designer`, `legacy-modernizer`, `arch-diagram`, `mermaid-diagram`, `walkthrough`, `oop-architect`) are personal skills under `~/.claude/skills/`. Use `legacy-modernizer` only for migrations, service-boundary analysis and major refactors.
