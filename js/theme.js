/* =========================================================
   かんじラボ 共通テーマ切替
   ---------------------------------------------------------
   <head> で同期読み込みすること(描画前に data-theme を当てて
   ちらつきを防ぐため)。css/theme.css とセットで使う。
   選択は localStorage に保存され、サイト内全アプリで共有される。
   ========================================================= */
(function () {
  "use strict";

  var KEY = "kanjilab_theme_v1";
  // id: data-theme値(""=既定のダーク) / icon: ボタン表示 / label: 切替時の表示名
  var THEMES = [
    { id: "", icon: "🌙", label: "よる" },
    { id: "hiru", icon: "☀️", label: "ひる" },
    { id: "sora", icon: "🌈", label: "そら" },
  ];

  function currentIndex() {
    var saved = "";
    try { saved = localStorage.getItem(KEY) || ""; } catch (e) {}
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === saved) return i;
    }
    return 0;
  }

  function apply(theme) {
    if (theme.id) {
      document.documentElement.setAttribute("data-theme", theme.id);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // 描画前に適用(ちらつき防止)
  apply(THEMES[currentIndex()]);

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.createElement("button");
    btn.id = "theme-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "はいけいの色をかえる");
    btn.title = "はいけいの色をかえる";
    btn.textContent = THEMES[currentIndex()].icon;

    var label = document.createElement("div");
    label.id = "theme-toggle-label";

    var hideTimer = null;
    btn.addEventListener("click", function () {
      var next = THEMES[(currentIndex() + 1) % THEMES.length];
      try { localStorage.setItem(KEY, next.id); } catch (e) {}
      apply(next);
      btn.textContent = next.icon;
      label.textContent = next.icon + " " + next.label;
      label.classList.add("show");
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { label.classList.remove("show"); }, 1200);
    });

    document.body.appendChild(btn);
    document.body.appendChild(label);
  });
})();
