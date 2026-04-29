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

In Discourse: **Admin → Customize → Components → Install → From a git repository** and paste this repo's URL. Then add the component to your active theme.

Note: paste-install via `<script type="text/discourse-plugin">` is not supported because the JS uses ES module syntax (`import`/`export default`) that requires Discourse's module bundler to resolve `discourse/lib/api`. Use the Git install path.

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
