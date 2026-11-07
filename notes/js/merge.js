// Трёхстороннее слияние данных заметки.
// base — версия, от которой построена правка; ours — правка; theirs — то, что уже лежит в хранилище.
// Массивы объектов с id (страницы, штрихи, поля, вложения) сливаются поэлементно:
// наши добавления и удаления применяются к их версии, изменённый нами элемент берётся наш.
// Остальные значения: если мы их не меняли, берём их версию, иначе нашу.

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const keyed = value => Array.isArray(value) && value.length > 0 && value.every(entry => entry && typeof entry === 'object' && typeof entry.id === 'string');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function mergeList(base = [], ours = [], theirs = []) {
  const baseById = new Map(base.map(entry => [entry.id, entry]));
  const oursById = new Map(ours.map(entry => [entry.id, entry]));
  const theirsById = new Map(theirs.map(entry => [entry.id, entry]));
  const result = [];
  for (const entry of theirs) {
    const before = baseById.get(entry.id);
    const mine = oursById.get(entry.id);
    if (before && !mine) continue; // удалили мы
    if (!mine) { result.push(entry); continue; } // добавили они
    result.push(before ? mergeValue(before, mine, entry) : mergeValue(undefined, mine, entry));
  }
  // Наши новые элементы ставим после ближайшего предшественника из нашей версии.
  let anchor = -1;
  for (const entry of ours) {
    const at = result.findIndex(item => item.id === entry.id);
    if (at >= 0) { anchor = at; continue; }
    if (baseById.has(entry.id)) continue; // они удалили, мы не меняли или меняли — удаление побеждает, если мы не трогали
    result.splice(anchor + 1, 0, entry);
    anchor += 1;
  }
  // Элемент удалён ими, но изменён нами: сохраняем нашу правку, чтобы не потерять работу.
  for (const entry of ours) {
    const before = baseById.get(entry.id);
    if (before && !theirsById.has(entry.id) && !same(before, entry)) result.push(entry);
  }
  return result;
}

export function mergeValue(base, ours, theirs) {
  if (same(ours, theirs)) return theirs;
  if (base !== undefined && same(base, ours)) return theirs;
  if (base !== undefined && same(base, theirs)) return ours;
  if ((keyed(ours) || keyed(theirs) || keyed(base)) && [base ?? [], ours ?? [], theirs ?? []].every(Array.isArray)) {
    return mergeList(base ?? [], ours ?? [], theirs ?? []);
  }
  if (plain(ours) && plain(theirs)) {
    const result = {};
    const before = plain(base) ? base : {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(ours)])) {
      const inOurs = key in ours, inTheirs = key in theirs, inBase = key in before;
      if (!inOurs && inBase && same(before[key], theirs[key])) continue; // удалили мы
      if (!inTheirs && inBase && same(before[key], ours[key])) continue; // удалили они
      if (!inOurs) { result[key] = theirs[key]; continue; }
      if (!inTheirs) { result[key] = ours[key]; continue; }
      result[key] = mergeValue(inBase ? before[key] : undefined, ours[key], theirs[key]);
    }
    return result;
  }
  return ours; // настоящее противоречие одного значения: последняя правка на этом устройстве
}

export const mergeNote = (base, ours, theirs) => mergeValue(base, ours, theirs);

// Правило записи на устройстве. existing — запись в хранилище, base — версия, от которой построена правка,
// local — сама правка. Возвращает запись для сохранения и признак слияния.
export function rebase(existing, base, local, newOperation = () => crypto.randomUUID()) {
  if (!existing || existing.operation === base.operation) {
    return { record: { ...local, revision: existing?.revision ?? 0 }, merged: false };
  }
  return {
    merged: true,
    record: {
      ...local, operation: newOperation(), revision: existing.revision,
      pending: local.pending || Boolean(existing.pending),
      data: mergeNote(base.data, local.data, existing.data),
    },
  };
}
