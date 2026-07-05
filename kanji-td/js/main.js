/* =========================================================
   エントリーポイント
   ========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  SaveMgr.load();
  Quiz.init();
  SFX.init();
  BGM.init();
  Game.setupInput();
  Screens.showHome();
});
