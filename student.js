/* ============================================================
   student.js
   Powers student.html:
     - Guards the page (student-only)
     - Lists exams available to attempt
     - Runs the exam-taking UI with a JS countdown timer that
       auto-submits when time expires
     - Auto-evaluates objective (MCQ) answers instantly
     - Shows the student's own result history
   ============================================================ */

// ---- Route guard: only logged-in students may view this page ----
const currentUser = DB.getSession();
if (!currentUser || currentUser.role !== "student") {
  window.location.href = "index.html";
}

// ---- Header ----
document.getElementById("welcomeName").textContent = currentUser.name;
document.getElementById("logoutBtn").addEventListener("click", () => {
  DB.clearSession();
  window.location.href = "index.html";
});

// ---- Views ----
const examListView = document.getElementById("examListView");
const examTakingView = document.getElementById("examTakingView");
const examResultView = document.getElementById("examResultView");

// ---- Exam-taking state ----
let activeExam = null;
let answers = {}; // { questionId: selectedOptionIndex }
let timerInterval = null;
let remainingSeconds = 0;

/* ---------------------------------------------------------
   1) LIST AVAILABLE EXAMS
--------------------------------------------------------- */
function renderExamList() {
  const exams = DB.getExams();
  const listEl = document.getElementById("availableExams");
  listEl.innerHTML = "";

  if (exams.length === 0) {
    listEl.innerHTML = `<p class="muted">No exams have been published yet.</p>`;
  }

  exams.forEach((exam) => {
    const attempted = DB.hasAttempted(exam.id, currentUser.id);
    const totalMarks = exam.questions.reduce((s, q) => s + q.marks, 0);

    const card = document.createElement("div");
    card.className = "exam-card";
    card.innerHTML = `
      <div>
        <h4>${exam.title}</h4>
        <p class="muted">${exam.questions.length} questions &middot; ${totalMarks} marks &middot; ${exam.duration} min</p>
      </div>
      <div class="exam-card-actions">
        ${
          attempted
            ? `<span class="badge">Completed</span>`
            : `<button class="btn-primary start-exam" data-id="${exam.id}">Start Exam</button>`
        }
      </div>
    `;
    listEl.appendChild(card);
  });

  document.querySelectorAll(".start-exam").forEach((btn) => {
    btn.addEventListener("click", () => startExam(btn.dataset.id));
  });

  renderMyResults();
}

/* ---------------------------------------------------------
   2) MY RESULT HISTORY
--------------------------------------------------------- */
function renderMyResults() {
  const mySubs = DB.getSubmissions().filter((s) => s.studentId === currentUser.id);
  const el = document.getElementById("myResults");
  el.innerHTML = "";

  if (mySubs.length === 0) {
    el.innerHTML = `<p class="muted">You have not attempted any exam yet.</p>`;
    return;
  }

  mySubs.forEach((sub) => {
    const exam = DB.getExamById(sub.examId);
    if (!exam) return;
    const totalMarks = exam.questions.reduce((s, q) => s + q.marks, 0);
    const percent = ((sub.score / totalMarks) * 100).toFixed(1);

    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `
      <span>${exam.title}</span>
      <span>${sub.score} / ${totalMarks} (${percent}%)</span>
    `;
    el.appendChild(row);
  });
}

/* ---------------------------------------------------------
   3) START / TAKE EXAM
--------------------------------------------------------- */
function startExam(examId) {
  if (DB.hasAttempted(examId, currentUser.id)) return; // safety check

  activeExam = DB.getExamById(examId);
  answers = {};
  remainingSeconds = activeExam.duration * 60;

  examListView.classList.add("hidden");
  examResultView.classList.add("hidden");
  examTakingView.classList.remove("hidden");

  document.getElementById("examTakingTitle").textContent = activeExam.title;
  renderQuestions();
  startTimer();
}

function renderQuestions() {
  const container = document.getElementById("examQuestions");
  container.innerHTML = "";

  activeExam.questions.forEach((q, idx) => {
    const block = document.createElement("div");
    block.className = "exam-question";
    block.innerHTML = `
      <p><strong>Q${idx + 1}.</strong> ${q.text} <span class="muted">(${q.marks} marks)</span></p>
      ${q.options
        .map(
          (opt, oIdx) => `
        <label class="option-label">
          <input type="radio" name="ans-${q.id}" value="${oIdx}" />
          ${opt}
        </label>`
        )
        .join("")}
    `;
    container.appendChild(block);

    // Track the selected answer as the student clicks
    block.querySelectorAll(`input[name="ans-${q.id}"]`).forEach((radio) => {
      radio.addEventListener("change", (e) => {
        answers[q.id] = parseInt(e.target.value, 10);
      });
    });
  });
}

// ---- Countdown timer: updates every second, auto-submits at 0 ----
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      submitExam(true); // true = auto-submitted because time ran out
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.max(0, Math.floor(remainingSeconds / 60));
  const s = Math.max(0, remainingSeconds % 60);
  document.getElementById("examTimer").textContent =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- Manual submit button ----
document.getElementById("submitExamBtn").addEventListener("click", () => {
  if (confirm("Submit the exam now? You cannot change your answers after this.")) {
    submitExam(false);
  }
});

/* ---------------------------------------------------------
   4) SUBMIT + AUTO-EVALUATE
--------------------------------------------------------- */
function submitExam(autoSubmitted) {
  clearInterval(timerInterval);

  // Auto-evaluate every objective (MCQ) question
  let score = 0;
  activeExam.questions.forEach((q) => {
    if (answers[q.id] === q.correctIndex) {
      score += q.marks;
    }
  });

  const submission = {
    id: DB.uid(),
    examId: activeExam.id,
    studentId: currentUser.id,
    answers,
    score,
    autoSubmitted,
    submittedAt: Date.now(),
  };
  DB.addSubmission(submission);

  showResultScreen(submission);
}

function showResultScreen(submission) {
  examTakingView.classList.add("hidden");
  examResultView.classList.remove("hidden");

  const totalMarks = activeExam.questions.reduce((s, q) => s + q.marks, 0);
  const percent = ((submission.score / totalMarks) * 100).toFixed(1);

  document.getElementById("resultSummary").innerHTML = `
    <h3>${activeExam.title} - Result</h3>
    <p class="score-big">${submission.score} / ${totalMarks}</p>
    <p class="muted">${percent}% ${submission.autoSubmitted ? "(auto-submitted: time expired)" : ""}</p>
  `;
}

document.getElementById("backToDashboardBtn").addEventListener("click", () => {
  examResultView.classList.add("hidden");
  examListView.classList.remove("hidden");
  renderExamList();
});

// Warn the student before they navigate away mid-exam
window.addEventListener("beforeunload", (e) => {
  if (!examTakingView.classList.contains("hidden")) {
    e.preventDefault();
    e.returnValue = "";
  }
});

renderExamList();
