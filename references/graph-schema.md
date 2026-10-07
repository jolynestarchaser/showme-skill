# graph.json schema

`graph.json` is the source of truth for every `/showme` visual. The Mermaid diagram, the HTML page, the interactive explorer and `summary.md` are all derived from it by `scripts/showme.mjs`.

A complete working example is in `examples/diff-session-refresh/graph.json` (synthetic paths, real structure).

## Localised text

Any field marked **L** is either a plain string or an object with `th` and/or `en`:

```json
"description": { "th": "โหลดข้อมูล repository", "en": "Loads repository data" }
```

- Use a plain string for anything that must not be translated: file names, symbols, code-like flow sketches.
- Supply both keys only for `th-en` / `en-th` output, or when the reader should be able to switch language. For `--lang th` or `--lang en`, plain strings are enough.
- IDs are never localised. Keep them ASCII (`[A-Za-z0-9._-]`), stable and language-independent.
- Evidence (`path`, `symbol`, `line`) is never localised.

## Shape

```json
{
  "meta": {
    "title": "L, required",
    "mode": "repo | task | flow | change | diff | walkthrough | oop",
    "language": "th | en | th-en | en-th",
    "edges": "dependency | flow",
    "direction": "LR | TD",
    "task": "L, the task or commit intent when evidence states it"
  },
  "groups": [{ "id": "auth", "label": "L" }],
  "nodes": [
    {
      "id": "auth-service",
      "label": "L, required",
      "type": "module | file | service | component | store | middleware | task | external | database | state | actor | effect | test | config",
      "status": "existing | modify | create | partial | unknown",
      "change": "added | modified | deleted | moved | renamed | unchanged",
      "group": "auth",
      "confidence": "fact | inference | unknown",
      "description": "L, the node's role in the repository",
      "evidence": [{ "path": "src/auth/auth.ts", "symbol": "refreshSession", "line": 42 }],

      "explanation": "L, what changed in this node",
      "before": "L, conceptual behaviour before (multi-line text is fine)",
      "after": "L, conceptual behaviour after",
      "why": { "fact": "L", "inference": "L", "unknown": "L" },
      "runtime": "L, runtime effect",
      "tests": "L, the behaviour the tests protect",
      "risks": "L, failure surface and why the path matters",
      "learn": "L, the pattern visible here",
      "task": "L, related task",

      "changes": [
        {
          "kind": "added | removed | modified | moved | renamed",
          "label": "refreshSession()  (plain string: the symbol or behaviour, never translated)",
          "explanation": "L",
          "before": "L",
          "after": "L",
          "why": { "fact": "L", "inference": "L", "unknown": "L" },
          "from": "RepositoryGraph.tsx",
          "to": "graphMapper.ts",
          "replacedBy": ["sessionStore.setSession(session)"],
          "calledBy": ["AuthService.request()"],
          "calls": ["POST /auth/refresh"],
          "learn": "L",
          "evidence": [{ "path": "src/auth/auth.ts", "symbol": "refreshSession" }]
        }
      ]
    }
  ],
  "edges": [
    { "source": "login-page", "target": "auth-service", "type": "calls", "label": "L", "confidence": "fact | inference | unknown" }
  ],
  "summary": {
    "changes": [{ "kind": "added | removed | modified | moved | renamed", "text": "L" }],
    "overall": "L, the overall change in one sentence",
    "replacements": [{ "removed": "localStorage token", "added": "sessionStore.setSession()", "note": "L" }],
    "insight": "L",
    "before": "L",
    "after": "L",
    "hotspots": ["L"],
    "risks": ["L"],
    "next": "L",
    "learn": ["L"]
  }
}
```

Only `meta.title`, `meta.mode`, `meta.language`, and each node's `id`, `label`, `type` are required. Omit every field the evidence does not support. Do not fabricate precision.

## Field rules

- `type` is free-form; the list above is the preferred vocabulary. The explorer colours and filters by whatever types appear.
- Use `status` for planning views (`task`) and `change` for git-based views (`diff`, `change`). Do not set both on one node.
- `unchanged` nodes belong in a diff graph when they are needed to explain impact. They make blast radius visible without implying they were edited.
- A node without `evidence` gets a validator warning unless its type is `external`, `actor`, `task`, `state` or `effect`. If something is inferred, say so with `"confidence": "inference"`.
- `why` holds the three confidence levels separately. Never merge an inference into `fact`.
- `meta.stat` is an optional plain string for git's numeric summary, for example `"4 files changed, +84 -31"`.
- `changes` lists the symbol-level items of a changed file, grouped by responsibility, not by line. The page and explorer render them as `+`, `-`, `~`, `→`. Node-level `change` says what happened to the file (`deleted` for a deleted file); item-level `kind` says what happened to a symbol or behaviour inside it (`removed`).
- A `removed` item should say where the behaviour went: fill `replacedBy` when a replacement exists, or state in `explanation` that none was found. The validator warns when both are missing.
- `from` / `to` are for `moved` and `renamed` items.
- Edge `type` vocabulary: `depends-on`, `calls`, `reads`, `writes`, `emits`, `contains`, `changes`, `blocks`.
- An edge with `confidence` other than `fact` is drawn dashed.

## Edge direction

`meta.edges` tells the explorer how to word its upstream/downstream buttons.

- `dependency` (default for `repo`, `oop`): draw edges from the dependent to the thing it depends on. `A → B` means "A depends on B".
- `flow` (default for everything else): draw edges in execution, data or impact order. `A → B` means "A leads to B".

Pick one meaning per graph and keep every edge consistent with it.

## Density

Target 5–15 nodes for the static Mermaid diagram. The interactive explorer copes with more, but past roughly 40 nodes use `groups` so the reader can collapse them. Beyond roughly 80 nodes, split into several topics.
