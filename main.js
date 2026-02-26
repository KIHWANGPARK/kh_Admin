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

// 시간
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
function syncSpotCustomUI() {
  const spotCustomRadio = $("spot_custom_radio");
  const spotCustomInput = $("spotCustom");
  if (!spotCustomInput) return;

  const isCustom = (getCheckedValue("spot") === SPOT_CUSTOM_VALUE);

  spotCustomInput.disabled = !isCustom;
  if (!isCustom) spotCustomInput.value = "";

  // 입력에 포커스/입력하면 라디오 체크
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
let spotChangeBound = false;

function initFormUI() {
  renderRadioGroup("aircraftGroupA", "aircraft", AIRCRAFT_A);
  renderRadioGroup("aircraftGroupB", "aircraft", AIRCRAFT_B);
  renderRadioGroup("spotGroup", "spot", SPOT_LIST);

  renderSelect("hour", HOUR_LIST);
  renderSelect("minute", MINUTE_LIST);
  renderSelect("unit", UNIT_LIST, "부서 선택");

  renderWorkerCheckboxes("");

  // unit change
  if ($("unit")) {
    $("unit").onchange = () => renderWorkerCheckboxes($("unit").value);
  }

  // spot change (중복 바인딩 방지)
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

    const hour = $("hour").value;
    const minute = $("minute").value;

    const work = $("work").value.trim();
    const unit = $("unit").value;
    const selectedWorkersArr = getSelectedWorkersArray();

    if (!aircraft) return alert("항공기를 선택하세요.");
    if (!spot) return alert("SPOT을 선택하세요.");

    if (spot === SPOT_CUSTOM_VALUE) {
      const custom = $("spotCustom").value.trim();
      if (!custom) return alert("SPOT 직접입력 값을 입력하세요.");
      spot = custom;
    }

    if (!work) return alert("작업사항을 입력하세요.");
    if (!unit) return alert("부서를 선택하세요.");
    if (selectedWorkersArr.length === 0) return alert("인원을 1명 이상 선택하세요.");

    const time = `${hour}:${minute}`;

    const row = {
      id: makeId(),
      aircraft,
      time,
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
  // 1) 서버/전역 rows 비우기
  rows = [];
  draftById.clear();
  selectedWorkers.clear();

  // 2) 서버로 빈 rows 전송 (Display까지 즉시 비워짐)
  socket.emit("state:update", { title: "작업표", rows: [] });

  // 3) 입력 UI도 초기 상태로
  initFormUI();
  if ($("work")) $("work").value = "";
  if ($("hour")) $("hour").value = "00";
  if ($("minute")) $("minute").value = "00";

  const spotCustomInput = $("spotCustom");
  if (spotCustomInput) {
    spotCustomInput.value = "";
    spotCustomInput.disabled = true;
  }
  const spotCustomRadio = $("spot_custom_radio");
  if (spotCustomRadio) spotCustomRadio.checked = false;

  renderWorkerCheckboxes("");

  // 4) 전송된 목록 UI도 비우기
  renderRowsList();
}

if ($("resetBtn")) {
  $("resetBtn").addEventListener("click", () => {
    resetAllAndClearServerRows();
    alert("초기화 되었습니다.");
  });
}

// ---------------------
// 전송된 목록(수정/삭제)
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
    const time = draft.time ?? r.time ?? "";
    const spot = draft.spot ?? r.spot ?? "";
    const work = draft.work ?? r.work ?? "";
    const workersText = draft.workersText ?? formatWorkersInput(workersArr);

    return `
      <div class="row-item" data-id="${r.id}">
        <div class="muted" style="margin-bottom:8px;font-weight:800">#${idx + 1}</div>

        <div class="row-grid">
          <div class="cell">
            <label>기번</label>
            <input data-field="aircraft" value="${escapeAttr(aircraft)}" />
          </div>

          <div class="cell">
            <label>TIME</label>
            <input data-field="time" value="${escapeAttr(time)}" placeholder="예: 22:15" />
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
            <label>근무자</label>
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
  const time = (draft.time ?? cur.time ?? "").trim();
  const spot = (draft.spot ?? cur.spot ?? "").trim();
  const work = (draft.work ?? cur.work ?? "").trim();
  const workersText = (draft.workersText ?? formatWorkersInput(cur.workers ?? [])).trim();

  if (!aircraft) return alert("기번은 비울 수 없습니다.");
  if (!time) return alert("TIME은 비울 수 없습니다.");
  if (!spot) return alert("SPOT은 비울 수 없습니다.");
  if (!work) return alert("작업사항은 비울 수 없습니다.");

  const workers = parseWorkersText(workersText);

  rows = rows.map(r => r.id !== id ? r : ({
    ...r,
    aircraft,
    time,
    spot,
    work,
    workers
  }));

  draftById.delete(id);

  socket.emit("state:update", { title: "작업표", rows });
  renderRowsList();

  // ✅ 요청대로: 메시지는 이것만
  alert("수정 되었습니다.");
}

function deleteRow(id) {
  // ✅ confirm 제거
  rows = rows.filter(r => r.id !== id);
  draftById.delete(id);

  socket.emit("state:update", { title: "작업표", rows });
  renderRowsList();

  // ✅ 요청대로: 메시지는 이것만
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