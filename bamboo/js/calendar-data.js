/* Календарные события и обмен iCalendar. Даты без времени — весь день, конец исключён. */
(function(){
const DAY = 1440;
const MIN = 60000;
const {add, diff, ymd, parse} = B;
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const dateOf = value => value.slice(0, 10);
const minuteOf = value => value.length > 10 ? Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16)) : 0;
const time = n => B.pad(Math.floor(n / 60)) + ':' + B.pad(n % 60);
const at = (date, minute) => add(date, Math.floor(minute / DAY)) + 'T' + time((minute % DAY + DAY) % DAY);
const span = (a, b) => diff(dateOf(a), dateOf(b)) * DAY + minuteOf(b) - minuteOf(a);
const shifted = (value, days) => add(dateOf(value), days) + value.slice(10);
const local = d => ymd(d) + 'T' + B.hm(d.getTime());
const validDate = d => /^\d{4}-\d\d-\d\d$/.test(d) && d >= '1900-01-01' && d <= '2199-12-31' && ymd(parse(d)) === d;
const valid = value => typeof value === 'string' && validDate(dateOf(value)) &&
  (value.length === 10 || /^T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.slice(10)));
const events = () => B.list('e_').filter(e => e && valid(e.start) && valid(e.end) &&
  e.start.length === e.end.length && e.start < e.end);
