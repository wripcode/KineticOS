---
trigger: always_on
glob:
description: KineticOS project-specific agent rules
---

# KineticOS Agent Rules

## 1. Codebase Intelligence — tokenos-ko MCP (MANDATORY)

`tokenos-ko` is the **primary and authoritative** source for codebase navigation. Always use it before touching files.

### Tools

| Tool              | Use When                                                        |
| ----------------- | --------------------------------------------------------------- |
| `top_nodes`       | Orient at task start — get high-impact entry points             |
| `search`          | Find by intent or natural language                              |
| `find_nodes`      | Find by name, type (`function`, `class`, `component`, etc.)     |
| `get_node`        | Get full code + metadata for a specific node (`filePath::name`) |
| `get_connections` | See what a node imports / is imported by                        |
| `explore`         | Traverse the graph outward from a node (depth 1–3)              |

### Mandatory Workflow

1. Run `top_nodes` at the start of every task.
2. Use `search` or `find_nodes` to locate the relevant symbol.
3. Run `get_connections` or `explore` **before** reading any file.
4. Use `get_node` for full source detail.
5. Only open files after graph analysis confirms they are needed.

### Hard Prohibitions

- ❌ Do NOT manually browse the filesystem to locate code.
- ❌ Do NOT mentally simulate grep or file search.
- ❌ Do NOT read files before running `get_connections` / `explore`.
- ❌ Do NOT skip `tokenos-ko` and fall back to filesystem unless all MCP calls return no results.

---

## 2. Code Rules

### Do

- Keep functions under 40 lines; split if larger.
- Use early returns to flatten nested logic.
- Write names that reveal intent (`isReady`, `hasError`, `applyEffect`).
- Co-locate related files; one responsibility per file.
- Remove all unused code, imports, and dead branches before committing.

### Don't

- No inheritance — prefer composition.
- No copy-pasted logic — extract to shared utilities.
- No prop drilling beyond two levels.
- No debug logs left in committed code.

---

## 3. Comment Policy

**Only top-level comments are allowed.**

- ✅ One JSDoc or block comment at the top of a file describing its purpose.
- ✅ One comment per exported function/class if the intent is non-obvious.
- ❌ No inline comments explaining what a line of code does.
- ❌ No block comments inside function bodies.
- ❌ No comments that restate the code (`// loop over items` above a forEach).

---

## 4. Response Style

- Keep responses **short and direct** — one clear answer beats three vague ones.
- Skip preamble. Never say "Great question!" or restate the user's request.
- Use bullet points or code blocks; avoid long prose paragraphs.
- If something is ambiguous, ask one focused question instead of making assumptions.

---

## 5. KineticOS-Specific Rules

- Effects are always wrapped in a `<div>` — never attach a canvas directly to the document root.
- The `kineticos` attribute on elements is the primary configuration API; respect its presence when scanning the DOM.
- When modifying effect logic, run `explore` on the effect's entry node at depth 2 before editing.

---

## 6. Artifact & Documentation Policy

- **Location**: All created documents, experiment logs, or research notes must be stored in the `dev-data/` folder.
- **Format**: Files must be in Markdown (`.md`) format.
- **Dating**: Every file created must include the current date in the header or filename as appropriate to ensure traceability.
