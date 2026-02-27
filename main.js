const socket = io("https://kh-server.onrender.com");

// 로고 클릭 시 새로고침
document.getElementById("mainLogo").addEventListener("click", () => location.reload());

// =====================
// rows / workers 상태
// =====================
let rows = [];
let selectedWorkers = new Set();
let draftById = new Map(); // 인라인 편집 중 변경분 임시 저장

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

function getWorkersForUnit(unit) {
  if (!unit) return [];
  return (WORKERS_BY_DEPT[unit] || []).map(name => `${unit} ${name}`);
}

// 시간(기조 그대로)
const HOUR_LIST = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTE_LIST = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

// DOM helper
const $ = (id) => document.getElementById(id);

// SPOT 직접입력
const SPOT_CUSTOM_VALUE = "__CUSTOM__";

// ---------------------
// 렌더 헬퍼
// ---------------------
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

function makeId() {
  return (crypto?.randomUUID?.() || `R${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

// ---------------------
// TIME 유틸
// ---------------------
function toTimeStr(hh, mm) {
  if (hh === "" || mm === "") return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// r.time = "HH:MM~HH:MM" 또는 depTime/arrTime가 올 수 있음
function parseTimeRange(r) {
  const dep = (r?.depTime ?? "").trim();
  const arr = (r?.arrTime ?? "").trim();
  if (dep && arr) return { dep, arr };

  const t = String(r?.time ?? "").trim();
  const m = t.match(/^(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})$/);
  if (m) return { dep: m[1], arr: m[2] };

  return { dep: "", arr: "" };
}

function buildTimeRange(depTime, arrTime) {
  if (!depTime || !arrTime) return "";
  return `${depTime}~${arrTime}`;
}

// ---------------------
// 인원 체크박스 렌더
// ---------------------
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

      renderWorkerCheckboxes($("unit").value);
    });

    container.appendChild(label);
  });
}

function getSelectedWorkersArray() {
  return Array.from(selectedWorkers);
}

// ---------------------
// SPOT 직접입력 UI 상태 반영
// ---------------------
let spotChangeBound = false;

function syncSpotCustomUI() {
  const spotCustomRadio = $("spot_custom_radio");
  const spotCustomInput = $("spotCustom");
  if (!spotCustomInput) return;

  const isCustom = (getCheckedValue("spot") === SPOT_CUSTOM_VALUE);

  spotCustomInput.disabled = !isCustom;
  if (!isCustom) spotCustomInput.value = "";

  if (spotCustomRadio) {
    spotCustomInput.oninput = () => {
      spotCustomRadio.checked = true;
      spotCustomInput.disabled = false;
    };
    spotCustomInput.onfocus = () => {
      spotCustomRadio.checked = true;
      spotCustomInput.disabled = false;
    };
  }
}

// ---------------------
// 초기 렌더 + 이벤트 바인딩
// ---------------------
function initFormUI() {
  renderRadioGroup("aircraftGroupA", "aircraft", AIRCRAFT_A);
  renderRadioGroup("aircraftGroupB", "aircraft", AIRCRAFT_B);
  renderRadioGroup("spotGroup", "spot", SPOT_LIST);

  // 출발/도착 시간 select 렌더
  renderSelect("depHour", HOUR_LIST);
  renderSelect("depMinute", MINUTE_LIST);
  renderSelect("arrHour", HOUR_LIST);
  renderSelect("arrMinute", MINUTE_LIST);

  // 기본값
  if ($("depHour")) $("depHour").value = "00";
  if ($("depMinute")) $("depMinute").value = "00";
  if ($("arrHour")) $("arrHour").value = "00";
  if ($("arrMinute")) $("arrMinute").value = "00";

  renderSelect("unit", UNIT_LIST, "부서 선택");
  renderWorkerCheckboxes("");

  if ($("unit")) {
    $("unit").onchange = () => renderWorkerCheckboxes($("unit").value);
  }

  if (!spotChangeBound) {
    document.addEventListener("change", (e) => {
      if (e.target && e.target.name === "spot") syncSpotCustomUI();
    });
    spotChangeBound = true;
  }
  syncSpotCustomUI();
}

// ---------------------
// 전송(추가) 버튼
// ---------------------
function clearInputsForNext() {
  if ($("work")) $("work").value = "";

  const spotCustomInput = $("spotCustom");
  if (spotCustomInput) {
    spotCustomInput.value = "";
    spotCustomInput.disabled = true;
  }

  selectedWorkers.clear();
  renderWorkerCheckboxes($("unit").value);
}

if ($("sendBtn")) {
  $("sendBtn").addEventListener("click", () => {
    const aircraft = getCheckedValue("aircraft");
    let spot = getCheckedValue("spot");

    const depTime = toTimeStr($("depHour").value, $("depMinute").value);
    const arrTime = toTimeStr($("arrHour").value, $("arrMinute").value);
    const time = buildTimeRange(depTime, arrTime);

    const work = $("work").value.trim();
    const unit = $("unit").value;
    const selectedWorkersArr = getSelectedWorkersArray();

    if (!aircraft) return alert("비행기를 선택하세요.");
    if (!spot) return alert("SPOT을 선택하세요.");

    if (spot === SPOT_CUSTOM_VALUE) {
      const custom = $("spotCustom").value.trim();
      if (!custom) return alert("SPOT 직접입력 값을 입력하세요.");
      spot = custom;
    }

    if (!depTime || !arrTime) return alert("출발시간과 도착시간을 모두 선택하세요.");
    if (!work) return alert("작업사항을 입력하세요.");
    if (!unit) return alert("부서를 선택하세요.");
    if (selectedWorkersArr.length === 0) return alert("인원을 1명 이상 선택하세요.");

    const row = {
      id: makeId(),
      aircraft,
      depTime,          // ✅ 저장
      arrTime,          // ✅ 저장
      time,             // ✅ 기존 호환 "HH:MM~HH:MM"
      spot,
      work,
      workers: selectedWorkersArr
    };

    rows.push(row);

    socket.emit("state:update", { title: "작업표", rows });
    renderRowsList();

    clearInputsForNext();
    alert(`작업표가 추가되었습니다. (총 ${rows.length}건)`);
  });
}

// ---------------------
// ✅ 전체초기화: 서버 rows + 전송된 목록 + Display까지 전부 비우기
// ---------------------
function resetAllAndClearServerRows() {
  rows = [];
  draftById.clear();
  selectedWorkers.clear();

  socket.emit("state:update", { title: "작업표", rows: [] });

  initFormUI();
  if ($("work")) $("work").value = "";

  const spotCustomInput = $("spotCustom");
  if (spotCustomInput) {
    spotCustomInput.value = "";
    spotCustomInput.disabled = true;
  }
  const spotCustomRadio = $("spot_custom_radio");
  if (spotCustomRadio) spotCustomRadio.checked = false;

  renderWorkerCheckboxes("");
  renderRowsList();
}

if ($("resetBtn")) {
  $("resetBtn").addEventListener("click", () => {
    resetAllAndClearServerRows();
    alert("초기화 되었습니다.");
  });
}

// ---------------------
// 전송된 목록(수정/삭제) - TIME도 출발/도착 select로 수정
// ---------------------
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
    const spot = draft.spot ?? r.spot ?? "";
    const work = draft.work ?? r.work ?? "";
    const workersText = draft.workersText ?? formatWorkersInput(workersArr);

    // ✅ 시간은 dep/arr로 관리 (draft 우선)
    const baseTime = parseTimeRange(r);
    const depTime = (draft.depTime ?? baseTime.dep ?? "").trim();
    const arrTime = (draft.arrTime ?? baseTime.arr ?? "").trim();

    const depHH = depTime ? depTime.slice(0, 2) : "00";
    const depMM = depTime ? depTime.slice(3, 5) : "00";
    const arrHH = arrTime ? arrTime.slice(0, 2) : "00";
    const arrMM = arrTime ? arrTime.slice(3, 5) : "00";

    const hourOptions = HOUR_LIST.map(h => `<option value="${h}" ${h === depHH ? "selected" : ""}>${h}</option>`).join("");
    const minuteOptions = (mm) => MINUTE_LIST.map(m => `<option value="${m}" ${m === mm ? "selected" : ""}>${m}</option>`).join("");
    const hourOptionsArr = HOUR_LIST.map(h => `<option value="${h}" ${h === arrHH ? "selected" : ""}>${h}</option>`).join("");

    return `
      <div class="row-item" data-id="${r.id}">
        <div class="muted" style="margin-bottom:8px;font-weight:800">#${idx + 1}</div>

        <div class="row-grid">
          <div class="cell">
            <label>기번</label>
            <input data-field="aircraft" value="${escapeAttr(aircraft)}" />
          </div>

          <div class="cell">
            <label>TIME ( ARR / DEP )</label>

            <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
              <span style="font-weight:800; font-size:12px; color:#666;">ARR</span>
              <select data-field="depHour">${hourOptions}</select>
              <span class="colon">:</span>
              <select data-field="depMinute">${minuteOptions(depMM)}</select>
            </div>

            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-weight:800; font-size:12px; color:#666;">DEP</span>
              <select data-field="arrHour">${hourOptionsArr}</select>
              <span class="colon">:</span>
              <select data-field="arrMinute">${minuteOptions(arrMM)}</select>
            </div>
          </div>

          <div class="cell">
            <label>SPOT</label>
            <input data-field="spot" value="${escapeAttr(spot)}" />
          </div>

          <div class="cell" style="grid-column: span 2;">
            <label>작업사항</label>
            <textarea data-field="work">${escapeHtml(work)}</textarea>
          </div>

          <div class="cell">
            <label>근무자 ( 띄어쓰기와 엔터로 구분 )</label>
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

  // draft 반영: input/textarea/select 모두
  box.querySelectorAll(".row-item input, .row-item textarea, .row-item select").forEach(el => {
    el.addEventListener("input", onDraftChange);
    el.addEventListener("change", onDraftChange);
  });

  function onDraftChange(e) {
    const item = e.target.closest(".row-item");
    const id = item.dataset.id;
    const field = e.target.dataset.field;
    if (!field) return;

    const prev = draftById.get(id) || {};

    // 시간 select은 dep/arr로 합쳐서 draft에 저장
    if (field === "depHour" || field === "depMinute" || field === "arrHour" || field === "arrMinute") {
      const depHour = item.querySelector('select[data-field="depHour"]')?.value ?? "00";
      const depMinute = item.querySelector('select[data-field="depMinute"]')?.value ?? "00";
      const arrHour = item.querySelector('select[data-field="arrHour"]')?.value ?? "00";
      const arrMinute = item.querySelector('select[data-field="arrMinute"]')?.value ?? "00";

      const depTime = toTimeStr(depHour, depMinute);
      const arrTime = toTimeStr(arrHour, arrMinute);

      draftById.set(id, { ...prev, depTime, arrTime });
      return;
    }

    draftById.set(id, { ...prev, [field]: e.target.value });
  }

  // 버튼 핸들러
  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "del") return deleteRow(id);
      if (action === "save") return saveRow(id);
    });
  });
}

