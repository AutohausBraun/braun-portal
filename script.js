const SUPABASE_URL =
  "https://yfehvpmphsyhpzzcdqld.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_mMgHrko1tucRceS0nbyLzQ_-1F_JheM";

let currentUser = null;

let currentMonth =
  new Date().getMonth();

let currentYear =
  new Date().getFullYear();

/* API */

async function api(
  endpoint,
  method = "GET",
  body = null
){

  let options = {

    method: method,

    headers: {
      apikey: SUPABASE_KEY,
      Authorization:
        `Bearer ${SUPABASE_KEY}`,
      "Content-Type":
        "application/json"
    }

  };

  if(body){

    options.body =
      JSON.stringify(body);

  }

  let response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/${endpoint}`,
      options
    );

  return await response.json();

}

/* LOGIN */

async function login(){

  let email =
    document.getElementById(
      "loginEmail"
    ).value;

  let password =
    document.getElementById(
      "loginPassword"
    ).value;

  /* ADMIN */

  if(
    email === "admin@braun.local" &&
    password === "BraunPortal!2026"
  ){

    currentUser = {
      firstname:"Admin",
      lastname:"",
      role:"admin",
      department:"Alle"
    };

    startSystem();

    return;

  }

  /* USERS */

  let users =
    await api(
      `employees?email=eq.${email}&password=eq.${password}`
    );

  if(users.length > 0){

    currentUser =
      users[0];

    startSystem();

    return;

  }

  alert(
    "Falsche Zugangsdaten"
  );

}

/* START */

function startSystem(){

  document.getElementById(
    "loginScreen"
  ).style.display =
    "none";

  document.getElementById(
    "dashboard"
  ).style.display =
    "flex";

  document.getElementById(
    "topbarUserName"
  ).innerHTML =
    currentUser.firstname +
    " " +
    currentUser.lastname;

  document.getElementById(
    "topbarUserRole"
  ).innerHTML =
    currentUser.role +
    " • " +
    currentUser.department;

  loadEmployees();

  loadEmployeeSelects();

  loadVacations();

  loadSickLeaves();

  renderCalendar();

  updateDashboard();

}

/* LOGOUT */

function logout(){

  location.reload();

}

/* NAVIGATION */

function showPage(pageId){

  let pages =
    document.querySelectorAll(
      ".page"
    );

  pages.forEach(function(page){

    page.classList.remove(
      "active"
    );

  });

  document
    .getElementById(pageId)
    .classList.add("active");

}

/* DASHBOARD */

async function updateDashboard(){

  let employees =
    await api("employees");

  let vacations =
    await api("vacations");

  let sickLeaves =
    await api("sick_leaves");

  document.getElementById(
    "employeeCount"
  ).innerHTML =
    employees.length;

  document.getElementById(
    "vacationCount"
  ).innerHTML =
    vacations.length;

  document.getElementById(
    "sickCount"
  ).innerHTML =
    sickLeaves.length;

}

/* EMPLOYEES */

async function addEmployee(){

  let firstname =
    document.getElementById(
      "firstname"
    ).value;

  let lastname =
    document.getElementById(
      "lastname"
    ).value;

  let email =
    document.getElementById(
      "employeeEmail"
    ).value;

  let password =
    document.getElementById(
      "employeePassword"
    ).value;

  let role =
    document.getElementById(
      "employeeRole"
    ).value;

  let department =
    document.getElementById(
      "employeeDepartment"
    ).value;

  await api(
    "employees",
    "POST",
    [{
      firstname,
      lastname,
      email,
      password,
      role,
      department
    }]
  );

  loadEmployees();

  loadEmployeeSelects();

  updateDashboard();

}

async function deleteEmployee(id){

  await fetch(
    `${SUPABASE_URL}/rest/v1/employees?id=eq.${id}`,
    {

      method:"DELETE",

      headers:{
        apikey:
          SUPABASE_KEY,

        Authorization:
          `Bearer ${SUPABASE_KEY}`
      }

    }
  );

  loadEmployees();

  updateDashboard();

}

async function loadEmployees(){

  let employeeList =
    document.getElementById(
      "employeeList"
    );

  employeeList.innerHTML =
    "";

  let employees =
    await api("employees");

  employees.forEach(function(employee){

    employeeList.innerHTML += `

      <div class="employee-card">

        <h3>
          ${employee.firstname}
          ${employee.lastname}
        </h3>

        <p>${employee.email}</p>

        <p>${employee.role}</p>

        <p>${employee.department}</p>

        <button
          onclick="deleteEmployee(${employee.id})">

          Löschen

        </button>

      </div>

    `;

  });

}

async function loadEmployeeSelects(){

  let vacationName =
    document.getElementById(
      "vacationName"
    );

  let sickName =
    document.getElementById(
      "sickName"
    );

  vacationName.innerHTML =
    "";

  sickName.innerHTML =
    "";

  let employees =
    await api("employees");

  employees.forEach(function(employee){

    let fullName =
      employee.firstname +
      " " +
      employee.lastname;

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

async function addVacation(){

  let name =
    document.getElementById(
      "vacationName"
    ).value;

  let start =
    document.getElementById(
      "vacationStart"
    ).value;

  let end =
    document.getElementById(
      "vacationEnd"
    ).value;

  await api(
    "vacations",
    "POST",
    [{
      name,
      start,
      end,
      status:"Offen"
    }]
  );

  loadVacations();

  renderCalendar();

  updateDashboard();

}

async function loadVacations(){

  let vacationList =
    document.getElementById(
      "vacationList"
    );

  vacationList.innerHTML =
    "";

  let vacations =
    await api("vacations");

  vacations.forEach(function(vacation){

    vacationList.innerHTML += `

      <div class="employee-card">

        <h3>${vacation.name}</h3>

        <p>
          ${vacation.start}
          bis
          ${vacation.end}
        </p>

        <p>
          ${vacation.status}
        </p>

      </div>

    `;

  });

}

/* KRANK */

async function addSickLeave(){

  let name =
    document.getElementById(
      "sickName"
    ).value;

  let start =
    document.getElementById(
      "sickStart"
    ).value;

  let end =
    document.getElementById(
      "sickEnd"
    ).value;

  await api(
    "sick_leaves",
    "POST",
    [{
      name,
      start,
      end,
      status:"Gemeldet"
    }]
  );

  loadSickLeaves();

  renderCalendar();

  updateDashboard();

}

async function loadSickLeaves(){

  let sickList =
    document.getElementById(
      "sickList"
    );

  sickList.innerHTML =
    "";

  let sickLeaves =
    await api("sick_leaves");

  sickLeaves.forEach(function(sick){

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

async function renderCalendar(){

  let calendarGrid =
    document.getElementById(
      "calendarGrid"
    );

  let calendarMonth =
    document.getElementById(
      "calendarMonth"
    );

  if(!calendarGrid){
    return;
  }

  calendarGrid.innerHTML =
    "";

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
    "Dezember"

  ];

  calendarMonth.innerHTML =
    monthNames[currentMonth] +
    " " +
    currentYear;

  let daysInMonth =
    new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();

  let vacations =
    await api("vacations");

  let sickLeaves =
    await api("sick_leaves");

  for(
    let day = 1;
    day <= daysInMonth;
    day++
  ){

    let dayElement =
      document.createElement(
        "div"
      );

    dayElement.classList.add(
      "calendar-day"
    );

    dayElement.innerHTML = `
      <div class="calendar-day-number">
        ${day}
      </div>
    `;

    vacations.forEach(function(vacation){

      let start =
        new Date(vacation.start);

      if(
        start.getDate() === day &&
        start.getMonth() === currentMonth
      ){

        dayElement.innerHTML += `
          <div class="calendar-event vacation-event">
            Urlaub:
            ${vacation.name}
          </div>
        `;

      }

    });

    sickLeaves.forEach(function(sick){

      let start =
        new Date(sick.start);

      if(
        start.getDate() === day &&
        start.getMonth() === currentMonth
      ){

        dayElement.innerHTML += `
          <div class="calendar-event sick-event">
            Krank:
            ${sick.name}
          </div>
        `;

      }

    });

    calendarGrid.appendChild(
      dayElement
    );

  }

}

function previousMonth(){

  currentMonth--;

  if(currentMonth < 0){

    currentMonth = 11;

    currentYear--;

  }

  renderCalendar();

}

function nextMonth(){

  currentMonth++;

  if(currentMonth > 11){

    currentMonth = 0;

    currentYear++;

  }

  renderCalendar();

}
