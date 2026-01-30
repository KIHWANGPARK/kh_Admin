const socket = io("https://kh-server.onrender.com");

// ✅ 로고 클릭 시 새로고침
document.getElementById("mainLogo").addEventListener("click", () => {
  location.reload();
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


document.getElementById("sendBtn").addEventListener("click", () => {
  const aircraft = getCheckedValue("aircraft");
  const spot = getCheckedValue("spot");

  const hour = document.getElementById("hour").value;
  const minute = document.getElementById("minute").value;

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
    work,
    note: note || "-",
    worker
  };

  const state = {
    title: "작업표",
    rows: [row] // ✅ Display는 기존 그대로 사용 가능
  };

  socket.emit("state:update", state);
  alert("작업표가 전송되었습니다.");
});