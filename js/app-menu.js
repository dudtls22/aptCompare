/** 상단 햄버거 메뉴 (index · gap 공통) */
(function () {
  const btn = document.getElementById("appMenuBtn");
  const panel = document.getElementById("appMenuPanel");
  if (!btn || !panel) return;

  function closeMenu() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "메뉴 열기");
  }

  function openMenu() {
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "메뉴 닫기");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.hidden) openMenu();
    else closeMenu();
  });

  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!panel.hidden) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
})();
