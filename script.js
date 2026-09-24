'use strict';
const $=id=>document.getElementById(id), D=window.PortalDates;
const state={me:null,employees:[],absences:[],allowances:[],holidays:[],years:[],month:new Date().getMonth(),year:new Date().getFullYear(),page:'overview',generation:0};
const requests=new Map();
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const name=e=>e?`${e.firstname} ${e.lastname}`:'Unbekannter Mitarbeiter';
const employee=id=>state.employees.find(e=>e.id===id);
const roleLabel={admin:'Admin',teamleiter:'Teamleiter',mitarbeiter:'Mitarbeiter'};
const dayNames=['Mo','Di','Mi','Do','Fr','Sa','So'];
let client;
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function notice(message,error=false){$('notice').textContent=message;$('notice').className=error?'error':'success';$('notice').hidden=false;}
function errorText(error){
 if(error?.code==='23505')return 'Dieser Eintrag ist bereits vorhanden. Bitte die bestehenden Daten prüfen.';
 if(error?.code==='PGRST202'||error?.code==='42P01')return 'Die neue Datenbankeinrichtung fehlt noch. Bitte den Admin kontaktieren.';
 if(error?.message==='Invalid login credentials')return 'E-Mail-Adresse oder Passwort stimmen nicht. Alternativ einen Anmeldelink anfordern.';
 if(/fetch|network/i.test(error?.message||''))return 'Die Verbindung ist unterbrochen. Bitte erneut versuchen.';
 return error?.message||'Die Aktion konnte nicht abgeschlossen werden.';
}
async function run(action,button){if(button?.disabled)return; if(button)button.disabled=true;try{await action();}catch(e){notice(errorText(e),true);}finally{if(button)button.disabled=false;}}
function button(text,action,cls='secondary'){const b=el('button',text,cls);b.type='button';b.addEventListener('click',()=>run(action,b));return b;}
function empty(container,text='Noch keine Einträge vorhanden.'){container.replaceChildren(el('p',text,'empty'));}
function activeEmployees(){return state.employees.filter(e=>e.active);}
function selector(id,rows){const s=$(id),value=s.value;s.replaceChildren();for(const e of rows){const o=el('option',name(e));o.value=e.id;s.append(o);}if(rows.some(e=>e.id===value))s.value=value;}
async function all(table){let rows=[];for(let offset=0;;offset+=1000){let query=client.from(table).select('*').order(table==='bp_holidays'?'day':table==='bp_calendar_years'?'year':table==='bp_allowances'?'employee_id':'id');if(table==='bp_allowances')query=query.order('year');const {data,error}=await query.range(offset,offset+999);if(error)throw error;rows.push(...data);if(data.length<1000)return rows;}}
async function refresh(){
 const generation=++state.generation;
 const {data,error}=await client.rpc('bp_claim_profile');if(error){clearSession();throw error;}
 const me=Array.isArray(data)?data[0]:data;if(!me?.id){clearSession();throw Error('Kein aktives Mitarbeiterprofil vorhanden.');}
 const [employees,absences,allowances,holidays,years]=await Promise.all(['bp_employees','bp_absences','bp_allowances','bp_holidays','bp_calendar_years'].map(all));
 if(generation!==state.generation)return;
 Object.assign(state,{me,employees,absences,allowances,holidays,years});render();
 $('loginScreen').hidden=true;$('dashboard').hidden=false;
}
async function mutate(operation,payload){const {error}=await client.rpc('bp_mutate',{operation,payload});if(error)throw error;}
async function afterSave(message){notice(message);try{await refresh();}catch(e){notice(`${message} Die Anzeige konnte noch nicht aktualisiert werden: ${errorText(e)}`,true);}}
function showPage(page){if(['employees','settings'].includes(page)&&state.me?.role!=='admin')return;state.page=page;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('selected',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
function card(title,value,detail){const box=el('div',undefined,'card');box.append(el('h3',title),el('p',String(value),'number'));if(detail)box.append(el('small',detail));return box;}
function render(){
 const me=state.me;$('userName').textContent=name(me);$('userRole').textContent=`${roleLabel[me.role]} · ${me.department}`;
 document.querySelectorAll('[data-admin]').forEach(e=>e.hidden=me.role!=='admin');
 const canSubmit=activeEmployees().filter(e=>me.role==='admin'||e.id===me.id);
 selector('vacationEmployee',canSubmit);selector('sickEmployee',canSubmit);selector('allowanceEmployee',state.employees);
 $('cards').replaceChildren(card('Mitarbeiter',activeEmployees().length,'In deinem Sichtbereich'),card('Offene Anträge',state.absences.filter(a=>a.status==='Offen').length),card('Heute im Urlaub',state.absences.filter(a=>a.kind==='vacation'&&a.status==='Genehmigt'&&a.start_date<=today()&&a.end_date>=today()).length),card('Heute krank',state.absences.filter(a=>a.kind==='sick'&&a.status==='Gemeldet'&&a.start_date<=today()&&a.end_date>=today()).length));
 renderAbsences('pendingList',state.absences.filter(a=>a.status==='Offen'));renderAbsences('vacationList',state.absences.filter(a=>a.kind==='vacation'));renderAbsences('sickList',state.absences.filter(a=>a.kind==='sick'));
 renderBalance();renderEmployees();renderSettings();renderCalendarFilter();renderCalendar();estimate();
 showPage(['employees','settings'].includes(state.page)&&me.role!=='admin'?'overview':state.page);
}
function renderAbsences(id,records){
 const list=$(id);list.replaceChildren();if(!records.length){empty(list);return;}
 for(const a of [...records].sort((a,b)=>b.start_date.localeCompare(a.start_date))){
  const box=el('article',undefined,'employee-card'), header=el('div',undefined,'row');
  header.append(el('h3',name(employee(a.employee_id))),el('span',a.status,`badge status-${a.status.toLowerCase()}`));box.append(header);
  box.append(el('p',`${formatDate(a.start_date)} – ${formatDate(a.end_date)}${a.kind==='vacation'?` · ${a.booked_dates.length} Urlaubstage`:''}`));
  if(a.note)box.append(el('p',a.note,'muted'));if(a.decision_note)box.append(el('p',`Entscheidung: ${a.decision_note}`,'muted'));
  if(a.decided_by)box.append(el('small',`Bearbeitet von ${name(employee(a.decided_by))}`));
  const controls=el('div',undefined,'actions');
  if(a.kind==='vacation'&&a.status==='Offen'&&state.me.role!=='mitarbeiter'&&a.employee_id!==state.me.id){controls.append(button('Genehmigen',()=>decide(a,'Genehmigt'),'primary'),button('Ablehnen',()=>decide(a,'Abgelehnt')));}
  if(['Offen','Genehmigt','Gemeldet'].includes(a.status)&&(state.me.role==='admin'||(a.employee_id===state.me.id&&a.status==='Offen')))controls.append(button('Stornieren',()=>decide(a,'Storniert')));
  box.append(controls);list.append(box);
 }
}
async function decide(a,status){
 const note=window.prompt(`${name(employee(a.employee_id))}: ${formatDate(a.start_date)} – ${formatDate(a.end_date)}\n${status}: Kommentar (optional). Abbrechen lässt den Eintrag unverändert.`,'');
 if(note===null)return;if(note.length>500)throw Error('Bitte höchstens 500 Zeichen eingeben.');
 await mutate('decision',{id:a.id,status,decision_note:note});await afterSave(`Eintrag: ${status}.`);
}
function formatDate(s){return D.parse(s).toLocaleDateString('de-DE',{timeZone:'UTC'});}
function renderBalance(){
 const id=$('vacationEmployee').value, year=Number(($('vacationStart').value||today()).slice(0,4)), allowance=state.allowances.find(a=>a.employee_id===id&&a.year===year);
 const area=$('balance');area.replaceChildren();if(!allowance){area.append(card(`Urlaub ${year}`,'–','Der Admin muss den Jahresanspruch hinterlegen.'));return;}
 const accepted=state.absences.filter(a=>a.employee_id===id&&a.kind==='vacation'&&['Offen','Genehmigt'].includes(a.status));
 const bookings=accepted.flatMap(a=>a.booked_dates.filter(d=>d.startsWith(String(year))).map(d=>({day:d,status:a.status})));
 const approved=bookings.filter(d=>d.status==='Genehmigt').length,pending=bookings.length-approved;
 const carryUsed=Math.min(allowance.carry,bookings.filter(d=>d.day<=allowance.carry_until).length);
 const carryAvailable=today()<=allowance.carry_until?allowance.carry-carryUsed:0;
 const remaining=allowance.days-(bookings.length-carryUsed)+carryAvailable;
 area.append(card(`Anspruch ${year}`,allowance.days,`Übertrag: ${allowance.carry} bis ${formatDate(allowance.carry_until)}`),card('Genehmigt / reserviert',`${approved} / ${pending}`,'Offene Anträge reservieren Urlaub.'),card('Noch verplanbar',remaining,`Davon ${carryAvailable} Übertrag vor Ablauf nutzbar.`));
}
function estimate(){
 renderBalance();const start=$('vacationStart').value,end=$('vacationEnd').value,e=employee($('vacationEmployee').value);$('vacationEstimate').textContent='';
 if(!start||!end||!e)return;
 try{const n=D.days(start,end,e.workdays,state.holidays.map(h=>h.day));$('vacationEstimate').textContent=`${n} Urlaubstage nach aktuellem Arbeitsmodell; Wochenenden und hinterlegte Feiertage sind abgezogen. Die verbindliche Prüfung erfolgt beim Speichern.`;}catch(error){$('vacationEstimate').textContent=errorText(error);}
}
function renderCalendarFilter(){const select=$('calendarDepartment'),value=select.value;select.replaceChildren();const all=el('option','Alle sichtbaren Abteilungen');all.value='';select.append(all);for(const department of [...new Set(state.employees.map(e=>e.department))].sort()){const o=el('option',department);o.value=department;select.append(o);}if([...select.options].some(o=>o.value===value))select.value=value;}
function renderCalendar(){
 $('calendarMonth').textContent=new Date(state.year,state.month,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'});
 const grid=$('calendarGrid');grid.replaceChildren();for(const label of dayNames)grid.append(el('div',label,'weekday'));
 const department=$('calendarDepartment').value,records=state.absences.filter(a=>!department||employee(a.employee_id)?.department===department);
 for(const date of D.month(state.year,state.month)){
  const box=el('div',undefined,date?'calendar-day':'calendar-blank');if(!date){grid.append(box);continue;}
  const weekday=D.parse(date).getUTCDay();if(weekday===0||weekday===6)box.classList.add('weekend');if(date===today())box.classList.add('today');
  box.append(el('div',String(Number(date.slice(-2))),'calendar-day-number'));
  const holiday=state.holidays.find(h=>h.day===date);if(holiday)box.append(el('small',holiday.name,'holiday'));
  for(const a of D.events(records,date)){const type=a.kind==='sick'?'sick':a.status==='Offen'?'pending':'vacation';box.append(el('div',`${name(employee(a.employee_id))} · ${a.kind==='sick'?'krank':a.status==='Offen'?'beantragt':'Urlaub'}`,`calendar-event ${type}-event`));}
  grid.append(box);
 }
}
function renderEmployees(){
 const list=$('employeeList');list.replaceChildren();if(state.me.role!=='admin')return;
 for(const e of state.employees){const box=el('article',undefined,'employee-card');box.append(el('h3',name(e)),el('p',`${e.email} · ${e.department} · ${roleLabel[e.role]}${e.active?'':' · deaktiviert'}`),el('p',`Arbeitstage: ${e.workdays.map(d=>dayNames[d-1]).join(', ')}`),button('Bearbeiten',()=>editEmployee(e)));list.append(box);}
}
function editEmployee(e){$('employeeId').value=e.id;for(const [field,key] of Object.entries({firstname:'firstname',lastname:'lastname',employeeEmail:'email',employeeDepartment:'department',employeeRole:'role',employeeActive:'active'}))$(field).value=String(e[key]);document.querySelectorAll('[name="workday"]').forEach(c=>c.checked=e.workdays.includes(Number(c.value)));$('employeeEmail').readOnly=!!e.auth_user_id;$('employeeForm').scrollIntoView({behavior:'smooth',block:'start'});}
function resetEmployee(){$('employeeForm').reset();$('employeeId').value='';$('employeeEmail').readOnly=false;document.querySelectorAll('[name="workday"]').forEach(c=>c.checked=Number(c.value)<=5);}
function renderSettings(){
 for(const id of ['allowanceList','holidayList','confirmedYears'])$(id).replaceChildren();if(state.me.role!=='admin')return;
 for(const a of state.allowances){const line=el('div',undefined,'compact-row');line.append(el('span',`${name(employee(a.employee_id))} · ${a.year}: ${a.days} Tage + ${a.carry} Übertrag bis ${formatDate(a.carry_until)}`),button('Bearbeiten',()=>{for(const [id,key] of Object.entries({allowanceEmployee:'employee_id',allowanceYear:'year',allowanceDays:'days',carryDays:'carry',carryUntil:'carry_until'}))$(id).value=a[key];$('allowanceForm').scrollIntoView({behavior:'smooth'});}));$('allowanceList').append(line);}
 for(const h of state.holidays){const line=el('div',undefined,'compact-row');line.append(el('span',`${formatDate(h.day)} · ${h.name}`),button('Entfernen',async()=>{if(!window.confirm(`${h.name} am ${formatDate(h.day)} aus dem Kalender entfernen?`))return;await mutate('holiday',{day:h.day,remove:true});await afterSave('Feiertag entfernt. Bitte den Jahreskalender erneut bestätigen.');}));$('holidayList').append(line);}
 for(const y of state.years)$('confirmedYears').append(el('p',`${y.year}: ${y.region} · bestätigt`));
}
function onForm(id,fn){$(id).addEventListener('submit',event=>{event.preventDefault();run(()=>fn(event),event.submitter);});}
function keyFor(formId,payload){const signature=JSON.stringify(payload),old=requests.get(formId);if(old?.signature===signature)return old.key;const key=crypto.randomUUID();requests.set(formId,{signature,key});return key;}
async function submitAbsence(kind){
 const prefix=kind==='vacation'?'vacation':'sick',start=$(prefix+'Start').value,end=$(prefix+'End').value;D.dates(start,end);
 const payload={kind,employee_id:$(prefix+'Employee').value,start_date:start,end_date:end,note:kind==='vacation'?$('vacationNote').value.trim():''};
 payload.request_key=keyFor(prefix,payload);await mutate('absence',payload);requests.delete(prefix);$(prefix+'Form').reset();await afterSave(kind==='vacation'?'Urlaubsantrag gespeichert.':'Krankmeldung gespeichert.');
}
async function signIn(){const {error}=await client.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)throw error;$('loginPassword').value='';await refresh();notice('Du bist angemeldet.');}
async function emailLogin(){
 if(!$('loginEmail').reportValidity())return;
 const {error}=await client.auth.signInWithOtp({email:$('loginEmail').value.trim(),options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;notice('Bitte prüfe dein Postfach und öffne den Anmeldelink. Zugriff erhältst du nur, wenn dein Mitarbeiterprofil freigeschaltet ist.');
}
function clearSession(){state.generation++;state.me=null;for(const k of ['employees','absences','allowances','holidays','years'])state[k]=[];for(const id of ['cards','balance','pendingList','vacationList','sickList','calendarGrid','employeeList','allowanceList','holidayList','confirmedYears'])$(id).replaceChildren();document.querySelectorAll('form').forEach(f=>f.reset());$('dashboard').hidden=true;$('loginScreen').hidden=false;}
async function init(){
 try{
  client=window.supabase.createClient(PORTAL_CONFIG.url,PORTAL_CONFIG.publishableKey,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  for(let i=1;i<=7;i++){const label=el('label'),input=el('input');input.type='checkbox';input.name='workday';input.value=String(i);input.checked=i<=5;label.append(input,document.createTextNode(dayNames[i-1]));$('workdays').append(label);}
  const year=new Date().getFullYear();$('allowanceYear').value=year;$('holidayYear').value=year;$('carryUntil').value=`${year}-03-31`;$('holidayRegion').value='Baden-Württemberg';
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
  onForm('loginForm',signIn);$('emailLogin').addEventListener('click',()=>run(emailLogin,$('emailLogin')));
  $('refresh').addEventListener('click',()=>run(async()=>{await refresh();notice('Anzeige aktualisiert.');},$('refresh')));
  $('logout').addEventListener('click',()=>run(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;clearSession();notice('Du bist abgemeldet.');},$('logout')));
  onForm('vacationForm',()=>submitAbsence('vacation'));onForm('sickForm',()=>submitAbsence('sick'));
  for(const id of ['vacationStart','vacationEnd','vacationEmployee'])$(id).addEventListener('change',estimate);
  $('previousMonth').addEventListener('click',()=>{if(--state.month<0){state.month=11;state.year--;}renderCalendar();});$('nextMonth').addEventListener('click',()=>{if(++state.month>11){state.month=0;state.year++;}renderCalendar();});$('calendarDepartment').addEventListener('change',renderCalendar);
  $('employeeReset').addEventListener('click',resetEmployee);
  onForm('employeeForm',async()=>{const workdays=[...document.querySelectorAll('[name="workday"]:checked')].map(c=>Number(c.value));if(!workdays.length)throw Error('Bitte mindestens einen Arbeitstag auswählen.');await mutate('employee',{id:$('employeeId').value||null,firstname:$('firstname').value.trim(),lastname:$('lastname').value.trim(),email:$('employeeEmail').value.trim(),department:$('employeeDepartment').value.trim(),role:$('employeeRole').value,active:$('employeeActive').value==='true',workdays});resetEmployee();await afterSave('Mitarbeiter gespeichert. Änderungen der Arbeitstage gelten für neue Anträge; vorhandene Buchungen bleiben erhalten.');});
  onForm('allowanceForm',async()=>{await mutate('allowance',{employee_id:$('allowanceEmployee').value,year:Number($('allowanceYear').value),days:Number($('allowanceDays').value),carry:Number($('carryDays').value),carry_until:$('carryUntil').value});await afterSave('Urlaubsanspruch gespeichert.');});
  onForm('holidayForm',async()=>{await mutate('holiday',{day:$('holidayDate').value,name:$('holidayName').value.trim()});$('holidayForm').reset();await afterSave('Feiertag gespeichert. Bitte den Jahreskalender erneut bestätigen.');});
  onForm('calendarConfirmForm',async()=>{await mutate('calendar',{year:Number($('holidayYear').value),region:$('holidayRegion').value.trim()});await afterSave('Feiertagskalender bestätigt.');});
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clearSession();});
  const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)await refresh();
 }catch(error){clearSession();notice(errorText(error),true);}
}
init();