function saveRow(id) {
  const draft = draftById.get(id);
  if (!draft) return alert("변경된 내용이 없습니다.");

  const cur = rows.find(r => r.id === id) || {};

  const aircraft = (draft.aircraft ?? cur.aircraft ?? "").trim();
  const spot = (draft.spot ?? cur.spot ?? "").trim();
  const work = (draft.work ?? cur.work ?? "").trim();
  const workersText = (draft.workersText ?? formatWorkersInput(cur.workers ?? [])).trim();

  // ✅ 시간: dep/arr로 반드시 계산
  const base = parseTimeRange(cur);
  const depTime = (draft.depTime ?? base.dep ?? "").trim();
  const arrTime = (draft.arrTime ?? base.arr ?? "").trim();
  const time = buildTimeRange(depTime, arrTime);

  if (!aircraft) return alert("기번은 비울 수 없습니다.");
  if (!depTime || !arrTime) return alert("출발시간과 도착시간을 모두 선택하세요.");
  if (!spot) return alert("SPOT은 비울 수 없습니다.");
  if (!work) return alert("작업사항은 비울 수 없습니다.");

  const workers = parseWorkersText(workersText);

  rows = rows.map(r => r.id !== id ? r : ({
    ...r,
    aircraft,
    depTime,
    arrTime,
    time,     // ✅ 호환 유지
    spot,
    work,
    workers
  }));

  draftById.delete(id);

  socket.emit("state:update", { title: "작업표", rows });
  renderRowsList();
  alert("수정 되었습니다.");
}

function deleteRow(id) {
  rows = rows.filter(r => r.id !== id);
  draftById.delete(id);

  socket.emit("state:update", { title: "작업표", rows });
  renderRowsList();
  alert("삭제 되었습니다.");
}

// ---------------------
// workers 변환/escape
// ---------------------
function formatWorkersInput(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join(" ");
}

function parseWorkersText(txt) {
  const tokens = String(txt).split(/\s+/).map(s => s.trim()).filter(Boolean);
  return Array.from(new Set(tokens));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// =====================
// 서버 최신 상태 동기화
// =====================
socket.on("state:update", (state) => {
  if (state && Array.isArray(state.rows)) {
    rows = state.rows.map(r => ({ ...r, id: r.id || makeId() }));
    renderRowsList();
  }
});

// =====================
// 앱 시작
// =====================
initFormUI();
renderRowsList();