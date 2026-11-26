const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('bamboo/js/keys.js','utf8');

function client(platform, hash) {
  const log = [], events = {}, location = {hash};
  const body = {closest: () => null, classList: {contains: () => false}};
  const document = {body, activeElement:body, addEventListener: (key, fn) => { events[key] = fn; }};
  const state = {modal:false, editor:false, dialog:false, picker:'', studio:true};
  const actions = new Proxy({}, {get: (obj,k) => obj[k] || (() => log.push(k))});
  const B = {
    acts:actions, sheetOpen:() => state.modal,
    sheet:() => log.push('guide'), closeSheet:() => log.push('sheet closed'), closeDialog:() => log.push('dialog closed'),
    $: sel => sel === '#dlgScrim' ? {hidden:!state.dialog} : sel === '.sheet .tw' && state.editor ? {} : null,
    $$: () => [], icon:() => '', pl:{view:() => 'week',clearSel:() => false, targetRow:() => null},
    calendarView:{deleteKeyItem:row => log.push(['remove',row])},
    focus:{isStudio:() => state.studio},twPopNow:() => state.picker,handleHistory:redo => log.push(redo ? 'redo' : 'undo')
  };
  vm.runInNewContext(source, {B,document,location,navigator:{platform}});
  function press(code, extra = {}) {
    const event = {code, key:code, target:document.activeElement, preventDefault(){ this.defaultPrevented=true; }, ...extra};
    events.keydown(event);
    return !!event.defaultPrevented;
  }
  return {document,body,events,B,location,log,state,press};
}

test('primary modifier matches the platform; system shortcuts and composition pass through', () => {
  for (const [platform, modifier, other] of [['MacIntel','metaKey','ctrlKey'],['Win32','ctrlKey','metaKey']]) {
    const {press,log,location,document,body} = client(platform,'#/board/focus');
    assert.equal(press('KeyZ',{[modifier]:true}),true);
    assert.equal(press('KeyZ',{[modifier]:true,shiftKey:true}),true);
    assert.equal(press('KeyZ',{[other]:true}),false);
    for (const code of ['KeyR','KeyB','KeyM']) assert.equal(press(code,{[modifier]:true}),false);
    assert.deepEqual(log,['undo','redo']);
    for (const extra of [{isComposing:true},{keyCode:229},{repeat:true},{getModifierState:() => true}])
      assert.equal(press('Digit1',extra),false);
    assert.equal(location.hash,'#/board/focus');
    document.activeElement = {closest:() => ({}),isContentEditable:true};
    assert.equal(press('Digit2'),false);
    assert.equal(press('Space'),false);
    document.activeElement=body;
    assert.equal(press('Digit2'),true);
    assert.equal(location.hash,'#/tasks');
  }
});
test('held Backspace never navigates back or applies a second delete', () => {
  const {press,log,state} = client('MacIntel','#/tasks/week');
  assert.equal(press('Backspace'),true);
  assert.equal(press('Backspace',{repeat:true}),true);
  assert.deepEqual(log,[['remove',null]]);
  state.modal=true;
  assert.equal(press('Delete'),true);
  assert.deepEqual(log,[['remove',null]]);
  assert.equal(press('Digit1'),false);
  assert.equal(press('Escape'),true);
  assert.equal(log.at(-1),'sheet closed');
  state.dialog=true;
  press('Escape');
  assert.equal(log.at(-1),'dialog closed');
});
test('focus commands stay on the studio and keep Space activation on focused buttons', () => {
  const {press,state,document,body,location,log} = client('Win32','#/board/focus');
  press('Space'); press('KeyM'); press('KeyR',{shiftKey:true});
  assert.deepEqual(log,['focusToggle','focusSound','focusReset']);
  const button={closest:selector=>selector.includes('button,')?button:null};
  document.activeElement=button;
  assert.equal(press('Space'),false);
  document.activeElement=body;
  state.studio=false;
  assert.equal(press('Space'),false);
  assert.equal(press('KeyM'),false);
  press('KeyH');
  assert.equal(location.hash,'#/board/history');
  press('Digit0');
  assert.equal(location.hash,'#/settings');
});
