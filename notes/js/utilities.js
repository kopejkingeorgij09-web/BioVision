import { button, element } from './text.js';

export function calculate(input) {
  const expression = input.replaceAll(',', '.').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replace(/\s/g, '');
  if (!expression || expression.length > 140) throw new Error('Введи выражение до 140 символов');
  let offset = 0;
  function take(symbol) {
    if (expression[offset] !== symbol) return false;
    offset++;
    return true;
  }
  function atom() {
    if (take('+')) return atom();
    if (take('-')) return -atom();
    if (take('(')) {
      const value = sum();
      if (!take(')')) throw new Error('Закрой скобку');
      return value;
    }
    const number = expression.slice(offset).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)?.[0];
    if (!number) throw new Error('Проверь выражение');
    offset += number.length;
    return Number(number);
  }
  function product() {
    let value = atom();
    for (;;) {
      if (take('*')) value *= atom();
      else if (take('/')) value /= atom();
      else return value;
    }
  }
  function sum() {
    let value = product();
    for (;;) {
      if (take('+')) value += product();
      else if (take('-')) value -= product();
      else return value;
    }
  }
  const result = sum();
  if (offset !== expression.length) throw new Error('Проверь выражение');
  if (!Number.isFinite(result)) throw new Error('Результат не определён');
  return Number(result.toPrecision(12));
}

const modes = { calculator: 'Калькулятор', stopwatch: 'Секундомер', timer: 'Таймер' };
const storage = 'biovision-notes-utilities';
const format = seconds => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
  .map(value => String(value).padStart(2, '0')).join(':');

export function createUtilities(panel, chip, notify) {
  let restored;
  try { restored = JSON.parse(localStorage.getItem(storage)); } catch { /* Optional storage. */ }
  const timer = { duration: 300000, remaining: 300000, until: 0, ...restored?.timer };
  const watch = { elapsed: 0, since: 0, ...restored?.watch };
  let mode = 'calculator', expression = '', result = '';
  let updatePanel = () => {};
  let interval;

  function save() {
    try { localStorage.setItem(storage, JSON.stringify({ timer, watch })); } catch { /* Optional storage. */ }
  }
  function tick() {
    const now = Date.now();
    if (timer.until && now >= timer.until) {
      timer.remaining = timer.until = 0;
      save();
      notify('Таймер завершён');
      navigator.vibrate?.([170, 80, 170]);
    }
    const remaining = timer.until ? timer.until - now : timer.remaining;
    const elapsed = watch.elapsed + (watch.since ? Math.max(0, now - watch.since) : 0);
    chip.hidden = !panel.hidden || (!timer.until && !watch.since);
    const chipMode = timer.until ? 'timer' : 'stopwatch';
    chip.textContent = modes[chipMode] + ' · ' + format(chipMode === 'timer' ? Math.ceil(remaining / 1000) : Math.floor(elapsed / 1000));
    chip.setAttribute('aria-label', 'Открыть ' + modes[chipMode].toLowerCase());
    if (!panel.hidden) updatePanel(remaining, elapsed);
    if (timer.until || watch.since) interval ??= setInterval(tick, 200);
    else { clearInterval(interval); interval = undefined; }
  }

  function renderCalculator() {
    const field = element('input');
    field.type = 'text';
    field.autocomplete = 'off';
    field.maxLength = 140;
    field.value = expression;
    field.setAttribute('aria-label', 'Выражение');
    field.oninput = () => { expression = field.value; };
    const output = element('output', result, 'utility-output');
    const calculateNow = () => {
      try { result = String(calculate(expression)); }
      catch (error) { result = error.message; }
      output.textContent = result;
    };
    field.onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); calculateNow(); }
    };
    const keys = element('div', undefined, 'calculator-keys');
    for (const key of ['(', ')', '⌫', 'C', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', ',', '=', '+']) {
      keys.append(button(key, () => {
        if (key === '=') { calculateNow(); return; }
        if (key === 'C') { expression = result = output.textContent = ''; }
        else if (key === '⌫') expression = expression.slice(0, -1);
        else if (expression.length < 140) expression += key;
        field.value = expression;
      }, key === '=' ? 'primary' : undefined));
    }
    panel.append(field, output, keys);
  }

  function renderClock(countdown) {
    const time = element('output', '00:00:00', 'utility-time');
    time.setAttribute('role', 'timer');
    const form = element('form', undefined, 'timer-form');
    const fields = [0, 1, 2].map((index) => {
      const [hours, minutes, seconds] = format(timer.duration / 1000).split(':');
      const input = element('input');
      input.type = 'number';
      input.min = 0;
      input.max = index ? 59 : 99;
      input.required = true;
      input.value = [hours, minutes, seconds][index];
      const title = ['Часы', 'Минуты', 'Секунды'][index];
      const label = element('label', title);
      label.append(input);
      if (countdown) form.append(label);
      return input;
    });
    function startOrPause() {
      const now = Date.now();
      if (countdown) {
        if (timer.until) { timer.remaining = Math.max(0, timer.until - now); timer.until = 0; }
        else {
          if (!form.reportValidity()) return;
          const duration = fields.reduce((total, field) => total * 60 + field.valueAsNumber, 0) * 1000;
          if (!duration) { notify('Укажи длительность таймера'); return; }
          if (duration !== timer.duration || !timer.remaining) timer.remaining = duration;
          timer.duration = duration;
          timer.until = now + timer.remaining;
        }
      } else if (watch.since) { watch.elapsed += Math.max(0, now - watch.since); watch.since = 0; }
      else watch.since = now;
      save();
      tick();
    }
    const toggle = button('Старт', startOrPause, 'primary');
    form.onsubmit = event => { event.preventDefault(); startOrPause(); };
    const reset = button('Сбросить', () => {
      if (countdown) { timer.until = 0; timer.remaining = timer.duration; }
      else watch.since = watch.elapsed = 0;
      save();
      tick();
    });
    const actions = element('div', undefined, 'utility-actions');
    actions.append(toggle, reset);
    panel.append(time);
    if (countdown) panel.append(form);
    panel.append(actions);
    updatePanel = (remaining, elapsed) => {
      time.textContent = format(countdown ? Math.ceil(remaining / 1000) : Math.floor(elapsed / 1000));
      const running = countdown ? timer.until : watch.since;
      toggle.textContent = running ? 'Пауза' : (countdown ? remaining && remaining !== timer.duration : elapsed) ? 'Продолжить' : 'Старт';
      for (const field of fields) field.disabled = Boolean(running);
    };
  }

  function open(next = mode) {
    mode = next;
    panel.hidden = false;
    updatePanel = () => {};
    const head = element('div', undefined, 'utility-head');
    head.append(element('strong', 'Инструменты'));
    const dismiss = button('×', close);
    dismiss.setAttribute('aria-label', 'Свернуть инструменты');
    head.append(dismiss);
    const tabs = element('div', undefined, 'utility-tabs');
    for (const [id, name] of Object.entries(modes)) {
      const tab = button(name, () => open(id));
      tab.setAttribute('aria-pressed', String(id === mode));
      tabs.append(tab);
    }
    panel.replaceChildren(head, tabs);
    if (mode === 'calculator') renderCalculator();
    else renderClock(mode === 'timer');
    tick();
    tabs.querySelector('[aria-pressed="true"]').focus();
  }
  function close() {
    if (panel.hidden) return false;
    panel.hidden = true;
    tick();
    if (!chip.hidden) chip.focus();
    return true;
  }
  chip.onclick = () => open(timer.until ? 'timer' : 'stopwatch');
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
  return { open, close };
}
