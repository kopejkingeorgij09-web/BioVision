const test = require('node:test');
const assert = require('node:assert/strict');
const {build, fits} = require('../js/day-plan.js');

test('counts the union of busy intervals, including events extending outside the planning window', () => {
  const plan = build(540, 780, [
    {start:480,end:600}, {start:570,end:630}, {start:660,end:720}, {start:750,end:810}
  ], []);
  assert.deepEqual(plan.windows, [{start:630,end:660}, {start:720,end:750}]);
  assert.equal(plan.free, 60);
  assert.equal(plan.overlap, true);
});

test('places whole tasks in priority order with starts on the five-minute grid', () => {
  const work = [{key:'large',minutes:45}, {key:'small',minutes:18}, {key:'next',minutes:21}];
  const plan = build(543, 690, [{start:570,end:605}], work);
  assert.equal(plan.required, 84);
  assert.deepEqual(plan.slots.map(({key,start,end})=>[key,start,end]), [
    ['large',605,650], ['small',545,563], ['next',650,671]
  ]);
  assert.equal(plan.free, 112);
  assert.deepEqual(plan.unplaced, []);
  assert.equal(fits(plan.windows, 563, 571), false);
  assert.equal(fits(plan.windows, 605, 690), true);
  assert.equal(fits(plan.windows, 620, 620), false);
});

test('keeps unknown effort separate and reports fragmented free time without splitting a task', () => {
  const task = {key:'single',minutes:35};
  const plan = build(540, 615, [{start:570,end:585}], [task,{key:'unestimated',minutes:0}]);
  assert.equal(plan.free, 60);
  assert.equal(plan.required, 35);
  assert.equal(plan.unknown, 1);
  assert.deepEqual(plan.slots, []);
  assert.deepEqual(plan.unplaced, [task]);
  assert.equal(plan.overlap, false);
});

test('treats adjacent intervals as separate commitments and closes planning after cutoff', () => {
  const busy = [{start:540,end:570}, {start:570,end:600}];
  assert.equal(build(540, 600, busy, []).overlap, false);
  const late = build(630, 600, busy, [{key:'missed',minutes:15}]);
  assert.equal(late.free, 0);
  assert.deepEqual(late.windows, []);
  assert.deepEqual(late.slots, []);
  assert.equal(late.required, 15);
});
