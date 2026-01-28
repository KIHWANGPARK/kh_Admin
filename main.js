const socket = io("https://kh-server.onrender.com");


const sendBtn = document.getElementById("sendBtn");

sendBtn.addEventListener("click", () => {
  const checked = document.querySelectorAll(".job:checked");

  const rows = Array.from(checked).map(cb => ({
    aircraft: cb.dataset.aircraft,
    time: cb.dataset.time,
    spot: cb.dataset.spot,
    work: cb.dataset.work,
    note: cb.dataset.note,
    worker: cb.dataset.worker
  }));

  const state = {
    title: "작업표",
    rows
  };

  socket.emit("state:update", state);

  alert("작업표가 전송되었습니다.");
});