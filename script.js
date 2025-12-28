/* =======================
   FIREBASE SAFE INIT
======================= */

const firebaseConfig = {
  apiKey: "AIzaSyCGK2M6c-uw2QjjWMAeR9fFKLKdT38NYsU",
  authDomain: "money-tracker-fd4f0.firebaseapp.com",
  projectId: "money-tracker-fd4f0"
};

let auth = null;
let db = null;

try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
} catch (e) {
  console.warn("Firebase unavailable, running local only");
}

/* =======================
   GLOBAL STATE
======================= */

let currentUser = null;
let periods = [];
let activePeriodId = null;

/* =======================
   LOCAL STORAGE
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
   CLOUD STORAGE
======================= */

async function saveCloud() {
  if (!db || !currentUser) return;
  await db.collection("users").doc(currentUser).set({
    periods,
    activePeriodId,
    updatedAt: Date.now()
  });
}

async function loadCloud() {
  if (!db) return false;
  const doc = await db.collection("users").doc(currentUser).get();
  if (!doc.exists) return false;

  const data = doc.data();
  periods = data.periods || [];
  activePeriodId = data.activePeriodId || null;
  return true;
}

/* =======================
   HELPERS
======================= */

function nowISO() {
  return new Date().toISOString();
}

function formatDate(d) {
  return new Date(d).toLocaleString("en-GB", {
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

  if (auth) await auth.signInAnonymously();

  loginScreen.style.display = "none";
  app.style.display = "block";

  let loaded = false;
  if (db) loaded = await loadCloud();
  if (!loaded) loadLocal();

  if (!activePeriodId) {
    startNewPeriod(0, 0);
    await saveAll();
  }

  renderAll();
}

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

  getActivePeriod().endDate = nowISO();
  startNewPeriod(
    parseInt(salaryPanas.value) || 0,
    parseInt(salaryDingin.value) || 0
  );

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

  if (!name || isNaN(amount) || amount <= 0)
    return alert("Invalid expense");

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

/* ✏️ EDIT EXPENSE VALUE */
async function editExpense(periodId, expenseId) {
  const period = periods.find(p => p.id === periodId);
  const expense = period.expenses.find(e => e.id === expenseId);

  const input = prompt(
    `Edit value for "${expense.name}"`,
    expense.amount
  );

  if (input === null) return;

  const newAmount = parseInt(input);
  if (isNaN(newAmount) || newAmount <= 0)
    return alert("Invalid amount");

  expense.amount = newAmount;
  await saveAll();
  renderAll();
}

/* ❌ DELETE EXPENSE */
async function deleteExpense(periodId, expenseId) {
  const period = periods.find(p => p.id === periodId);
  period.expenses = period.expenses.filter(e => e.id !== expenseId);
  await saveAll();
  renderAll();
}

/* =======================
   UI
======================= */

function updateSummary() {
  const a = getActivePeriod();
  let panas = 0, dingin = 0;

  a.expenses.forEach(e => {
    e.type === "panas" ? panas += e.amount : dingin += e.amount;
  });

  panasSalary.textContent = a.salaryPanas;
  panasExpense.textContent = panas;
  panasRemaining.textContent = a.salaryPanas - panas;

  dinginSalary.textContent = a.salaryDingin;
  dinginExpense.textContent = dingin;
  dinginRemaining.textContent = a.salaryDingin - dingin;
}

/* =======================
   HISTORY (FIXED)
======================= */

function renderHistory() {
  expenseList.innerHTML = "";

  periods.forEach(p => {
    const card = document.createElement("li");
    card.className = "period-card";

    card.innerHTML = `
      <div class="period-header">
        <strong>
          ${formatDate(p.startDate)} →
          ${p.endDate ? formatDate(p.endDate) : "Present"}
        </strong>
      </div>
    `;

    p.expenses.forEach(e => {
      const row = document.createElement("div");
      row.className = "expense-item";

      row.innerHTML = `
        <div class="expense-info">
          <div class="expense-name">${e.name} — Rp ${e.amount}</div>
          <div class="expense-meta">
            <span class="badge ${e.type === "panas" ? "badge-panas" : "badge-dingin"}">
              ${e.type}
            </span>
            <span class="expense-date">${formatDate(e.date)}</span>
          </div>
        </div>
        <div class="expense-actions">
          <button class="delete-btn"
            onclick="editExpense('${p.id}','${e.id}')">Edit</button>
          <button class="delete-btn"
            onclick="deleteExpense('${p.id}','${e.id}')">✕</button>
        </div>
      `;

      card.appendChild(row);
    });

    expenseList.appendChild(card);
  });
}

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
