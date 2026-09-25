(function (root) {
  'use strict';
  const iso = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  const parse = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) throw Error('Bitte ein gültiges Datum eingeben.');
    const d = new Date(s + 'T12:00:00Z');
    if (!Number.isFinite(d.getTime()) || iso(d) !== s) throw Error('Ungültiges Datum.');
    return d;
  };
  function dates(start,end) {
    const d=parse(start), stop=parse(end), result=[];
    if (d>stop) throw Error('Das Enddatum darf nicht vor dem Startdatum liegen.');
    if ((stop-d)/86400000>730) throw Error('Bitte höchstens zwei Jahre auf einmal erfassen.');
    while(d<=stop) { result.push(iso(d)); d.setUTCDate(d.getUTCDate()+1); }
    return result;
  }
  function days(start,end,weekdays,holidays=[],year) {
    const excluded=new Set(holidays);
    return dates(start,end).filter(s => (!year || s.startsWith(String(year))) && weekdays.includes(parse(s).getUTCDay() || 7) && !excluded.has(s)).length;
  }
  function month(year,monthIndex) {
    const first=new Date(Date.UTC(year,monthIndex,1,12));
    const count=new Date(Date.UTC(year,monthIndex+1,0,12)).getUTCDate();
    return [...Array((first.getUTCDay()+6)%7).fill(null),...Array.from({length:count},(_,i)=>iso(new Date(Date.UTC(year,monthIndex,i+1,12))))];
  }
  function events(records,date) { return records.filter(r=>r.start_date<=date && r.end_date>=date && !['Abgelehnt','Storniert'].includes(r.status)); }
  const api={iso,parse,dates,days,month,events};
  if(typeof module!=='undefined') module.exports=api;
  else root.PortalDates=api;
})(typeof window!=='undefined'?window:globalThis);
