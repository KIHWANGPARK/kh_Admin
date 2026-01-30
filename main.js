const socket = io("https://kh-server.onrender.com");

// ✅ 로고 클릭 시 새로고침
document.getElementById("mainLogo").addEventListener("click", () => {
  location.reload();
});

// ✅ 누적 rows 저장 (핵심)
let rows = [];

// ✅ 서버의 최신 상태를 받아서 Admin도 동기화 (새로고침/다른 PC에서도 유지)
socket.on("state:update", (state) => {
  if (state && Array.isArray(state.rows)) {
    rows = state.rows;
  }
});

const AIRCRAFT_LIST = Array.from({ length: 14 }, (_, i) => `HL74${(i + 1).toString().padStart(2, "0")}`);
const SPOT_LIST = Array.from({ length: 10 }, (_, i) => String(621 + i));

const UNIT_LIST = ["1부서", "2부서", "3부서", "4부서", "5부서"];
const WORKERS_BY_UNIT = Object.fromEntries(
  UNIT_LIST.map(unit => [unit, Array.from({ length: 10 }, (_, i) => `${i + 1}번`)])
);

const HOUR_LIST = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTE_LIST = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

function renderRadioGroup(containerId, name, values) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  values.forEach((val, idx) => {
    const id = `${name}_${idx}`;

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
  const sel = document.getElementById(selectId);
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

renderRadioGroup("aircraftGroup", "aircraft", AIRCRAFT_LIST);
renderRadioGroup("spotGroup", "spot", SPOT_LIST);

renderSelect("hour", HOUR_LIST);
renderSelect("minute", MINUTE_LIST);

renderSelect("unit", UNIT_LIST, "부서 선택");
renderSelect("worker", [], "인원 선택");

const unitSelect = document.getElementById("unit");
const workerSelect = document.getElementById("worker");

unitSelect.addEventListener("change", () => {
  const unit = unitSelect.value;
  const workers = unit ? WORKERS_BY_UNIT[unit] : [];
  renderSelect("worker", workers, "인원 선택");
});

// ✅ (선택) 입력 폼을 다음 입력을 위해 일부 초기화하는 함수
function clearInputsForNext() {
  document.getElementById("work").value = "";
  document.getElementById("note").value = "";
  // 라디오/셀렉트까지 초기화하고 싶으면 여기서 추가로 처리 가능
}

// ✅ 완료 버튼: 누적 추가 + 전체 rows 전송
document.getElementById("sendBtn").addEventListener("click", () => {
  const aircraft = getCheckedValue("aircraft");
  const spot = getCheckedValue("spot");

  const hour = document.getElementById("hour").value;
  const minute = document.getElementById("minute").value;

  // ✅ textarea도 value로 받으면 됨 (여러 줄 그대로 들어옴)
  const work = document.getElementById("work").value.trim();
  const note = document.getElementById("note").value.trim();

  const unit = unitSelect.value;
  const workerNo = workerSelect.value;

  // 필수 체크 항목
  if (!aircraft) return alert("비행기를 선택하세요.");
  if (!spot) return alert("SPOT을 선택하세요.");
  if (!work) return alert("작업사항을 입력하세요.");
  if (!unit) return alert("부서를 선택하세요.");
  if (!workerNo) return alert("인원을 선택하세요.");

  const time = `${hour}:${minute}`;
  const worker = `${unit} ${workerNo}`;

  const row = {
    aircraft,
    time,
    spot,
    work,               // ✅ 여러 줄 텍스트 그대로 전송됨
    note: note || "-",
    worker
  };

  // ✅ 누적
  rows.push(row);

  // ✅ 전체 rows를 Display에 반영
  socket.emit("state:update", {
    title: "작업표",
    rows
  });

  clearInputsForNext();
  alert(`작업표가 추가되었습니다. (총 ${rows.length}건)`);
});

// ✅ 리셋 버튼: rows 비우고 Display도 초기화
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const ok = confirm("표를 초기화할까요? (Display도 비워집니다)");
    if (!ok) return;

    rows = [];

    socket.emit("state:update", {
      title: "작업표",
      rows: []
    });

    alert("초기화되었습니다.");
  });
}