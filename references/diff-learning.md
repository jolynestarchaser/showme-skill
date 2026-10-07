# Git diff learning mode

The educational goal of `/showme diff` is to help junior developers, career switchers, new team members and vibe coders understand what an AI coding agent (or anyone) changed, how it fits the repository, and why the implementation may have been shaped that way. The purpose is understanding, not a correctness review.

`diff` and `change` share this pipeline. Use `diff` framing when the user wants to understand the code change; use `change` framing when they want impact and blast radius.

## Reading the arguments

Pass the arguments through to git with rename and copy detection:

| Command | Git evidence |
|---|---|
| `/showme diff` | `git diff HEAD -M -C` plus untracked files from `git status --short`. If the tree is clean, fall back to `git show HEAD -M -C` and say that the last commit is being explained. |
| `/showme diff --staged` | `git diff --staged -M -C` |
| `/showme diff HEAD~1` | `git diff HEAD~1 -M -C` |
| `/showme diff main..HEAD` | `git diff main..HEAD -M -C`, plus `git log main..HEAD --oneline` for stated intent |
| `/showme diff src/auth.ts` | `git diff HEAD -M -C -- src/auth.ts` |

Start with `--stat` to size the change. Run read-only git commands only: never stage, commit, reset, stash or check out as part of this mode. If the directory is not a git repository, say so and offer `repo` or `flow` instead.

For a very large diff, group by module and explain the most meaningful changes in depth; list the rest briefly and say what was skipped.

## The questions to answer

```text
What changed?
      ↓
Where does it live?
      ↓
What did this code do before?
      ↓
What does it do now?
      ↓
Why might this implementation exist?
      ↓
What calls it?
      ↓
What does it call?
      ↓
What behavior changes?
      ↓
What should I learn from this?
```

## Pipeline

```text
Git Diff → Changed Files → Changed Symbols → Repository Context
           (callers, dependencies, tests, types, related modules)
         → Behavior Change → Impact Graph → Educational Explanation
```

Do not explain a changed line in isolation when repository context is available. For each meaningful change, read the surrounding code and find its callers and callees, then determine: before, after, reason or likely reason, repository role, runtime effect, dependencies, risk, learning point.

## Evidence hierarchy

Never invent the author's or agent's intention. Keep three levels apart:

```text
FACT       Directly visible in code, the diff, tests, configuration, the task
           description, a commit message, or the current conversation.
INFERENCE  A likely architectural or implementation reason derived from
           repository structure and surrounding code.
UNKNOWN    The reason cannot be established from available evidence.
```

Sources of stated intent, in order: the task in the current conversation (if this session made the change, its own request history counts), commit messages, PR or issue text, test names, code comments.

Bad: "The agent changed this to improve performance." (unless that intent is evidenced)

Better:

```text
Observed:
The implementation replaces repeated array scanning with a Map.

Likely reason:
This reduces repeated lookup work from linear search to direct key lookup.

Confidence:
Inference — no task or commit message explicitly states performance as the goal.
```

Wording: use "This change achieves…", "This structure allows…", "A likely reason is…", "The repository benefits because…". Do not write "The agent wanted…" or "The agent decided…" without evidence.

## Explaining an agent's change

```text
Agent changed       what moved from where to where
    ↓
Technical reason    what the code now does differently
    ↓
Repository reason   why that matters in this codebase
    ↓
Behavioral result   what a user or caller observes
```

## Repository context for every changed file

Instead of "auth.ts changed", write:

```text
auth.ts
Authentication service layer

Called by:
Login.tsx
authMiddleware.ts

Calls:
apiClient.ts
sessionStore.ts

Why this change matters:
Both the UI login path and protected API requests pass through this module.
```

## Structural changes

- **New file:** state its role, why a separate file makes sense, what uses it and what it depends on.
- **Deleted code:** state what disappeared, why the responsibility is no longer needed there, where it moved, and whether behaviour disappeared or only relocated. Never assume deletion means functionality was removed; trace moved logic.
- **Rename, move, extract, inline, split, consolidate:** detect these and explain them as structural changes, not as delete plus add. Show the shape:

```text
This is primarily an extraction:

BEFORE
RepositoryGraph.tsx
 ├─ fetch repository
 ├─ normalize
 ├─ build graph
 └─ render

AFTER
RepositoryGraph.tsx
 └─ render

graphMapper.ts
 ├─ normalize
 └─ build graph
```

## Tests

Explain the behaviour the tests protect. Not "Added 3 tests", but:

```text
These tests establish three behavioral contracts:

expired sessions refresh,
failed refresh logs the user out,
successful refresh retries the original request.
```

Connect tests to implementation nodes in the map when useful.

