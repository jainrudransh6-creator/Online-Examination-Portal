/* ============================================================
   auth.js
   Handles login, registration, and redirecting the user to the
   correct dashboard based on their role.
   ============================================================ */

// If a user is already logged in, send them straight to their dashboard
(function redirectIfLoggedIn() {
  const user = DB.getSession();
  if (user) {
    window.location.href = user.role === "teacher" ? "teacher.html" : "student.html";
  }
})();

// ---- Element references ----
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showRegisterBtn = document.getElementById("showRegister");
const showLoginBtn = document.getElementById("showLogin");
const loginCard = document.getElementById("loginCard");
const registerCard = document.getElementById("registerCard");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");

// ---- Toggle between login/register cards ----
showRegisterBtn.addEventListener("click", (e) => {
  e.preventDefault();
  loginCard.classList.add("hidden");
  registerCard.classList.remove("hidden");
});
showLoginBtn.addEventListener("click", (e) => {
  e.preventDefault();
  registerCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
});

// ---- Login ----
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const user = DB.findUserByEmail(email);
  if (!user || user.password !== password) {
    loginError.textContent = "Invalid email or password.";
    return;
  }

  DB.setSession(user.id);
  window.location.href = user.role === "teacher" ? "teacher.html" : "student.html";
});

// ---- Register ----
registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  registerError.textContent = "";

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const role = document.getElementById("regRole").value;

  if (!name || !email || !password || !role) {
    registerError.textContent = "Please fill in all fields.";
    return;
  }
  if (DB.findUserByEmail(email)) {
    registerError.textContent = "An account with this email already exists.";
    return;
  }

  const newUser = { id: DB.uid(), name, email, password, role };
  DB.addUser(newUser);
  DB.setSession(newUser.id);
  window.location.href = role === "teacher" ? "teacher.html" : "student.html";
});
