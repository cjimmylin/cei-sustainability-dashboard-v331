# Dashboard Changelog

## v3.3.1 (2026-04-13, S19 patch)

**Type:** Internal generator hygiene. No user-visible content changes.

### What changed
- `scoring/generate_dashboard.py` reconciled to match `DASHBOARD/index.html` and `DASHBOARD/app.js` byte-for-byte. Re-running the generator is now safe and reproduces the live dashboard.
- Wholesale replacement of the `html = """..."""` and `APP_JS = """..."""` triple-quoted literal blocks (~220 line-diff hunks total).
- Reconciliation surface included S18 narrative hand-edits (About This Study, per-tab hooks, OG meta, contrast fixes) **and** previously-undiagnosed pre-S18 drift from S17's theme-toggle work (~112 lines of JS that had never been ported into the generator).
- S18 warning header in the generator docstring removed; replaced with reconciliation note.
- Version strings bumped v3.3 → v3.3.1 in 6 places (title, OG, navbar, print stylesheet, footer, footer note); cache-bust query strings bumped `?v=3.3.0` → `?v=3.3.1`.

### Why patch (v3.3.1) and not minor (v3.4)
- No data changed (analytics, tier counts, ICC, kappa, baseline rates all unchanged).
- No user-visible content changed (every byte of `data.js`/`app.js` and every non-version-string byte of `index.html` is identical to v3.3).
- This is internal generator architecture only — semver patch.
- Same precedent the S18 critic council used to downgrade S18 from v4.0 → v3.3.

### Technical notes
- New generator size: 141,017 bytes (was 123,153 in pre-S19 stale form).
- Post-bump `index.html`: 85,795 bytes (+65 vs v3.3 = exactly the version-string deltas).
- `data.js` and `app.js` byte-identical to v3.3 (cache-bust strings live only in `index.html`).
- Backups retained: `RECYCLE-BIN/generate_dashboard.pre-recon-20260413.py` and `DASHBOARD.pre-recon-20260413/`.
- Full reconciliation log: `METHODS/20260413b-sustainability-s19-generator-reconciliation.md`.

---

## v3.3 (2026-04-13, S18)

**Type:** Narrative onboarding for first-time readers. No analytics changes.

### New content
- **About This Study** progressive-disclosure panel on Overview tab: 60-word visible hook + 3 collapsible `<details>` panels (Background, Methods, Tier definitions) sourced from paper sections
- **Per-tab intro hooks** on all 7 non-Overview tabs: one-sentence summaries of what each tab shows and the headline finding
- HTML `<!-- source: ... -->` comments on every new narrative block for academic integrity traceability

### Technical
- OpenGraph meta tags (`og:title`, `og:description`, `twitter:card`)
- Cache-bust query strings (`?v=3.3.0`) on `data.js` and `app.js` script tags
- Version string updated: title, navbar, footer, print stylesheet → "v3.3"
- Generator warning header added to `scoring/generate_dashboard.py`

### Not changed
- `data.js` analytics (all tier counts, ICC, kappa, baseline rates unchanged)
- `app.js` chart rendering logic (no functional changes)
- CSS (no new classes; reuses existing `.annotation` and `<details>` styles)
- axe-core compliance target: 0 violations (to be verified via Playwright)

### Sourced from (12-expert council + 12-critic alternate council)
All new prose blocks cite specific paper sections:
- `PAPER/20260410-abstract-draft.md`
- `PAPER/20260410-introduction-draft.md` §1
- `PAPER/20260410-literature-review-draft.md` §2
- `PAPER/20260410-methods-draft.md` §3.1-3.9
- `PAPER/20260410-results-draft.md` §4.1-4.5
- `PAPER/20260410-discussion-draft.md` §5.2-5.4
- `data.js` TIER_COUNTS, YEAR_TIMELINE, TOP_STATEMENTS

---

## v3.2 (2026-04-12, S17)

- ECharts theme edge cases fixed (5 fixes: CSS custom property reads, pie label patching, mobile theme awareness, resize version counter, aria-pressed toggle)
- WCAG AA audit: 0 violations across 4 tabs × 2 themes
- Color contrast fixes for light theme (region vars, accent vars)

## v3.1 (2026-04-11, S16)

- Light/dark theme toggle
- Versioned deploy to `-v3` repo

## v3.0 (2026-04-11, S15)

- 8-tab dashboard with 44 annotations
- Full ECharts implementation
- Initial GitHub Pages deploy
