(function () {
  const { K, esc, lectureStore, rng, $ } = BV;
  const { root } = BVHOST;
  const banks = {};

  const style = document.createElement('style');
  style.textContent = `
    .practice-group{margin:12px 0;border:1px solid var(--line);border-radius:var(--rx);padding:0 14px}
    .practice-group>summary{cursor:pointer;padding:12px 0;font-weight:650}
    .practice-group .k-q:last-child{margin-bottom:14px}
    .practice-answer{display:grid;gap:8px;margin:12px 0;color:var(--muted)}
    .practice-answer textarea,.practice-rubric select{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:var(--rx);padding:8px}
    .practice-answer textarea{width:100%;min-height:110px;resize:vertical;box-sizing:border-box}
    .practice-rubric>summary{cursor:pointer;font-weight:650}
    .practice-rubric label{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--line)}
    .practice-rubric output{display:block;margin:8px 0 0;font-weight:650}
  `;
  root.appendChild(style);

  function renderTask(id, index, [title, prompt, criteria]) {
    const key = `practice:${id}:open:${index + 1}`;
    const saved = lectureStore.get(key, {});
    const scores = criteria.map((_, i) => saved.scores?.[i] || 0);
    return `<article class="k-q" data-practice-task="${esc(key)}">
      <h4>${esc(title)}</h4>
      <p>${esc(prompt)}</p>
      <label class="practice-answer">Твой ответ<textarea rows="4">${esc(saved.answer || '')}</textarea></label>
      <details class="practice-rubric">
        <summary>Критерии самооценки</summary>
        <p>Поставь 0, если пункт пропущен, 1 за частичный ответ и 2 за полный.</p>
        ${criteria.map((criterion, i) => `<label><span>${esc(criterion)}</span><select>${[0, 1, 2].map(score =>
          `<option value="${score}"${score === scores[i] ? ' selected' : ''}>${score}</option>`
        ).join('')}</select></label>`).join('')}
        <output role="status">Самооценка · ${scores.reduce((sum, score) => sum + score, 0)} / ${criteria.length * 2}</output>
      </details>
    </article>`;
  }

  function render(id, { groups, tasks }) {
    let index = 0;
    const random = rng(Number(id.slice(1)) * 20261117);
    const count = groups.reduce((sum, group) => sum + group.questions.length, 0);
    return `<p>${count} вопросов с одним верным ответом. Выбери вариант, затем проверь себя и прочитай объяснение.</p>
      ${groups.map(({ title, questions }, groupIndex) => `<details class="practice-group"${groupIndex === 0 ? ' open' : ''}>
        <summary>${esc(title)}</summary>
        ${questions.map(([prompt, correct, first, second, third, explanation]) => {
          const options = [first, second, third].map(esc);
          const position = Math.floor(random() * (options.length + 1));
          options.splice(position, 0, esc(correct));
          return K.choice({ t: `${++index}. ${esc(prompt)}`, opts: options, ok: [position], a: esc(explanation) });
        }).join('')}
      </details>`).join('')}
      <h3>Открытые задания</h3>
      <p>Обоснуй ответ своими словами и сверь его с критериями. Текст и баллы сохраняются по мере ввода.</p>
      ${tasks.map((task, i) => renderTask(id, i, task)).join('')}`;
  }

  root.addEventListener('input', event => {
    const task = event.target.closest('[data-practice-task]');
    if (!task) return;
    const scores = Array.from(task.querySelectorAll('select'), select => Number(select.value));
    lectureStore.set(task.dataset.practiceTask, { answer: $('textarea', task).value, scores });
    $('output', task).textContent = `Самооценка · ${scores.reduce((sum, score) => sum + score, 0)} / ${scores.length * 2}`;
  });

  BV.practice = {
    register(data) { Object.assign(banks, data); },
    attach(id) {
      const sectionId = `${id}-practice`;
      if (!banks[id] || BV.KR[id].sections.some(section => section.id === sectionId)) return;
      K.sec(id, { id: sectionId, t: 'Практика', html: () => render(id, banks[id]) });
    }
  };
})();
