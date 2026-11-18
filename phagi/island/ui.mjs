export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const btn=(label,action,cls='',disabled=false)=>'<button class="'+cls+'" data-do="'+escape(action)+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
export const opt=(value,label,selection)=>'<option value="'+escape(value)+'" '+(String(selection)===String(value)?'selected':'')+'>'+escape(label)+'</option>';
export const select=(id,html,label)=>'<select aria-label="'+escape(label)+'" id="'+id+'">'+html+'</select>';
export const row=(name,details,control='')=>'<div class="row"><div><b>'+name+'</b><br><small>'+details+'</small></div>'+control+'</div>';
export const panel=(title,body)=>'<section class="panel"><h3>'+title+'</h3>'+body+'</section>';
export const page=(title,html)=>'<div class="page"><h1>'+title+'</h1>'+html+'</div>';
export const moscowDate=t=>new Date(t).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export const structureName=(b,names)=>b.landmark==='fortress'?'Цитадель главы':b.id==='keep'?'Крепость':names[b.kind];
export const structureArt=b=>b.id==='keep'?'art/settlement/'+(b.landmark==='fortress'?'fortress':'keep')+'.svg':'art/settlement/'+b.kind+'.webp';