## Risk

Identify likely failure surfaces from the dependency path, with evidence:

```text
Potential blast radius

auth.ts
  ↓
authMiddleware.ts
  ↓
all protected routes
```

Do not call something dangerous only because many files depend on it. Explain why the path matters.

## Reader level

Assume the reader knows basic programming but not this repository. Do not assume knowledge of architecture patterns, framework conventions, dependency injection, React hooks, async lifecycle, state management, middleware, ORM behaviour, event-driven architecture or advanced TypeScript. When one of these matters to the change, explain it briefly in this repository's terms:

```text
Why use useMemo here?

useMemo stores the calculated value between React renders.

In this repository, graphNodes can contain thousands of entries.
Without memoization, the filtering step would run again whenever
this component renders, even when graphNodes did not change.
```

Explain a concept only when it materially helps understand the diff. Do not turn the response into a textbook.

## Explaining additions, removals, modifications, moves and renames

Do not only summarise the final architecture. The reader must be able to understand the actual git diff without reading the raw `+` and `-` lines. If the explanation only restates diff syntax ("Removed 2 lines. Added 2 lines."), the task is incomplete.

### Categories and notation

Classify every meaningful change as ADDED, REMOVED, MODIFIED, MOVED or RENAMED, and use this notation consistently:

```text
+  Added
-  Removed
~  Modified
→  Moved / Renamed
○  Unchanged context
```

Do not classify individual lines. Group related hunks by responsibility: a symbol, function, component, class, configuration block or behaviour.

```text
auth.ts

ADDED
+ refreshSession()
+ retry logic for expired access tokens

REMOVED
- direct logout when the first authenticated request fails

MODIFIED
~ request() now attempts session refresh before failing

RESULT
Expired tokens can now recover automatically instead of immediately logging the user out.
```

### Interpreting raw hunks

Read the actual diff, then explain it conceptually as REMOVED / ADDED / MEANING:

```diff
- const result = await api.login(email, password)
- localStorage.setItem("token", result.token)

+ const session = await authService.login(email, password)
+ sessionStore.setSession(session)
```

```text
REMOVED
Login component จัดการ token โดยตรง:
api.login() → รับ token → เขียน localStorage

ADDED
Login component ส่ง responsibility ไปที่:
authService.login() → คืน session → sessionStore.setSession()

MEANING
ก่อนหน้า UI รู้รายละเอียดเกี่ยวกับ token storage
หลังแก้ UI รู้เพียงว่าได้รับ session แล้วส่งให้ session store
นี่ลด coupling ระหว่าง UI กับ authentication implementation
```

### What to say for each category

**Added** — what was added, where, what responsibility it introduces, who calls it, what it calls, and what behaviour becomes possible because of it.

**Removed** — what was removed, what responsibility left this location, whether the behaviour was deleted or moved elsewhere, and what replaces it. Never assume deleted code means deleted functionality; trace where the responsibility went. Word the reason by evidence:

- Replacement found: "The old branch became unnecessary because `refreshSession()` now handles token expiry before this condition is reached."
- Reason inferred: "Likely reason: this removes duplicated session handling from the component. Evidence: equivalent behaviour now exists in `AuthService.refreshSession()`."
- No replacement found: "The behaviour was removed. I could not find an equivalent implementation elsewhere in the repository. This may be an intentional behaviour change or an incomplete migration."

**Modified** — show the transformation (before code or behaviour, after code or behaviour), then state the behavioural change in words: "missing/expired token → logout" became "missing/expired token → attempt recovery → logout only if recovery fails".

**Moved** — name FROM, TO and the responsibility that moved, show the before/after responsibility trees, and say explicitly that it is a responsibility move, not a deletion plus an addition.

**Renamed** — show old → new and say whether only the name changed or behaviour changed too, and which references were updated.

### Connect removed code to its replacement

Whenever possible, pair deletions with what replaced them. Raw diffs make moved code look like unrelated deletion and addition, so this matters most for refactors.

```text
REMOVED                         ADDED

buildNodes()                    graphMapper.buildNodes()
inside component       →        dedicated module

localStorage token     →        sessionStore

manual fetch()         →        apiClient.request()
```

### Before / After / Delta

For important code paths, add a DELTA block after the before/after flows:

```text
DELTA

+ recovery path
+ request retry
- immediate logout behavior
```

### Compact diff summary

Start with a semantic summary. Git's numeric statistics (`+84 -31`) may be shown but are not the summary.

```text
GIT DIFF

7 files changed

+ Added
  2 functions
  1 test file

- Removed
  direct token persistence from Login.tsx

~ Modified
  authentication request lifecycle

→ Moved
  graph transformation from UI → graphMapper


Overall change

Authentication responsibility is moving out of UI components
and into dedicated service/store layers.
```

