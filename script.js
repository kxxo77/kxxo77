const storageKey = "noir-diary-v1";
const state = {
  viewDate: new Date(),
  selectedDate: new Date(),
  entries: loadEntries(),
  cameraStream: null,
};

const coverPage = document.querySelector("#coverPage");
const appShell = document.querySelector("#appShell");
const enterButton = document.querySelector("#enterButton");
const calendarGrid = document.querySelector("#calendarGrid");
const monthLabel = document.querySelector("#monthLabel");
const selectedDateLabel = document.querySelector("#selectedDateLabel");
const editorDateLabel = document.querySelector("#editorDateLabel");
const anniversaryInput = document.querySelector("#anniversaryInput");
const anniversaryPill = document.querySelector("#anniversaryPill");
const todoPill = document.querySelector("#todoPill");
const todoInput = document.querySelector("#todoInput");
const todoList = document.querySelector("#todoList");
const diaryEditor = document.querySelector("#diaryEditor");
const imageInput = document.querySelector("#imageInput");
const imageGallery = document.querySelector("#imageGallery");
const dropZone = document.querySelector("#dropZone");
const dayDialog = document.querySelector("#dayDialog");
const dialogDateLabel = document.querySelector("#dialogDateLabel");
const cameraDialog = document.querySelector("#cameraDialog");
const cameraVideo = document.querySelector("#cameraVideo");
const cameraCanvas = document.querySelector("#cameraCanvas");

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(state.entries));
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEntry(key = dateKey(state.selectedDate)) {
  if (!state.entries[key]) {
    state.entries[key] = {
      anniversary: "",
      todos: [],
      diary: "",
      emoji: "🙂",
      images: [],
    };
  }
  if (!state.entries[key].emoji) state.entries[key].emoji = "🙂";
  return state.entries[key];
}

const holidayOverrides = {
  2026: {
    "2026-06-03": "전국동시지방선거",
  },
};

const fixedHolidayNames = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절",
};

const substituteTargets = new Set(["삼일절", "어린이날", "부처님오신날", "광복절", "개천절", "한글날", "성탄절"]);
const holidayCache = {};

function getHolidayName(date) {
  const key = dateKey(date);
  const year = date.getFullYear();
  if (!holidayCache[year]) holidayCache[year] = buildHolidayMap(year);
  return holidayCache[year][key] || "";
}

function buildHolidayMap(year) {
  const holidays = {};
  Object.entries(fixedHolidayNames).forEach(([monthDay, name]) => {
    holidays[`${year}-${monthDay}`] = name;
  });
  addLunarHolidays(year, holidays);
  Object.assign(holidays, holidayOverrides[year] || {});
  addSubstituteHolidays(holidays);
  return holidays;
}

function addLunarHolidays(year, holidays) {
  const lunarNewYear = findLunarDate(year, 1, 1);
  const buddhaBirthday = findLunarDate(year, 4, 8);
  const chuseok = findLunarDate(year, 8, 15);

  if (lunarNewYear) {
    holidays[dateKey(addDays(lunarNewYear, -1))] = "설날 연휴";
    holidays[dateKey(lunarNewYear)] = "설날";
    holidays[dateKey(addDays(lunarNewYear, 1))] = "설날 연휴";
  }
  if (buddhaBirthday) holidays[dateKey(buddhaBirthday)] = "부처님오신날";
  if (chuseok) {
    holidays[dateKey(addDays(chuseok, -1))] = "추석 연휴";
    holidays[dateKey(chuseok)] = "추석";
    holidays[dateKey(addDays(chuseok, 1))] = "추석 연휴";
  }
}

function findLunarDate(year, lunarMonth, lunarDay) {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) return null;
  const formatter = new Intl.DateTimeFormat("ko-KR-u-ca-chinese", {
    month: "numeric",
    day: "numeric",
  });

  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(year, month, day);
      const parts = formatter.formatToParts(current);
      const parsedMonth = Number(parts.find((part) => part.type === "month")?.value);
      const parsedDay = Number(parts.find((part) => part.type === "day")?.value);
      if (parsedMonth === lunarMonth && parsedDay === lunarDay) return current;
    }
  }
  return null;
}

