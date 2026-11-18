function prepareLesson(ev,day,preset={}){
  if(!T())return;
  const batch=S.db.collection('tasks').doc().id, eid=ev?.id || S.db.collection('events').doc().id;
  const d={title:ev?.title||'',date:day||today(),start:ev?.start||preset.start||'',subject:ev?.subject||'bio',
    to:[...(ev?.to||[])],q:'',quizDue:'',written:'',writtenDue:'',max:'',quizTitle:'',writtenTitle:''};
  let file=null, fileId=null, uploaded=false, packet=null, publishing=false;
  function edit(){
    openDlg(`<h2>Подготовить урок</h2>${ev?`<p><b>${esc(ev.title)}</b> · ${fmtDayW(day)} · ${esc(d.to.map(name).join(', ')||'без учениц')}</p>`:`
      <label>Тема урока<input name="title" maxlength="100" value="${esc(d.title)}"></label>
      <div class="row"><label class="grow">Дата<input name="date" type="date" value="${esc(d.date)}"></label><label>Начало<input name="start" type="time" value="${esc(d.start)}"></label></div>
      <label>Предмет<select name="subject">${subjOptions(d.subject)}</select></label>${toBox(new Set(d.to))}`}
      <label>Конспект PDF<input name="bundleFile" type="file" accept="application/pdf,.pdf"></label><small data-filename>${esc(file?.name||'')}</small>
      <fieldset><legend>Тест с самопроверкой</legend><label>Название<input name="quizTitle" value="${esc(d.quizTitle)}" placeholder="Тест по теме урока"></label>
      <label>Вопросы<textarea name="q" rows="5" placeholder="${esc('? Назовите ткань крови\n= соединительная')}">${esc(d.q)}</textarea></label>
      <details><summary>Как записать вопросы и ключ</summary><pre style="white-space:pre-wrap">${esc(TEST_HINT)}</pre></details>
      <label>Срок теста<input type="date" name="quizDue" value="${esc(d.quizDue)}"></label></fieldset>
      <fieldset><legend>Письменная работа</legend><label>Название<input name="writtenTitle" value="${esc(d.writtenTitle)}" placeholder="Письменная работа по теме урока"></label>
      <label>Задания<textarea name="written" rows="4">${esc(d.written)}</textarea></label><div class="row"><label class="grow">Срок работы<input type="date" name="writtenDue" value="${esc(d.writtenDue)}"></label><label>Макс. балл<input type="number" name="max" min="0" value="${esc(d.max)}"></label></div></fieldset>
      <p class="err" role="alert"></p><div class="actions"><button class="btn ghost" data-dact="cancel">Отмена</button><button class="btn" data-dact="preview">Как увидит ученица</button></div>`,
      {cancel:closeDlg,preview:()=>{
        for(const key of Object.keys(d)){if(key!=='to' && $('#dlgbox').querySelector(`[name="${key}"]`))d[key]=fv(key).trim();}
        if(!ev)d.to=fvAll('to');
        if(!d.title||!d.date)return dlgErr('Укажите тему и дату урока.');
        if(!d.to.length)return dlgErr('Выберите ученицу для публикации урока.');
        const parsed=parseTest(d.q);
        if(d.q && (!parsed.qs.length || parsed.errs.length || parsed.qs.some(q=>!q.text.trim())))return dlgErr(parsed.errs[0]||'Проверьте текст вопросов.');
        if(!d.q && (d.quizTitle || d.quizDue))return dlgErr('Добавьте вопросы теста.');
        if(!d.written && (d.writtenTitle || d.writtenDue || d.max))return dlgErr('Добавьте задания письменной работы.');
        if(d.max && (!Number.isFinite(+d.max)||+d.max<0))return dlgErr('Проверьте максимальный балл.');
        if(!file && !d.q && !d.written)return dlgErr('Добавьте конспект или домашнее задание.');
        const tasks=[];
        if(d.q)tasks.push({kind:'test',title:d.quizTitle||'Тест · '+d.title,q:parsed.qs,due:d.quizDue});
        if(d.written)tasks.push({kind:'task',title:d.writtenTitle||'Письменная работа · '+d.title,body:d.written,due:d.writtenDue,max:d.max?+d.max:null});
        packet={batch,eventId:eid,day:d.date,to:d.to,tasks};
        if(!ev)packet.event={title:d.title,date:d.date,start:d.start,subject:d.subject,to:d.to};
        if(file)packet.file={id:fileId,name:file.name,type:'application/pdf'};
        preview();
      }});
    $('#dlgbox [name=bundleFile]').onchange=e=>{
      const selected=e.target.files[0];if(!selected)return;
      try{if(fileType(selected)!=='application/pdf')throw Error();S.assets.validate(selected,'application/pdf');}
      catch{e.target.value='';return dlgErr('Выберите PDF размером до 20 МБ.');}
      file=selected;fileId=S.assets.newId();uploaded=false;$('#dlgbox [data-filename]').textContent=file.name;dlgErr('');
    };
  }
  function preview(){
    const existing=ev?evFiles(ev,day):[], prior=ev?lessonTasks(ev,day):[];
    openDlg(`<h2>Как увидит ${esc(d.to.map(name).join(', '))}</h2><article class="lesson-card"><h3>${esc(d.title)}</h3><p>${fmtDayW(d.date)}${d.start?' · '+esc(d.start):''}</p>
      ${[...existing,...(file?[file]:[])].map(f=>`<p>Конспект · ${esc(f.name)}</p>`).join('')}
      ${[...prior,...packet.tasks].map(t=>`<div class="lesson-task"><span><b>${esc(t.title)}</b><small>${t.kind==='test'?`Тест · ${(t.q||[]).length} вопросов`:'Письменная работа'} · ${t.due?'до '+fmtDay(t.due):'без срока'}</small></span></div>`).join('')}</article>
      <p class="err" role="status"></p><div class="actions"><button class="btn ghost" data-dact="edit">Изменить</button><button class="btn" data-dact="publish">Опубликовать урок</button></div>`,
      {edit, publish:async()=>{
        if(publishing)return;
        publishing=true;
        const editButton=$('#dlgbox [data-dact=edit]');editButton.disabled=true;
        try{
          if(file && !uploaded){dlgErr('Загружается PDF…');await S.assets.upload(file,{id:fileId,type:'application/pdf'});uploaded=true;}
          dlgErr('Публикуется урок…');await S.db.publishLesson(packet);
          S.calDay=d.date;S.calMonth=null;S.view='cal';closeDlg();openOcc('ev',eid,d.date);toast('Урок опубликован');
        }catch(e){dlgErr(e.message?.includes('lesson changed')?'Занятие изменилось. Откройте его из календаря ещё раз.':'Публикация не подтверждена. Повторите с теми же материалами.');}
        finally{publishing=false;}
      }});
  }
  edit();
}
