# Arabic UI Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate six Arabic Discourse theme components into one (`discourse-arabic-morocco-ui`) and fix the Moroccan month + Latin digit rendering bug at the source by switching Moment.js to its built-in `ar-ma` locale.

**Architecture:** Single Discourse theme component. One JS file (`javascripts/discourse/api-initializers/arabic-ui.js`) with discrete behavioral blocks inside one `apiInitializer`. One SCSS file (`common/common.scss`) with three rule groups. One shared global `MutationObserver` drives all DOM-side work; Block E2 (signup gender hider) keeps its click delegation per the original component.

**Tech Stack:** Discourse theme component conventions, modern `apiInitializer` API (no deprecated `<script type="text/discourse-plugin">`), Moment.js (server-shipped), Day.js (server-shipped), SCSS.

**Note on testing:** Discourse theme components have no local unit-test harness. Each task uses static verification (syntax check, file presence) where possible. **Task 12 is the full in-browser QA pass on staging** — that's where end-to-end behavior is verified per the spec's QA checklist.

---

## File structure

```
discourse-arabic-morocco-ui/
├── about.json                                              ← Task 1
├── README.md                                               ← Task 11
├── common/
│   └── common.scss                                         ← Task 2
└── javascripts/
    └── discourse/
        └── api-initializers/
            └── arabic-ui.js                                ← Tasks 3–10 (built incrementally)
```

Working directory for all tasks: `/root/discourse-arabic-morocco-ui/`

---

### Task 1: Scaffold component metadata (`about.json`)

**Files:**
- Create: `/root/discourse-arabic-morocco-ui/about.json`

- [ ] **Step 1: Create `about.json` with theme component metadata**

```json
{
  "name": "discourse-arabic-morocco-ui",
  "component": true
}
```

(Discourse theme components require only `name` and `component: true`. Other fields are optional and omitted to avoid empty-string admin warnings.)

- [ ] **Step 2: Verify it parses as valid JSON**

Run: `cd /root/discourse-arabic-morocco-ui && python3 -c "import json; json.load(open('about.json'))" && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add about.json
git commit -m "scaffold: theme component about.json"
```

---

### Task 2: Create `common/common.scss` with all three CSS rule groups

**Files:**
- Create: `/root/discourse-arabic-morocco-ui/common/common.scss`

- [ ] **Step 1: Create the SCSS file with all three rule groups in order**

```scss
// discourse-arabic-morocco-ui — common.scss
// Consolidates: composer hide (#3), gender option hide (#5), published-page RTL (#6).

// 1. Composer — hide category & tags inputs (Arabic only)  [from #3]
html[lang^="ar"] .category-input,
html[lang^="ar"] .tags-input {
  display: none !important;
}

// 2. Gender options — hide on Arabic UI (signup, by data-value)  [from #5]
html[lang^="ar"] .select-kit-body .select-kit-row[data-value*="Divers / Diverse"],
html[lang^="ar"] .select-kit-body .select-kit-row[data-value*="Prefer not to say"],
html[lang^="ar"] .select-kit-body .select-kit-row[data-value*="عدم الإفصاح"] {
  display: none !important;
}

// 3. Published page — RTL  [from #6]
body.published-page.ar {
  direction: rtl !important;
}
```

- [ ] **Step 2: Verify the file exists and has expected size (>200 bytes)**

Run: `wc -c /root/discourse-arabic-morocco-ui/common/common.scss`
Expected: a number greater than 200.

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add common/common.scss
git commit -m "feat(css): consolidate composer, gender, RTL rules"
```

---

### Task 3: Create `arabic-ui.js` with apiInitializer skeleton + Arabic guard (Block A)

**Files:**
- Create: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

- [ ] **Step 1: Create the file with the skeleton**

```js
// discourse-arabic-morocco-ui — arabic-ui.js
// Consolidates 4 prior JS components: dates/digits (#1), gender hide pref (#2),
// signup labels (#4), gender hide signup (#5). All gated on Arabic UI.
// Modern apiInitializer API — no deprecated <script type="text/discourse-plugin">.
import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.13.0", function (api) {
  // Block A — Arabic detection guard
  var html = document.documentElement;
  var isArabicUI = html.classList.contains("ar") || (html.lang || "").indexOf("ar") === 0;
  if (!isArabicUI) return;

  // Sentinel for QA: confirms the initializer ran on Arabic UI.
  try { console.info("[arabic-ui] active"); } catch (e) {}
});
```

- [ ] **Step 2: Verify JS parses cleanly (syntax check via Node)**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

(Node's `--check` does syntax-only parsing — `import` statements parse fine without resolving the Discourse module.)

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): apiInitializer skeleton with Arabic guard (Block A)"
```

