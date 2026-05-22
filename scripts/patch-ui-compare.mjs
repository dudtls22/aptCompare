import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const htmlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

html = html.replace(/        <div class="compare-card c2">[\s\S]*?        <\/motion>\r?\n\r?\n/, "");
html = html.replace(/        <div class="compare-card c2">[\s\S]*?        <\/div>\r?\n\r?\n/, "");

const buildStart = html.indexOf("    function buildCompareSlotCard(slotId)");
const buildEnd = html.indexOf("    function addCompareSlot(options = {})");
if (buildStart < 0 || buildEnd < 0) {
  console.error("markers not found", buildStart, buildEnd);
  process.exit(1);
}

const cleanBuild = `    function getNextSlotId() {
      const used = new Set(slots.map((s) => s.id));
      for (let i = 1; i <= MAX_COMPARE_SLOTS; i++) {
        if (!used.has(i)) return i;
      }
      return null;
    }

    function clearCompareSlotFields(slot) {
      if (!slot?.dongEl) return;
      slot.dongEl.value = "";
      if (slot.aptEl) renderAptOptions(slot.aptEl, []);
      if (slot.areaEl) renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
    }

    function removeCompareSlot(slotId) {
      if (slotId <= 1) return;
      const idx = slots.findIndex((s) => s.id === slotId);
      if (idx < 0) return;
      const slot = slots[idx];
      clearCompareSlotFields(slot);
      slot.cardEl.remove();
      slots.splice(idx, 1);
      updateAddCompareButton();
      setMessage(\`비교 \${slotId} 영역을 삭제했습니다.\`);
    }

    function buildCompareSlotCard(slotId) {
      const theme = SLOT_THEME[slotId];
      const removeBtn =
        slotId > 1
          ? '<button type="button" class="btn-slot-remove" data-remove-slot="' +
            slotId +
            '" aria-label="비교 ' +
            slotId +
            ' 삭제" title="삭제">×</button>'
          : "";
      const card = document.createElement("motion");
      card.className = "compare-card " + theme.cls;
      card.dataset.compareSlot = String(slotId);
      card.innerHTML =
        '<TAG class="compare-card-head"><p class="section-title">비교 ' +
        slotId +
        '</p><TAG class="compare-card-actions">' +
        '<button type="button" class="btn-link" data-fav-pick-slot="' +
        slotId +
        '">즐겨찾기에서 선택</button>' +
        removeBtn +
        "</TAG></TAG>" +
        '<TAG class="compare-grid">' +
        '<TAG class="field"><label for="dongSelect' +
        slotId +
        '">동</label><select id="dongSelect' +
        slotId +
        '"><option value="">선택 안함</option></select></TAG>' +
        '<TAG class="field"><label for="aptSelect' +
        slotId +
        '">아파트</label><select id="aptSelect' +
        slotId +
        '"><option value="">선택 안함</option></select></TAG>' +
        '<TAG class="field"><label for="areaSelect' +
        slotId +
        '">평형</label><select id="areaSelect' +
        slotId +
        '"><option value="">전체</option></select></TAG>' +
        "</TAG>";
      card.innerHTML = card.innerHTML.replaceAll("TAG", "motion");
      card.innerHTML = card.innerHTML.replaceAll("motion", "div");
      return {
        id: slotId,
        color: theme.color,
        cardEl: card,
        dongEl: card.querySelector("#dongSelect" + slotId),
        aptEl: card.querySelector("#aptSelect" + slotId),
        areaEl: card.querySelector("#areaSelect" + slotId)
      };
    }

`.replaceAll("motion", "div");

html = html.slice(0, buildStart) + cleanBuild + html.slice(buildEnd);

html = html.replace(
  "const slotId = slots.length + 1;",
  "const slotId = getNextSlotId();\n      if (!slotId) return null;"
);

html = html.replace(/btn\.textContent = "\+ 추가";/g, 'btn.textContent = "아파트 추가+";');

if (!html.includes('addCompareSlotBtn.textContent = "아파트 추가+"')) {
  html = html.replace(
    "addCompareSlotBtn = document.getElementById(\"addCompareSlotBtn\");\n      const root = compareSlotsRoot;",
    "addCompareSlotBtn = document.getElementById(\"addCompareSlotBtn\");\n      if (addCompareSlotBtn) addCompareSlotBtn.textContent = \"아파트 추가+\";\n      const root = compareSlotsRoot;"
  );
}

if (!html.includes("data-remove-slot")) {
  html = html.replace(
    `        root.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-fav-pick-slot]");
          if (!btn) return;
          const sid = Number(btn.getAttribute("data-fav-pick-slot"));
          if (Number.isFinite(sid)) void openSlotFavoritePicker(sid, btn);
        });`,
    `        root.addEventListener("click", (e) => {
          const removeBtn = e.target.closest("[data-remove-slot]");
          if (removeBtn) {
            removeCompareSlot(Number(removeBtn.getAttribute("data-remove-slot")));
            return;
          }
          const btn = e.target.closest("[data-fav-pick-slot]");
          if (!btn) return;
          const sid = Number(btn.getAttribute("data-fav-pick-slot"));
          if (Number.isFinite(sid)) void openSlotFavoritePicker(sid, btn);
        });`
  );
}

html = html.replace(
  'setMessage("비교 " + slots.length + "번 조건이 추가되었습니다.");',
  'setMessage("아파트 비교 영역이 추가되었습니다. (비교 " + slots.length + ")");'
);

fs.writeFileSync(htmlPath, html, "utf8");
console.log("patched OK");
