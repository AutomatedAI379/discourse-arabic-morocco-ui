# Arabic UI Consolidation — Design Spec

**Date:** 2026-04-29
**Status:** Approved (brainstorm)
**Target:** Consolidate six Arabic-related Discourse theme components into one, and fix the Moroccan month + Latin digit rendering bug.

## Background

Six Discourse theme components currently handle Arabic UI behavior on the forum. They overlap in concerns, vary in code style (modern `apiInitializer` vs. classic Ember initializer), and have at least one known bug: Moroccan month names and Latin digits render inconsistently across the UI. A colleague reported seeing Arabic-Indic digits and MSA month names in a topic view, even though the existing component is supposed to convert them.

Root cause hypothesis (validated by symptom: Latin digits work in some places, not others; MSA months bleed through inside threads): the existing date component patches **Day.js**, but Discourse renders most dates via **Moment.js**. MSA month names come straight from Moment's default `ar` locale, and the DOM safety pass only catches them after the fact, missing surfaces like user-card popups, edit indicators, action notices, and lazy-loaded posts that race the observer.

## Goals

1. Consolidate the six Arabic components into one theme component.
2. Fix the Morocco-month / Latin-digit bug at the source by switching Moment to its built-in `ar-ma` locale (Moroccan months baked in) and forcing Latin-digit postformat.
3. Keep all six existing behaviors intact — no behavior change beyond the bug fix.
4. Stay on the modern `apiInitializer` API — no use of the deprecated `<script type="text/discourse-plugin" version="0.8">` tag.

## Non-Goals

