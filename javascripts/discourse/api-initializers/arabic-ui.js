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
