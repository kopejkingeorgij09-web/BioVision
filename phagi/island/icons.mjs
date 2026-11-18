const lines={
 island:'M3 13 12 6l9 7-9 7-9-7Z M3 16l9 6 9-6 M8.5 10.5V6l3.5-3 3.5 3v4.5 M11 12V8h2v4',
 book:'M3 5q5-2 9 1v14q-4-3-9-1V5Z M12 6q4-3 9-1v14q-5-2-9 1',
 nest:'M3 13q1 8 9 8t9-8 M4 14l8 3 8-3 M8 13C6 9 10 3 12 3s6 6 4 10',
 raids:'M5 22V3m1 1q4-2 8 0t7 0l-3 4 3 4q-3 2-7 0t-8 0',
 build:'m4 20 9-9m-4-5 3-3 4 3-1 2 3 3 2-1 2 3-3 3-4-3 1-2-3-3-2 1Z',
 dragons:'m3 17 4-7 5 1-2-7 5 4 3-3 1 4 3 3-5 3-3 4-6-1-5 3 1-4Z M15.5 11.5h.5',
 trials:'M7 3h10v5q0 6-5 7-5-1-5-7V3Z M7 5H3v3q0 3 5 4m9-7h4v3q0 3-5 4m-4 3v5m-4 1h8',
 log:'M6 3h12v18H6z M9 7h6m-6 4h6m-6 4h4',
 back:'m14 5-7 7 7 7',
 coin:'M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0Z M12 7l3 5-3 5-3-5Z',
 food:'M12 8c-5-5-10 1-7 7s6 6 7 4c2 2 5 2 7-4 3-7-2-11-7-7Zm0 1q0-6 6-7',
 gem:'m3 8 4-5h10l4 5-9 13L3 8Z M3 8h18M8 8l4 13 4-13',
};
export const icon=(name)=>'<svg class="ui-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+lines[name]+'"/></svg>';