---

### Task 4: Add Block B — Moment.js `ar-ma` locale + Latin digits

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

This is the root-cause fix for the Morocco bug. It changes Moment's active locale to its built-in `ar-ma` (which already has Moroccan months) and forces a `postformat` that rewrites any Arabic-Indic / Persian digits to Latin.

- [ ] **Step 1: Add helper + Block B inside the initializer, after the `console.info` line**

Replace the line:
```js
  try { console.info("[arabic-ui] active"); } catch (e) {}
});
```
with:
```js
  try { console.info("[arabic-ui] active"); } catch (e) {}

  // ---- Helpers shared by Blocks B and C ----
  function toLatinDigits(s) {
    if (!s) return s;
    return s
      .replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); });
  }

  // ---- Block B — Locale fix (root cause) ----
  var req = (window && window.require) ? window.require : null;

  // Moment.js: switch to built-in ar-ma (Moroccan months baked in) and force Latin digits.
  var moment = null;
  try {
    moment = (req && (req("moment").default || req("moment"))) || null;
  } catch (e) { moment = null; }
  if (!moment && window.moment) moment = window.moment;

  function applyMomentLocale() {
    if (!moment) return;
    try {
      moment.updateLocale("ar-ma", { postformat: toLatinDigits });
      moment.locale("ar-ma");
    } catch (e) {
      try { console.warn("[arabic-ui] moment locale set failed:", e); } catch (_) {}
    }
  }
  applyMomentLocale();

  if (!moment) {
    try { console.warn("[arabic-ui] moment unavailable — skipping Block B Moment branch"); } catch (e) {}
  }
});
```

- [ ] **Step 2: Verify JS still parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): Block B — Moment.js ar-ma locale + Latin digits"
```

---

### Task 5: Extend Block B — Day.js Moroccan months + Latin digits

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

Day.js is the secondary date library. Some Discourse renderers use it. Override the `ar` locale's months and pre/postformat so Day.js-rendered dates also come out right.

- [ ] **Step 1: Append Day.js block immediately before the closing `});` of the initializer**

Insert this code right before the final `});` of the `apiInitializer` callback:

```js
  // Day.js: override 'ar' locale with Moroccan months + Latin digits.
  var dayjs = null, updateLocale = null;
  try {
    dayjs = (req && (req("dayjs").default || req("dayjs"))) || null;
    updateLocale = (req && (req("dayjs/plugin/updateLocale").default || req("dayjs/plugin/updateLocale"))) || null;
  } catch (e) { dayjs = dayjs || null; }
  if (!dayjs && window.dayjs) dayjs = window.dayjs;
  if (!updateLocale && window.dayjs_plugin_updateLocale) updateLocale = window.dayjs_plugin_updateLocale;

  if (dayjs && updateLocale && dayjs.extend) {
    var moroccanMonths = [
      "يناير","فبراير","مارس","أبريل","ماي","يونيو",
      "يوليوز","غشت","شتنبر","أكتوبر","نونبر","دجنبر"
    ];
    try {
      dayjs.extend(updateLocale);
      dayjs.updateLocale("ar", {
        months: moroccanMonths,
        monthsShort: moroccanMonths,
        preparse: toLatinDigits,
        postformat: toLatinDigits
      });
      dayjs.locale("ar");
    } catch (e) {
      try { console.warn("[arabic-ui] dayjs locale set failed:", e); } catch (_) {}
    }
  }
```

- [ ] **Step 2: Verify JS parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): Block B — Day.js Moroccan months + Latin digits"
```

---

### Task 6: Add Block C — DOM safety pass (broader selectors, skip `.cooked`)

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

