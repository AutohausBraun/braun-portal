console.log("SCRIPT GELADEN");
 
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

  console.log("LOGIN START");

  let email =
    document.getElementById(
      "loginEmail"
    ).value;

  let password =
    document.getElementById(
      "loginPassword"
    ).value;

  console.log(email);
  console.log(password);

  /* ADMIN LOGIN */

  if(
    email === "admin@braun.local" &&
    password === "BraunPortal!2026"
  ){

    console.log(
      "ADMIN LOGIN OK"
    );

    currentUser = {

      firstname:"Admin",

      lastname:"",

      role:"admin",

      department:"Alle"

    };

    startSystem();

    return;

  }

  /* MITARBEITER LOGIN */

  try{

    let users =
      await api(
        `employees?email=eq.${email}&password=eq.${password}`
      );

    console.log(users);

    if(users.length > 0){

      currentUser =
        users[0];

      startSystem();

      return;

    }

  }catch(error){

    console.log(error);

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

  let targetPage =
    document.getElementById(
      pageId
    );

  if(targetPage){

    targetPage.classList.add(
      "active"
    );

  }

}
