# Language and translation

## Modes

| `--lang` | Output |
|---|---|
| `auto` (default) | Thai request → Thai. English request → English. Mixed → explain in the dominant language and keep the English technical terms. |
| `th` | Thai only |
| `en` | English only |
| `th-en` | Thai is the teaching language; a concise English line sits under important explanations |
| `en-th` | English primary; a concise Thai line under important explanations |

Detect Thai by the presence of Thai script (U+0E00–U+0E7F) in the user's request. The chosen language applies to the chat response, `summary.md`, and every localised field in `graph.json`. Set `meta.language` to the resolved value, never to `auto`.

## Never translate

- file paths
- function, class, variable and type names
- package names, APIs, command names, technology names
- code snippets and flow sketches made of identifiers

Good: `RepositoryService.search()` เรียก `GitHubClient.searchRepositories()`

Bad: translating symbol names into Thai.

## Terms usually kept in English

repository, dependency, runtime, flow, component, service, API, frontend, backend, commit, branch, merge, deploy, cache, state, hook, module, middleware, token, session, request, response, render, refactor, test.

Keep the English term when it is what a Thai developer would say at work. A Thai gloss may be placed next to the term the first time when it genuinely helps, for example `dependency (สิ่งที่โค้ดนี้ต้องพึ่งพา)`. Avoid awkward literal translations of development terminology.

Preferred Thai style:

```text
ตรงนี้ Agent แยก graph transformation ออกจาก React component

ก่อนหน้า RepositoryGraph.tsx ทำทั้ง:
รับข้อมูล → transform → สร้าง node → render

หลังแก้:
graphMapper.ts รับผิดชอบ transformation
RepositoryGraph.tsx รับผิดชอบ rendering
```

## Bilingual layout

`th-en`:

```text
Repository Loader
โหลดข้อมูล repository และ normalize metadata

EN:
Loads repository data and normalizes its metadata.
```

`en-th` mirrors this with English first.

Translate node descriptions, graph legends, summaries, risks and next actions. Keep code evidence unchanged. Keep the secondary language to one concise line per item; do not duplicate long paragraphs in both languages.

In `graph.json`, bilingual output means giving `{ "th": "...", "en": "..." }` for those fields. The page then shows a `TH | EN` switch that changes labels, descriptions, legend, side panel and summary headings in the browser without regenerating anything. Paths, symbols and code never change.

## Thai in Mermaid

Thai labels render correctly through the `mermaid-diagram` render script on this machine. Always quote them: `["ชั้น Authentication"]` and `-->|"เก็บ session"|`. `scripts/showme.mjs mmd` does this automatically.

## `translate` mode

```text
/showme translate th "text"
/showme translate en "text"
/showme translate th-en "text"
/showme translate en-th "text"
```

This is a text-only mode. Do not inspect the repository, do not create `.showme/`, do not draw a diagram. Reply with the translation only.

- Preserve every technical identifier exactly.
- Translate only the natural-language content.
- Apply the keep-in-English list above.
- For `th-en` / `en-th`, give the primary language first and the secondary on the next line.

Example:

```text
/showme translate th "RepositoryService fetches metadata and builds the dependency graph."

RepositoryService ดึง metadata และสร้าง dependency graph
```