Backup converter for any date string that slips past the locale fix. Now skips `.cooked` and covers more leak surfaces (user card, edit history, action notices, notifications, search results, profile activity).

- [ ] **Step 1: Append Block C before the closing `});` of the initializer**

Insert before the final `});`:

```js
  // ---- Block C — DOM safety pass (backup) ----
  var HAS_AR_NUM = /[٠-٩۰-۹]/;
  var monthRules = [
    { re: /أغسطس/g, to: "غشت" },
    { re: /سبتمبر/g, to: "شتنبر" },
    { re: /نوفمبر/g, to: "نونبر" },
    { re: /ديسمبر/g, to: "دجنبر" },
    { re: /مايو/g, to: "ماي" },
    { re: /يوليو(?!ز)/g, to: "يوليوز" }
  ];

  function fixMonths(s) {
    if (!s) return s;
    for (var i = 0; i < monthRules.length; i++) s = s.replace(monthRules[i].re, monthRules[i].to);
    return s;
  }
  function fixStr(s) {
    if (!s) return s;
    var t = HAS_AR_NUM.test(s) ? toLatinDigits(s) : s;
    return fixMonths(t);
  }

  // UI date surfaces — explicit allow-list. Never includes .cooked (user content).
  var UI_SELECTORS = [
    "time[datetime]",
    ".relative-date",
    ".topic-list .age .relative-date",
    ".topic-list .latest .relative-date",
    ".topic-list .post-activity .relative-date",
    ".topic-post .post-info",
    ".topic-status-info",
    ".topic-meta-data",
    ".topic-timer",
    ".topic-map",
    ".topic-links",
    ".quote .title",
    ".topic-timeline",
    ".timeline-container",
    // Added in consolidation (cover known leak surfaces inside threads):
    ".user-card",
    ".edit-history",
    ".small-action",
    ".notification-list",
    ".user-stream-item",
    ".search-results",
    ".directory .relative-date"
  ];

  function isInsideCooked(el) {
    return !!(el && el.closest && el.closest(".cooked"));
  }

  function processNodeText(el) {
    if (isInsideCooked(el)) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) {
      var tn = nodes[i];
      if (isInsideCooked(tn.parentElement)) continue;
      var old = tn.nodeValue;
      var next = fixStr(old);
      if (next !== old) tn.nodeValue = next;
    }
    var attrs = ["title", "aria-label", "data-original-title"];
    for (var a = 0; a < attrs.length; a++) {
      var attr = attrs[a];
      if (el.hasAttribute && el.hasAttribute(attr)) {
        var oldA = el.getAttribute(attr);
        var nextA = fixStr(oldA);
        if (nextA !== oldA) el.setAttribute(attr, nextA);
      }
    }
  }

  function processUI(root) {
    if (!root || !root.querySelectorAll) return;
    for (var s = 0; s < UI_SELECTORS.length; s++) {
      var sel = UI_SELECTORS[s];
      var list = root.querySelectorAll(sel);
      for (var i = 0; i < list.length; i++) processNodeText(list[i]);
      if (root.matches && root.matches(sel)) processNodeText(root);
    }
  }

  function runDomPass() { processUI(document); }

  // Initial pass on this page.
  runDomPass();
```

- [ ] **Step 2: Verify JS parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): Block C — DOM safety pass with broader selectors and .cooked skip"
```

---

### Task 7: Add Block D — Signup label shortener

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

- [ ] **Step 1: Append Block D before the closing `});` of the initializer**

```js
  // ---- Block D — Signup label shortener (#4) ----
  var SIGNUP_LABEL_REPLACEMENTS = {
    "Alter / Age / Âge / العمر / Возраст / Вік": "العمر",
    "Geschlecht / Gender / Genre / الجنس / Пол / Стать": "الجنس",
    "Sprache / Language / Langue / اللغة / Мова / Язык": "اللغة",
    "Land / Country / Pays / بلد / Країна / Страна": "البلد"
  };

  function isSignupPage() { return window.location.pathname === "/signup"; }
  function isSmallViewport() { return window.innerWidth < 500; }

  function shortenSignupLabels() {
    if (!isSignupPage() || !isSmallViewport()) return;
    var labels = document.querySelectorAll("label");
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      var text = (label.textContent || "").trim();
      if (SIGNUP_LABEL_REPLACEMENTS[text]) {
        label.textContent = SIGNUP_LABEL_REPLACEMENTS[text];
      }
    }
  }

  // Resize handler (rotation / soft keyboard / viewport changes).
  var resizeTid = null;
  window.addEventListener("resize", function () {
    if (resizeTid) clearTimeout(resizeTid);
    resizeTid = setTimeout(shortenSignupLabels, 100);
  }, { passive: true });
