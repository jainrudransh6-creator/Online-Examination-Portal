/* ============================================================
   teacher.js
   Powers teacher.html:
     - Guards the page (teacher-only)
     - Lets a teacher build an exam with a dynamic list of MCQs
     - Lists exams the teacher has created
     - Shows the results/performance report for each exam
   ============================================================ */

// ---- Route guard: only logged-in teachers may view this page ----
const currentUser = DB.getSession();
if (!currentUser || currentUser.role !== "teacher") {
  window.location.href = "index.html";
}

// ---- Header ----
document.getElementById("welcomeName").textContent = currentUser.name;
document.getElementById("logoutBtn").addEventListener("click", () => {
  DB.clearSession();
  window.location.href = "index.html";
});

// ---- Elements ----
const examForm = document.getElementById("examForm");
const questionsContainer = document.getElementById("questionsContainer");
const addQuestionBtn = document.getElementById("addQuestionBtn");
const examListEl = document.getElementById("examList");
const resultsPanel = document.getElementById("resultsPanel");
const formMessage = document.getElementById("formMessage");

let questionCount = 0;

// ---- Build one question block (title, 4 options, correct-answer radio, marks) ----
function addQuestionBlock() {
  questionCount++;
  const qIndex = questionCount;

  const block = document.createElement("div");
  block.className = "question-block";
  block.dataset.qindex = qIndex;
  block.innerHTML = `
    <div class="question-block-header">
      <strong>Question ${qIndex}</strong>
      <button type="button" class="btn-icon remove-question" title="Remove question">&times;</button>
    </div>
    <label>Question text</label>
    <input type="text" class="q-text" placeholder="Enter the question" required />

    <label>Options (select the radio next to the correct answer)</label>
    <div class="option-row">
      <input type="radio" name="correct-${qIndex}" value="0" checked />
      <input type="text" class="q-option" placeholder="Option A" required />
    </div>
    <div class="option-row">
      <input type="radio" name="correct-${qIndex}" value="1" />
      <input type="text" class="q-option" placeholder="Option B" required />
    </div>
    <div class="option-row">
      <input type="radio" name="correct-${qIndex}" value="2" />
      <input type="text" class="q-option" placeholder="Option C" required />
    </div>
    <div class="option-row">
      <input type="radio" name="correct-${qIndex}" value="3" />
      <input type="text" class="q-option" placeholder="Option D" required />
    </div>

    <label>Marks for this question</label>
    <input type="number" class="q-marks" min="1" value="5" required />
  `;

  block.querySelector(".remove-question").addEventListener("click", () => {
    block.remove();
  });

  questionsContainer.appendChild(block);
}

// Start every new exam form with one question
addQuestionBlock();
addQuestionBtn.addEventListener("click", addQuestionBlock);

// ---- Submit: gather all question blocks into an exam object ----
examForm.addEventListener("submit", (e) => {
  e.preventDefault();
  formMessage.textContent = "";

  const title = document.getElementById("examTitle").value.trim();
  const duration = parseInt(document.getElementById("examDuration").value, 10);

  const blocks = questionsContainer.querySelectorAll(".question-block");
  if (blocks.length === 0) {
    formMessage.textContent = "Add at least one question.";
    return;
  }

  const questions = [];
  for (const block of blocks) {
    const qIndex = block.dataset.qindex;
    const text = block.querySelector(".q-text").value.trim();
    const optionInputs = block.querySelectorAll(".q-option");
    const options = Array.from(optionInputs).map((i) => i.value.trim());
    const correctRadio = block.querySelector(`input[name="correct-${qIndex}"]:checked`);
    const correctIndex = parseInt(correctRadio.value, 10);
    const marks = parseInt(block.querySelector(".q-marks").value, 10) || 1;

    if (!text || options.some((o) => !o)) {
      formMessage.textContent = "Please fill in every question and all four options.";
      return;
    }

    questions.push({ id: DB.uid(), text, options, correctIndex, marks });
  }

  const exam = {
    id: DB.uid(),
    title,
    duration,
    teacherId: currentUser.id,
    createdAt: Date.now(),
    questions,
  };

  DB.addExam(exam);
  formMessage.style.color = "var(--success)";
  formMessage.textContent = "Exam created successfully!";
  examForm.reset();
  questionsContainer.innerHTML = "";
  questionCount = 0;
  addQuestionBlock();

  renderExamList();
});

// ---- List all exams created by this teacher ----
function renderExamList() {
  const myExams = DB.getExams().filter((ex) => ex.teacherId === currentUser.id);
  examListEl.innerHTML = "";

  if (myExams.length === 0) {
    examListEl.innerHTML = `<p class="muted">You haven't created any exams yet.</p>`;
    return;
  }

  myExams.forEach((exam) => {
    const totalMarks = exam.questions.reduce((sum, q) => sum + q.marks, 0);
    const submissionCount = DB.getSubmissions().filter((s) => s.examId === exam.id).length;

    const card = document.createElement("div");
    card.className = "exam-card";
    card.innerHTML = `
      <div>
        <h4>${exam.title}</h4>
        <p class="muted">
          ${exam.questions.length} questions &middot; ${totalMarks} marks &middot;
          ${exam.duration} min &middot; ${submissionCount} attempt(s)
        </p>
      </div>
      <div class="exam-card-actions">
        <button class="btn-secondary view-results" data-id="${exam.id}">View Results</button>
        <button class="btn-danger delete-exam" data-id="${exam.id}">Delete</button>
      </div>
    `;
    examListEl.appendChild(card);
  });

  // Wire up buttons
  document.querySelectorAll(".view-results").forEach((btn) => {
    btn.addEventListener("click", () => showResults(btn.dataset.id));
  });
  document.querySelectorAll(".delete-exam").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this exam? This cannot be undone.")) {
        DB.deleteExam(btn.dataset.id);
        resultsPanel.innerHTML = "";
        renderExamList();
      }
    });
  });
}

// ---- Show a results/performance table for one exam ----
function showResults(examId) {
  const exam = DB.getExamById(examId);
  const totalMarks = exam.questions.reduce((sum, q) => sum + q.marks, 0);
  const subs = DB.getSubmissions().filter((s) => s.examId === examId);
  const users = DB.getUsers();

  let rows = "";
  if (subs.length === 0) {
    rows = `<tr><td colspan="4" class="muted">No submissions yet.</td></tr>`;
  } else {
    subs
      .sort((a, b) => b.score - a.score)
      .forEach((sub) => {
        const student = users.find((u) => u.id === sub.studentId);
        const percent = ((sub.score / totalMarks) * 100).toFixed(1);
        rows += `
          <tr>
            <td>${student ? student.name : "Unknown"}</td>
            <td>${sub.score} / ${totalMarks}</td>
            <td>${percent}%</td>
            <td>${sub.autoSubmitted ? "Auto-submitted (time up)" : "Submitted"}</td>
          </tr>
        `;
      });
  }

  resultsPanel.innerHTML = `
    <h3>Results: ${exam.title}</h3>
    <table class="results-table">
      <thead>
        <tr><th>Student</th><th>Score</th><th>Percentage</th><th>Status</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

renderExamList();
