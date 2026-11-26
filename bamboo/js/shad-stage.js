// Shared by the tracker and Zov Lesa. A note edit is not a webinar or homework completion.
(function(){
function completionTimes(mark){
  const times=mark?.completed;
  return times && times.stage===mark.s && times.revision===mark.at ? times : {};
}
function change(mark,stage,at=Date.now()){
  const previous=mark?.s || 0, times={...completionTimes(mark),stage,revision:at};
  for(const [part,threshold] of [['web',2],['hw',3]]){
    if(stage<threshold)delete times[part];
    else if(previous<threshold)times[part]=at;
  }
  return {...mark,s:stage,at,completed:times};
}
window.ShadStages={completionTimes,change};
})();