```

- [ ] **Step 2: Verify JS parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): Block D — signup label shortener (no setTimeout race)"
```

---

### Task 8: Add Block E1 — Gender hider, preferences

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

- [ ] **Step 1: Append Block E1 before the closing `});` of the initializer**

```js
  // ---- Block E1 — Gender hider on preferences pages (from #2) ----
  var GENDER_PREFS_HIDE_TEXT = ["متنوع", "عدم الإفصاح"];

  function hideGenderOptionsPreferences() {
    var rows = document.querySelectorAll(
      ".user-field-geschlecht--gender .select-kit-body .select-kit-item"
    );
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var text = (row.textContent || "").trim();
      for (var j = 0; j < GENDER_PREFS_HIDE_TEXT.length; j++) {
        if (text.indexOf(GENDER_PREFS_HIDE_TEXT[j]) !== -1) {
          row.style.display = "none";
          break;
        }
      }
    }
  }
```

- [ ] **Step 2: Verify JS parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): Block E1 — gender hider on preferences"
```

---

### Task 9: Add Block E2 — Gender hider, signup (with click delegation)

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

- [ ] **Step 1: Append Block E2 before the closing `});` of the initializer**

```js
  // ---- Block E2 — Gender hider on signup (from #5) ----
  var GENDER_SIGNUP_HIDE_VALUES = [
    "Divers / Diverse / Divers / متنوع / Другое / Інша",
    "Keine Angabe / Prefer not to say / Préfère ne pas dire / أفضل عدم الإفصاح / Предпочитаю не указывать / Не вказувати"
  ];

  function hideGenderOptionsSignup() {
    if (!isSignupPage()) return;
    var rows = document.querySelectorAll(".user-field-geschlecht li.select-kit-row");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var value = row.dataset.value || row.dataset.name || row.textContent || "";
      for (var j = 0; j < GENDER_SIGNUP_HIDE_VALUES.length; j++) {
        if (value.indexOf(GENDER_SIGNUP_HIDE_VALUES[j]) !== -1) {
          row.style.display = "none";
          break;
        }
      }
    }
  }

  // Click delegation — kept from #5; gives select-kit time to render rows.
  document.addEventListener("click", function (event) {
    var genderField = event.target.closest && event.target.closest(".user-field-geschlecht");
    if (!genderField) return;
    setTimeout(hideGenderOptionsSignup, 0);
  });
```

- [ ] **Step 2: Verify JS parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): Block E2 — gender hider on signup (click delegated)"
```

---

### Task 10: Wire shared hooks (page change, MutationObserver, app-events)

**Files:**
- Modify: `/root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js`

Single global `MutationObserver` drives Blocks C, D, and E1. Block E2 keeps its click delegation (already wired in Task 9).

- [ ] **Step 1: Append the hooks section before the closing `});` of the initializer**

```js
  // ---- Shared hooks (registered once) ----
  function runAll() {
    applyMomentLocale();      // re-apply in case Discourse reset locale
    runDomPass();
    shortenSignupLabels();
    hideGenderOptionsPreferences();
    hideGenderOptionsSignup();
  }

  // SPA navigation
  api.onPageChange(function () { runAll(); });

  // App-events (extra coverage for stream / list / search refresh)
  try {
    var appEvents = api.container.lookup("service:app-events") || api.container.lookup("app-events:main");
    var evts = ["page:changed", "topic:loaded", "post-stream:refresh"];
    for (var e = 0; e < evts.length; e++) {
      if (appEvents) appEvents.on(evts[e], runAll);
    }
  } catch (e) {
    try { console.warn("[arabic-ui] app-events wiring failed:", e); } catch (_) {}
  }

  // One global MutationObserver — drives DOM-side passes for B/C/D/E1.
  // requestAnimationFrame coalesces bursts (chat / scroll / lazy posts).
  var rafScheduled = false;
  function scheduleRun() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(function () {
      rafScheduled = false;
      runDomPass();
      shortenSignupLabels();
      hideGenderOptionsPreferences();
    });
  }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === "characterData" || (m.addedNodes && m.addedNodes.length)) {
        scheduleRun();
        return;
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Initial run
  runAll();
```

