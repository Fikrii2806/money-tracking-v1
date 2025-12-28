/* =======================
   FIREBASE INIT
======================= */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* =======================
   GLOBAL STATE
======================= */

let currentUser = null;
let periods = [];
let activePeriodId = null;

/* =======================
   STORAGE (LOCAL)
======================= */

function storageKey() {
  return `money-tracker-${currentUser}`;
}

function saveLocal() {
  localStorage.setItem(
    storageKey(),
    JSON.stringify({ periods, activePeriodId })
  );
}

function loadLocal() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return false;

  const data = JSON.parse(raw);
  periods = data.periods || [];
  activePeriodId = data.activePeriodId || null;
  return true;
}

/* =======================
   STORAGE (CLOUD)
======================= */

async function saveCloud() {
  if (!currentUser) return;

  await db.collection("users")
    .doc(currentUser)
    .set({ periods, activePeriodId, updatedAt: Date.now() });
}

async function loadCloud() {
  const doc = await db.collection("users").doc(currentUser).get();
  if (!doc.exists) return false;

  const data = doc.data();
  periods = data.periods || [];
  activePeriodId = data.activePeriodId || null;
  return true;
}

/* =======================
   UTILITIES
======================= */

function nowISO() {
  return new Date().toISOString();
}

function formatDate(date) {
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getActivePeriod() {
  return periods.find(p => p.id === activePeriodId);
}

/* =======================
   LOGIN
======================= */

async function login() {
  const username = usernameInput.value.trim();
  if (!username) return alert("Enter username");

  currentUser = username;

  await auth.signInAnonymously();

  loginScreen.style.display = "none";
  app.style.display = "block";

  const cloudLoaded = await loadCloud();

  if (!cloudLoaded) {
    loadLocal();
  }

  if (!activePeriodId) {
    startNewPeriod(0, 0);
    await saveAll();
  }

  renderAll();
}

/* =======================
   SAVE ALL
======================= */

async function saveAll() {
  saveLocal();
  await saveCloud();
}

/* =======================
   PERIOD
======================= */

function startNewPeriod(panas, dingin) {
  periods.push({
    id: crypto.randomUUID(),
    salaryPanas: panas,
    salaryDingin: dingin,
    startDate: nowISO(),
    endDate: null,
    expenses: []
  });
  activePeriodId = periods.at(-1).id;
}

async function confirmNewPeriod() {
  if (!confirm("Close current period and start a new one?")) return;

  const panas = parseInt(salaryPanas.value) || 0;
  const dingin = parseInt(salaryDingin.value) || 0;

  getActivePeriod().endDate = nowISO();
  startNewPeriod(panas, dingin);

  await saveAll();
  renderAll();
}

/* =======================
   EXPENSE
======================= */

async function addExpense() {
  const name = expenseName.value.trim();
  const amount = parseInt(expenseAmount.value);
  const type = expenseType.value;

  if (!name || amount <= 0) return alert("Invalid expense");

  getActivePeriod().expenses.push({
    id: crypto.randomUUID(),
    name,
    amount,
    type,
    date: nowISO()
  });

  expenseName.value = "";
  expenseAmount.value = "";

  await saveAll();
  renderAll();
}

/* =======================
   SUMMARY
======================= */

function updateSummary() {
  const active = getActivePeriod();
  let panas = 0, dingin = 0;

  active.expenses.forEach(e =>
    e.type === "panas" ? panas += e.amount : dingin += e.amount
  );

  panasSalary.textContent = active.salaryPanas;
  panasExpense.textContent = panas;
  panasRemaining.textContent = active.salaryPanas - panas;

  dinginSalary.textContent = active.salaryDingin;
  dinginExpense.textContent = dingin;
  dinginRemaining.textContent = active.salaryDingin - dingin;
}

/* =======================
   HISTORY
======================= */

function renderHistory() {
  expenseList.innerHTML = "";

  periods.forEach(p => {
    const li = document.createElement("li");
    li.className = "period-card";
    li.innerHTML = `<strong>${formatDate(p.startDate)}</strong>`;
    expenseList.appendChild(li);
  });
}

/* =======================
   RENDER
======================= */

function renderAll() {
  updateSummary();
  renderHistory();
}

/* =======================
   SERVICE WORKER
======================= */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