- Email / push notification rendering (server-side, can't be reached from a theme component).
- Mobile native app date rendering.
- Touching `.cooked` user content (intentionally left alone — user posts must never be rewritten).
- Server-side i18n overrides via admin → Customize → Text content (separate future work for emails).

## Inventory of source components

| # | Name | Type | Notes |
|---|------|------|-------|
| 1 | Arabic Latin Digits & Morocco Months | JS (`apiInitializer`) | Bug: patches Day.js only, misses Moment-rendered dates. Folder typo `api-initializer/` (singular) suspected at one point but ruled out — component does run, just leaks. |
| 2 | Custom AR Hide Gender Options (preferences) | JS (classic Ember initializer) | Wrong folder shape — currently in `api-initializers/` but exports a classic initializer object. Hides "متنوع" and "عدم الإفصاح" via MutationObserver. |
| 3 | Custom Composer AR edits | CSS | Hides composer category and tag inputs on Arabic UI. |
| 4 | Custom Signup Translation | JS (`apiInitializer`, missing version arg) | Shortens long multi-language signup labels to Arabic-only on small viewports. |
| 5 | Custom AR Hide Gender Options (signup) | CSS + JS (`apiInitializer`, missing version arg) | Hides Diverse / Prefer-not-to-say options on signup. Click-delegated. |
| 6 | published-page-ar-rtl | CSS | Forces RTL on Arabic published pages. |

Per user direction (2026-04-29), components #2 and #5 stay as **two separate gender-hide blocks** within the consolidated component — not merged.

## Architecture

Single Discourse theme component named **`discourse-arabic-morocco-ui`** with this layout:

```
discourse-arabic-morocco-ui/
├── about.json
├── common/
│   └── common.scss
└── javascripts/
    └── discourse/
        └── api-initializers/
            └── arabic-ui.js
```

One JS file with a single `apiInitializer("1.13.0", api => { … })` containing discrete blocks. One SCSS file with the three CSS rule groups in order.

## JS initializer blocks (`arabic-ui.js`)

### Block A — Arabic detection guard
```js
const html = document.documentElement;
const isArabicUI = html.classList.contains("ar") || (html.lang || "").startsWith("ar");
if (!isArabicUI) return;
```
Everything below runs only on Arabic UI.

### Block B — Locale fix (root-cause Morocco bug)
- Resolve `moment` via `window.require("moment")` with `window.moment` fallback.
- `moment.locale("ar-ma")` — Moment ships this locale with Moroccan months built in (يناير _ فبراير _ مارس _ أبريل _ ماي _ يونيو _ يوليوز _ غشت _ شتنبر _ أكتوبر _ نونبر _ دجنبر).
- Override `moment.updateLocale("ar-ma", { postformat: latinDigits })` to force Latin digits in both absolute and relative dates.
- Same for Day.js (kept from existing #1): `dayjs.locale("ar")` + `updateLocale("ar", { months, monthsShort, preparse, postformat })` — covers any renderer that uses Day.js.
- Re-apply on `api.onPageChange` in case Discourse re-sets the locale.

### Block C — DOM safety pass (backup only)
- Walks text nodes inside a list of UI date selectors and rewrites Arabic-Indic / Persian digits → Latin and MSA months → Moroccan equivalents.
- Selectors expanded beyond #1 to cover known leak surfaces:
  - `time[datetime]`, `.relative-date`
  - topic-list: `.age .relative-date`, `.latest .relative-date`, `.post-activity .relative-date`
  - inside topics: `.topic-post .post-info`, `.topic-status-info`, `.topic-meta-data`, `.topic-timer`, `.topic-map`, `.topic-links`, `.quote .title`, `.topic-timeline`, `.timeline-container`
  - **new in this consolidation:** `.user-card`, `.edit-history`, `.small-action`, `.notification-list`, `.user-stream-item`, `.search-results`, `.directory .relative-date`
- Skips anything inside `.cooked` (user post content must not be rewritten).
- Also rewrites tooltip-style attributes: `title`, `aria-label`, `data-original-title`.

### Block D — Signup label shortener (from #4)
- Page guard: `window.location.pathname === "/signup"`.
- Viewport guard: `window.innerWidth < 500`.
- Replaces the four long multi-language `<label>` strings with their Arabic-only short forms (العمر / الجنس / اللغة / البلد).
- Triggered by the shared global MutationObserver (see Hooks) on subtree changes — this replaces the existing `setTimeout(..., 300)` race in #4.
- Resize handler kept, debounced ~100ms.

### Block E1 — Gender hider, preferences (from #2, behavior preserved)
- Selector: `.user-field-geschlecht--gender .select-kit-body .select-kit-item`.
- Match: `textContent` contains `"متنوع"` or `"عدم الإفصاح"`.
- Triggered by the shared global MutationObserver (see Hooks) — original #2 attached its own observer to the field, which only worked if the field existed at init time. The global observer fixes that.
- Converted from classic Ember initializer to inline block within the `apiInitializer` callback.

### Block E2 — Gender hider, signup (from #5, behavior preserved)
- Page guard: `/signup` only.
- Selector: `.user-field-geschlecht li.select-kit-row`.
- Match: `data-value` / `data-name` / `textContent` contains the long multi-language strings (`"Divers / Diverse / Divers / متنوع …"`, `"Keine Angabe / Prefer not to say …"`).
- Click delegation kept, with `setTimeout(hideGenderOptions, 0)` after click on `.user-field-geschlecht`.

### Hooks (registered once)
- `api.onPageChange(runAll)` — re-runs Block B locale re-apply and Blocks C / D / E1 / E2 DOM passes after SPA navigation.
- One shared `MutationObserver` on `document.body` — `{ childList: true, subtree: true, characterData: true }`. Drives the DOM-side work for Blocks C, D, E1; Block E2 keeps its click delegation as in the original #5.
- App-events: `page:changed`, `topic:loaded`, `post-stream:refresh`.

The single global observer is intentional — multiple per-element observers in the originals (#2 attached to the gender field at init time) failed when the target element was rendered after init.

## CSS rules (`common/common.scss`)

```scss
// 1. Composer — hide category & tags inputs (Arabic only)  [from #3]
html[lang^="ar"] .category-input,
html[lang^="ar"] .tags-input { display: none !important; }

// 2. Gender options — hide on Arabic UI (signup, by data-value)  [from #5]
html[lang^="ar"] .select-kit-body .select-kit-row[data-value*="Divers / Diverse"],
html[lang^="ar"] .select-kit-body .select-kit-row[data-value*="Prefer not to say"],
html[lang^="ar"] .select-kit-body .select-kit-row[data-value*="عدم الإفصاح"] { display: none !important; }

// 3. Published page — RTL  [from #6]
body.published-page.ar { direction: rtl !important; }
```

No new CSS rules beyond the consolidated existing ones.

## Error handling

- **Library resolution failure:** if `moment` is not reachable, log a single `console.warn("[arabic-ui] Moment unavailable — falling back to DOM pass only")` and skip Block B. Block C (DOM pass) still runs and corrects after the fact.
- **Locale name mismatch:** Block B re-applies on `api.onPageChange` so a Discourse re-set doesn't strand us in MSA `ar`.
- **MutationObserver thrash:** DOM pass debounced via `requestAnimationFrame` (or 100ms `setTimeout`) so chat / scroll / stream loads don't run the walker on every micro-mutation.
- **Page guards:** all blocks early-exit if guards fail — no work wasted on non-Arabic / non-relevant pages.

## Testing & verification

No unit-test harness — Discourse theme component, manual QA on staging (or live with rollback ready).

### QA checklist
**Dates & digits**
- Topic list — Latin digits, Moroccan months in tooltips.
- Inside a topic — every post's date Latin digits + Moroccan months on hover.
- User card popup, edit indicator, notifications panel, search results, profile page — same.
- Reload + navigate between 3-4 topics — no flash of MSA / Arabic-Indic.

**Composer (#3)** — category and tag inputs hidden in Arabic, visible otherwise.

**Gender options (#2 + #5)** — Diverse / Prefer-not-to-say hidden on `/signup` AND user preferences in Arabic; visible in non-Arabic.

**Signup labels (#4)** — at < 500px width on `/signup` in Arabic, labels show short Arabic-only forms; > 500px, long multi-language labels return.

**RTL (#6)** — published pages in Arabic render RTL.

### Smoke validation
Open browser console on a topic page in Arabic:
```js
moment.locale()              // → "ar-ma"
moment().format("MMMM")      // → Moroccan month for current date
```
If both come back right, Block B is doing its job.

### Rollback
Theme components are reversible. Keep the original six **installed but disabled** for one week after deploy. If a regression appears, disable the new component and re-enable the originals in admin → Customize → Components.

## Out of scope (for later, separate work)

- Email / push notification rendering (server-side overrides).
- Mobile native app.
- Server-side i18n customization via `/admin/customize/site_texts`.

## Deprecation note

The user mentioned `<script type="text/discourse-plugin" version="0.8">` going away. None of the six source components use this tag — they're all already on `apiInitializer` or pure CSS. The consolidation will note this in a comment at the top of `arabic-ui.js`. No migration work is needed for these six.