function monthPattern(r, a, d){
  const day = d.getDate(), last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  const monthDays = r.monthDays || [], weekDays = r.days || [];
  if (!monthDays.length && !weekDays.length) return day === a.getDate();
  const fits = n => (!monthDays.length || monthDays.includes(n) || monthDays.includes(n-last-1)) &&
    (!weekDays.length || weekDays.includes((new Date(d.getFullYear(),d.getMonth(),n,12).getDay()+6)%7));
  if (!fits(day)) return false;
  if (!r.pos) return true;
  const matched = Array.from({length:last},(_,i)=>i+1).filter(fits);
  return matched.at(r.pos > 0 ? r.pos-1 : r.pos) === day;
}
function occursOn(e, date){
  const r = e.repeat, first = dateOf(e.start);
  if (date === first) return true;
  if (!r || date < first || (r.until && date > r.until)) return false;
  const n = Math.max(1, Number(r.every) || 1);
  const days = diff(first, date);
  if (r.freq === 'daily') return days % n === 0;
  if (r.freq === 'weekly') return Math.floor((days + B.wd(first)) / 7) % n === 0 &&
    (r.days?.length ? r.days : [B.wd(first)]).includes(B.wd(date));
  const a = parse(first), d = parse(date), years = d.getFullYear()-a.getFullYear();
  if (r.freq === 'monthly') return (years*12+d.getMonth()-a.getMonth())%n === 0 && monthPattern(r,a,d);
  return r.freq === 'yearly' && years%n === 0 && d.getMonth() === (r.month ? r.month-1 : a.getMonth()) && monthPattern(r,a,d);
}
function occurrences(e, from, to){
  const first = dateOf(e.start), duration = Math.ceil(span(e.start, e.end) / DAY);
  if (!e.repeat) return e.start < add(to, 1) && e.end > (e.end.length === 10 ? from : from + 'T00:00') ? [{...e, on: first}] : [];
  const lower = add(from, -duration), upper = e.repeat.until && e.repeat.until < to ? e.repeat.until : to;
  const out = [];
  let count = 0;
  for (let date = e.repeat.count ? first : (first > lower ? first : lower); date <= upper; date = add(date, 1)){
    if (!occursOn(e, date)) continue;
    count++;
    if (e.repeat.count && count > e.repeat.count) break;
    if (date < lower || (e.skip || []).includes(date)) continue;
    const days = diff(first, date), start = shifted(e.start, days), end = shifted(e.end, days);
    if (end > (end.length === 10 ? from : from + 'T00:00')) out.push({...e, start, end, on: date});
  }
  return out;
}
function move(e, start){
  const duration = span(e.start, e.end);
  return {...e, start, end: start.length === 10
    ? add(start, Math.max(1, Math.ceil(duration / DAY)))
    : at(dateOf(start), minuteOf(start) + (e.start.length === 10 ? Math.max(60, duration - DAY + 60) : duration))};
}
function countBefore(e, date){
  if (!e.repeat?.count) return 0;
  let n = 0;
  for (let d = dateOf(e.start); d < date && n < e.repeat.count; d = add(d, 1)) if (occursOn(e, d)) n++;
  return n;
}
function previousOccurrences(e, date){
  const count = countBefore(e, date);
  const repeat = {...e.repeat, until: add(date, -1)};
  if (repeat.count) repeat.count = count;
  return {...e, repeat, skip: (e.skip || []).filter(d => d < date)};
}
const escape = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
const unescape = s => s.replace(/\\([nN,;\\])/g, (_, c) => /n/i.test(c) ? '\n' : c);
const basic = s => s.replace(/[-:]/g, '') + (s.length > 10 ? '00' : '');
const property = (name, value) => name + (value.length === 10 ? ';VALUE=DATE' : '') + ':' + basic(value);
const encoder = new TextEncoder();
function fold(line){
  let out = '', size = 0;
  for (const char of line){
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75){ out += '\r\n '; size = 1; }
    out += char; size += bytes;
  }
  return out;
}
function exportICS(items){
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zov Lesa//Calendar//RU', 'CALSCALE:GREGORIAN'];
  for (const e of items){
    lines.push('BEGIN:VEVENT', 'UID:' + escape(e.icsUid || e.id + '@zov-lesa'),
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d+/g, ''),
      property('DTSTART', e.start), property('DTEND', e.end), 'SUMMARY:' + escape(e.title));
    if (e.location) lines.push('LOCATION:' + escape(e.location));
    if (e.notes) lines.push('DESCRIPTION:' + escape(e.notes));
    if (e.url) lines.push('URL:' + escape(e.url));
    if (e.travel) lines.push('X-ZOV-TRAVEL:' + e.travel);
    if (e.repeat){
      const r = e.repeat;
      const until = r.until ? ';UNTIL=' + basic(e.start.length === 10 ? r.until : r.until + 'T23:59') : '';
      lines.push('RRULE:FREQ=' + r.freq.toUpperCase() + ';INTERVAL=' + r.every +
        (r.days?.length ? ';BYDAY=' + r.days.map(d => WEEKDAYS[d]).join(',') : '') +
        (r.monthDays?.length ? ';BYMONTHDAY=' + r.monthDays.join(',') : '') +
        (r.pos ? ';BYSETPOS=' + r.pos : '') + (r.month ? ';BYMONTH=' + r.month : '') +
        (r.count ? ';COUNT=' + r.count : until));
      for (const d of e.skip || []) lines.push(property('EXDATE', d + e.start.slice(10)));
    }
    for (const m of e.alerts || []) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escape(e.title), 'TRIGGER:' + (m ? '-PT' + m + 'M' : 'PT0M'), 'END:VALARM');
    lines.push('END:VEVENT');
  }
  return lines.concat('END:VCALENDAR', '').map(fold).join('\r\n');
}
function localInZone(d, zone){
  const fmt = new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  const target = Date.parse(d + 'Z');
  let guess = target;
  for (let i = 0; i < 3; i++){
    const p = Object.fromEntries(fmt.formatToParts(guess).map(x => [x.type, x.value]));
    const actual = Date.parse(p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + 'Z');
    if (actual === target) return local(new Date(guess));
    guess += target - actual;
  }
  throw Error('Несуществующее местное время');
}
function readDate(value, zone){
  const m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(?:\d\d)?(Z)?)?$/.exec(value);
  if (!m) throw Error('Неподдерживаемая дата');
  const d = m[1] + '-' + m[2] + '-' + m[3] + (m[4] ? 'T' + m[4] + ':' + m[5] : '');
  if (!valid(d)) throw Error('Неверная дата');
  return m[6] ? local(new Date(d + 'Z')) : zone && m[4] ? localInZone(d, zone) : d;
}
function readRepeat(value, start){
  const fields = {};
  for (const part of value.split(';')){
    const [key, item] = part.split('=');
    if (!['FREQ','INTERVAL','UNTIL','COUNT','BYDAY','WKST','BYMONTHDAY','BYSETPOS','BYMONTH'].includes(key) || !item) throw Error('Сложный повтор');
    fields[key] = item;
  }
  const freq = fields.FREQ?.toLowerCase(), every = Number(fields.INTERVAL || 1), count = Number(fields.COUNT || 0);
  if (!['daily','weekly','monthly','yearly'].includes(freq) || !Number.isInteger(every) || every < 1 ||
      !Number.isInteger(count) || count < 0 || (fields.WKST && fields.WKST !== 'MO' && (every > 1 || count))) throw Error('Сложный повтор');
  const monthly = freq === 'monthly' || freq === 'yearly';
  const byDay = fields.BYDAY?.split(',') || [], ordinals = byDay.map(d=>/^(-?[1-5])([A-Z]{2})$/.exec(d));
  const ordinal = ordinals.length === 1 ? Number(ordinals[0]?.[1]) || 0 : 0;
  const days = byDay.map((d,i) => WEEKDAYS.indexOf(ordinal ? ordinals[i][2] : d));
  const monthDays = fields.BYMONTHDAY?.split(',').map(Number) || [];
  const pos = Number(fields.BYSETPOS || ordinal), month = Number(fields.BYMONTH || 0);
  if (days.length && (days.includes(-1) || (freq !== 'weekly' && !monthly))) throw Error('Сложный повтор');
  if ((monthDays.length || pos) && (!monthly || monthDays.some(n=>!Number.isInteger(n)||!n||Math.abs(n)>31))) throw Error('Сложный повтор');
  if (!Number.isInteger(pos) || Math.abs(pos)>31 || (pos && !days.length && !monthDays.length) ||
      !Number.isInteger(month) || (fields.BYMONTH && (freq!=='yearly'||month<1||month>12))) throw Error('Сложный повтор');
  if (freq==='yearly' && (ordinal || pos || monthDays.length || days.length) && !month) throw Error('Сложный повтор');
  const until = fields.UNTIL ? dateOf(readDate(fields.UNTIL)) : '';
  if (until && until < dateOf(start)) throw Error('Неверный конец повтора');
  return {freq,every,days,until,count,monthDays,pos,month};
}
function durationMinutes(value){
  const d = /^P(?:(\d+)W|(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?)$/.exec(value);
  if(!d) throw Error('Неподдерживаемая длительность');
  const minutes=(Number(d[1]||0)*7+Number(d[2]||0))*DAY+Number(d[3]||0)*60+Number(d[4]||0)+Math.ceil(Number(d[5]||0)/60);
  if(!minutes) throw Error('Нулевая длительность');
  return minutes;
}
function importICS(source){
  if (!/^BEGIN:VCALENDAR\s*$/mi.test(source)) throw Error('Выбери файл календаря .ics');
  const items = [], rejected = [], detached = [];
  for (const [, body] of source.replace(/\r?\n[ \t]/g, '').matchAll(/^BEGIN:VEVENT\r?\n([\s\S]*?)^END:VEVENT\s*$/gmi)){
    const fields = Object.create(null), alerts = [], excluded = [];
    let inAlarm = false, unsupported = false;
    for (const line of body.split(/\r?\n/)){
      if (line === 'BEGIN:VALARM'){ inAlarm = true; continue; }
      if (line === 'END:VALARM'){ inAlarm = false; continue; }
      const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/i.exec(line);
      if (!m) continue;
      const key = m[1].toUpperCase(), value = m[3], zone = /;TZID=(?:"([^"]+)"|([^;]+))/i.exec(m[2]);
      const entry = {value, zone: zone?.[1] || zone?.[2]};
      if (inAlarm){
        const trigger = key === 'TRIGGER' && /^(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(value);
        if (trigger && (trigger[1] || !Number(trigger[2] || trigger[3] || trigger[4]))) alerts.push(Number(trigger[2] || 0) * DAY + Number(trigger[3] || 0) * 60 + Number(trigger[4] || 0));
      }else if (key === 'EXDATE') excluded.push(entry);
      else if (key === 'RDATE' || key === 'EXRULE' || (key === 'RRULE' && fields[key])) unsupported = true;
      else fields[key] = entry;
    }
    const get = key => fields[key]?.value || '';
    const title = unescape(get('SUMMARY')).trim() || 'Событие';
    try {
      const uid = get('UID') ? unescape(get('UID')) : '';
      if (get('RECURRENCE-ID') && get('STATUS') === 'CANCELLED'){
        detached.push({uid, on: dateOf(readDate(get('RECURRENCE-ID'), fields['RECURRENCE-ID']?.zone))});
        continue;
      }
      if (get('STATUS') === 'CANCELLED') continue;
      if (unsupported) throw Error('Неподдерживаемое событие');
      const start = readDate(get('DTSTART'), fields.DTSTART?.zone);
      const duration = !get('DTEND') && get('DURATION') ? durationMinutes(get('DURATION')) : start.length===10 ? DAY : 60;
      const end = get('DTEND') ? readDate(get('DTEND'), fields.DTEND?.zone) :
        start.length === 10 ? add(start, Math.ceil(duration/DAY)) : at(dateOf(start), minuteOf(start) + duration);
      if (!valid(end) || start >= end || start.length !== end.length) throw Error('Неверный интервал');
      const on = get('RECURRENCE-ID') ? dateOf(readDate(get('RECURRENCE-ID'), fields['RECURRENCE-ID']?.zone)) : '';
      if (on) detached.push({uid, on});
      const repeat = get('RRULE') ? readRepeat(get('RRULE'), start) : null;
      const skip = excluded.flatMap(x => x.value.split(',').map(v => dateOf(readDate(v, x.zone))));
      items.push({title,start,end,repeat,skip,alerts: [...new Set(alerts)].slice(0, 2),
        location: unescape(get('LOCATION')),notes: unescape(get('DESCRIPTION')),url: unescape(get('URL')),
        travel: Math.max(0, Number(get('X-ZOV-TRAVEL')) || 0),icsUid: uid && (on ? uid + '/' + on : uid)});
    } catch (_) { rejected.push(title); }
  }
  detached.forEach(({uid,on}) => { const series = uid && items.find(e => e.icsUid === uid && e.repeat); if (series && !series.skip.includes(on)) series.skip.push(on); });
  return {items,rejected};
}
B.calData = {DAY,MIN,dateOf,minuteOf,time,at,span,shifted,valid,validDate,events,occurrences,move,countBefore,previousOccurrences,exportICS,importICS};
})();