### Per-file summary

For every materially changed file:

```text
src/auth/AuthService.ts

CHANGE
+ refreshSession()
~ request()
- old logout-on-expiry path

ROLE
Central authentication behavior

WHY IT MATTERS
All authenticated requests pass through this service.

IMPACT
API request lifecycle changes.
```

For large diffs, prioritise the important files and group trivial ones under "Minor/supporting changes" (lockfiles, type additions, re-exports). Do not give a lockfile the same depth as core business logic.

### Line-level explanation

Explain an individual line only when the syntax is difficult, a small change has a large behavioural effect, the user asks for line-by-line, or a junior developer would otherwise miss an important concept. Do not explain obvious syntax such as every added import.

### LEARN after each major section

Close each major diff section with a short `LEARN` block that names a concept the diff itself demonstrates, tied to the files that show it. Teach nothing the diff does not demonstrate.

## Response structure

Use progressive disclosure, in this order. For small diffs, drop sections that would be empty; never output an empty heading.

```text
SHOWME — Git Diff

1. BIG PICTURE            (opens with the compact GIT DIFF summary)
2. CHANGE MAP
3. ADDED          +
4. REMOVED        -
5. MODIFIED       ~
6. MOVED / RENAMED →
7. BEFORE → AFTER         (with DELTA)
8. REPOSITORY IMPACT
9. WHAT THE AGENT ACHIEVED
10. WHAT YOU SHOULD LEARN
11. RISKS / THINGS TO CHECK
```

After reading it, a junior developer should be able to answer: What did the agent add? What did it remove? What code changed behaviour? Did removed code disappear or move somewhere else? Which parts of the repository are affected? Why does the new structure make sense? What concept can I learn from it?

Do not begin with hundreds of changed lines. Go line by line only where it adds value. Prefer conceptual before/after flows over raw diff text.

Approximate shape of the default reply:

```text
SHOWME — What changed?

Task
<stated task, or "not stated in the evidence">

<impact map: boxes for the changed and affected nodes, each marked
 ADDED / MODIFIED / DELETED / MOVED / RENAMED / UNCHANGED>

BIG PICTURE
<two or three sentences>

BEFORE
<conceptual flow>

AFTER
<conceptual flow>

WHY THIS SHAPE
FACT: ...
INFERENCE: ...
UNKNOWN: ...   (only when something is genuinely unexplained)

WHAT TO LEARN
<patterns visible in this repository, each tied to the files that show it>
```

The learning section names patterns that are visible in this change. Do not add unrelated generic best practices.

The reader should finish understanding both "What happened?" and "How does this repository work?"

## Visual map

When several files or modules changed, always produce an impact map that explains relationships, not the file tree. Include `unchanged` nodes where they are needed to show the path from the change to its effect:

```text
Login.tsx       modified
     │
     ▼
AuthService     modified
     │
     ▼
ApiClient       unchanged
     │
     ▼
Backend API     unchanged
```

For a single small change, the before/after sketch in the reply is the visual and no files need to be generated.

## graph.json for a diff

Set `meta.mode` to `diff` (or `change`), `meta.edges` to `flow`, and `meta.task` when intent is evidenced. On each node set `change` and fill only what the evidence supports: `description` (role in the repository), `explanation` (what changed), `before`, `after`, `why.fact` / `why.inference` / `why.unknown`, `runtime`, `tests`, `risks`, `learn`, `evidence`. Put the overall before/after and learning points in `summary`.

Record the symbol-level changes of each file in the node's `changes` array (`kind`, `label`, and whatever of `explanation`, `before`, `after`, `why`, `from`, `to`, `replacedBy`, `calledBy`, `calls`, `learn`, `evidence` the evidence supports). Put the compact diff summary in `summary.changes` and `summary.overall`, the removed → replacement pairs in `summary.replacements`, and git's numeric line in `meta.stat`.

See `examples/diff-session-refresh/graph.json`.

## Interactive change explorer

`/showme diff --interactive` and `/showme change --interactive` build the standard explorer from that graph. It shows a "Changed" list beside the impact graph with each file's changed symbols under it (`+ refreshSession()`, `~ request()`, `- expireAndLogout()`), and filter buttons All / Added / Removed / Modified / Moved. Selecting a file opens: Overview, What changed, Changed symbols, Before, After, Why, Dependencies, Dependents, Runtime impact, Tests, Risks, Learning, Evidence. Selecting a symbol opens that symbol's own explanation: before, after, why, from → to, replaced by, called by, calls, learning, evidence.
