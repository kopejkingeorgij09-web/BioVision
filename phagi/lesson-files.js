/* Persist the selected bytes and destination together, before the first network request. */
const lessonFiles = (() => {
  let database, running = false, again = false, retryTimer, delay = 2000;

  function openQueue() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('phagi-lesson-uploads', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('files', {keyPath: 'id'}).createIndex('owner', 'owner');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
    return database;
  }

  async function transaction(mode, action) {
    const db = await openQueue();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      tx.onabort = () => reject(tx.error || Error('Не удалось сохранить загрузку на устройстве'));
      const request = action(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request && request.result);
    });
  }

  async function attach(job) {
    if (!T() || meId() !== job.owner) return false;
    let info = await S.assets.info(job.id);
    if (!info) info = await S.assets.upload(job.file, {type: job.type, id: job.id});
    await S.db.changeOccurrenceFile(job.event, job.day, {
      action: 'add', id: job.id, file: {id: job.id, name: job.file.name, type: info.contentType}
    });
    return true;
  }

  function refresh(event, day) {
    if ($('#dlg').open && occCtx?.ev.id === event && occCtx.date === day) openOcc('ev', event, day);
    render();
  }

  async function send(id) {
    const job = await transaction('readonly', store => store.get(id));
    if (!job || !T() || job.owner !== meId()) return;
    try {
      if (!await attach(job)) return;
    } catch (error) {
      if (['too_large','unsupported_type'].includes(error.code) || error.message === 'missing') {
        await transaction('readwrite', store => store.delete(id));
        if (error.message === 'missing') toast('Урок удалён. Файл не прикреплён.');
        else uplErr(error);
        return;
      }
      throw error;
    }
    await transaction('readwrite', store => store.delete(id));
    refresh(job.event, job.day);
    toast('К уроку прикреплён файл «'+job.file.name+'»');
  }

  async function resume() {
    if (!T() || !S.assets) return;
    if (running) { again = true; return; }
    clearTimeout(retryTimer);
    running = true;
    let failed = false;
    try {
      const ids = await transaction('readonly', store => store.index('owner').getAllKeys(meId()));
      for (const id of ids) {
        try {
          if (navigator.locks) await navigator.locks.request('phagi-upload:'+id, () => send(id));
          else await send(id);
        } catch (error) {
          failed = true;
          if (delay === 2000) toast('Файл сохранён на устройстве. Прикрепление к уроку будет повторено.');
        }
      }
    } catch (error) {
      // New uploads fall back to direct transfer if the browser disables IndexedDB.
      console.warn('Очередь файлов урока недоступна', error);
    } finally {
      running = false;
      if (again || failed) retryTimer = setTimeout(resume, again ? 0 : delay);
      delay = failed ? Math.min(delay * 2, 60000) : 2000;
      again = false;
    }
  }

  async function enqueue(event, day, files) {
    const jobs = files.map(file => ({
      owner: meId(), id: S.assets.newId(), event, day, type: fileType(file), file
    }));
    try {
      await transaction('readwrite', store => { for (const job of jobs) store.add(job); });
    } catch (error) {
      toast('Очередь на устройстве недоступна. Оставьте вкладку открытой до окончания загрузки.');
      for (const job of jobs) {
        try { if (await attach(job)) { refresh(event,day); toast('К уроку прикреплён файл «'+job.file.name+'»'); } }
        catch (e) { uplErr(e); }
      }
      return;
    }
    toast('Прикрепляю '+(jobs.length === 1 ? 'файл к уроку…' : 'файлы к уроку…'));
    await resume();
  }

  window.addEventListener('online', () => { if (typeof S !== 'undefined') resume(); });
  return {enqueue, resume};
})();
