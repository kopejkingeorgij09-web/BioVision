export const defaultPenButton = { hold: 'erase', tap: 'none', double: 'lasso' };

export function createPenButton({ settings, enabled, changed, activate }) {
  const doubleDelay = 360;
  const tapLimit = 280;
  const tapMinimum = 18;
  let pressed = false;
  let start = 0;
  let drew = false;
  let pending = null;
  let timer;

  function clearTap() {
    clearTimeout(timer);
    pending = null;
  }

  function finishTap() {
    clearTap();
    if (enabled()) activate(settings().tap, 'tap');
  }

  return {
    input(down, contact, canceled, now = performance.now()) {
      if (canceled) {
        const wasPressed = pressed;
        pressed = false;
        clearTap();
        if (wasPressed) changed();
        return;
      }
      if (down === pressed) {
        if (down && contact) drew = true;
        return;
      }
      pressed = down;
      changed();
      if (down) {
        start = now;
        drew = contact;
        if (pending !== null) {
          if (now - pending <= doubleDelay) clearTimeout(timer);
          else finishTap();
        }
        return;
      }
      if (drew || contact || !enabled()) {
        clearTap();
        return;
      }
      const duration = now - start;
      if (duration > tapLimit) {
        clearTap();
        return;
      }
      if (duration < tapMinimum) {
        if (pending !== null) timer = setTimeout(finishTap, Math.max(0, doubleDelay - (now - pending)));
        return;
      }
      if (pending !== null && start - pending <= doubleDelay) {
        clearTap();
        activate(settings().double, 'double');
      } else {
        pending = now;
        timer = setTimeout(finishTap, doubleDelay);
      }
    },
    reset() { clearTap(); },
    isPressed() { return pressed; },
    held() { return pressed ? settings().hold : 'none'; },
    use() { if (pressed) drew = true; },
  };
}
