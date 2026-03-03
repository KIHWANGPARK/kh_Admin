const socket = io("https://kh-server.onrender.com");

// 로고 클릭 시 새로고침
document.getElementById("mainLogo")?.addEventListener("click", () => location.reload());

// =====================
// rows / workers 상태
// =====================
let rows = [];
let items = []; // ✅ ITEM 누적 목록 = itemRows 로 서버에 보냄
let selectedWorkers = new Set();
let draftById = new Map();
let itemDraftById = new Map(); // ✅ ITEM 인라인 편집 draft

// =====================
// 비행기 / SPOT / 작업자
// =====================
const AIRCRAFT_A = [
  "HL7417","HL7419","HL7420","HL7421","HL7423","HL7436",
  "HL7616","HL7620","HL7645","HL7646","HL7507"
];
const AIRCRAFT_B = ["HL8319","HL8338","HL8355","HL8503"];
const SPOT_LIST = ["621","622","623","624","625","626","627"];

const UNIT_LIST = ["1파트","주간","1그룹","2그룹","3그룹"];
const WORKERS_BY_DEPT = {
  "1파트" : ["이태우","박진우","유을준","석충근","윤석재","육영근","박태현1","남상명","신경일",
    "김현철","김지환","한승민","성덕주","박범규","장상윤","이범주","장현식","김민구",
    "박태현2","구석서","이상훈","유영준",
    "노귀현","이경찬","조정수","최광철","이동헌","김영훈","이찬형","조정상","김흥규","소순형",
    "차태현","이규빈","박동원","전상훈","엄두훈","김주훈","김경민","권정우","박상우2",
    "김상대","구자민","임우석","최영헌","한준호","김진석2","김동욱","김태윤","우하민",
    "박현우","이재원","이성서","윤영준","박정현","김요셉","김상천","김대현","신영훈",
    "박수빈","민병준","전재일","최재만","김영선","안수성","박영현","김덕환","최세진",
    "최우림","박상우1","송철우","김태완","박상준","최진우","김예준","이태한","이한솔","김수민"


  ],
  "주간" : ["이태우","박진우","유을준","석충근","윤석재","육영근","박태현1","남상명","신경일",
    "김현철","김지환","한승민","성덕주","박범규","장상윤","이범주","장현식","김민구",
    "박태현2","구석서","이상훈","유영준"
  ], 
  "1그룹" : ["노귀현","이경찬","조정수","최광철","이동헌","김영훈","이찬형","조정상","김흥규","소순형",
    "차태현","이규빈","박동원","전상훈","엄두훈","김주훈","김경민","권정우","박상우2"
  ], 
  "2그룹" : ["김상대","구자민","임우석","최영헌","한준호","김진석2","김동욱","김태윤","우하민",
    "박현우","이재원","이성서","윤영준","박정현","김요셉","김상천","김대현","신영훈"
  ], 
  "3그룹" : ["박수빈","민병준","전재일","최재만","김영선","안수성","박영현","김덕환","최세진",
    "최우림","박상우1","송철우","김태완","박상준","최진우","김예준","이태한","이한솔","김수민"
  ]
};

const SPOT_CUSTOM_VALUE = "__CUSTOM__";

// 시간 옵션: GRD + 00~23 (GRD가 제일 위)
const HOUR_LIST = ["GRD", ...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))];
const MINUTE_LIST = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// =====================
// DOM helper
// =====================
const $ = (id) => document.getElementById(id);

