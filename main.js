const socket = io("https://kh-server.onrender.com");

// 로고 클릭 시 새로고침
document.getElementById("mainLogo").addEventListener("click", () => {
  location.reload();
});

// 누적 rows 저장
let rows = [];

// 🔥 이름 기준으로만 저장(부서 무관)
let selectedWorkers = new Set();

// 서버 상태 동기화
socket.on("state:update", (state) => {
  if (state && Array.isArray(state.rows)) {
    rows = state.rows;
  }
});

// ----------------------
// 1) 비행기
// ----------------------
const AIRCRAFT_A = [
  "HL7417",
  "HL7419",
  "HL7420",
  "HL7421",
  "HL7423",
  "HL7436",
  "HL7616",
  "HL7620",
  "HL7645",
  "HL7646",
  "HL7507"
];

const AIRCRAFT_B = ["HL8319", "HL8338", "HL8355", "HL8503"];

// ----------------------
// 3) SPOT
// ----------------------
const SPOT_LIST = ["621", "622", "623", "624", "625", "626", "627"];

// ----------------------
// 6) 작업자
// ----------------------
const UNIT_LIST = ["1파트", "주간", "1그룹", "2그룹", "3그룹"];

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

// 1파트 = 전체 통합(전체 인원 유니크 목록)
function getWorkersForUnit(unit) {
  if (!unit) return [];

  if (unit === "1파트") {
    const all = new Set();
    Object.values(WORKERS_BY_DEPT).forEach((arr) => {
      arr.forEach((name) => all.add(name));
    });
    return Array.from(all);
  }

  return WORKERS_BY_DEPT[unit] || [];
}

// ----------------------
// 시간
// ----------------------
const HOUR_LIST = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0")
);
const MINUTE_LIST = Array.from({ length: 12 }, (_, i) =>
  (i * 5).toString().padStart(2, "0")
);

// ----------------------
// 공통 렌더 함수
// ----------------------
function renderRadioGroup(containerId, name, values) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  values.forEach((val, idx) => {
    const id = `${name}_${containerId}_${idx}`;

    const label = document.createElement("label");
    label.className = "option";

    label.innerHTML = `
      <input type="radio" name="${name}" id="${id}" value="${val}">
      <span>${val}</span>
    `;

    container.appendChild(label);
  });
}

function renderSelect(selectId, values, placeholder) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = "";

  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }

  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function getCheckedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

// ----------------------
// ✅ 선택된 인원 "회색 처리" 스타일 주입
// (클릭은 가능해야 하므로 pointer-events/disabled 절대 금지)
// ----------------------
(function injectSelectedStyle() {
  const style = document.createElement("style");
  style.textContent = `
    /* 선택된 인원 표시(회색 + 살짝 흐림) */
    .option.worker-selected {
      opacity: 0.55;
      filter: grayscale(0.7);
    }
    /* 체크박스는 클릭 가능해야 하므로 pointer-events 건드리지 않음 */
  `;
  document.head.appendChild(style);
})();