- [ ] **Step 2: Verify JS parses cleanly**

Run: `node --check /root/discourse-arabic-morocco-ui/javascripts/discourse/api-initializers/arabic-ui.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add javascripts/discourse/api-initializers/arabic-ui.js
git commit -m "feat(js): shared hooks — page change, MutationObserver, app-events"
```

---

### Task 11: Add `README.md` with install + rollback notes

**Files:**
- Create: `/root/discourse-arabic-morocco-ui/README.md`

- [ ] **Step 1: Create README**

```markdown
# discourse-arabic-morocco-ui

Consolidated Discourse theme component for Arabic UI on a Moroccan-context forum. Replaces six prior Arabic components with one.

## What it does

- **Dates & digits** — switches Moment.js to its built-in `ar-ma` locale (Moroccan months: يناير / فبراير / مارس / أبريل / ماي / يونيو / يوليوز / غشت / شتنبر / أكتوبر / نونبر / دجنبر) and forces Latin digits via `postformat`. Same for Day.js. A DOM safety pass catches any string the locale layer misses.
- **Composer (CSS)** — hides category and tag inputs on Arabic UI.
- **Gender field** — hides "Divers / Diverse" and "Prefer not to say" options on signup and on user preferences.
- **Signup labels** — on `/signup` at viewport `< 500px`, replaces multi-language labels with Arabic-only short forms.
- **Published pages (CSS)** — forces RTL on Arabic published pages.

All JS is gated by an Arabic-UI guard (`html.classList.contains("ar")` or `html.lang` starts with `"ar"`).

## Install

**Via Git (recommended):**
1. Push this repo to a Git remote you control (GitHub/GitLab).
2. In Discourse: **Admin → Customize → Components → Install → From a git repository** and paste the repo URL.
3. Add the component to your active theme.

**Via paste (fallback):**
Create a new component in Discourse admin and paste:
- The contents of `common/common.scss` into the **Common → CSS** tab.
- The contents of `javascripts/discourse/api-initializers/arabic-ui.js` into the **Common → Header** tab, wrapped in a `<script type="text/discourse-plugin" version="0.8">` block — **but note:** that tag is being deprecated. Prefer the Git install path.

## Rollback

Theme components are reversible. If a regression appears after deploying, disable this component in **Admin → Customize → Components** and re-enable the original six. Recommended: keep the originals installed-but-disabled for 1 week before deleting.

## Smoke test (browser console, on Arabic UI)

```js
moment.locale()           // → "ar-ma"
moment().format("MMMM")   // → Moroccan month for current date
```

If both look right, the locale block is doing its job.

## Replaces

1. Arabic Latin Digits & Morocco Months
2. Custom AR Hide Gender Options (preferences)
3. Custom Composer AR edits
4. Custom Signup Translation
5. Custom AR Hide Gender Options (signup)
6. published-page-ar-rtl
```

- [ ] **Step 2: Verify README is non-empty**

Run: `wc -l /root/discourse-arabic-morocco-ui/README.md`
Expected: a number greater than 30.

- [ ] **Step 3: Commit**

```bash
cd /root/discourse-arabic-morocco-ui
git add README.md
git commit -m "docs: add README with install and rollback notes"
```

---

### Task 12: Full in-browser QA on staging (final acceptance)

**Files:** none changed. This is the acceptance gate.

**Prerequisite:** install the component on a staging Discourse instance via Git URL, with the user logged in to an Arabic-UI account (or with `?lang=ar`).

- [ ] **Step 1: Smoke check the locale block (browser console on a topic page in Arabic)**

```js
moment.locale()             // expect: "ar-ma"
moment().format("MMMM")     // expect: a Moroccan month name
moment().format("D MMMM YYYY")  // expect: Latin digits + Moroccan month
```

