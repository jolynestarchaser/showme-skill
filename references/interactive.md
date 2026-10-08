# Interactive output

## What gets generated

```text
.showme/<topic-slug>/
├── index.html     entry point: summary, static diagram, explorer
├── showme.js      explorer (copied from the skill, not written per run)
├── showme.css     styles (copied from the skill)
├── graph.json     source of truth
├── map.mmd        Mermaid source
├── map.svg        static diagram
└── summary.md     the same summary as plain Markdown
```

With `--static`, `showme.js` is omitted and `index.html` contains no script.

Everything stays under `.showme/`. Never add a visualization dependency to the application's own `package.json`, lockfile or source tree unless the user explicitly asks.

## Build steps

`SHOWME=~/.claude/skills/showme` and `OUT=.showme/<topic-slug>`.

1. Write `$OUT/graph.json` (see `references/graph-schema.md`).
2. `node $SHOWME/scripts/showme.mjs validate $OUT` and fix every error. Read the warnings; a missing-evidence warning means either add evidence or mark the node as an inference.
3. Produce `map.mmd`:
   - flowchart-shaped graphs: `node $SHOWME/scripts/showme.mjs mmd $OUT` derives it from `graph.json`;
   - sequence, state, ER or class diagrams: write `map.mmd` by hand with the `mermaid-diagram` skill.
4. Render: `bash ~/.claude/skills/mermaid-diagram/references/render_mermaid.sh $OUT/map.mmd $OUT/map.svg`. Inspect the result and fix layout. To look at it as an image, render a PNG into a temporary directory and do not keep it.
5. `node $SHOWME/scripts/showme.mjs build $OUT` (add `--static` for a script-free page). Every `.svg` in the directory is inlined, `map.svg` first.
6. Open `index.html` in the default browser (`Start-Process` on Windows, `open` on macOS, `xdg-open` on Linux).

Re-run step 5 after any change to `graph.json`. Do not hand-edit `index.html`, `showme.js` or `showme.css` inside `.showme/`; they are overwritten on the next build.

## Guided reading

Every page opens as a guided reader, not as a wall of sections. All of it is derived from `graph.json` by the build script; nothing is authored per report, and a missing field renders "Not available in source".

- **Start here:** title, one-sentence TL;DR (`summary.insight`), task, scope, the key node, and a "Start guided reading" button.
- **Five steps:** Problem → Root cause → Fix → Impact and risks → Evidence, each with one main idea, a short body and collapsed technical details. Previous, Next, jump and "Skip to Deep Dive" all work; nothing is locked.
- **Three reading modes:** Scan (at-a-glance summary, everything else collapsed), Understand (default: one step at a time, graph limited to the critical path), Deep Dive (every section open, full graph, all inspector sections open).
- **Key node and critical path:** the key node is the changed node with the most detail; the critical path is one chain through it from a source to a sink. When no chain of at least three nodes exists, the page says so and shows the full graph.
- **Reader controls:** text size (A−, A, A+), theme (Auto, Light, Dark), reading width. Saved in the browser's `localStorage`.
- **Addressable state:** `#step-<1-5>`, `#mode-<scan|understand|deep>`, `#node-<id>[:<n>]`.
- **Without JavaScript:** Start here, all five steps, the static diagram and every original section remain readable; the original sections are native `<details>` elements.

Confidence tags (FACT, INFERENCE, UNKNOWN) use a neutral colour with different border styles and glyphs. Change status (added, modified, deleted, moved) uses colour plus a word. The two are never distinguished by colour alone.

## What the explorer does

- pan (drag), zoom (wheel or buttons), fit to screen, reset view
- search across labels, ids, descriptions, evidence paths and symbols; Enter jumps to the first match
- filter by node type and by status; diff graphs get All / Added / Removed / Modified / Moved buttons that dim everything without a change of that kind
- diff graphs list each changed file with its changed symbols (`+`, `-`, `~`, `→`); clicking a symbol opens its own explanation, and `index.html#node-<id>:<n>` deep-links to the n-th symbol
- click a node to open the evidence panel; connected nodes are highlighted
- highlight transitive upstream or downstream nodes
- focus mode: show only the selected node and its highlighted set
- collapse a group by clicking its title; expand by double-clicking the collapsed node
- `TH | EN` switch when the data has both languages
- deep link: `index.html#node-<id>` opens with that node selected
- keyboard: nodes are focusable, Enter selects, Escape clears

The evidence panel shows only fields that exist on the node: name, type, change or status, confidence, overview, what changed, before, after, why (FACT / INFERENCE / UNKNOWN), dependencies, dependents, runtime impact, tests, risks, learning, related task, evidence.

## Progressive enhancement

`index.html` is readable with JavaScript disabled: the summary, the inlined SVG, the per-change cards and the full node/relationship table are plain HTML. The explorer is added on top. Nothing essential is reachable only through hover or animation.

## Choosing a renderer

| Graph | Use |
|---|---|
| Small (up to ~15 nodes), quick answer | Mermaid only, `--static` page |
| Medium, needs exploration | bundled explorer (vanilla JS + SVG, no dependencies) |
| Large (roughly 80+ nodes) or needing force/compound layouts the bundled explorer lacks | Cytoscape.js or D3.js, loaded by a `<script>` tag from a CDN inside `.showme/` only |
| Application-grade: custom nodes, side panels, RepoVerse-style behaviour | React Flow, only when the repository already uses React or the user asks for it |

Default to the bundled explorer. Do not install JavaScript libraries by reflex, and never add React just to display a small graph. When a heavier library is chosen, keep `graph.json` as the data source and keep the generated code in separate files for data, rendering, interaction and UI state.

## Known limits of the bundled explorer

- Layout is layered left-to-right. Group outlines are bounding boxes, so a group that spans several columns can visually enclose a node from another group; collapse the group or reduce cross-group edges if that misleads.
- Edge labels are hidden above 40 visible edges and shown again for highlighted edges.
- `file://` pages cannot fetch `graph.json`, which is why the build embeds a copy in `index.html`. `graph.json` on disk remains the reusable export.
