let currentMonth = new Date().getMonth();

let currentYear = new Date().getFullYear();

let currentUser = null;

/* LOGIN */

function login() {
  let email = document.getElementById("loginEmail").value;

  let password = document.getElementById("loginPassword").value;

  if (email === "admin@braun.local" && password === "BraunPortal!2026") {
    currentUser = {
      firstname: "Admin",
      lastname: "",
      role: "admin",
      department: "Alle",
    };

    startSystem();

    return;
  }

  let employees = JSON.parse(localStorage.getItem("employees")) || [];

  let user = employees.find(function (employee) {
    return employee.email === email && employee.password === password;
  });

  if (user) {
    currentUser = user;

    localStorage.setItem("currentUser", JSON.stringify(user));

    startSystem();

    return;
  }

  alert("Falsche Zugangsdaten");
}

function startSystem() {
  document.getElementById("loginScreen").style.display = "none";

  document.getElementById("dashboard").style.display = "flex";

  document.getElementById("topbarUserName").innerHTML =
    currentUser.firstname + " " + currentUser.lastname;

  document.getElementById("topbarUserRole").innerHTML =
    currentUser.role + " • " + currentUser.department;

  applyPermissions();

  loadEmployees();

  loadEmployeeSelects();

  loadVacations();

  loadSickLeaves();

  renderCalendar();

  updateDashboard();
}

/* PERMISSIONS */

function applyPermissions() {
  if (currentUser.role === "mitarbeiter") {
    document.querySelector(
      "button[onclick=\"showPage('page-mitarbeiter')\"]",
    ).style.display = "none";
  }
}

/* LOGOUT */

function logout() {
  localStorage.removeItem("currentUser");

  location.reload();
}

/* NAVIGATION */

function showPage(pageId) {
  let pages = document.querySelectorAll(".page");

  pages.forEach(function (page) {
    page.classList.remove("active");
  });

  document.getElementById(pageId).classList.add("active");
}

/* DASHBOARD */

function updateDashboard() {
  let employees = JSON.parse(localStorage.getItem("employees")) || [];

  let vacations = JSON.parse(localStorage.getItem("vacations")) || [];

  let sickLeaves = JSON.parse(localStorage.getItem("sickLeaves")) || [];

  document.getElementById("employeeCount").innerHTML = employees.length;

  document.getElementById("vacationCount").innerHTML = vacations.length;

  document.getElementById("sickCount").innerHTML = sickLeaves.length;
}

/* EMPLOYEES */

function addEmployee() {
  let firstname = document.getElementById("firstname").value;

  let lastname = document.getElementById("lastname").value;

  let email = document.getElementById("employeeEmail").value;

  let password = document.getElementById("employeePassword").value;

  let role = document.getElementById("employeeRole").value;

  let department = document.getElementById("employeeDepartment").value;

  let employees = JSON.parse(localStorage.getItem("employees")) || [];

  employees.push({
    firstname,
    lastname,
    email,
    password,
    role,
    department,
  });

  localStorage.setItem("employees", JSON.stringify(employees));

  loadEmployees();

  loadEmployeeSelects();

  updateDashboard();
}

function deleteEmployee(index) {
  let employees = JSON.parse(localStorage.getItem("employees")) || [];

  employees.splice(index, 1);

  localStorage.setItem("employees", JSON.stringify(employees));

  loadEmployees();

  updateDashboard();
}

function loadEmployees() {
  let employeeList = document.getElementById("employeeList");

  employeeList.innerHTML = "";

  let employees = JSON.parse(localStorage.getItem("employees")) || [];

  employees.forEach(function (employee, index) {
    employeeList.innerHTML += `

      <div class="employee-card">

        <h3>
          ${employee.firstname}
          ${employee.lastname}
        </h3>

        <p>${employee.email}</p>

        <p>${employee.role}</p>

        <p>${employee.department}</p>

        <button onclick="deleteEmployee(${index})">
          Löschen
        </button>

      </div>

    `;
  });
}

function loadEmployeeSelects() {
  let vacationName = document.getElementById("vacationName");

  let sickName = document.getElementById("sickName");

  vacationName.innerHTML = "";

  sickName.innerHTML = "";

  let employees = JSON.parse(localStorage.getItem("employees")) || [];

  employees.forEach(function (employee) {
    let fullName = employee.firstname + " " + employee.lastname;

    vacationName.innerHTML += `
      <option value="${fullName}">
        ${fullName}
      </option>
    `;

    sickName.innerHTML += `
      <option value="${fullName}">
        ${fullName}
      </option>
    `;
  });
}

