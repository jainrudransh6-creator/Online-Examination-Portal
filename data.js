/* ============================================================
   data.js
   Central "database" layer for the Online Examination Portal.
   Everything is persisted in the browser's localStorage so the
   whole app runs with plain HTML + CSS + JS (no backend needed).

   Storage keys used:
     oep_users        -> array of user objects {id,name,email,password,role}
     oep_exams        -> array of exam objects {id,title,duration,teacherId,questions:[...]}
     oep_submissions  -> array of submission objects {id,examId,studentId,...}
     oep_session      -> the currently logged-in user's id
   ============================================================ */

const DB = {
  // ---------- low level helpers ----------
  _get(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  },
  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  uid() {
    // Small unique id generator (timestamp + random suffix)
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  },

  // ---------- users ----------
  getUsers() {
    return this._get("oep_users", []);
  },
  saveUsers(users) {
    this._set("oep_users", users);
  },
  findUserByEmail(email) {
    return this.getUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
  },
  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },

  // ---------- exams ----------
  getExams() {
    return this._get("oep_exams", []);
  },
  saveExams(exams) {
    this._set("oep_exams", exams);
  },
  addExam(exam) {
    const exams = this.getExams();
    exams.push(exam);
    this.saveExams(exams);
  },
  getExamById(id) {
    return this.getExams().find((e) => e.id === id);
  },
  deleteExam(id) {
    this.saveExams(this.getExams().filter((e) => e.id !== id));
  },

  // ---------- submissions ----------
  getSubmissions() {
    return this._get("oep_submissions", []);
  },
  saveSubmissions(subs) {
    this._set("oep_submissions", subs);
  },
  addSubmission(sub) {
    const subs = this.getSubmissions();
    subs.push(sub);
    this.saveSubmissions(subs);
  },
  hasAttempted(examId, studentId) {
    return this.getSubmissions().some(
      (s) => s.examId === examId && s.studentId === studentId
    );
  },

  // ---------- session ----------
  getSession() {
    const id = localStorage.getItem("oep_session");
    if (!id) return null;
    return this.getUsers().find((u) => u.id === id) || null;
  },
  setSession(userId) {
    localStorage.setItem("oep_session", userId);
  },
  clearSession() {
    localStorage.removeItem("oep_session");
  },

  // ---------- seed demo data (runs once) ----------
  seed() {
    if (this.getUsers().length > 0) return; // already seeded

    const demoUsers = [
      {
        id: this.uid(),
        name: "Umar Siddiqui",
        email: "teacher@demo.com",
        password: "teacher123",
        role: "teacher",
      },
      {
        id: this.uid(),
        name: "Rudransh Jain",
        email: "student@demo.com",
        password: "student123",
        role: "student",
      },
    ];
    this.saveUsers(demoUsers);

    const teacherId = demoUsers[0].id;
    const demoExam = {
      id: this.uid(),
      title: "Web Technologies - Unit Test 1",
      duration: 5, // minutes, kept short for demo purposes
      teacherId,
      createdAt: Date.now(),
      questions: [
        {
          id: this.uid(),
          text: "Which tag is used to link an external CSS file in HTML?",
          options: ["<style>", "<link>", "<css>", "<script>"],
          correctIndex: 1,
          marks: 5,
        },
        {
          id: this.uid(),
          text: "Which JavaScript method converts a JSON string into an object?",
          options: [
            "JSON.stringify()",
            "JSON.parse()",
            "JSON.toObject()",
            "Object.parse()",
          ],
          correctIndex: 1,
          marks: 5,
        },
        {
          id: this.uid(),
          text: "Which CSS property controls the text size?",
          options: ["font-weight", "text-style", "font-size", "text-size"],
          correctIndex: 2,
          marks: 5,
        },
      ],
    };
    this.addExam(demoExam);
  },
};

// Seed demo accounts/exam on first load of any page
DB.seed();
