/* =========================================================
   エントリーポイント
   ========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  SaveMgr.load();
  Quiz.init();
  SFX.init();
  Game.setupInput();
  Screens.showHome();
});
