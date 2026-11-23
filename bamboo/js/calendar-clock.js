/* Красная линия следует местным часам устройства, включая смену даты в полночь. */
B.mountCalendarClock = function(root){
  const tick = 10000;
  const mark = document.createElement('span');
  mark.className = 'ac-now';
  mark.setAttribute('aria-hidden','true');
  let day = '', column = null, timer;
  function refresh(){
    clearTimeout(timer);
    if (document.hidden || !root.isConnected) return;
    const now = new Date(), key = B.ymd(now);
    if (key !== day){
      day = key;
      column = root.querySelector('.ac-col[data-col="'+day+'"]');
      for (const [selector,field] of [['.ac-col','col'],['.ac-allday','all'],['.ac-head button','d']]){
        root.querySelectorAll(selector).forEach(el => el.classList.toggle('now',el.dataset[field]===day));
      }
      if (column) column.append(mark); else mark.remove();
    }
    if (column){
      const seconds = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds() + now.getMilliseconds()/1000;
      mark.style.top = (seconds/86400*100)+'%';
    }
    timer = setTimeout(refresh,tick - now.getTime()%tick);
  }
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  window.addEventListener('pageshow',refresh);
  window.addEventListener('zov-clock-resume',refresh);
  refresh();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange',refresh);
    window.removeEventListener('focus',refresh);
    window.removeEventListener('pageshow',refresh);
    window.removeEventListener('zov-clock-resume',refresh);
  };
};
