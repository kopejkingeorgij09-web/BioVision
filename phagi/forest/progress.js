/* Personal forest rewards. The existing srs/<uid> rules cover this collection. */
window.PhagiForestProgress = (() => {
  'use strict';

  const CARD_POINTS = 1;
  const HOMEWORK_POINTS = 10;
  const homeworkDoc = task => 'hw-' + task;
  const isCardDay = id => /^cards-\d{4}-\d{2}-\d{2}$/.test(id);
  const isHomeworkDoc = id => /^hw-[\w.~:@+-]+$/.test(id);
  const hasClaim = (doc, key) => key === null ? !!doc : doc?.cards?.[key] === true;

  function connect(db, uid, { change, reward, loaded }) {
    const collection = db.collection(`srs/${uid}/forest`);
    const modeKey = 'ph-forest-mode:' + uid;
    const outboxKey = 'ph-forest-outbox:' + uid + ':';
    const docs = new Map();
    const queue = new Map();
    let mode = 'bacteria';
    let ready = false;
    let busy = false;
    let timer = null;
    let delay = 1000;
    let cards = 0;
    let assignments = 0;

    function accept(id, data) {
      if (!data || !Number.isSafeInteger(data.rev) || data.rev < 1) return;
      const previous = docs.get(id);
      if (previous && previous.rev >= data.rev) return;
      if (isCardDay(id)) {
        cards += Object.keys(data.cards || {}).length - Object.keys(previous?.cards || {}).length;
      } else if (isHomeworkDoc(id) && !previous) assignments++;
      docs.set(id, data);
    }

    function forget(claim) {
      queue.delete(claim.storageKey);
      try { localStorage.removeItem(claim.storageKey); } catch {}
    }

    function enqueue(id, key, origin, play = true) {
      if (hasClaim(docs.get(id), key)) return;
      const storageKey = outboxKey + JSON.stringify([id, key]);
      if (queue.has(storageKey)) return;
      queue.set(storageKey, { id, key, storageKey, origin, play });
      try { localStorage.setItem(storageKey, '1'); } catch {}
      schedule(90);
    }

    function restore() {
      try {
        if (localStorage.getItem(modeKey) === 'forest') mode = 'forest';
        for (const storageKey of Object.keys(localStorage)) {
          if (!storageKey.startsWith(outboxKey)) continue;
          let parts;
          try { parts = JSON.parse(storageKey.slice(outboxKey.length)); } catch { continue; }
          if (!Array.isArray(parts)) continue;
          const [id, key] = parts;
          if (!(isHomeworkDoc(id) && key === null) && !(isCardDay(id) && typeof key === 'string')) continue;
          queue.set(storageKey, { id, key, storageKey, play: false });
        }
      } catch {}
    }

    function schedule(ms) {
      if (!ready || busy || !queue.size) return;
      clearTimeout(timer);
      timer = setTimeout(flush, ms);
    }

    async function flush() {
      const next = queue.values().next().value;
      if (busy || !next) return;
      busy = true;
      const batch = [...queue.values()].filter(claim => claim.id === next.id);
      const ref = collection.doc(next.id);
      let doc = docs.get(next.id) || null;
      let earned = [];
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const fresh = batch.filter(({ key }) => !hasClaim(doc, key));
          if (!fresh.length) break;
          const update = { rev: (doc?.rev || 0) + 1, op: crypto.randomUUID() };
          if (isCardDay(next.id)) {
            update.cards = { ...doc?.cards };
            for (const { key } of fresh) update.cards[key] = true;
          }
          const result = await ref.setIfCurrent(doc, update);
          if (result.ok) {
            doc = update;
            earned = fresh;
            break;
          }
          doc = result.cur;
        }
        accept(next.id, doc);
        const saved = docs.get(next.id);
        for (const claim of batch) if (hasClaim(saved, claim.key)) forget(claim);
        delay = batch.some(claim => queue.has(claim.storageKey)) ? Math.min(delay * 2, 30000) : 1000;
        change();
        for (const claim of earned) {
          if (claim.play && mode === 'forest') reward(claim.key === null ? HOMEWORK_POINTS : CARD_POINTS, claim.origin);
        }
      } catch (error) {
        console.warn('Forest reward sync', error);
        delay = Math.min(delay * 2, 30000);
      } finally {
        busy = false;
        schedule(delay === 1000 ? 90 : delay);
      }
    }

    function subscribe() {
      const unsubscribe = collection.onSnapshot(snapshot => {
        snapshot.docs.forEach(doc => accept(doc.id, doc.data()));
        const wasReady = ready;
        ready = true;
        if (!wasReady) loaded();
        change();
        schedule(90);
      }, () => {
        unsubscribe();
        setTimeout(subscribe, 5000);
      });
    }

    restore();
    subscribe();
    window.addEventListener('online', () => schedule(0));
    return {
      get mode() { return mode; },
      get ready() { return ready; },
      get points() { return cards * CARD_POINTS + assignments * HOMEWORK_POINTS; },
      setMode(value) {
        mode = value === 'forest' ? 'forest' : 'bacteria';
        try { localStorage.setItem(modeKey, mode); } catch {}
        change();
      },
      card(day, deck, card, origin) {
        enqueue('cards-' + day, JSON.stringify([String(deck), String(card)]), origin);
      },
      homework(task, origin, play = true) {
        const id = homeworkDoc(task);
        if (isHomeworkDoc(id)) enqueue(id, null, origin, play);
      }
    };
  }

  return { CARD_POINTS, HOMEWORK_POINTS, connect };
})();
