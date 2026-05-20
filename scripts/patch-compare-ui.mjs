import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const htmlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

const start = html.indexOf('      <motion class="compare-wrap">'.replace("motion ", "div "));
const startDiv = html.indexOf('      <div class="compare-wrap">');
if (startDiv < 0) throw new Error("compare-wrap not found");
const endDiv = html.indexOf('      <div class="field full">', startDiv);
if (endDiv < 0) throw new Error("field full not found");

const newWrap = [
  '      <div class="compare-wrap compare-section">',
  '        <p class="section-title compare-section-title">비교 아파트</p>',
  '        <motion id="compareSlotsRoot" class="compare-slots-stack"></motion>',
  '        <motion class="compare-add-row">',
  '          <button type="button" id="addCompareSlotBtn" class="btn-secondary btn-add-compare">+ 추가</button>',
  "        </motion>",
  "      </motion>",
  ""
].join("\n");

const newWrapFixed = newWrap.split("motion").join("div");

html = html.slice(0, startDiv) + newWrapFixed + html.slice(endDiv);

html = html.replace(
  "지역 선택 후 비교1~3의 동/아파트/평형을 설정하세요.",
  "지역 선택 후 비교 조건(동/아파트/평형)을 설정하세요. [+ 추가]로 최대 3건까지 비교할 수 있습니다."
);

const slotsOld = `    const slots = [
      {
        id: 1,
        color: "#2563eb",
        dongEl: document.getElementById("dongSelect1"),
        aptEl: document.getElementById("aptSelect1"),
        areaEl: document.getElementById("areaSelect1")
      },
      {
        id: 2,
        color: "#ef4444",
        dongEl: document.getElementById("dongSelect2"),
        aptEl: document.getElementById("aptSelect2"),
        areaEl: document.getElementById("areaSelect2")
      },
      {
        id: 3,
        color: "#10b981",
        dongEl: document.getElementById("dongSelect3"),
        aptEl: document.getElementById("aptSelect3"),
        areaEl: document.getElementById("areaSelect3")
      }
    ];`;

const slotsNewRaw = `    const MAX_COMPARE_SLOTS = 3;
    const SLOT_THEME = {
      1: { color: "#2563eb", cls: "c1" },
      2: { color: "#ef4444", cls: "c2" },
      3: { color: "#10b981", cls: "c3" }
    };
    const compareSlotsRoot = document.getElementById("compareSlotsRoot");
    const addCompareSlotBtn = document.getElementById("addCompareSlotBtn");
    let slots = [];

    function updateAddCompareButton() {
      const atMax = slots.length >= MAX_COMPARE_SLOTS;
      addCompareSlotBtn.hidden = atMax;
      addCompareSlotBtn.disabled = atMax;
    }

    function cloneDongSelectOptions(sourceDongEl, targetDongEl) {
      targetDongEl.innerHTML = sourceDongEl.innerHTML;
      targetDongEl.disabled = sourceDongEl.disabled;
      targetDongEl.value = "";
    }

    function buildCompareSlotCard(slotId) {
      const theme = SLOT_THEME[slotId];
      const card = document.createElement("motion");
      card.className = "compare-card " + theme.cls;
      card.dataset.compareSlot = String(slotId);
      card.innerHTML =
        '<motion class="compare-card-head"><p class="section-title">비교 ' + slotId + '</p>' +
        '<button type="button" class="btn-link" data-fav-pick-slot="' + slotId + '">즐겨찾기에서 선택</button></motion>' +
        '<motion class="compare-grid">' +
        '<motion class="field"><label for="dongSelect' + slotId + '">동</label><select id="dongSelect' + slotId + '"><option value="">선택 안함</option></select></motion>' +
        '<motion class="field"><label for="aptSelect' + slotId + '">아파트</label><select id="aptSelect' + slotId + '"><option value="">선택 안함</option></select></motion>' +
        '<motion class="field"><label for="areaSelect' + slotId + '">평형</label><select id="areaSelect' + slotId + '"><option value="">전체</option></select></motion>' +
        "</motion>";
      card.innerHTML = card.innerHTML.split("motion").join("div");
      return {
        id: slotId,
        color: theme.color,
        cardEl: card,
        dongEl: card.querySelector("#dongSelect" + slotId),
        aptEl: card.querySelector("#aptSelect" + slotId),
        areaEl: card.querySelector("#areaSelect" + slotId)
      };
    }

    function addCompareSlot(options = {}) {
      if (slots.length >= MAX_COMPARE_SLOTS) return null;
      const slotId = slots.length + 1;
      const slot = buildCompareSlotCard(slotId);
      slots.push(slot);
      compareSlotsRoot.appendChild(slot.cardEl);
      bindSlotEvents(slot);
      const first = slots[0];
      if (options.syncDong && first && first.id !== slot.id && first.dongEl.options.length > 1) {
        cloneDongSelectOptions(first.dongEl, slot.dongEl);
        renderAptOptions(slot.aptEl, []);
        renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
      }
      updateAddCompareButton();
      return slot;
    }

    function initCompareSlots() {
      compareSlotsRoot.innerHTML = "";
      slots = [];
      addCompareSlot();
      updateAddCompareButton();
      compareSlotsRoot.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-fav-pick-slot]");
        if (!btn) return;
        const sid = Number(btn.getAttribute("data-fav-pick-slot"));
        if (Number.isFinite(sid)) void openSlotFavoritePicker(sid, btn);
      });
      addCompareSlotBtn.addEventListener("click", () => {
        addCompareSlot({ syncDong: true });
        setMessage("비교 " + slots.length + "번 조건이 추가되었습니다.");
      });
    }`;

const slotsNew = slotsNewRaw
  .split("motion")
  .join("div")
  .replace('createElement("div")', 'createElement("div")');

if (!html.includes(slotsOld)) throw new Error("slots block not found");
html = html.replace(slotsOld, slotsNew);

html = html.replace(
  "      slots.forEach(bindSlotEvents);\n      loadMoreBtn.addEventListener",
  "      initCompareSlots();\n      loadMoreBtn.addEventListener"
);

html = html.replace("비교1~3 동 목록을 불러왔습니다.", "비교 슬롯 동 목록을 불러왔습니다.");

const pickOld = `    document.querySelectorAll("[data-fav-pick-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = Number(btn.getAttribute("data-fav-pick-slot"));
        if (Number.isFinite(sid)) {
          void openSlotFavoritePicker(sid, btn);
        }
      });
    });

    document.addEventListener("keydown", (e) => {`;
if (html.includes(pickOld)) {
  html = html.replace(pickOld, `    document.addEventListener("keydown", (e) => {`);
}

fs.writeFileSync(htmlPath, html, "utf8");
console.log("index.html patched OK");