function addSubstituteHolidays(holidays) {
  const originalEntries = Object.entries(holidays);
  originalEntries.forEach(([key, name]) => {
    const date = parseDateKey(key);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const isLunarFamily = name.startsWith("설날") || name.startsWith("추석");
    const needsSubstitute = substituteTargets.has(name) ? weekend : isLunarFamily && date.getDay() === 0;
    if (!needsSubstitute) return;

    let substitute = addDays(date, 1);
    while (substitute.getDay() === 0 || substitute.getDay() === 6 || holidays[dateKey(substitute)]) {
      substitute = addDays(substitute, 1);
    }
    holidays[dateKey(substitute)] = `대체공휴일(${name.replace(" 연휴", "")})`;
  });
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatKoreanDate(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function renderCalendar() {
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());

  monthLabel.textContent = `${year}.${String(month + 1).padStart(2, "0")}`;
  selectedDateLabel.textContent = formatKoreanDate(state.selectedDate);
  calendarGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const key = dateKey(current);
    const entry = state.entries[key];
    const holidayName = getHolidayName(current);
    const button = document.createElement("button");
    button.className = "day-cell";
    button.type = "button";
    if (current.getMonth() !== month) button.classList.add("is-muted");
    if (holidayName) button.classList.add("is-holiday", "has-label");
    if (key === dateKey(state.selectedDate)) button.classList.add("is-selected");
    button.innerHTML = `<span class="day-number">${current.getDate()}</span><span class="holiday-name"></span><span class="markers"></span>`;
    button.querySelector(".holiday-name").textContent = holidayName;

    const markers = button.querySelector(".markers");
    if (holidayName) markers.append(marker("holiday"));
    if (entry?.anniversary) markers.append(marker());
    if (entry?.todos?.length) markers.append(marker("todo"));
    if (entry?.images?.length || entry?.diary) markers.append(marker("image"));

    button.addEventListener("click", () => {
      selectDate(current);
      openDayDialog();
    });
    calendarGrid.append(button);
  }
}

function marker(type = "") {
  const dot = document.createElement("span");
  dot.className = `marker ${type}`;
  return dot;
}

function selectDate(date) {
  state.selectedDate = new Date(date);
  if (state.selectedDate.getMonth() !== state.viewDate.getMonth()) {
    state.viewDate = new Date(date);
  }
  renderCalendar();
  renderEditor();
}

function renderEditor() {
  const entry = getEntry();
  const holidayName = getHolidayName(state.selectedDate);
  editorDateLabel.textContent = formatKoreanDate(state.selectedDate);
  anniversaryInput.value = entry.anniversary;
  anniversaryPill.textContent = [holidayName, entry.anniversary].filter(Boolean).join(" · ") || "일정 없음";
  todoPill.textContent = `할 일 ${entry.todos.length}개`;
  diaryEditor.innerHTML = entry.diary;
  renderTodos(entry);
  renderEmoji(entry.emoji);
  renderImages(entry.images);
}

function renderTodos(entry) {
  todoList.innerHTML = "";
  entry.todos.forEach((todo, index) => {
    const item = document.createElement("li");
    if (todo.done) item.classList.add("is-done");
    item.innerHTML = `
      <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="완료" />
      <span>${escapeHtml(todo.text)}</span>
      <button type="button" aria-label="삭제">×</button>
    `;
    item.querySelector("input").addEventListener("change", (event) => {
      todo.done = event.target.checked;
      persistAndRender();
    });
    item.querySelector("button").addEventListener("click", () => {
      entry.todos.splice(index, 1);
      persistAndRender();
    });
    todoList.append(item);
  });
}

function renderEmoji(emoji) {
  document.querySelectorAll(".emoji-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.emoji === emoji);
  });
}

function renderImages(images) {
  imageGallery.innerHTML = "";
  images.forEach((src, index) => {
    const item = document.createElement("div");
    item.className = "image-item";
    item.innerHTML = `<img src="${src}" alt="첨부 이미지 ${index + 1}" /><button type="button" aria-label="이미지 삭제">×</button>`;
    item.querySelector("button").addEventListener("click", () => {
      getEntry().images.splice(index, 1);
      persistAndRender();
    });
    imageGallery.append(item);
  });
}

function persistAndRender() {
  saveEntries();
  renderCalendar();
  renderEditor();
}

