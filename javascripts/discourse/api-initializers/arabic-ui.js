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
      .replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); });
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
  } catch (e) { dayjs = null; updateLocale = null; }
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

  // ---- Block F — Force Arabic label on post-action-menu reply buttons ----
  // Workaround for an i18n gap on this Discourse install where the original-post
  // (post #1) reply button renders the default-locale ("Antworten") while reply
  // posts render the Arabic "الرد". The key isn't in any loaded I18n.translations
  // dictionary, so a YAML override isn't enough — we patch the rendered DOM.
  var REPLY_BUTTON_LABEL = "الرد";
  function fixReplyButtonLabels() {
    var labels = document.querySelectorAll(".post-action-menu__reply .d-button-label");
    for (var i = 0; i < labels.length; i++) {
      var span = labels[i];
      if (span.textContent.trim() !== REPLY_BUTTON_LABEL) {
        span.textContent = REPLY_BUTTON_LABEL;
      }
    }
  }

  // ---- Shared hooks (registered once) ----
  function runAll() {
    applyMomentLocale();      // re-apply in case Discourse reset locale
    runDomPass();
    shortenSignupLabels();
    hideGenderOptionsPreferences();
    hideGenderOptionsSignup();
    fixReplyButtonLabels();
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
      fixReplyButtonLabels();
    });
  }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === "characterData" || (m.addedNodes && m.addedNodes.length)) {
        scheduleRun();
        scheduleLabelFix();
        return;
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Block F sensitive to render timing — Discourse cloaks posts on scroll-out
  // and re-renders them on scroll-back, after our rAF has already finished.
  // Debounced delayed re-run catches the post-Ember-render state.
  var labelFixTid = null;
  function scheduleLabelFix() {
    if (labelFixTid) clearTimeout(labelFixTid);
    labelFixTid = setTimeout(fixReplyButtonLabels, 250);
  }
  window.addEventListener("scroll", scheduleLabelFix, { passive: true });

  // Initial run
  runAll();
});
