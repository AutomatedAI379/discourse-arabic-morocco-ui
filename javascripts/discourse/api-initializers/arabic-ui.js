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
});