function makeId() {
  return (crypto?.randomUUID?.() || `R${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// =====================
// ✅ emit 통일 (rows + itemRows 같이)
// =====================
function emitState() {
  socket.emit("state:update", {
    title: "작업표",
    rows,
    itemRows: items, // ✅ Display는 state.itemRows 로 받게 됨
  });
}

// =====================
// 렌더 헬퍼
// =====================
function renderRadioGroup(containerId, name, values) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = "";

  values.forEach((val, idx) => {
    const id = `${name}_${containerId}_${idx}`;
    const label = document.createElement("label");
    label.className = "option";
    label.setAttribute("for", id);
    label.innerHTML = `
      <input type="radio" name="${name}" id="${id}" value="${val}">
      <span>${val}</span>
    `;
    container.appendChild(label);
  });
}

function renderSelect(selectId, values, placeholder) {
  const sel = $(selectId);
  if (!sel) return;
  sel.innerHTML = "";

  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function getCheckedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

// =====================
// 작업자 체크박스
// =====================
function getWorkersForUnit(unit) {
  if (!unit) return [];
  return (WORKERS_BY_DEPT[unit] || []).map(name => `${unit} ${name}`);
}

function renderWorkerCheckboxes(unit) {
  const container = $("workerGroup");
  if (!container) return;

  container.innerHTML = "";

  if (!unit) {
    container.innerHTML = `<p class="hint">부서를 선택하면 인원이 표시됩니다.</p>`;
    return;
  }

  const list = getWorkersForUnit(unit);
  if (!list.length) {
    container.innerHTML = `<p class="hint">표시할 인원이 없습니다.</p>`;
    return;
  }

  list.forEach((val, idx) => {
    const id = `worker_${unit}_${idx}`;
    const nameOnly = val.split(" ").slice(1).join(" ");
    const isSelected = selectedWorkers.has(nameOnly);

    const label = document.createElement("label");
    label.className = "option";
    label.setAttribute("for", id);

    label.innerHTML = `
      <input type="checkbox" id="${id}" value="${nameOnly}" ${isSelected ? "checked" : ""}>
      <span>${nameOnly}</span>
    `;

    if (isSelected) label.style.opacity = "0.55";

    const input = label.querySelector("input");
    input.addEventListener("change", (e) => {
      const name = e.target.value;
      if (e.target.checked) selectedWorkers.add(name);
      else selectedWorkers.delete(name);

      renderWorkerCheckboxes($("unit")?.value);
    });

    container.appendChild(label);
  });
}

function getSelectedWorkersArray() {
  return Array.from(selectedWorkers);
}

// =====================
// SPOT 직접입력
// =====================
function syncSpotCustomUI() {
  const spotCustomInput = $("spotCustom");
  if (!spotCustomInput) return;

  const isCustom = (getCheckedValue("spot") === SPOT_CUSTOM_VALUE);
  spotCustomInput.disabled = !isCustom;

  if (!isCustom) spotCustomInput.value = "";
  if (isCustom) spotCustomInput.focus();
}

function bindSpotCustomInput() {
  const spotCustomRadio = $("spot_custom_radio");
  const spotCustomInput = $("spotCustom");
  if (!spotCustomInput) return;

  spotCustomInput.addEventListener("input", () => {
    if (spotCustomRadio) spotCustomRadio.checked = true;
    spotCustomInput.disabled = false;
  });

  spotCustomInput.addEventListener("focus", () => {
    if (spotCustomRadio) spotCustomRadio.checked = true;
    spotCustomInput.disabled = false;
  });

  document.addEventListener("change", (e) => {
    if (e.target && e.target.name === "spot") syncSpotCustomUI();
  });

  syncSpotCustomUI();
}

// =====================
// 시간(ARR/DEP) + GRD 처리
// =====================
function formatTime(h, m) {
  if (!h) return "";
  if (h === "GRD") return "GRD";
  if (!m) return `${h}:00`;
  return `${h}:${m}`;
}

function syncGrdMinuteLock(hourId, minuteId) {
  const hourEl = $(hourId);
  const minEl = $(minuteId);
  if (!hourEl || !minEl) return;

  const isGrd = hourEl.value === "GRD";
  if (isGrd) {
    minEl.value = "00";
    minEl.disabled = true;
  } else {
    minEl.disabled = false;
    if (!minEl.value) minEl.value = "00";
  }
}

function bindTimeUI() {
  $("depHour")?.addEventListener("change", () => syncGrdMinuteLock("depHour", "depMinute"));
  $("depMinute")?.addEventListener("change", () => syncGrdMinuteLock("depHour", "depMinute"));

  $("arrHour")?.addEventListener("change", () => syncGrdMinuteLock("arrHour", "arrMinute"));
  $("arrMinute")?.addEventListener("change", () => syncGrdMinuteLock("arrHour", "arrMinute"));

  syncGrdMinuteLock("depHour", "depMinute");
  syncGrdMinuteLock("arrHour", "arrMinute");
}

// =====================
// 작업사항 자동 번호(1., Enter마다 증가)
// =====================
function ensureWorkStartsNumbered() {
  const el = $("work");
  if (!el) return;

  if (!el.value.trim()) {
    el.value = "1. ";
    el.setSelectionRange(el.value.length, el.value.length);
  }
}

function nextNumberFromText(text) {
  const lines = String(text || "").split("\n");
  let max = 0;
  for (const line of lines) {
    const m = line.trim().match(/^(\d+)\.\s/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return (max || 0) + 1;
}

function insertAtCursor(textarea, insertText) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + insertText + after;
  const pos = (before + insertText).length;
  textarea.setSelectionRange(pos, pos);
}

function bindWorkAutoNumbering() {
  const el = $("work");
  if (!el) return;

  el.addEventListener("focus", () => ensureWorkStartsNumbered());

  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const n = nextNumberFromText(el.value);
    insertAtCursor(el, `\n${n}. `);
  });
}

// =====================
// 초기 UI 렌더
// =====================
function initFormUI() {
  renderRadioGroup("aircraftGroupA", "aircraft", AIRCRAFT_A);
  renderRadioGroup("aircraftGroupB", "aircraft", AIRCRAFT_B);
  renderRadioGroup("spotGroup", "spot", SPOT_LIST);

  renderSelect("depHour", HOUR_LIST);
  renderSelect("arrHour", HOUR_LIST);
  renderSelect("depMinute", MINUTE_LIST);
  renderSelect("arrMinute", MINUTE_LIST);

  if ($("depHour")) $("depHour").value = "GRD";
  if ($("depMinute")) $("depMinute").value = "00";
  if ($("arrHour")) $("arrHour").value = "GRD";
  if ($("arrMinute")) $("arrMinute").value = "00";

  renderSelect("unit", UNIT_LIST, "부서 선택");
  renderWorkerCheckboxes("");

  $("unit")?.addEventListener("change", () => renderWorkerCheckboxes($("unit")?.value));

  bindSpotCustomInput();
  bindTimeUI();
  bindWorkAutoNumbering();
  // ensureWorkStartsNumbered();

  $("resetBtn")?.addEventListener("click", () => {
  const ok = confirm("Display 및 입력창 전체 초기화를 진행하시겠습니까?");
  if (!ok) return;          // 아니오면 종료
  resetAllRowsAndForm();    // 예면 초기화 실행
});

  // ✅ ITEM 버튼 바인딩
  $("addItemBtn")?.addEventListener("click", addItem);
  $("clearItemsBtn")?.addEventListener("click", clearAllItems);
}

// =====================
// 작업표 전송(추가)
// =====================
function clearInputsForNext() {
  const workEl = $("work");
  if (workEl) {
    workEl.value = "";
    // workEl.setSelectionRange(workEl.value.length, workEl.value.length);
  }

  const spotCustomInput = $("spotCustom");
  if (spotCustomInput) {
    spotCustomInput.value = "";
    spotCustomInput.disabled = true;
  }

  selectedWorkers.clear();
  renderWorkerCheckboxes($("unit")?.value);
}

$("sendBtn")?.addEventListener("click", () => {
  const aircraft = getCheckedValue("aircraft");
  let spot = getCheckedValue("spot");

  const arrH = $("depHour")?.value || "";
  const arrM = $("depMinute")?.value || "";
  const depH = $("arrHour")?.value || "";
  const depM = $("arrMinute")?.value || "";

  const arrTime = formatTime(arrH, arrM);
  const depTime = formatTime(depH, depM);

  const work = ($("work")?.value || "").trim();
  const unit = $("unit")?.value || "";
  const selectedWorkersArr = getSelectedWorkersArray();

  if (!aircraft) return alert("비행기를 선택하세요.");
  if (!spot) return alert("SPOT을 선택하세요.");

  if (spot === SPOT_CUSTOM_VALUE) {
    const custom = ($("spotCustom")?.value || "").trim();
    if (!custom) return alert("SPOT 직접입력 값을 입력하세요.");
    spot = custom;
  }

  if (!arrTime) return alert("ARR 시간을 선택하세요.");
  if (!depTime) return alert("DEP 시간을 선택하세요.");
  if (!work) return alert("작업사항을 입력하세요.");
  if (!unit) return alert("부서를 선택하세요.");
  if (selectedWorkersArr.length === 0) return alert("인원을 1명 이상 선택하세요.");

  const row = {
    id: makeId(),
    aircraft,
    arrTime,
    depTime,
    time: `${arrTime}~${depTime}`,
    spot,
    work,
    workers: selectedWorkersArr
  };

  rows.push(row);

  emitState();
  renderRowsList();

  clearInputsForNext();
  alert(`작업표가 추가되었습니다. (총 ${rows.length}건)`);
});

// =====================
// 작업표 전송된 목록(수정/삭제)
// =====================
function formatWorkersInput(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join(" ");
}

function parseWorkersText(txt) {
  const tokens = String(txt ?? "")
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

function renderRowsList() {
  const box = $("rowsList");
  if (!box) return;

  if (!rows.length) {
    box.className = "rows-list muted";
    box.textContent = "표시할 항목이 없습니다.";
    return;
  }

  box.className = "rows-list";

  box.innerHTML = rows.map((r, idx) => {
    const workersArr = Array.isArray(r.workers)
      ? r.workers
      : (typeof r.worker === "string" ? r.worker.split(/\s+/).filter(Boolean) : []);

    const draft = draftById.get(r.id) || {};
    const aircraft = draft.aircraft ?? r.aircraft ?? "";
    const arrTime = draft.arrTime ?? r.arrTime ?? "";
    const depTime = draft.depTime ?? r.depTime ?? "";
    const spot = draft.spot ?? r.spot ?? "";
    const work = draft.work ?? r.work ?? "";
    const workersText = draft.workersText ?? formatWorkersInput(workersArr);

    // ✅ 여기서 <div ...> 빠지면 "< class="row-grid">" 텍스트로 찍힘 (주의)
    return `
      <div class="row-item" data-id="${r.id}">
        <div class="muted" style="margin-bottom:8px;font-weight:800">#${idx + 1}</div>

        <div class="row-grid">
          <div class="cell">
            <label>기번</label>
            <input data-field="aircraft" value="${escapeAttr(aircraft)}" />
          </div>

          <div class="cell">
            <label>TIME (ARR / DEP)</label>
            <div class="timeSplit">
              <input data-field="arrTime" value="${escapeAttr(arrTime)}" placeholder="ARR (예: 08:00/GRD)" />
              <input data-field="depTime" value="${escapeAttr(depTime)}" placeholder="DEP (예: 17:00/GRD)" />
            </div>
          </div>

          <div class="cell spotCellGrid">
            <label>SPOT</label>
            <input data-field="spot" value="${escapeAttr(spot)}" />
          </div>

          <div class="cell workCellGrid">
            <label>작업사항</label>
            <textarea data-field="work">${escapeHtml(work)}</textarea>
          </div>

          <div class="cell workerCellGrid">
            <label>근무자 (공백/줄바꿈으로 분리, 한 행에 4명씩 표기)</label>
            <textarea data-field="workersText">${escapeHtml(workersText)}</textarea>
          </div>
        </div>

        <div class="row-actions">
          <button class="btn-mini btn-save" data-action="save" data-id="${r.id}">수정</button>
          <button class="btn-mini btn-del" data-action="del" data-id="${r.id}">삭제</button>
        </div>
      </div>
    `;
  }).join("");

  // draft 반영
  box.querySelectorAll(".row-item input, .row-item textarea").forEach(el => {
    el.addEventListener("input", (e) => {
      const item = e.target.closest(".row-item");
      const id = item.dataset.id;
      const field = e.target.dataset.field;

      const prev = draftById.get(id) || {};
      draftById.set(id, { ...prev, [field]: e.target.value });
    });
  });

  box.querySelectorAll(".row-item input, .row-item textarea").forEach(el => {
    el.addEventListener("input", (e) => {
      const item = e.target.closest(".row-item");
      const id = item.dataset.id;
      const field = e.target.dataset.field;

      const prev = draftById.get(id) || {};
      draftById.set(id, { ...prev, [field]: e.target.value });
    });
  });

  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "del") return deleteRow(id);
      if (action === "save") return saveRow(id);
    });
  });
}

function isValidTimeToken(t) {
  const s = String(t ?? "").trim();
  if (!s) return false;
  if (s === "GRD") return true;
  return /^\d{2}:\d{2}$/.test(s);
}

function saveRow(id) {
  const draft = draftById.get(id);
  if (!draft) return alert("변경된 내용이 없습니다.");

  const cur = rows.find(r => r.id === id) || {};

  const aircraft = String(draft.aircraft ?? cur.aircraft ?? "").trim();
  const arrTime = String(draft.arrTime ?? cur.arrTime ?? "").trim();
  const depTime = String(draft.depTime ?? cur.depTime ?? "").trim();
  const spot = String(draft.spot ?? cur.spot ?? "").trim();
  const work = String(draft.work ?? cur.work ?? "").trim();
  const workersText = String(draft.workersText ?? formatWorkersInput(cur.workers ?? [])).trim();

  if (!aircraft) return alert("기번은 비울 수 없습니다.");
  if (!arrTime || !isValidTimeToken(arrTime)) return alert("ARR 형식이 올바르지 않습니다. (예: 08:00 또는 GRD)");
  if (!depTime || !isValidTimeToken(depTime)) return alert("DEP 형식이 올바르지 않습니다. (예: 17:00 또는 GRD)");
  if (!spot) return alert("SPOT은 비울 수 없습니다.");
  if (!work) return alert("작업사항은 비울 수 없습니다.");

  const workers = parseWorkersText(workersText);

  rows = rows.map(r => r.id !== id ? r : ({
    ...r,
    aircraft,
    arrTime,
    depTime,
    time: `${arrTime}~${depTime}`,
    spot,
    work,
    workers
  }));

  draftById.delete(id);

  emitState();
  renderRowsList();
  alert("수정 되었습니다.");
}

function deleteRow(id) {
  rows = rows.filter(r => r.id !== id);
  draftById.delete(id);

  emitState();
  renderRowsList();
  alert("삭제 되었습니다.");
}

// =====================
// Reset 버튼: 작업표 rows만 초기화 (ITEM은 유지)
// =====================
function resetAllRowsAndForm() {
  rows = [];
  draftById.clear();

  renderRadioGroup("aircraftGroupA", "aircraft", AIRCRAFT_A);
  renderRadioGroup("aircraftGroupB", "aircraft", AIRCRAFT_B);
  renderRadioGroup("spotGroup", "spot", SPOT_LIST);

  renderSelect("depHour", HOUR_LIST);
  renderSelect("arrHour", HOUR_LIST);
  renderSelect("depMinute", MINUTE_LIST);
  renderSelect("arrMinute", MINUTE_LIST);

  if ($("depHour")) $("depHour").value = "GRD";
  if ($("depMinute")) $("depMinute").value = "00";
  if ($("arrHour")) $("arrHour").value = "GRD";
  if ($("arrMinute")) $("arrMinute").value = "00";

  bindTimeUI();

  const spotCustomInput = $("spotCustom");
  if (spotCustomInput) {
    spotCustomInput.value = "";
    spotCustomInput.disabled = true;
  }
  const spotCustomRadio = $("spot_custom_radio");
  if (spotCustomRadio) spotCustomRadio.checked = false;

  const workEl = $("work");
  if (workEl) {
    workEl.value = "";
    workEl.setSelectionRange(workEl.value.length, workEl.value.length);
  }

  selectedWorkers.clear();
  if ($("unit")) $("unit").value = "";
  renderWorkerCheckboxes("");

  emitState();
  renderRowsList();
  alert("초기화 되었습니다.");
}

// =====================================================
// ✅✅✅ ITEM 누적형 (A~H 한 줄씩 추가 / 수정 / 삭제 / 전체삭제)
// =====================================================
function readItemInput(k) {
  // 네 HTML: itemA, itemB ... itemH 사용
  return ($(`item${k}`)?.value ?? "").trim();
}

function clearItemInputs() {
  ["A","B","C","D","E","F","G","H"].forEach(k => {
    const el = $(`item${k}`);
    if (el) el.value = "";
  });
}

function addItem() {
  const v = {
    A: readItemInput("A"),
    B: readItemInput("B"),
    C: readItemInput("C"),
    D: readItemInput("D"),
    E: readItemInput("E"),
    F: readItemInput("F"),
    G: readItemInput("G"),
    H: readItemInput("H"),
  };

  const any = Object.values(v).some(x => String(x).trim() !== "");
  if (!any) return alert("ITEM 값을 1개 이상 입력하세요.");

  items.push({ id: makeId(), ...v, createdAt: Date.now() });

  clearItemInputs();
  itemDraftById.clear();

  emitState();
  renderItemsList();
  alert("ITEM이 추가되었습니다.");
}

function renderItemsList() {
  const box = $("itemsList");
  if (!box) return;

  if (!items.length) {
    box.className = "rows-list muted";
    box.textContent = "대기 중…";
    return;
  }

  box.className = "rows-list";

  box.innerHTML = items.map((it, idx) => {
    const draft = itemDraftById.get(it.id) || {};

    const A = draft.A ?? it.A ?? "";
    const B = draft.B ?? it.B ?? "";
    const C = draft.C ?? it.C ?? "";
    const D = draft.D ?? it.D ?? "";
    const E = draft.E ?? it.E ?? "";
    const F = draft.F ?? it.F ?? "";
    const G = draft.G ?? it.G ?? "";
    const H = draft.H ?? it.H ?? "";

    return `
      <div class="row-item" data-id="${it.id}">
        <div class="muted" style="margin-bottom:8px;font-weight:800">#${idx + 1}</div>

        <div class="row-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
          <div class="cell"><label>기번</label><input data-field="A" value="${escapeAttr(A)}" /></div>
          <div class="cell"><label>시작일자</label><input data-field="B" value="${escapeAttr(B)}" /></div>
          <div class="cell"><label>종료일자</label><input data-field="C" value="${escapeAttr(C)}" /></div>
          <div class="cell"><label>결함내용</label><input data-field="D" value="${escapeAttr(D)}" /></div>
          <div class="cell"><label>명칭</label><input data-field="E" value="${escapeAttr(E)}" /></div>
          <div class="cell"><label>P/N</label><input data-field="F" value="${escapeAttr(F)}" /></div>
          <div class="cell"><label>S/N</label><input data-field="G" value="${escapeAttr(G)}" /></div>
          <div class="cell"><label>작업자</label><input data-field="H" value="${escapeAttr(H)}" /></div>
        </div>

        <div class="row-actions" style="justify-content:center;">
          <button class="btn-mini btn-save" data-action="item-save" data-id="${it.id}">수정</button>
          <button class="btn-mini btn-del" data-action="item-del" data-id="${it.id}">삭제</button>
        </div>
      </div>
    `;
  }).join("");

  // draft 저장
  box.querySelectorAll(".row-item input").forEach(el => {
    el.addEventListener("input", (e) => {
      const wrap = e.target.closest(".row-item");
      const id = wrap.dataset.id;
      const field = e.target.dataset.field;

      const prev = itemDraftById.get(id) || {};
      itemDraftById.set(id, { ...prev, [field]: e.target.value });
    });
  });

  // 버튼 핸들러
  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "item-save") return saveItem(id);
      if (action === "item-del") return deleteItem(id);
    });
  });
}

function saveItem(id) {
  const draft = itemDraftById.get(id);
  if (!draft) return alert("변경된 내용이 없습니다.");

  items = items.map(r => (r.id !== id ? r : ({ ...r, ...draft })));
  itemDraftById.delete(id);

  emitState();
  renderItemsList();
  alert("ITEM이 수정되었습니다.");
}

function deleteItem(id) {
  items = items.filter(r => r.id !== id);
  itemDraftById.delete(id);

  emitState();
  renderItemsList();
  alert("ITEM이 삭제되었습니다.");
}

function clearAllItems() {
  const ok = confirm("ITEM 전체를 삭제할까요?");
  if (!ok) return;

  items = [];
  itemDraftById.clear();

  emitState();
  renderItemsList();
  alert("ITEM 전체삭제 완료.");
}

// =====================
// 서버 최신 상태 동기화 (1개만!)
// =====================
socket.on("state:update", (state) => {
  if (!state) return;

  rows = Array.isArray(state.rows)
    ? state.rows.map(r => ({ ...r, id: r.id || makeId() }))
    : [];

  // ✅ itemRows를 items로 받는다
  items = Array.isArray(state.itemRows)
    ? state.itemRows.map(it => ({ ...it, id: it.id || makeId() }))
    : [];

  renderRowsList();
  renderItemsList();
});

// =====================
// 앱 시작 (DOM 로드 후)
// =====================
document.addEventListener("DOMContentLoaded", () => {
  initFormUI();
  renderRowsList();
  renderItemsList();
});