If `moment.locale()` is not `"ar-ma"` — Block B failed. Investigate library resolution (look for `[arabic-ui]` warnings in console) before continuing.

- [ ] **Step 2: Walk the dates & digits checklist (Arabic UI)**

  - [ ] Topic list — "last activity" column shows Latin digits
  - [ ] Topic list — hover relative date, tooltip shows Moroccan month
  - [ ] Inside a topic — every post's date Latin digits
  - [ ] Inside a topic — hover post date, tooltip shows Moroccan month (e.g., غشت / شتنبر / نونبر / دجنبر)
  - [ ] User card popup (click any username) — join date Latin digits + Moroccan month
  - [ ] Edit indicator on edited posts — tooltip correct
  - [ ] Notifications panel (bell icon) — relative dates correct
  - [ ] Search results page — dates correct
  - [ ] Profile page → Activity — dates correct
  - [ ] Reload + navigate between 3-4 topics — no flash of MSA / Arabic-Indic at any point

- [ ] **Step 3: Composer checklist (#3)**

  - [ ] Open composer in Arabic — category and tag inputs are hidden
  - [ ] Switch to non-Arabic UI — both inputs reappear

- [ ] **Step 4: Gender options checklist (#2 + #5)**

  - [ ] Open `/signup` in Arabic — gender dropdown does NOT show "Divers / Diverse"
  - [ ] Open `/signup` in Arabic — gender dropdown does NOT show "Prefer not to say"
  - [ ] Open user preferences in Arabic — same options hidden in the gender field
  - [ ] Switch to non-Arabic — all gender options visible on both pages

- [ ] **Step 5: Signup labels checklist (#4)**

  - [ ] Open `/signup` on a phone (or DevTools mobile, viewport < 500px) in Arabic — labels show short Arabic-only forms (العمر / الجنس / اللغة / البلد)
  - [ ] Resize viewport > 500px — long multi-language labels return

- [ ] **Step 6: RTL checklist (#6)**

  - [ ] Visit any published page (`/pub/...`) in Arabic — direction is right-to-left

- [ ] **Step 7: Console check — no errors from this component**

  - [ ] Open DevTools console; reload; navigate between several pages
  - [ ] Expect: a single `[arabic-ui] active` info line on each Arabic page; **no `[arabic-ui]` warnings**, no uncaught errors originating from this component

- [ ] **Step 8: Disable the original six components, confirm everything still works**

  - [ ] In **Admin → Customize → Components**, disable the original six
  - [ ] Reload, re-run sections 2–6 above
  - [ ] All checklist items still pass

- [ ] **Step 9: Mark complete**

If every checklist box passes, the implementation is done. Tag the release:

```bash
cd /root/discourse-arabic-morocco-ui
git tag v1.0.0
```

If any item fails, file a follow-up task with the specific symptom and the page/element where it occurred. Do **not** mark this task complete on a partial pass.

---

## Self-review notes (already addressed inline)

- All six original components mapped to a task: #1 → Tasks 4+5+6, #2 → Task 8, #3 → Task 2, #4 → Task 7, #5 → Task 9 + Task 2, #6 → Task 2.
- No `TBD` / `TODO` / placeholder language anywhere.
- Function names referenced consistently: `applyMomentLocale`, `runDomPass`, `runAll`, `shortenSignupLabels`, `hideGenderOptionsPreferences`, `hideGenderOptionsSignup`, `toLatinDigits`, `fixStr`, `processNodeText`, `processUI`, `scheduleRun`.
- Helper `toLatinDigits` defined once in Task 4 and reused in Tasks 5 and 6 — no duplication.
- The `moment.locale()` "ar-ma" expectation in Task 12's smoke test matches the `moment.locale("ar-ma")` call in Task 4.
- Block E2's click delegation is wired in Task 9, intentionally **not** moved into the global MutationObserver (per spec — preserves original #5 behavior).
- `applyMomentLocale` is hoisted as a function declaration would be — but written as `function applyMomentLocale() { ... }` so it's available to `runAll()` defined later. Task ordering verified: Block B (Task 4) defines `applyMomentLocale`, Task 10's `runAll` references it.
