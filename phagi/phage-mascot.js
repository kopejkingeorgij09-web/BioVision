/* The mark has no SVG ids, so several sizes and moods can share one page. */
window.PhagiMascot = (() => {
  'use strict';

  const modes = new Set(['idle', 'notice', 'urgent', 'celebrate']);
  const variants = {badge:52, portrait:116, brand:42};
  const fibres = [
    {depth:'back', side:'left', start:'52 80', elbow:'31 69', end:'20 77', hook:'17 82'},
    {depth:'back', side:'right', start:'62 79', elbow:'79 66', end:'91 73', hook:'96 78'},
    {depth:'middle', side:'left', start:'50 82', elbow:'22 83', end:'9 98', hook:'7 103'},
    {depth:'middle', side:'right', start:'63 81', elbow:'89 80', end:'103 92', hook:'107 97'},
    {depth:'front', side:'left', start:'53 85', elbow:'38 95', end:'33 107', hook:'29 110'},
    {depth:'front', side:'right', start:'60 84', elbow:'74 94', end:'79 106', hook:'84 109'}
  ];
  function fibre({depth, side, start, elbow, end, hook}) {
    const path = `M${start}L${elbow} ${end} ${hook}`;
    const [x,y] = elbow.split(' ');
    return `<g class="pm-fibre pm-${depth} pm-${side}">
      <path class="pm-fibre-edge" d="${path}"/>
      <path class="pm-fibre-light" d="${path}"/>
      <circle class="pm-joint" cx="${x}" cy="${y}" r="1.45"/>
    </g>`;
  }
  const rear = fibres.slice(0,2).map(fibre).join('');
  const legs = fibres.slice(2).map(fibre).join('');
  const capsid = `<g class="pm-head" stroke-linejoin="round">
    <path fill="#416f75" stroke="#16464e" stroke-width="2.2" d="M37 18L51 5 63 6 77 16 83 33 76 47 63 57 48 54 35 46 29 33Z"/>
    <path fill="#89d0be" d="M37 18L51 5 63 6 57 16 44 26 29 33Z"/>
    <path fill="#5faaa6" d="M63 6L77 16 83 33 69 25 57 16Z"/>
    <path fill="#3b777e" d="M69 25L83 33 76 47 65 42Z"/>
    <path fill="#559696" d="M29 33L44 26 48 42 35 46Z"/>
    <path fill="#71b9ac" d="M44 26L57 16 69 25 65 42 48 42Z"/>
    <path fill="#28606a" d="M65 42L76 47 63 57 48 54 48 42Z"/>
    <path fill="#478f92" d="M48 42L65 42 55 49 48 54 35 46Z"/>
    <path fill="#95cebc" d="M57 16L69 25 56 23 44 26Z"/>
    <path fill="#6daea2" d="M44 26L56 23 65 42 48 42Z"/>
    <path fill="#407f85" d="M56 23L69 25 65 42Z"/>
    <path fill="none" stroke="#d9f4e9" stroke-width="1.15" opacity=".65" d="M30 32L44 26 57 16 63 6M37 18L44 26 48 42 65 42 69 25 77 16M35 46L48 42M65 42L63 57"/>
    <path fill="none" stroke="#23656b" stroke-width=".8" opacity=".58" d="M37 18L49 17 51 5M49 17L57 16 56 23 48 42 55 49 65 42M77 16L73 21 83 33 65 42"/>
    <path fill="none" stroke="#e6fff3" stroke-width="1.65" stroke-linecap="round" d="M38 18L48 9M35 23L32 29"/>
  </g>`;
  const sheath = `<g stroke-linejoin="round">
    <path fill="#8cc5b2" stroke="#21535a" stroke-width="1.9" d="M47 52L62 49 68 53 65 57 59 58 61 80 56 84 51 79 50 58 46 56Z"/>
    <path fill="#427f7e" d="M56 57L59 56 61 80 56 84 55 77Z"/>
    <path fill="#e0ebe0" opacity=".8" d="M51 57L53 57 55 77 53 77Z"/>
    <path fill="none" stroke="#2c656a" stroke-width="1.8" stroke-linecap="round" d="M51 60L59 58M51 64L59 62M52 68L60 66M52 72L60 70M52 76L60 74M53 80L60 78"/>
    <path fill="none" stroke="#bce5d3" stroke-width="1" d="M47 54L62 51 66 53M52 62L59 60M53 70L60 68M54 78L60 76"/>
  </g>`;

  function svg(options={}) {
    const mode = modes.has(options.mode) ? options.mode : 'idle';
    const variant = Object.hasOwn(variants,options.variant) ? options.variant : 'badge';
    const size = variants[variant];
    return `<svg class="phage-mascot pm-v-${variant} pm-m-${mode}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="2 0 110 114" aria-hidden="true" focusable="false">
      <ellipse class="pm-shadow" cx="57" cy="109" rx="31" ry="3" fill="#367b74" opacity=".17"/>
      <g class="pm-float"><g class="pm-pose">
        ${rear}
        ${sheath}
        ${legs}
        <path fill="#90bdb0" stroke="#2d646a" stroke-width="1.9" stroke-linejoin="round" d="M46 81L56 77 67 81 64 86 55 89 46 85Z"/>
        <path fill="none" stroke="#d9eee1" stroke-width="1.25" stroke-linecap="round" d="M48 81L56 83 65 81"/>
        <path fill="#69a89d" stroke="#2d646a" stroke-width="1.15" stroke-linejoin="round" d="M53 88L60 86 57 95 55 94Z"/>
        ${capsid}
      </g></g>
    </svg>`;
  }
  return Object.freeze({svg});
})();