function openDayDialog() {
  dialogDateLabel.textContent = formatKoreanDate(state.selectedDate);
  if (typeof dayDialog.showModal === "function") {
    dayDialog.showModal();
  }
}

function focusSection(section) {
  if (section === "anniversary") anniversaryInput.focus();
  if (section === "todo") todoInput.focus();
  if (section === "diary") diaryEditor.focus();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  getEntry().todos.push({ text, done: false });
  todoInput.value = "";
  persistAndRender();
}

function readImages(files) {
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
  imageFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      getEntry().images.push(reader.result);
      persistAndRender();
    };
    reader.readAsDataURL(file);
  });
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("이 브라우저에서는 웹캠 촬영을 사용할 수 없습니다.");
    return;
  }

  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    cameraVideo.srcObject = state.cameraStream;
    if (typeof cameraDialog.showModal === "function") cameraDialog.showModal();
  } catch {
    alert("카메라 권한을 허용해야 사진을 찍을 수 있습니다.");
  }
}

function closeCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  cameraVideo.srcObject = null;
}

function captureCameraImage() {
  if (!state.cameraStream) return;
  cameraCanvas.width = cameraVideo.videoWidth || 1280;
  cameraCanvas.height = cameraVideo.videoHeight || 720;
  const context = cameraCanvas.getContext("2d");
  context.translate(cameraCanvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
  getEntry().images.push(cameraCanvas.toDataURL("image/png"));
  persistAndRender();
  cameraDialog.close();
  closeCamera();
}

enterButton.addEventListener("click", () => {
  coverPage.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
});

document.querySelector("#backToCoverButton").addEventListener("click", () => {
  appShell.classList.add("is-hidden");
  coverPage.classList.remove("is-hidden");
});

document.querySelector("#prevMonth").addEventListener("click", () => {
  state.viewDate.setMonth(state.viewDate.getMonth() - 1);
  renderCalendar();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  state.viewDate.setMonth(state.viewDate.getMonth() + 1);
  renderCalendar();
});

document.querySelector("#todayButton").addEventListener("click", () => selectDate(new Date()));
document.querySelector("#newEntryButton").addEventListener("click", () => {
  selectDate(new Date());
  diaryEditor.focus();
});

anniversaryInput.addEventListener("input", () => {
  getEntry().anniversary = anniversaryInput.value;
  saveEntries();
  renderCalendar();
  anniversaryPill.textContent = [getHolidayName(state.selectedDate), anniversaryInput.value].filter(Boolean).join(" · ") || "일정 없음";
});

document.querySelector("#addTodoButton").addEventListener("click", addTodo);
todoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addTodo();
});

diaryEditor.addEventListener("input", () => {
  getEntry().diary = diaryEditor.innerHTML;
  saveEntries();
  renderCalendar();
});

document.querySelectorAll(".emoji-button").forEach((button) => {
  button.addEventListener("click", () => {
    getEntry().emoji = button.dataset.emoji;
    persistAndRender();
  });
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    diaryEditor.focus();
    document.execCommand(button.dataset.command, false, null);
    getEntry().diary = diaryEditor.innerHTML;
    saveEntries();
  });
});

document.querySelector("#fontSize").addEventListener("change", (event) => {
  diaryEditor.focus();
  document.execCommand("fontSize", false, event.target.value);
});

document.querySelector("#foreColor").addEventListener("input", (event) => {
  diaryEditor.focus();
  document.execCommand("foreColor", false, event.target.value);
});

document.querySelector("#hiliteColor").addEventListener("input", (event) => {
  diaryEditor.focus();
  document.execCommand("hiliteColor", false, event.target.value);
});

imageInput.addEventListener("change", (event) => readImages(event.target.files));
document.querySelector("#openCameraButton").addEventListener("click", openCamera);
document.querySelector("#captureButton").addEventListener("click", captureCameraImage);
cameraDialog.addEventListener("close", closeCamera);

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-over");
  });
});

dropZone.addEventListener("drop", (event) => readImages(event.dataTransfer.files));

dayDialog.addEventListener("close", () => {
  if (dayDialog.returnValue) focusSection(dayDialog.returnValue);
});

renderCalendar();
renderEditor();