// ----------------------
// 🔥 근무자 체크박스 렌더 (이름 기준 동기화 + 회색 표시)
// ----------------------
function renderWorkerCheckboxes(unit) {
  const container = document.getElementById("workerGroup");
  container.innerHTML = "";

  if (!unit) {
    container.innerHTML = `<p class="hint">부서를 선택하면 인원이 표시됩니다.</p>`;
    return;
  }

  const list = getWorkersForUnit(unit);

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="hint">표시할 인원이 없습니다.</p>`;
    return;
  }

  list.forEach((name, idx) => {
    const id = `worker_${unit}_${idx}`;
    const isSelected = selectedWorkers.has(name);

    const label = document.createElement("label");
    label.className = "option";
    if (isSelected) label.classList.add("worker-selected"); // ✅ 회색 처리

    label.innerHTML = `
      <input type="checkbox" id="${id}" value="${name}" ${isSelected ? "checked" : ""}>
      <span>${name}</span>
    `;

    const input = label.querySelector("input");

    input.addEventListener("change", (e) => {
      if (e.target.checked) selectedWorkers.add(name);
      else selectedWorkers.delete(name);

      // ✅ 현재 화면 다시 그려서 회색/체크 동기화
      renderWorkerCheckboxes(unitSelect.value);
    });

    container.appendChild(label);
  });
}

function getSelectedWorkersArray() {
  return Array.from(selectedWorkers);
}

// ----------------------
// 초기 렌더
// ----------------------
renderRadioGroup("aircraftGroupA", "aircraft", AIRCRAFT_A);
renderRadioGroup("aircraftGroupB", "aircraft", AIRCRAFT_B);

renderRadioGroup("spotGroup", "spot", SPOT_LIST);

renderSelect("hour", HOUR_LIST);
renderSelect("minute", MINUTE_LIST);

renderSelect("unit", UNIT_LIST, "부서 선택");

const unitSelect = document.getElementById("unit");

// 최초 안내문
renderWorkerCheckboxes("");

// 부서 변경 시 인원 체크박스 갱신
unitSelect.addEventListener("change", () => {
  renderWorkerCheckboxes(unitSelect.value);
});

// ----------------------
// SPOT 직접입력 제어
// ----------------------
const spotCustomRadio = document.getElementById("spot_custom_radio");
const spotCustomInput = document.getElementById("spotCustom");

document.addEventListener("change", (e) => {
  if (e.target && e.target.name === "spot") {
    const isCustom = getCheckedValue("spot") === "__CUSTOM__";
    spotCustomInput.disabled = !isCustom;

    if (isCustom) spotCustomInput.focus();
    else spotCustomInput.value = "";
  }
});

spotCustomInput.addEventListener("focus", () => {
  spotCustomRadio.checked = true;
  spotCustomInput.disabled = false;
});

// ----------------------
// 입력 초기화
// ----------------------
function clearInputsForNext() {
  document.getElementById("work").value = "";
  // document.getElementById("note").value = "";

  // SPOT 직접입력 초기화
  spotCustomInput.value = "";
  spotCustomInput.disabled = true;
  spotCustomRadio.checked = false;

  // 전송 후 인원 체크는 자동 초기화
  selectedWorkers.clear();
  renderWorkerCheckboxes(unitSelect.value);
}

// ----------------------
// 전송
// ----------------------
document.getElementById("sendBtn").addEventListener("click", () => {
  const aircraft = getCheckedValue("aircraft");
  let spot = getCheckedValue("spot");

  const hour = document.getElementById("hour").value;
  const minute = document.getElementById("minute").value;
  const time = `${hour}:${minute}`;

  const work = document.getElementById("work").value.trim();
  // const note = document.getElementById("note").value.trim();

  const unit = unitSelect.value;
  const selectedWorkersArr = getSelectedWorkersArray();

  if (!aircraft) return alert("비행기를 선택하세요.");
  if (!spot) return alert("SPOT을 선택하세요.");

  // 직접입력 선택 시: 입력값을 실제 spot으로 전송
  if (spot === "__CUSTOM__") {
    const custom = spotCustomInput.value.trim();
    if (!custom) return alert("SPOT 직접입력 값을 입력하세요.");
    spot = custom;
  }

  if (!work) return alert("작업사항을 입력하세요.");
  if (!unit) return alert("부서를 선택하세요.");
  if (selectedWorkersArr.length === 0) return alert("인원을 1명 이상 선택하세요.");

  const worker = selectedWorkersArr.join(" ");

  const row = {
    aircraft,
    time,
    spot,
    work,
    // note: note || "-",
    worker
  };

  rows.push(row);

  socket.emit("state:update", {
    title: "작업표",
    rows
  });

  clearInputsForNext();
  alert(`작업표가 추가되었습니다. (총 ${rows.length}건)`);
});

// ----------------------
// 초기화 버튼
// ----------------------
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const ok = confirm("표를 초기화할까요? (Display도 비워집니다)");
    if (!ok) return;

    rows = [];
    selectedWorkers.clear();
    renderWorkerCheckboxes(unitSelect.value);

    socket.emit("state:update", {
      title: "작업표",
      rows: []
    });

    alert("초기화되었습니다.");
  });
}