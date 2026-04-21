---
description: Publish a new version of KineticOS to npm and push to GitHub. Uses GitHub Actions for the actual publish — no local npm credentials required.
skills:
  - git-pushing
  - architecture-decision-records
  - javascript-pro
---

# /publish

Publishing is triggered by pushing a version tag to GitHub. The `release.yml` workflow handles build → test → typecheck → npm publish → GitHub Release automatically.

---

## Pre-flight checks

Before tagging:

1. All feature work is merged to `main`
2. Local build, tests, and typecheck pass

```bash
cd packages/core && pnpm build && pnpm test && pnpm typecheck
```

---

## Step 1 — Decide the version bump

| Change type | Bump |
|---|---|
| New effect added | `minor` (e.g. `1.0.x` → `1.1.0`) |
| Bug fix, performance tweak | `patch` (e.g. `1.1.0` → `1.1.1`) |
| Breaking API change | `major` (e.g. `1.x.x` → `2.0.0`) — confirm with user before proceeding |

---

## Step 2 — Bump the version

Edit `packages/core/package.json` — update the `"version"` field only.

```bash
# Verify current version
node -p "require('./packages/core/package.json').version"
```

> Do **not** use `npm version` — it creates an automatic commit. We control the commit message.

---

## Step 3 — Update `packages/core/README.md`

This is the npm-facing README (shown on the npm package page). Keep it minimal:

**Must contain:**
- One-line description
- CDN install snippet with `ko-*` effect attributes
- Minimal getting-started example
- Link to the full attributes guide

**Must NOT contain:**
- Full attribute reference (lives in `dev-data/attributes-guide.md`)
- Internal architecture notes
- Dev setup instructions

---

## Step 4 — Commit everything to `main`

Stage all changed files and push with a release commit:

```bash
git add -A
git commit -m "release: @kineticos/core v<VERSION>"
git push origin main
```

---

## Step 5 — Create and push the version tag

The tag **must match** the `package.json` version exactly. The `release.yml` workflow verifies this before publishing.

```bash
git tag v<VERSION>
git push origin v<VERSION>
```

This triggers `.github/workflows/release.yml` automatically.

---

## Step 6 — Monitor the Action

Watch the workflow at:
```
https://github.com/wripcode/KineticOS/actions
```

The Action runs:
1. ✅ Version/tag mismatch guard
2. ✅ `pnpm build` (filter: `@kineticos/core`)
3. ✅ `pnpm test`
4. ✅ `pnpm typecheck`
5. ✅ `npm publish --access public --provenance`
6. ✅ GitHub Release (auto-generated notes)

---

## Step 7 — Verify CDN (Task 7.5)

After the Action completes, verify the new version resolves on jsDelivr:

```
https://cdn.jsdelivr.net/npm/@kineticos/core@<VERSION>/dist/kineticos.min.js
https://cdn.jsdelivr.net/npm/@kineticos/core@<VERSION>/dist/effects/dots-shader/index.min.js
https://cdn.jsdelivr.net/npm/@kineticos/core@<VERSION>/dist/effects/image-particle/index.min.js
```

And that `@latest` picks it up within a few minutes:
```
https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js
```

Check the `x-jsd-version` response header — it should show the new version.

---

## Checklist

- [ ] Pre-flight: `pnpm build && pnpm test && pnpm typecheck` all pass
- [ ] Version bumped in `packages/core/package.json`
- [ ] `packages/core/README.md` updated (minimal, links to attributes guide)
- [ ] Committed to `main` with `release: @kineticos/core v<VERSION>` message
- [ ] Tag `v<VERSION>` pushed — GitHub Action triggered
- [ ] Action completed successfully (check GitHub Actions tab)
- [ ] CDN verified at `@VERSION` and `@latest`

---

## Required GitHub Secret

The workflow requires `NPM_TOKEN` set in **GitHub → Settings → Secrets → Actions**:

1. Generate at npmjs.com → Account → Access Tokens → Granular token for `@kineticos/core`
2. Add as secret `NPM_TOKEN` in the repo settings

This is a one-time setup. Once set, all future releases are fully automated.

---

## README template

If creating `packages/core/README.md` from scratch:

```markdown
# KineticOS

WebGL canvas effects for Webflow and any HTML platform. Attribute-driven. Zero config to full control.

## Install via CDN

\`\`\`html
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos
  ko-dots-shader>
</script>
\`\`\`

## Getting started

Add `ko-<effect>` to the script tag for each effect you need, then place a `<div>` with `ko-effect` in your HTML:

\`\`\`html
<div ko-effect="dots-shader" style="width: 100%; height: 400px;"></div>
\`\`\`

## Full attribute reference

See [Attributes & Configuration Guide](https://github.com/wripcode/KineticOS/blob/main/dev-data/attributes-guide.md).

## License

MIT
```