/* URLAUB */

function addVacation() {
  let name = document.getElementById("vacationName").value;

  let start = document.getElementById("vacationStart").value;

  let end = document.getElementById("vacationEnd").value;

  let vacations = JSON.parse(localStorage.getItem("vacations")) || [];

  vacations.push({
    name,
    start,
    end,
    status: "Offen",
  });

  localStorage.setItem("vacations", JSON.stringify(vacations));

  loadVacations();

  updateDashboard();
}

function loadVacations() {
  let vacationList = document.getElementById("vacationList");

  vacationList.innerHTML = "";

  let vacations = JSON.parse(localStorage.getItem("vacations")) || [];

  vacations.forEach(function (vacation, index) {
    if (
      currentUser.role === "mitarbeiter" &&
      vacation.name !== currentUser.firstname + " " + currentUser.lastname
    ) {
      return;
    }

    vacationList.innerHTML += `

      <div class="employee-card">

        <h3>${vacation.name}</h3>

        <p>
          ${vacation.start}
          bis
          ${vacation.end}
        </p>

        <p>${vacation.status}</p>

      </div>

    `;
  });
}

/* KRANK */

function addSickLeave() {
  let name = document.getElementById("sickName").value;

  let start = document.getElementById("sickStart").value;

  let end = document.getElementById("sickEnd").value;

  let sickLeaves = JSON.parse(localStorage.getItem("sickLeaves")) || [];

  sickLeaves.push({
    name,
    start,
    end,
    status: "Gemeldet",
  });

  localStorage.setItem("sickLeaves", JSON.stringify(sickLeaves));

  loadSickLeaves();

  updateDashboard();
}

function loadSickLeaves() {
  let sickList = document.getElementById("sickList");

  sickList.innerHTML = "";

  let sickLeaves = JSON.parse(localStorage.getItem("sickLeaves")) || [];

  sickLeaves.forEach(function (sick) {
    if (
      currentUser.role === "mitarbeiter" &&
      sick.name !== currentUser.firstname + " " + currentUser.lastname
    ) {
      return;
    }

    sickList.innerHTML += `

      <div class="employee-card">

        <h3>${sick.name}</h3>

        <p>
          ${sick.start}
          bis
          ${sick.end}
        </p>

        <p>${sick.status}</p>

      </div>

    `;
  });
}

/* KALENDER */

function renderCalendar() {
  let calendarGrid = document.getElementById("calendarGrid");

  let calendarMonth = document.getElementById("calendarMonth");

  calendarGrid.innerHTML = "";

  let monthNames = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  calendarMonth.innerHTML = monthNames[currentMonth] + " " + currentYear;

  let daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  let vacations = JSON.parse(localStorage.getItem("vacations")) || [];

  let sickLeaves = JSON.parse(localStorage.getItem("sickLeaves")) || [];

  for (let day = 1; day <= daysInMonth; day++) {
    let dayElement = document.createElement("div");

    dayElement.classList.add("calendar-day");

    dayElement.innerHTML = `
      <div class="calendar-day-number">
        ${day}
      </div>
    `;

    vacations.forEach(function (vacation) {
      let start = new Date(vacation.start);

      if (start.getDate() === day && start.getMonth() === currentMonth) {
        dayElement.innerHTML += `
          <div class="calendar-event vacation-event">
            Urlaub:
            ${vacation.name}
          </div>
        `;
      }
    });

    sickLeaves.forEach(function (sick) {
      let start = new Date(sick.start);

      if (start.getDate() === day && start.getMonth() === currentMonth) {
        dayElement.innerHTML += `
          <div class="calendar-event sick-event">
            Krank:
            ${sick.name}
          </div>
        `;
      }
    });

    calendarGrid.appendChild(dayElement);
  }
}

function previousMonth() {
  currentMonth--;

  if (currentMonth < 0) {
    currentMonth = 11;

    currentYear--;
  }

  renderCalendar();
}

function nextMonth() {
  currentMonth++;

  if (currentMonth > 11) {
    currentMonth = 0;

    currentYear++;
  }

  renderCalendar();
}
