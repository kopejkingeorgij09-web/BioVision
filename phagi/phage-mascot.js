/* The mark has no SVG ids, so several sizes and moods can share one page. */
window.PhagiMascot = (() => {
  'use strict';

  const modes = new Set(['idle', 'notice', 'urgent', 'celebrate']);
  const variants = {badge:42, portrait:116, brand:42};
  // Three pairs of long jointed tail fibres, seen at different depths.
  const fibres = [
    ['back',  51,83, 43,72, 33,84],
    ['back',  61,83, 71,71, 83,82],
    ['middle',49,83, 32,76, 18,92],
    ['middle',63,83, 82,76, 97,91],
    ['front', 51,85, 41,93, 33,105],
    ['front', 62,85, 74,92, 82,104]
  ];
  function fibre([depth,x,y,elbowX,elbowY,toX,toY], side) {
    return `<g class="pm-fibre pm-${depth} pm-${side%2?'right':'left'}">
      <path class="pm-fibre-edge" d="M${x} ${y}L${elbowX} ${elbowY}L${toX} ${toY}"/>
      <path class="pm-fibre-light" d="M${x} ${y}L${elbowX} ${elbowY}L${toX} ${toY}"/>
      <circle class="pm-joint" cx="${elbowX}" cy="${elbowY}" r="1.65"/>
      <circle class="pm-tip" cx="${toX}" cy="${toY}" r="1.4"/>
    </g>`;
  }
  const rear = fibres.slice(0,2).map(fibre).join('');
  const legs = fibres.slice(2).map(fibre).join('');
  const capsid = `<g class="pm-head" stroke-linejoin="round">
    <path fill="#193f42" stroke="#173c40" stroke-width="3.3" d="M39 14L55 7 69 12 79 24 78 39 66 51 53 55 39 49 31 37 31 23Z"/>
    <path fill="#70b8ab" d="M39 14L55 7 51 16 39 22 31 23Z"/>
    <path fill="#b9ddd0" d="M55 7L69 12 63 18 51 16Z"/>
    <path fill="#4a9890" d="M69 12L79 24 70 25 63 18Z"/>
    <path fill="#377b78" d="M79 24L78 39 69 38 70 25Z"/>
    <path fill="#245b5f" d="M78 39L66 51 61 44 69 38Z"/>
    <path fill="#37867d" d="M66 51L53 55 51 46 61 44Z"/>
    <path fill="#599e8d" d="M53 55L39 49 42 41 51 46Z"/>
    <path fill="#4d9488" d="M39 49L31 37 39 34 42 41Z"/>
    <path fill="#92c6b5" d="M31 37L31 23 39 22 39 34Z"/>
    <path class="pm-face" fill="#f2b660" d="M39 22L51 16 63 18 70 25 69 38 61 44 51 46 42 41 39 34Z"/>
    <path fill="#ffdda0" d="M39 22L51 16 63 18 51 22 41 30Z"/>
    <path fill="#d58d50" d="M69 34L69 38 61 44 51 46 42 41 53 42 63 39Z"/>
    <path class="pm-glint" fill="none" stroke="#f3fff2" stroke-width="1.6" stroke-linecap="round" d="M34 26L35 23 41 17M47 14L53 11"/>
    <g class="pm-eyes" fill="#29494a">
      <path d="M46 29c.3-2.4 3.4-2.4 3.8-.4l.1 2c-.2 2.3-3.4 2.5-3.8.2Z"/>
      <path d="M59 28c.3-2.3 3.3-2.6 3.7-.5l.1 1.9c-.1 2.3-3.3 2.6-3.7.4Z"/>
    </g>
    <g class="pm-expression pm-alert-brows" fill="none" stroke="#6b6042" stroke-linecap="round" stroke-width="1.45">
      <path d="m44.6 25.2 4.6-.2m10-1.7 4.1 1.1"/>
    </g>
    <g class="pm-expression pm-joy-eyes" fill="none" stroke="#29494a" stroke-width="2.4" stroke-linecap="round">
      <path d="M44.8 30q2-4.2 5.1-.9m8 .2q2-4.1 5.3-1.1"/>
    </g>
    <g class="pm-expression pm-cheeks" fill="#d9875a"><ellipse cx="44.2" cy="34" rx="2.6" ry="1.2"/><ellipse cx="65.4" cy="32" rx="2.3" ry="1.1"/></g>
    <path class="pm-smile" fill="none" stroke="#795935" stroke-width="1.45" stroke-linecap="round" d="M52 35q2.9 2.7 5.7-.5"/>
  </g>`;
  function svg(options={}) {
    const mode=modes.has(options.mode)?options.mode:'idle';
    const variant=Object.hasOwn(variants,options.variant)?options.variant:'badge';
    const size=variants[variant];
    return `<svg class="phage-mascot pm-v-${variant} pm-m-${mode}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="3 0 108 110" aria-hidden="true" focusable="false">
      <g class="pm-aura" fill="#edb66a"><ellipse cx="54" cy="31" rx="35" ry="30" opacity=".07"/><ellipse cx="54" cy="31" rx="30" ry="26" opacity=".09"/></g>
      <ellipse class="pm-shadow" cx="57" cy="105" rx="20" ry="2.8" fill="#24635c" opacity=".16"/>
      <g class="pm-float"><g class="pm-pose">
        ${rear}
        <g class="pm-sheath" stroke-linejoin="round">
          <path fill="#78afa4" stroke="#234e50" stroke-width="2.5" d="M50 52L59 51 61 79 57 84 52 79Z"/>
          <path fill="#d0e6cc" d="M52 55L54 55 56 80 53.7 79Z"/>
          <path fill="#387b76" d="M57.5 54L59.2 53 61 78.5 58.5 80.5Z"/>
          <g fill="none" stroke="#356c6a" stroke-width="2.55" stroke-linecap="round"><path d="M51 59l8-2M51.3 64l8-2M52 69l8-2M52.4 74l8-2M53 79l7.5-2"/></g>
          <path fill="#f3ce84" stroke="#34585a" stroke-width="1.9" d="M46 51l12.2-2.5 5.1 2.5-1.6 4.2-13.3 2.1-3.1-2.1Z"/>
          <path fill="#dbad62" d="m47.2 54.5 14.7-2.7-.8 2.1-12.5 2.2Z"/>
        </g>
        ${legs}
        <path fill="#b9d2b3" stroke="#234e50" stroke-width="2" stroke-linejoin="round" d="M47 80.8l11-2 8 3.3-1.8 3.6-10.6 2.3-7.6-3.9Z"/>
        <path d="m48.3 82.3 7.1 2.4 8.9-2" fill="none" stroke="#fff0bb" stroke-width="1.5" stroke-linecap="round"/>
        <path d="m54 87 2.4 5.1 2-6.1" fill="#43736e" stroke="#234e50" stroke-width="1.2" stroke-linejoin="round"/>
        ${capsid}
      </g></g>
      <g class="pm-sparks" fill="none" stroke="#deac5d" stroke-width="1.7" stroke-linecap="round">
        <path d="m87 17 .7-4M91 20l3.4-2M92 24l3.4.4"/>
        <path d="m22 34-2.6-1.7M23.2 29.4l-.7-2.6"/>
      </g>
    </svg>`;
  }
  return Object.freeze({svg});
})();
