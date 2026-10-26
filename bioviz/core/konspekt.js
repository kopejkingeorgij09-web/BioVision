/* Движок конспектов БиоВиза: разметка разделов, интерактивные рисунки, задания, оглавление.
   Извлечён из прежнего bioviz/bv.js и отформатирован. API: BV.K.doc, BV.K.sec, BV.K.init, BV.K.fig, K.box, K.tbl…
   и BV.K.open(id) — нарисовать конспект id в контейнере #m-<id> .k-doc. Подробнее: content/README.md. */
(function () {
  const { $: t, $$: e, esc: a, hooks: o, reduced: l, store: n, clamp: i } = BV,
    s = (BV.K = {}),
    r = (BV.KR = {}),
    c = {},
    d = {},
    h = {};
  let f = null;
  ((s.doc = (t, e) => {
    r[t] = Object.assign(r[t] || { sections: [] }, e, {
      sections: ((r[t] && r[t].sections) || []).concat(e.sections || []),
    });
  }),
    (s.sec = (t, e) => {
      (r[t] = r[t] || { sections: [] }).sections.push(e);
    }),
    (s.init = (t, e) => {
      c[t] = e;
    }));
  function p(o) {
    const l = t(".kf-st", o),
      n = t("svg", l),
      i = t(".kf-info", o);
    let s = null;
    const r = (l) => {
      ((s = s === l ? null : l),
        e(".kf-b", o).forEach((t) =>
          t.classList.toggle("on", t.dataset.n === s),
        ),
        e(".kf-leg li", o).forEach((t) =>
          t.classList.toggle("on", t.dataset.n === s),
        ));
      const r = s ? e(`[data-k~="${s}"]`, n) : [];
      (e("[data-k].on", n).forEach((t) => t.classList.remove("on")),
        r.forEach((t) => t.classList.add("on")),
        n.classList.toggle("kf-hl", !!r.length));
      const c = s && ((e) => t(`.kf-leg li[data-n="${e}"]`, o))(s);
      if (
        (c &&
          o.classList.contains("quiz") &&
          !c.classList.contains("shown") &&
          (c.classList.add("shown"), d()),
        i && c)
      ) {
        const e = c.dataset.d;
        i.innerHTML = `${t("i.ch", c) ? "" : `<b>${a(s)}</b> · `}${t("span", c).innerHTML}${e ? ` <span style="color:var(--muted)">· ${e}</span>` : ""}`;
      } else i && !o.dataset.keepInfo && (i.innerHTML = "");
      o._onPick && o._onPick(s);
    };
    ((o._pick = r),
      o.addEventListener("click", (t) => {
        const a = t.target.closest(".kf-b,.kf-leg li");
        if (a) return void r(a.dataset.n);
        const l = t.target.closest("[data-k]");
        if (l && n.contains(l)) r(l.getAttribute("data-k").split(" ")[0]);
        else if (t.target.closest(".kf-zoom"))
          u(o, !o.classList.contains("full"));
        else if (t.target.closest(".kf-qb")) {
          const a = o.classList.toggle("quiz");
          (e(".kf-leg li", o).forEach((t) => t.classList.remove("shown")),
            (t.target.textContent = a
              ? "Показать все подписи"
              : "Проверь себя: спрятать подписи"),
            d(),
            s && r(s));
        }
      }));
    const c = t(".kf-qs", o);
    function d() {
      if (!c) return;
      const t = e(".kf-leg li", o),
        a = t.filter((t) => t.classList.contains("shown"));
      c.textContent = o.classList.contains("quiz")
        ? `Называй структуру, потом нажимай номер: открыто ${a.length} из ${t.length}`
        : "";
    }
    o.addEventListener("keydown", (t) => {
      "Escape" === t.key &&
        o.classList.contains("full") &&
        (t.stopPropagation(), u(o, !1));
    });
  }
  ((s.tbl = (t, e, a = "") => {
    const o = t && t.length >= 3 && !/k-nostk/.test(a);
    return `<div class="k-tw${o ? " k-stk" : ""}"><table class="k-t ${a}">${t ? `<thead><tr>${t.map((t) => `<th>${t}</th>`).join("")}</tr></thead>` : ""}<tbody>${e
      .map(
        (e) =>
          `<tr${e.k ? ` data-row="${e.k}"` : ""}>${(e.c || e)
            .map((e, a) => {
              return `<td${
                o && a && t[a]
                  ? ` data-l="${
                      ((l = t[a]),
                      String(l)
                        .replace(/<[^>]+>/g, "")
                        .replace(/"/g, "&quot;")
                        .trim())
                    }"`
                  : ""
              }>${e}</td>`;
              var l;
            })
            .join("")}</tr>`,
      )
      .join("")}</tbody></table></div>`;
  }),
    (s.box = (t, e, a) => `<div class="k-box k-${t}"><b>${e}</b>${a}</div>`),
    (s.ol = (t) => s.box("ol", "На олимпиаде", t)),
    (s.trap = (t, e = "Ловушка") => s.box("tr", e, t)),
    (s.ex = (t, e = "Пример расчёта") => s.box("ex", e, t)),
    (s.deep = (t, e = "Глубже, для олимпиады") => s.box("deep", e, t)),
    (s.rng = (t, e, a, o, l, n, i = "") =>
      `<div class="k-rng"><label for="${t}">${e}: <b id="${t}-v">${n}${i}</b></label><input type="range" id="${t}" min="${a}" max="${o}" step="${l}" value="${n}"></div>`),
    (s.seg = (t, e, a) =>
      `<div class="seg" role="group" id="${t}">${e.map(([t, e]) => `<button data-v="${t}" aria-pressed="${t === a}">${e}</button>`).join("")}</div>`),
    (s.segOn = (a, o, l) => {
      const n = t("#" + o, a);
      n &&
        n.addEventListener("click", (t) => {
          const a = t.target.closest("button[data-v]");
          a &&
            (e("button", n).forEach((t) =>
              t.setAttribute("aria-pressed", String(t === a)),
            ),
            l(a.dataset.v));
        });
    }),
    (s.rngOn = (e, a, o, l) => {
      const n = t("#" + a, e),
        i = t("#" + a + "-v", e);
      if (!n) return;
      const s = () => {
        const t = +n.value;
        (i && (i.textContent = l ? l(t) : t), o(t));
      };
      (n.addEventListener("input", s), s());
    }),
    (s.pg = (t) =>
      `<div class="k-pg" aria-hidden="true">стр. ${t} конспекта</div>`),
    (s.fig = (t) => {
      const [e, o] = t.vb,
        l = (t, a) =>
          `left:${((t / e) * 100).toFixed(2)}%;top:${((a / o) * 100).toFixed(2)}%`,
        n = (t.marks || [])
          .filter((t) => t.length > 3 && (t[3] !== t[1] || t[4] !== t[2]))
          .map(
            ([t, a, o, l, n]) =>
              `<g class="kf-ld" data-ld="${t}"><line x1="${l}" y1="${n}" x2="${a}" y2="${o}" stroke="currentColor" stroke-width="1.1" vector-effect="non-scaling-stroke" opacity=".7"/><circle cx="${a}" cy="${o}" r="${(e / 320).toFixed(1)}" fill="currentColor" opacity=".85"/></g>`,
          )
          .join(""),
        i = (t.marks || [])
          .map((t) => {
            const [e, a, o, n = a, i = o] = t;
            return `<button class="kf-b" data-n="${e}" style="${l(n, i)}" aria-label="${e}">${e}</button>`;
          })
          .join(""),
        s = (t.lbl || [])
          .map(
            ([t, e, a, o = ""]) =>
              `<span class="kf-lbl ${o}" style="${l(t, e)}">${a}</span>`,
          )
          .join(""),
        r =
          t.leg && t.leg.length
            ? `<ol class="kf-leg">${t.leg.map(([t, e, o, l]) => `<li data-n="${t}"${o ? ` data-d="${a(o)}"` : ""}><i${l ? ' class="ch"' : ""}>${l || t}</i><span>${e}</span></li>`).join("")}</ol>`
            : "",
        c =
          t.leg && t.leg.length && !1 !== t.quiz
            ? '<div class="kf-tools"><button class="btn ghost kf-qb">Проверь себя: спрятать подписи</button><span class="hint kf-qs"></span></div>'
            : '<div class="kf-pad"></div>';
      return `<figure class="kf" id="f-${t.id}" data-fig="${t.id}">${t.ctl ? `<div class="kf-ctl">${t.ctl}</div>` : ""}\n  <div class="kf-st${t.dark ? " dark" : ""}"><svg viewBox="0 0 ${e} ${o}" role="img" aria-label="${a(t.t)}">${t.svg}<g class="kf-leads">${n}</g></svg><div class="kf-mk">${s}${i}</div>\n  <button class="kf-zoom" title="Крупнее" aria-label="Открыть рисунок крупнее"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>\n  <div class="kf-info" aria-live="polite"></div>\n  ${t.after || ""}\n  <figcaption>${t.n ? `<b>Рис. ${t.n}.</b> ` : ""}${t.t ? `<b>${t.t}.</b> ` : ""}${t.cap || ""}</figcaption>${r}${c}</figure>`;
    }));
  const g = {
    on: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    off: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  };
  function u(e, a) {
    const o = t(".kf-zoom", e);
    (e.classList.toggle("full", a),
      o &&
        ((o.innerHTML = a ? g.on : g.off),
        (o.title = a ? "Закрыть (Esc)" : "Крупнее"),
        o.setAttribute(
          "aria-label",
          a ? "Закрыть крупный рисунок" : "Открыть рисунок крупнее",
        )),
      a
        ? ((e.scrollTop = 0), o && o.focus({ preventScroll: !0 }))
        : requestAnimationFrame(() => {
            const t = e.getBoundingClientRect();
            (t.bottom < 0 || t.top > innerHeight) &&
              e.scrollIntoView({ block: "center" });
          }));
  }
  ((s.zoom = u),
    (s.steps = (t) =>
      s.fig({
        ...t,
        quiz: !1,
        ctl: `<div class="k-dots" role="group" aria-label="Шаги">${(t.steps || (b[t.id] || {}).steps || []).map((t, e) => `<button data-st="${e + 1}" aria-pressed="${0 === e}">${e + 1}</button>`).join("")}</div><span style="flex:1"></span><button class="btn ghost k-prev" aria-label="Назад">←</button><button class="btn k-play">▶ Анимация</button><button class="btn ghost k-next" aria-label="Дальше">→</button>${t.ctl || ""}`,
        after: `<div class="k-steptx"></div>${t.after || ""}`,
      })));
  const b = {};
  s.stepsReg = (t, e) => {
    b[t] = e;
  };
  let m = 0;
  function x(a) {
    const o = a.dataset.q,
      l = t(".k-res", a),
      n = t(".k-ans:last-child", a) || t(".k-ans", a),
      i = (t, e) => {
        (l &&
          ((l.className = "k-res " + (t ? "ok" : "no")),
          (l.textContent = e || (t ? "Верно" : "Есть ошибки"))),
          n && (n.hidden = !1));
      };
    if ("open" === o)
      return void t(".k-show", a).addEventListener("click", (e) => {
        const o = t(".k-ans", a);
        ((o.hidden = !o.hidden),
          (e.target.textContent = o.hidden
            ? "Показать ответ и разбор"
            : "Спрятать ответ"));
      });
    let s = [];
    a.addEventListener("click", (r) => {
      if (a.dataset.locked && !r.target.closest(".k-rst")) return;
      const c = r.target.closest(".k-opt");
      if (c && "choice" === o) {
        const t = "1" === a.dataset.multi;
        return (
          t ||
            e(".k-opt", a).forEach((t) =>
              t.setAttribute("aria-pressed", "false"),
            ),
          void c.setAttribute(
            "aria-pressed",
            String(!("true" === c.getAttribute("aria-pressed") && t)),
          )
        );
      }
      if (c && "seq" === o) {
        const e = c.dataset.i;
        if (s.includes(e)) return;
        return (
          s.push(e),
          c.setAttribute("aria-pressed", "true"),
          (t("i", c).textContent = s.length),
          void (t(".k-seqv", a).textContent = s.join(""))
        );
      }
      const d = r.target.closest(".k-mb button");
      if (d)
        e("button", d.parentNode).forEach((t) =>
          t.setAttribute("aria-pressed", String(t === d)),
        );
      else {
        if (r.target.closest(".k-chk")) {
          if (((a.dataset.locked = "1"), "choice" === o)) {
            const t = a.dataset.ok.split(",").map(Number);
            let o = !0;
            (e(".k-opt", a).forEach((e) => {
              const a = +e.dataset.i,
                l = "true" === e.getAttribute("aria-pressed"),
                n = t.includes(a);
              (e.classList.add(l && n ? "ok" : l ? "no" : n ? "miss" : "_"),
                l !== n && (o = !1));
            }),
              i(o));
          }
          if ("match" === o) {
            const o = a.dataset.ok.split(",");
            let l = 0;
            (e(".k-mrow", a).forEach((a, n) => {
              const i = t('[aria-pressed="true"]', a),
                s = o[n];
              (e("button", a).forEach((t) => {
                t.dataset.c === s
                  ? t.classList.add(i === t ? "ok" : "miss")
                  : t === i && t.classList.add("no");
              }),
                i && i.dataset.c === s && l++);
            }),
              i(l === o.length, `Верно ${l} из ${o.length}`));
          }
          if ("seq" === o) {
            const t = a.dataset.ok,
              e = s.join("");
            i(
              e === t,
              e === t ? "Верно" : `Твой порядок ${e || "—"}, верный ${t}`,
            );
          }
        }
        r.target.closest(".k-rst") &&
          (delete a.dataset.locked,
          (s = []),
          l && ((l.textContent = ""), (l.className = "k-res")),
          n && (n.hidden = !0),
          e(".k-opt", a).forEach((e) => {
            (e.setAttribute("aria-pressed", "false"),
              e.classList.remove("ok", "no", "miss", "_"),
              "seq" === o && (t("i", e).textContent = e.dataset.i));
          }),
          e(".k-mb button", a).forEach((t) => {
            (t.setAttribute("aria-pressed", "false"),
              t.classList.remove("ok", "no", "miss"));
          }),
          "seq" === o && (t(".k-seqv", a).textContent = ""));
      }
    });
  }
  ((s.choice = (t) => {
    const e = "q" + ++m;
    return `<div class="k-q" data-q="choice" data-ok="${t.ok.join(",")}" data-multi="${t.ok.length > 1 || t.multi ? 1 : 0}" id="${e}">${t.fmt ? `<div class="k-fmt">${t.fmt}</div>` : ""}<b>${t.t}</b>${t.q ? `<div>${t.q}</div>` : ""}<div class="k-opts">${t.opts.map((e, a) => `<button class="k-opt" data-i="${a}" aria-pressed="false"><i>${t.lab ? t.lab[a] : a + 1}</i><span>${e}</span></button>`).join("")}</div><div class="k-qa"><button class="btn k-chk">Проверить</button><button class="btn ghost k-rst">Заново</button><span class="k-res"></span></div><div class="k-ans" hidden>${t.a || ""}</div></div>`;
  }),
    (s.match = (t) => {
      const e = "q" + ++m;
      return `<div class="k-q" data-q="match" data-ok="${t.ok.join(",")}" id="${e}">${t.fmt ? `<div class="k-fmt">${t.fmt}</div>` : ""}<b>${t.t}</b>${t.q ? `<div>${t.q}</div>` : ""}${t.legend ? `<div class="k-ans" style="margin:8px 0">${t.legend}</div>` : ""}${t.rows.map((e, a) => `<div class="k-mrow" data-r="${a}"><span>${a + 1}. ${e}</span><span class="k-mb">${t.cols.map((t) => `<button data-c="${t}" aria-pressed="false">${t}</button>`).join("")}</span></div>`).join("")}<div class="k-qa"><button class="btn k-chk">Проверить</button><button class="btn ghost k-rst">Заново</button><span class="k-res"></span></div><div class="k-ans" hidden>${t.a || ""}</div></div>`;
    }),
    (s.seq = (t) => {
      const e = "q" + ++m;
      return `<div class="k-q" data-q="seq" data-ok="${t.ok}" id="${e}">${t.fmt ? `<div class="k-fmt">${t.fmt}</div>` : ""}<b>${t.t}</b><div style="margin:4px 0 8px">Нажимай события по порядку.</div><div class="k-opts">${t.items.map((t, e) => `<button class="k-opt" data-i="${e + 1}" aria-pressed="false"><i>${e + 1}</i><span>${t}</span></button>`).join("")}</div><div class="k-seqv"></div><div class="k-qa"><button class="btn k-chk">Проверить</button><button class="btn ghost k-rst">Заново</button><span class="k-res"></span></div><div class="k-ans" hidden>${t.a || ""}</div></div>`;
    }),
    (s.open = (t) =>
      `<div class="k-q" data-q="open" id="${"q" + ++m}">${t.fmt ? `<div class="k-fmt">${t.fmt}</div>` : ""}<b>${t.t}</b><div>${t.q}</div><div class="k-qa"><button class="btn ghost k-show">Показать ответ и разбор</button></div><div class="k-ans" hidden>${t.a}</div></div>`));
  const k = new Set();
  let $ = 0,
    y = 0;
  const v =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (t) => {
            (t.forEach((t) => {
              const e = t.target._ka;
              e && (e.vis = t.isIntersecting);
            }),
              w());
          },
          { rootMargin: "120px" },
        )
      : null;
  function w() {
    $ || !f || l || ($ = requestAnimationFrame(M));
  }
  function M(t) {
    if ((($ = 0), !f)) return;
    let e = !1;
    const a = Math.min(0.1, (t - (y || t)) / 1e3);
    (k.forEach((t) => {
      if (!t.vis || !t.on) return;
      if (((e = !0), (t.acc = (t.acc || 0) + a), t.acc < 1 / t.fps - 0.004))
        return;
      const o = t.acc;
      ((t.acc = 0), (t.T += o));
      try {
        t.fn(t.T, o);
      } catch (e) {
        (console.error(e), (t.on = !1));
      }
    }),
      (y = t),
      e ? ($ = requestAnimationFrame(M)) : (y = 0));
  }
  function C(a) {
    const o = r[a],
      n = t("#m-" + a + " .k-doc");
    if (!o || !n) return !1;
    const s = o.sections,
      h = s
        .map(
          (t) =>
            `<a data-to="${t.id}">${t.no ? t.no + ". " : ""}${t.t}</a>${(t.sub || []).map(([t, e]) => `<a class="sub" data-to="${t}">${e}</a>`).join("")}`,
        )
        .join("");
    ((n.innerHTML = `<div class="k-wrap"><article class="k-sheet">\n    <header class="k-title"><span class="k-kick">${o.kick}</span><h2>${o.title}</h2><p>${o.lead}</p></header>\n    <details class="k-ctoc"><summary>Содержание</summary>${h}</details>\n    ${o.intro || ""}\n    ${s
      .map(
        (t) =>
          `<section class="k-sec" id="k-${t.id}" data-sec="${t.id}"><h2>${t.no ? `<span class="k-no">${t.no}</span>` : ""}<span>${t.t}</span></h2>${(() => {
            try {
              return t.html();
            } catch (er) {
              console.error("Раздел", t.id, er);
              return '<div class="dp-err" style="border:1px dashed var(--bad);border-radius:12px;padding:10px 12px;color:var(--muted)">Этот раздел не загрузился. Обнови страницу.</div>';
            }
          })()}</section>`,
      )
      .join(
        "",
      )}\n    <div class="k-end"><span>${o.end || "Конец раздела."}</span><button class="btn ghost k-up">Наверх ↑</button></div>\n  </article><aside class="k-toc"><b>Содержание</b><div class="k-prog"><i></i></div>${h}</aside></div>\n  <button class="k-fab" aria-label="Содержание"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Содержание</button>`),
      e("[data-fig]", n).forEach((a) => {
        const o = a.dataset.fig;
        try {
          p(a);
          if (
            (b[o] &&
              (function (a, o) {
                const n = t(".kf-st svg", a),
                  s = t(".k-steptx", a);
                let r = 1,
                  c = 0;
                const d = o.steps.length,
                  h = (t) => {
                    ((r = i(t, 1, d)),
                      n.setAttribute("data-step", r),
                      e("[data-s]", n).forEach((t) =>
                        t.classList.toggle(
                          "k-hide",
                          !(function (t, e) {
                            return t.split(",").some((t) => {
                              if (t.includes("-")) {
                                const [a, o] = t.split("-");
                                return (
                                  e >= (+a || 1) && e <= ("" === o ? 99 : +o)
                                );
                              }
                              return +t === e;
                            });
                          })(t.getAttribute("data-s"), r),
                        ),
                      ),
                      e(".k-dots button", a).forEach((t) =>
                        t.setAttribute(
                          "aria-pressed",
                          String(+t.dataset.st === r),
                        ),
                      ));
                    const c = o.steps[r - 1];
                    if (
                      ((s.innerHTML = `<b>${r}. ${c.t}</b>${c.d}`),
                      o.on && o.on(r, n, a),
                      l && a._ka)
                    )
                      try {
                        (a._ka.fn(a._ka.still, 0),
                          a._ka.fn(a._ka.still + 10, 0));
                      } catch (t) {}
                  },
                  p = () => {
                    (clearInterval(c),
                      (c = 0),
                      (t(".k-play", a).textContent = "▶ Анимация"));
                  };
                (a.addEventListener("click", (t) => {
                  const e = t.target.closest("[data-st]");
                  if (
                    (e && (p(), h(+e.dataset.st)),
                    t.target.closest(".k-prev") && (p(), h(r - 1)),
                    t.target.closest(".k-next") && (p(), h(r + 1)),
                    t.target.closest(".k-play"))
                  ) {
                    if (c) return void p();
                    (r >= d && h(1),
                      (t.target.textContent = "❚❚ Пауза"),
                      (c = setInterval(() => {
                        r >= d || !f ? p() : h(r + 1);
                      }, o.auto || 3600)));
                  }
                }),
                  (a._stop = p),
                  h(1));
              })(a, b[o]),
            c[o])
          )
            try {
              c[o](a, t(".kf-st svg", a));
            } catch (t) {
              console.error("fig", o, t);
            }
        } catch (er) {
          console.error("fig init", o, er);
        }
      }),
      e(".k-q", n).forEach(x),
      o.init && o.init(n));
    n.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-to]");
      (a &&
        (e.preventDefault(),
        L(),
        ((e) => {
          const a = t("#k-" + e, n) || t("#" + e, n);
          if (!a) return;
          let o = 0;
          const l = () => {
            const t = a.getBoundingClientRect().top;
            (Math.abs(t - 14) > 4 && window.scrollBy(0, t - 14),
              ++o < 4 && setTimeout(() => requestAnimationFrame(l), 120 * o));
          };
          l();
        })(a.dataset.to)),
        e.target.closest(".k-up") &&
          (BVHOST.top ? BVHOST.top() : window.scrollTo(0, 0)),
        e.target.closest(".k-fab") &&
          (function (e, a) {
            L();
            const o = document.createElement("div");
            ((o.innerHTML = `<div class="k-scrim"></div><nav class="k-sheetnav" aria-label="Содержание"><b style="display:block;padding:0 10px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Содержание</b>${a}</nav>`),
              e.appendChild(o),
              (S = o));
            const l = t(".k-toc a.on", e);
            if (l) {
              const e = t(`a[data-to="${l.dataset.to}"]`, o);
              e &&
                (e.classList.add("on"),
                setTimeout(() => e.scrollIntoView({ block: "center" }), 0));
            }
            t(".k-scrim", o).addEventListener("click", L);
          })(n, h));
    });
    const g = [...s.flatMap((t) => [t.id, ...(t.sub || []).map((t) => t[0])])]
        .map((e) => ({ id: e, el: t("#k-" + e, n) || t("#" + e, n) }))
        .filter((t) => t.el),
      u = t(".k-prog i", n),
      m = t(".k-fab", n),
      k = t(".k-sheet", n);
    return (
      (n._spy = () => {
        if (n.hidden) return;
        let t = g[0] && g[0].id;
        for (const e of g) {
          if (!(e.el.getBoundingClientRect().top < 140)) break;
          t = e.id;
        }
        e(".k-toc a", n).forEach((e) =>
          e.classList.toggle("on", e.dataset.to === t),
        );
        const a = k.getBoundingClientRect(),
          o = i((-a.top + 0.3 * innerHeight) / a.height, 0, 1);
        (u && (u.style.width = (100 * o).toFixed(1) + "%"),
          m.classList.toggle("vis", a.top < -200 && a.bottom > innerHeight));
      }),
      (d[a] = !0),
      !0
    );
  }
  s.anim = (t, e, a = {}) => {
    const o = {
      el: t,
      fn: e,
      vis: !v,
      T: 0,
      fps: a.fps || 30,
      on: !0,
      still: null != a.still ? a.still : 2,
    };
    return (
      (t._ka = o),
      k.add(o),
      v && v.observe(t),
      l ? e(null != a.still ? a.still : 2, 0) : w(),
      o
    );
  };
  let S = null;
  function L() {
    S && (S.remove(), (S = null));
  }
  let E = 0;
  const T = () => {
    !E &&
      f &&
      (E = requestAnimationFrame(() => {
        E = 0;
        const e = f && t("#m-" + f + " .k-doc");
        e && e._spy && e._spy();
      }));
  };
  (addEventListener("scroll", T, { passive: !0 }),
    addEventListener("resize", T));
  function A(t) {
    return n.get("kmode:" + t, "viz");
  }
  function P(e) {
    const a = t("#m-" + e);
    a &&
      (d[e] || C(e)) &&
      ((f = e),
      (t(".k-doc", a).hidden = !1),
      (t(".k-viz", a).hidden = !0),
      w(),
      T());
  }
  function H(a) {
    const o = t("#m-" + a);
    o &&
      (f === a && (f = null),
      L(),
      e(".kf.full", o).forEach((t) => u(t, !1)),
      e(".kf", o).forEach((t) => t._stop && t._stop()));
  }
  const I = () => BVHOST.host.classList.contains("full");
  function q() {
    const t = I();
    e(".k-win").forEach((e) => {
      const a = e.closest(".module"),
        o = a && A(a.id.slice(2));
      ((e.hidden = "doc" !== o),
        (e.title = t ? "Вернуть шапку и меню" : "Открыть конспект на всё окно"),
        e.setAttribute("aria-pressed", String(t)),
        (e.innerHTML = t
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg><span>Свернуть</span>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>На всё окно</span>'));
    });
  }
  window.MutationObserver &&
    new MutationObserver(q).observe(BVHOST.host, {
      attributes: !0,
      attributeFilter: ["class"],
    });
  const O = document.createElement("style");
  ((O.textContent =
    '\n.k-switch{align-self:flex-start;max-width:100%}\n.k-switch button{font-weight:600}\n.k-wrap{display:grid;grid-template-columns:minmax(0,1fr) 236px;gap:26px;align-items:start}\n@container bvm (max-width:1060px){.k-wrap{grid-template-columns:minmax(0,1fr)}.k-toc{display:none}}\n.k-sheet{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:42px 46px 56px;box-shadow:0 1px 2px rgba(10,40,30,.05),0 12px 40px -24px rgba(10,40,30,.25);min-width:0;font-size:16.2px;line-height:1.66}\n@container bvm (max-width:700px){.k-sheet{padding:22px 16px 34px;border-radius:16px;font-size:15.6px;margin-inline:-2px}}\n.k-sheet p{margin:0 0 12px}\n.k-sheet ul,.k-sheet ol{margin:0 0 12px;padding-left:22px}\n.k-sheet li{margin:3px 0}\n.k-sheet b,.k-sheet strong{font-weight:650}\n.k-sheet sub,.k-sheet sup{font-size:.72em;line-height:0}\n.k-title{display:flex;flex-direction:column;gap:6px;margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid var(--line)}\n.k-title .k-kick{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--eosin);font-weight:700}\n.k-title h2{font-family:var(--font-display);font-size:clamp(23px,3vw,32px);line-height:1.12;letter-spacing:-.01em}\n.k-title p{color:var(--muted);margin:4px 0 0}\n.k-goal{background:color-mix(in oklab,var(--ui) 8%,var(--surface));border:1px solid color-mix(in oklab,var(--ui) 22%,var(--line));border-radius:16px;padding:16px 20px;margin:0 0 22px}\n.k-goal>b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ui);margin-bottom:6px}\n.k-goal ul{margin:0}\n.k-sec{scroll-margin-top:18px;padding-top:8px}\n.k-sec+.k-sec{margin-top:34px;padding-top:30px;border-top:1px dashed var(--line)}\n.k-sec>h2{display:flex;align-items:baseline;gap:12px;font-family:var(--font-display);font-size:clamp(21px,2.6vw,27px);line-height:1.18;letter-spacing:-.01em;margin:0 0 16px}\n.k-sec>h2 .k-no{flex:none;display:inline-grid;place-items:center;min-width:38px;height:38px;padding:0 8px;border-radius:12px;background:var(--ui);color:var(--card,#fff);font-size:17px;transform:translateY(-3px)}\n.k-sheet h3{font-family:var(--font-display);font-weight:500;font-size:19px;line-height:1.25;margin:26px 0 10px;scroll-margin-top:18px}\n.k-sheet h4{font-size:15.5px;font-weight:700;margin:18px 0 6px}\n.k-pg{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;margin:6px 0 14px}\n.k-pg:after{content:"";flex:1;height:1px;background:var(--line)}\n.k-box{border-radius:16px;padding:15px 18px 14px;margin:16px 0 18px;border:1px solid}\n.k-box>b:first-child{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}\n.k-box p:last-child,.k-box ul:last-child{margin-bottom:0}\n.k-ol{background:color-mix(in oklab,var(--sky) 9%,var(--surface));border-color:color-mix(in oklab,var(--sky) 30%,var(--line))}\n.k-ol>b:first-child{color:var(--sky)}\n.k-tr{background:color-mix(in oklab,var(--bad) 8%,var(--surface));border-color:color-mix(in oklab,var(--bad) 32%,var(--line))}\n.k-tr>b:first-child{color:var(--bad)}\n.k-ex{background:color-mix(in oklab,var(--amber) 9%,var(--surface));border-color:color-mix(in oklab,var(--amber) 30%,var(--line))}\n.k-ex>b:first-child{color:color-mix(in oklab,var(--amber) 80%,var(--ink))}\n.k-deep{background:color-mix(in oklab,var(--hema) 7%,var(--surface));border-color:color-mix(in oklab,var(--hema) 26%,var(--line))}\n.k-deep>b:first-child{color:var(--hema)}\n.k-tw{overflow-x:auto;margin:12px 0 18px;border:1px solid var(--line);border-radius:14px;-webkit-overflow-scrolling:touch}\n.k-t{border-collapse:collapse;width:100%;font-size:14.4px;line-height:1.45;min-width:520px}\n.k-t th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);font-weight:700;background:var(--surface-2);padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:bottom}\n.k-t td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}\n.k-t tr:last-child td{border-bottom:0}\n.k-t td:first-child{font-weight:600}\n.k-t tr.on td{background:color-mix(in oklab,var(--eosin) 9%,var(--surface))}\n.k-t.k-t2 td:first-child{font-weight:400}\n.k-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:12px 0 18px}\n.k-card{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--surface)}\n.k-card b{display:block;margin-bottom:3px}\n.k-card small{color:var(--muted);font-size:13px;line-height:1.45;display:block}\n.k-f{font-family:var(--font-mono);font-size:.93em;background:var(--surface-2);border-radius:6px;padding:1px 6px;white-space:nowrap}\n.k-mark{background:color-mix(in oklab,var(--amber) 22%,transparent);border-radius:4px;padding:0 3px}\n/* рисунки */\n.kf{margin:20px 0 24px;border:1px solid var(--line);border-radius:18px;background:var(--surface-2);overflow:hidden}\n.kf-ctl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:12px 14px 0}\n.kf-ctl .seg{max-width:100%}\n.kf-st{position:relative;margin:12px 12px 0;border-radius:13px;overflow:hidden;background:var(--surface);border:1px solid var(--line);touch-action:pan-y}\n.kf-st.dark{background:#0d1014;border-color:#0d1014}\n.kf-st:not(.dark){--bg:#eef0f5;--surface:#ffffff;--surface-2:#f5f6fb;--ink:#1b1c33;--muted:#5b5e7a;--line:#d9dce8;--hema:#3b3da0;--eosin:#c2386e;--ok:#2f8a4c;--bad:#c2384a;--amber:#c98a12;--sky:#2f7fc1;color-scheme:light}\n.kf-st>svg{display:block;width:100%;height:auto;color:var(--ink);font-family:var(--font-body)}\n.kf-st svg text{font-family:var(--font-body)}\n.kf-mk{position:absolute;inset:0;pointer-events:none}\n.kf-b{pointer-events:auto;position:absolute;transform:translate(-50%,-50%);min-width:22px;height:22px;padding:0 5px;border-radius:11px;border:1.5px solid var(--surface);background:var(--ink);color:var(--surface);font:700 12px/19px var(--font-body);text-align:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .15s,background .15s}\n.kf-b:hover{transform:translate(-50%,-50%) scale(1.15)}\n.kf-b.on{background:var(--eosin);border-color:#fff;transform:translate(-50%,-50%) scale(1.22);z-index:3}\n.kf-lbl{position:absolute;transform:translate(-50%,-50%);font-size:12px;line-height:1.2;color:var(--muted);font-weight:600;white-space:nowrap;pointer-events:none;letter-spacing:.02em}\n.kf-lbl.l{transform:translate(0,-50%)}.kf-lbl.r{transform:translate(-100%,-50%)}\n.kf-lbl.up{text-transform:uppercase;font-size:10.5px;letter-spacing:.08em}\n.kf-zoom{position:absolute;right:8px;top:8px;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:color-mix(in oklab,var(--surface) 88%,transparent);cursor:pointer;display:grid;place-items:center;color:var(--ink);z-index:4}\n.kf-zoom svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}\n.kf-info{min-height:22px;margin:10px 14px 0;font-size:14.4px;line-height:1.5;color:var(--ink)}\n.kf-info:empty{display:none}\n.kf-info b{color:var(--eosin)}\n.kf figcaption,.kf .kf-cap{padding:10px 16px 0;font-size:14px;line-height:1.5;color:var(--muted)}\n.kf figcaption b{color:var(--ink)}\n.kf-leg{list-style:none;margin:10px 14px 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px 12px;font-size:14px;line-height:1.38}\n.kf-leg li{display:flex;gap:8px;align-items:flex-start;padding:5px 6px;border-radius:9px;cursor:pointer}\n.kf-leg li:hover,.kf-leg li.on{background:color-mix(in oklab,var(--eosin) 10%,var(--surface))}\n.kf-leg li>i{flex:none;font-style:normal;min-width:21px;height:21px;border-radius:11px;background:var(--ink);color:var(--surface);font:700 11.5px/21px var(--font-body);text-align:center}\n.kf-leg li.on>i{background:var(--eosin)}\n.kf-leg li>i.ch{background:none;min-width:auto;height:auto;display:inline-flex;align-items:center}\n.kf.quiz .kf-leg li:not(.shown)>span{color:transparent;background:repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 9px);border-radius:4px;user-select:none}\n.kf-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px 14px}\n.kf-tools .btn{padding:6px 12px;font-size:13px}\n.kf-tools .hint{margin-left:auto}\n.kf-pad{height:14px}\n.kf [data-k]{cursor:pointer;transition:opacity .2s,filter .2s}\n.kf .kf-hl [data-k]:not(.on){opacity:.42}\n.kf [data-k].on{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 7px var(--eosin))}\n.kf.full{position:fixed;inset:0;z-index:60;margin:0;border-radius:0;overflow:auto;overscroll-behavior:contain;background:var(--bg);padding-top:48px;padding-bottom:30px}\n.kf.full .kf-st{min-width:min(1100px,190vw)}\n.kf.full .kf-zoom{position:fixed}\n.k-row{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center}\n.k-rng{display:flex;flex-direction:column;gap:2px;min-width:180px;flex:1}\n.k-rng label{font-size:13px;color:var(--muted)}\n.k-rng label b{color:var(--ink);font-family:var(--font-mono);font-weight:600}\n.k-rng input{width:100%;accent-color:var(--eosin)}\n.k-chk{display:inline-flex;align-items:center;gap:7px;font-size:14px;cursor:pointer}\n.k-chk input{accent-color:var(--eosin);width:16px;height:16px}\n.k-out{font-family:var(--font-mono);font-size:14px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:6px 10px}\n.k-steptx{margin:10px 14px 0;padding:12px 14px;border-radius:12px;background:var(--surface);border:1px solid var(--line);font-size:14.6px;line-height:1.5;min-height:74px}\n.k-steptx b{display:block;font-family:var(--font-display);font-weight:500;font-size:16px;margin-bottom:3px}\n.k-dots{display:flex;gap:5px;flex-wrap:wrap}\n.k-dots button{all:unset;cursor:pointer;min-width:30px;height:30px;border-radius:9px;border:1px solid var(--line);background:var(--surface);font:600 13px/30px var(--font-body);text-align:center}\n.k-dots button[aria-pressed="true"]{background:var(--ui);border-color:var(--ui);color:var(--card,#fff)}\n[data-s]{transition:opacity .35s}\n.k-hide{opacity:0!important;pointer-events:none}\n/* задания */\n.k-q{border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:14px 0;background:var(--surface)}\n.k-q>b:first-child{display:block;font-family:var(--font-display);font-weight:500;font-size:16.5px;margin-bottom:8px}\n.k-q .k-fmt{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:6px}\n.k-opts{display:flex;flex-direction:column;gap:6px;margin:8px 0}\n.k-opt{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border:1px solid var(--line);border-radius:11px;background:var(--surface);font-size:14.8px;line-height:1.45}\n.k-opt>i{flex:none;font-style:normal;min-width:24px;height:24px;border-radius:7px;border:1px solid var(--line);display:grid;place-items:center;font-size:12.5px;font-weight:700;color:var(--muted);background:var(--surface-2)}\n.k-opt:hover{border-color:var(--ui)}\n.k-opt[aria-pressed="true"]{border-color:var(--ui);background:color-mix(in oklab,var(--ui) 9%,var(--surface))}\n.k-opt[aria-pressed="true"]>i{background:var(--ui);color:var(--card,#fff);border-color:var(--ui)}\n.k-opt.ok{border-color:var(--ok);background:color-mix(in oklab,var(--ok) 12%,var(--surface))}\n.k-opt.ok>i{background:var(--ok);border-color:var(--ok);color:#fff}\n.k-opt.no{border-color:var(--bad);background:color-mix(in oklab,var(--bad) 10%,var(--surface))}\n.k-opt.no>i{background:var(--bad);border-color:var(--bad);color:#fff}\n.k-opt.miss{border:2px dashed var(--ok)}\n.k-qa{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}\n.k-res{font-weight:600}\n.k-res.ok{color:var(--ok)}.k-res.no{color:var(--bad)}\n.k-ans{margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--surface-2);font-size:14.6px;line-height:1.55}\n.k-ans[hidden]{display:none}\n.k-mrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:11px;margin:5px 0;font-size:14.6px}\n.k-mrow .k-mb{display:flex;gap:4px;flex-wrap:wrap;flex:none}\n.k-mb button{all:unset;cursor:pointer;min-width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);text-align:center;font:600 13px/30px var(--font-body)}\n.k-mb button[aria-pressed="true"]{background:var(--ui);border-color:var(--ui);color:var(--card,#fff)}\n.k-mb button.ok{background:var(--ok);border-color:var(--ok);color:#fff}.k-mb button.no{background:var(--bad);border-color:var(--bad);color:#fff}.k-mb button.miss{outline:2px dashed var(--ok)}\n@media (max-width:600px){.k-mrow{flex-direction:column;align-items:stretch}}\n.k-seqv{font-family:var(--font-mono);font-size:18px;letter-spacing:.14em;min-height:28px}\n/* оглавление */\n.k-toc{position:sticky;top:14px;max-height:calc(100dvh - 28px);overflow:auto;scrollbar-width:thin;border:1px solid var(--line);border-radius:18px;background:var(--surface);padding:14px 10px 12px}\n.k-toc>b{display:block;font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);padding:2px 8px 8px}\n.k-toc a{display:block;padding:6px 8px;border-radius:9px;color:var(--muted);text-decoration:none;font-size:13.6px;line-height:1.3;cursor:pointer}\n.k-toc a.sub{padding-left:20px;font-size:12.8px}\n.k-toc a:hover{background:var(--surface-2);color:var(--ink)}\n.k-toc a.on{background:color-mix(in oklab,var(--ui) 12%,var(--surface));color:var(--ui);font-weight:600}\n.k-prog{height:4px;border-radius:2px;background:var(--line);margin:4px 8px 10px;overflow:hidden}\n.k-prog i{display:block;height:100%;width:0;background:var(--eosin);border-radius:2px}\n.k-fab{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 128px);z-index:20;display:none;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);box-shadow:0 6px 20px rgba(0,0,0,.18);font-weight:600;font-size:14px;cursor:pointer;color:var(--ink)}\n.k-fab svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}\n@container bvm (max-width:1060px){.k-fab.vis{display:inline-flex}}\n.k-sheetnav{position:fixed;inset:auto 0 0 0;z-index:61;max-height:72dvh;overflow:auto;background:var(--surface);border-radius:20px 20px 0 0;padding:16px 14px calc(env(safe-area-inset-bottom,0px) + 18px);box-shadow:0 -10px 40px rgba(0,0,0,.25)}\n.k-sheetnav a{display:block;padding:10px 10px;border-radius:10px;color:var(--ink);text-decoration:none;font-size:15px}\n.k-sheetnav a.sub{padding-left:24px;color:var(--muted);font-size:14px}\n.k-sheetnav a.on{background:color-mix(in oklab,var(--ui) 12%,var(--surface));color:var(--ui);font-weight:600}\n.k-scrim{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.3)}\n.k-ctoc{display:none;margin:0 0 22px;border:1px solid var(--line);border-radius:14px;padding:6px 6px}\n.k-ctoc summary{cursor:pointer;padding:8px 10px;font-weight:600}\n.k-ctoc a{display:block;padding:6px 10px;color:var(--muted);text-decoration:none;font-size:14.5px;border-radius:8px;cursor:pointer}\n.k-ctoc a.sub{padding-left:24px;font-size:13.8px}\n@container bvm (max-width:1060px){.k-ctoc{display:block}}\n.k-t td[data-l]:before{display:none}\n@container bvm (max-width:600px){\n .k-tw.k-stk{border:0;overflow:visible;border-radius:0}\n .k-stk .k-t{min-width:0;display:block}.k-stk .k-t thead{display:none}.k-stk .k-t tbody{display:flex;flex-direction:column;gap:10px}\n .k-stk .k-t tr{display:block;border:1px solid var(--line);border-radius:14px;padding:6px 0;background:var(--surface)}\n .k-stk .k-t td{display:block;border:0;padding:5px 14px}\n .k-stk .k-t td[data-l]:before{display:block;content:attr(data-l);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:1px}\n .k-stk .k-t td:first-child{font-size:15.5px;padding-top:8px;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:3px}\n .k-stk .k-t td:first-child:before{display:none}}\n.kf-ctl .seg{flex-wrap:wrap!important;overflow:visible!important;border-radius:16px!important}\n.kf-ctl .seg button{flex:0 1 auto!important}\n.k-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}\n.k-win{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:14px;color:var(--ink)}\n.k-win:hover{border-color:var(--ui);color:var(--ui)}.k-win:focus-visible{outline:2px solid var(--ui);outline-offset:2px}\n.k-win svg{width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n.k-win[hidden]{display:none}\n:host(.full) .k-wrap{max-width:1320px;margin-inline:auto}\n@container bvm (max-width:600px){.k-win span{display:none}.k-win{padding:9px}}\n.k-end{margin-top:36px;padding:18px 20px;border-radius:16px;background:var(--surface-2);display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}\n'),
    BVHOST.root.appendChild(O));
  /* Открыть конспект в контейнере #m-<id> .k-doc (рисуется один раз) и закрыть его при уходе со страницы */
  s.show = (id) => {
    if (!(d[id] || C(id))) return !1;
    f = id;
    w();
    T();
    return !0;
  };
  s.hide = (id) => H(id);
  s.drop = (id) => {
    H(id);
    delete d[id];
  };
})();
