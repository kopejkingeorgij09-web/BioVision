const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('biovision-notes-v1', 2);
  request.onupgradeneeded = event => {
    const db = request.result;
    if (event.oldVersion < 1) {
      for (const name of ['items', 'files']) {
        const store = db.createObjectStore(name, { keyPath: ['library', 'id'] });
        store.createIndex('library', 'library');
      }
    }
    // Версия 2: индекс «запись + её версия». По нему проверяем, что запись не менялась,
    // не читая всю заметку целиком — у большой тетради это сотни миллисекунд на каждый штрих.
    if (event.oldVersion < 2) request.transaction.objectStore('items').createIndex('head', ['library', 'id', 'operation', 'revision']);
  };
  request.onsuccess = () => {
    const db = request.result;
    // Новая версия приложения в другой вкладке обновляет базу: эта вкладка уступает и просит перезагрузку.
    db.onversionchange = () => { db.close(); window.dispatchEvent(new CustomEvent('notes-db-outdated')); };
    resolve(db);
  };
  request.onerror = () => reject(request.error);
});

async function transact(names, mode, work) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error('Не удалось записать данные на устройство'));
    try {
      work(tx, value => { result = value; });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export const list = (name, library) => transact([name], 'readonly', (tx, result) => {
  const request = tx.objectStore(name).index('library').getAll(library);
  request.onsuccess = () => result(request.result);
});

export const read = (name, library, id) => transact([name], 'readonly', (tx, result) => {
  const request = tx.objectStore(name).get([library, id]);
  request.onsuccess = () => result(request.result);
});

export const put = (name, value) => transact([name], 'readwrite', tx => {
  tx.objectStore(name).put(value);
});

// expected — { operation, revision, record }: если запись в хранилище ровно этой версии,
// кладём record без чтения заметки. Иначе читаем и вызываем mutate, как обычно.
export function edit(library, id, mutate, file, expected) {
  return transact(file ? ['items', 'files'] : ['items'], 'readwrite', (tx, result) => {
    const items = tx.objectStore('items');
    const full = () => {
      const request = items.get([library, id]);
      request.onsuccess = () => apply(request);
    };
    const head = expected && typeof expected.revision === 'number' && typeof expected.operation === 'string'
      && items.indexNames.contains('head');
    if (head) {
      const count = items.index('head').count([library, id, expected.operation, expected.revision]);
      count.onsuccess = () => {
        if (count.result !== 1) { full(); return; }
        items.put(expected.record);
        if (file) tx.objectStore('files').put(file);
        result(expected.record);
      };
    } else full();
    function apply(request) {
      try {
        const next = mutate(request.result);
        if (!next) return;
        items.put(next);
        if (file) tx.objectStore('files').put(file);
        result(next);
      } catch {
        tx.abort();
      }
    }
  });
}

export const fromServer = (library, row) => ({
  library, id: row.id, data: row.data, deleted: row.deleted, revision: row.revision,
  operation: row.operation_id, modified: Date.parse(row.updated_at), pending: false,
});

export function mergeRemote(library, remote) {
  return edit(library, remote.id, current => {
    if (current?.pending || current?.revision >= remote.revision) return;
    return fromServer(library, remote);
  });
}

export function acknowledge(library, sent, remote) {
  return edit(library, sent.id, current => {
    if (!current || current.revision > remote.revision) return;
    if (current.operation === sent.operation) return fromServer(library, remote);
    if (current.revision === sent.revision) return { ...current, revision: remote.revision };
  });
}

export function preserveConflict(library, sent, remote) {
  return transact(['items'], 'readwrite', (tx, result) => {
    const items = tx.objectStore('items');
    const request = items.get([library, sent.id]);
    request.onsuccess = () => {
      const current = request.result;
      if (!current?.pending || current.revision !== sent.revision) return;
      const id = crypto.randomUUID();
      const copy = {
        ...current, id, revision: 0, operation: crypto.randomUUID(), deleted: false,
        data: {
          ...current.data, title: `${current.data.title} · локальная версия`,
          conflict: { original: sent.id, wasDeleted: current.deleted },
        },
      };
      items.put(copy);
      items.put(fromServer(library, remote));
      result(copy);
    };
  });
}
