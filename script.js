
const SUPABASE_URL="https://wcyjhwnbnlnvlsgyjyvo.supabase.co";
const SUPABASE_KEY="sb_publishable_-J8mF8tmmWwKTmpt0K6hoQ_-jdJ4O1c";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);

let signup=false,user=null;
let data={
  stars:0,habits:[],tasks:[],rewards:[],events:[],
  notes:{},moods:{},library:[]
};
let month=new Date();
let selectedHabit="all";
let selectedCalendarDate=null;
let toastTimer=null;

const today=()=>{
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const uid=()=>crypto.randomUUID();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function msg(t,ok=false){
  $('auth-message').textContent=t;
  $('auth-message').style.color=ok?'#248a3d':'#d70015';
}
function toast(text){
  const el=$('toast');
  el.textContent=text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}

function authMode(){
  signup=!signup;
  $('auth-submit').textContent=signup?'Create account':'Sign in';
  $('auth-toggle').textContent=signup?'Already have an account? Sign in':'Create account';
  $('password').autocomplete=signup?'new-password':'current-password';
  msg('');
}
$('auth-toggle').onclick=authMode;

$('auth-form').onsubmit=async e=>{
  e.preventDefault();
  const b=$('auth-submit');
  b.disabled=true;b.textContent='Please wait…';
  try{
    const email=$('email').value.trim();
    const password=$('password').value;
    const r=signup
      ?await sb.auth.signUp({email,password})
      :await sb.auth.signInWithPassword({email,password});
    if(r.error)throw r.error;
    if(signup&&!r.data.session)msg('Account created! Confirm your email, then sign in.',true);
    else if(r.data.user)await enter(r.data.user);
  }catch(x){msg(x.message);}
  finally{b.disabled=false;b.textContent=signup?'Create account':'Sign in';}
};

async function enter(u){
  user=u;
  $('auth-view').classList.add('hidden');
  $('app').classList.remove('hidden');
  await loadData();
  render();
  sb.auth.onAuthStateChange(ev=>{
    if(ev==='SIGNED_OUT')location.reload();
  });
}

async function loadData(){
  const {data:row,error}=await sb.from('today_data')
    .select('payload').eq('user_id',user.id).maybeSingle();
  if(error){
    alert('Database setup required. Open setup.sql in Supabase SQL Editor.\n'+error.message);
    return;
  }
  if(row?.payload)data={...data,...row.payload};
  data.events=data.events||[];
  data.habits=data.habits||[];
  data.tasks=data.tasks||[];
  data.rewards=data.rewards||[];
  data.notes=data.notes||{};
  data.moods=data.moods||{};
  data.library=data.library||[];
}

let notesTimer;
$('daily-notes').addEventListener('input',()=>{
  const date=today();
  if(!data.notes)data.notes={};
  data.notes[date]=$('daily-notes').value;
  $('notes-status').textContent='Saving...';
  clearTimeout(notesTimer);
  notesTimer=setTimeout(async()=>{
    await save();
    $('notes-status').textContent='Saved';
  },700);
});

let saveTimer;
async function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    const {error}=await sb.from('today_data').upsert({
      user_id:user.id,payload:data,updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if(error)alert('Save error: '+error.message);
  },250);
}

$('logout').onclick=async()=>{await sb.auth.signOut();location.reload();};

document.querySelectorAll('.nav').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
    $('page-'+b.dataset.page).classList.remove('hidden');
    $('page-title').textContent={
      today:'Today',stats:'Statistics',shop:'Shop',library:'Library'
    }[b.dataset.page];
    if(b.dataset.page==='stats')renderStats();
    if(b.dataset.page==='library')renderLibrary();
  };
});

$('date-label').textContent=new Date().toLocaleDateString('en-US',{
  weekday:'long',month:'long',day:'numeric'
});

function render(){
  $('stars').textContent=$('stars-top').textContent=data.stars;
  renderHabits();
  renderTasks();
  renderQuickNotes();
  renderMood();
  renderLibrary();
  renderShop();
  renderStats();
}

function empty(t){return `<div class="empty">${esc(t)}</div>`;}

function renderHabits(){
  $('habits-list').innerHTML=data.habits.length
    ?data.habits.map(h=>{
      const done=h.done===today();
      return `<div class="item ${done?'completed':''}">
        <button class="check ${done?'done':''}" data-habit="${h.id}">${done?'✓':''}</button>
        <div class="item-text"><strong>${esc(h.name)}</strong>
        <small>${done?'Completed today':'Daily habit'} · ${h.stars} ☆</small></div>
        <div class="item-actions">
          <button class="icon-btn" data-edit-h="${h.id}">✎</button>
          <button class="icon-btn" data-del-h="${h.id}">×</button>
        </div>
      </div>`;
    }).join('')
    :empty('No habits yet. Add your first one!');
}

function renderTasks(){
  const list=data.tasks.filter(t=>t.date===today()||!t.done);
  const active=list.filter(t=>!t.done);
  const completed=list.filter(t=>t.done);
  $('tasks-list').innerHTML=`
    ${active.length?`<div class="task-section-title">TO DO · ${active.length}</div>
      ${active.map(taskCard).join('')}`:''}
    ${completed.length?`<div class="task-section-title completed-title">COMPLETED · ${completed.length}</div>
      ${completed.map(taskCard).join('')}`:''}
    ${!list.length?empty('Nothing planned. Enjoy your day!'):''}
  `;
}

function renderQuickNotes(){
  const input=$('daily-notes');
  if(!input)return;
  input.value=data.notes?.[today()]||'';
  $('notes-status').textContent='Saved';
}

function taskCard(t){
  return `<div class="item ${t.done?'completed':''}">
    <button class="check ${t.done?'done':''}" data-task="${t.id}">${t.done?'✓':''}</button>
    <div class="item-text"><strong>${esc(t.name)}</strong><small>${t.date} · ${t.stars} ☆</small></div>
    <div class="item-actions">
      <button class="icon-btn" data-edit-t="${t.id}">✎</button>
      <button class="icon-btn" data-del-t="${t.id}">×</button>
    </div>
  </div>`;
}

function renderShop(){
  $('shop-list').innerHTML=data.rewards.length
    ?data.rewards.map(r=>`<article class="reward">
      <strong>${esc(r.name)}</strong><span class="cost">${r.cost} ☆</span>
      <button class="primary" data-buy="${r.id}" ${data.stars<r.cost?'disabled':''}>Redeem</button>
      <button class="icon-btn" data-edit-r="${r.id}">Edit</button>
      <button class="icon-btn" data-del-r="${r.id}">Delete</button>
    </article>`).join('')
    :empty('Your reward shop is empty. Add something you want!');
  const buys=data.events.filter(e=>e.type==='buy').slice().reverse();
  $('purchase-history').innerHTML=buys.length?buys.map(e=>`
    <div class="item">
      <div class="item-text"><strong>${esc(e.name)}</strong><small>${e.date}</small></div>
      <b>−${e.amount} ☆</b>
    </div>`).join(''):empty('No purchases yet');
}

/* MOOD & ENERGY */
function renderMood(){
  const m=data.moods?.[today()]||{};
  document.querySelectorAll('[data-mood]').forEach(b=>
    b.classList.toggle('selected',String(m.mood)===b.dataset.mood));
  document.querySelectorAll('[data-energy]').forEach(b=>
    b.classList.toggle('selected',String(m.energy)===b.dataset.energy));
  $('mood-note').value=m.note||'';
  $('mood-status').textContent='Saved';
}
let moodTimer;
function saveMood(){
  const date=today(),old=data.moods[date]||{};
  data.moods[date]={...old,note:$('mood-note').value};
  $('mood-status').textContent='Saving…';
  clearTimeout(moodTimer);
  moodTimer=setTimeout(()=>{save();$('mood-status').textContent='Saved';},600);
}
$('mood-options').addEventListener('click',e=>{
  const b=e.target.closest('[data-mood]');if(!b)return;
  data.moods[today()]={...(data.moods[today()]||{}),mood:+b.dataset.mood};
  renderMood();saveMood();
});
$('energy-options').addEventListener('click',e=>{
  const b=e.target.closest('[data-energy]');if(!b)return;
  data.moods[today()]={...(data.moods[today()]||{}),energy:+b.dataset.energy};
  renderMood();saveMood();
});
$('mood-note').addEventListener('input',saveMood);

/* LIBRARY */
let libraryKind='all';
const libraryTypes={book:'Book',movie:'Movie',series:'Series',podcast:'Podcast',article:'Article'};
function renderLibrary(){
  const items=(data.library||[]).filter(x=>libraryKind==='all'||x.type===libraryKind);
  $('library-grid').innerHTML=items.length?items.map(x=>`<article class="library-card">
    ${x.cover?`<img class="library-cover" src="${esc(x.cover)}" alt="${esc(x.title)} cover">`:`<div class="library-cover cover-placeholder">${({book:'📚',movie:'🎬',series:'📺',podcast:'🎧',article:'📰'})[x.type]||'✦'}</div>`}
    <div class="library-info"><div class="library-type">${libraryTypes[x.type]||'Item'} · ${esc(x.status||'planned')}</div><strong>${esc(x.title)}</strong>
    ${x.rating?`<div class="library-rating">${'★'.repeat(x.rating)}${'☆'.repeat(5-x.rating)}</div>`:''}
    ${x.type==='series'?`<small>Season ${x.season||1} · ${x.episode||0}/${x.totalEpisodes||0} episodes</small>`:''}
    ${x.review?`<p>${esc(x.review)}</p>`:''}</div>
    <div class="library-actions">
      <button type="button" class="icon-btn" data-lib-progress="${x.id}">${x.type==='series'?'＋ Episode':'✓ Status'}</button>
      <button type="button" class="icon-btn" data-lib-edit="${x.id}">✎</button>
      <button type="button" class="icon-btn" data-lib-del="${x.id}">×</button>
    </div>
  </article>`).join(''):empty('Your library is waiting for its first story ✨');
}
$('library-filters').addEventListener('click',e=>{
  const b=e.target.closest('[data-kind]');if(!b)return;
  libraryKind=b.dataset.kind;
  document.querySelectorAll('#library-filters .filter').forEach(x=>x.classList.toggle('active',x===b));
  renderLibrary();
});

function libraryForm(item={}){
  const type=item.type||'book';
  modal(item.id?'Edit item':'Add to library',`
  <label>Type</label><select name="type">${Object.entries(libraryTypes).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v}</option>`).join('')}</select>
  <label>Title</label><input name="title" required value="${esc(item.title||'')}" placeholder="Title">
  <label>Cover image</label><input name="coverFile" type="file" accept="image/*">
  <label>Or cover URL</label><input name="cover" type="url" value="${esc(item.cover||'')}" placeholder="https://…">
  <label>Status</label><select name="status">
    <option value="planned" ${item.status==='planned'?'selected':''}>Planned</option>
    <option value="in progress" ${item.status==='in progress'?'selected':''}>In progress</option>
    <option value="completed" ${item.status==='completed'?'selected':''}>Completed</option>
  </select>
  <label>Rating (1–5)</label><select name="rating"><option value="">No rating</option>
    ${[1,2,3,4,5].map(n=>`<option value="${n}" ${item.rating===n?'selected':''}>${n} ★</option>`).join('')}
  </select>
  <label>Review / notes</label><textarea name="review" maxlength="2000" placeholder="Your thoughts…">${esc(item.review||'')}</textarea>
  ${type==='series'||item.type==='series'?`
    <label>Season</label><input name="season" type="number" min="1" value="${item.season||1}">
    <label>Current episode</label><input name="episode" type="number" min="0" value="${item.episode||0}">
    <label>Total episodes in season</label><input name="totalEpisodes" type="number" min="0" value="${item.totalEpisodes||0}">
  `:''}`,
  async f=>{
    const file=f.get('coverFile');let cover=f.get('cover')||item.cover||'';
    if(file&&file.size){
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=`${user.id}/${uid()}-${safeName}`;
      const {error}=await sb.storage.from('library-covers').upload(path,file,{upsert:false});
      if(error){toast('Cover upload failed: '+error.message);throw error;}
      cover=sb.storage.from('library-covers').getPublicUrl(path).data.publicUrl;
    }
    const obj={...item,id:item.id||uid(),type:f.get('type'),
      title:f.get('title').trim(),cover,status:f.get('status'),
      rating:f.get('rating')?+f.get('rating'):null,review:f.get('review').trim()};
    if(obj.type==='series'){
      obj.season=+f.get('season')||1;
      obj.episode=+f.get('episode')||0;
      obj.totalEpisodes=+f.get('totalEpisodes')||0;
    }else{
      delete obj.season;delete obj.episode;delete obj.totalEpisodes;
    }
    if(item.id)data.library=data.library.map(x=>x.id===item.id?obj:x);
    else data.library.unshift(obj);
    save();renderLibrary();toast(item.id?'Updated ✨':'Added to library ✨');
  });
}
$('add-library').onclick=()=>libraryForm();

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.libEdit){
    const item=data.library.find(x=>x.id===b.dataset.libEdit);
    if(item)libraryForm(item);
  }
  if(b.dataset.libDel){
    if(confirm('Delete this library item?')){
      data.library=data.library.filter(x=>x.id!==b.dataset.libDel);
      save();renderLibrary();toast('Removed');
    }
  }
  if(b.dataset.libProgress){
    const item=data.library.find(x=>x.id===b.dataset.libProgress);if(!item)return;
    if(item.type==='series'){
      item.episode=Math.min((item.totalEpisodes||999),(+item.episode||0)+1);
      if(item.totalEpisodes&&item.episode>=item.totalEpisodes){
        item.episode=0;item.season=(+item.season||1)+1;
      }
    }else item.status=item.status==='completed'?'in progress':'completed';
    save();renderLibrary();
    toast(item.type==='series'?'Episode updated 📺':'Status updated');
  }
});

/* HELPERS FOR STATISTICS */
function habitDates(habitId){
  return [...new Set(data.events.filter(e=>e.type==='habit'&&e.habitId===habitId).map(e=>e.date))].sort();
}
function streakFor(habitId){
  const dates=habitDates(habitId),set=new Set(dates);
  let current=0,best=0;
  for(const date of dates){
    const prev=new Date(date+'T12:00:00');
    prev.setDate(prev.getDate()-1);
    const prevKey=prev.toISOString().slice(0,10);
    if(!set.has(prevKey))current=0;
    current++;best=Math.max(best,current);
  }
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yKey=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  if(!set.has(today())&&!set.has(yKey))current=0;
  return {current,best};
}

function renderStats(){
  const y=month.getFullYear(),m=month.getMonth();
  const monthKey=`${y}-${String(m+1).padStart(2,'0')}`;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const events=data.events.filter(e=>e.date&&e.date.slice(0,7)===monthKey);
  $('month-name').textContent=month.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  $('stat-done').textContent=events.filter(e=>e.type==='complete').length;
  const earned=events.filter(e=>e.type==='earn').reduce((s,e)=>s+Number(e.amount||0),0);
  $('stat-earned').textContent=earned+' ☆';
  const habitEvents=events.filter(e=>e.type==='habit');
  const elapsed=monthKey===today().slice(0,7)?new Date().getDate():monthKey>today().slice(0,7)?0:daysInMonth;
  const possible=data.habits.length*elapsed;
  $('stat-rate').textContent=possible?Math.round(habitEvents.length/possible*100)+'%':'0%';
  let allCurrent=0,allBest=0;
  data.habits.forEach(h=>{const s=streakFor(h.id);allCurrent+=s.current;allBest=Math.max(allBest,s.best);});
  $('stat-streak').textContent=allCurrent+' days';
  $('stat-best-streak').textContent=allBest+' days';
  const dayCounts={};
  habitEvents.forEach(e=>dayCounts[e.date]=(dayCounts[e.date]||0)+1);
  const best=Object.entries(dayCounts).sort((a,b)=>b[1]-a[1])[0];
  $('stat-best-day').textContent=best?new Date(best[0]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
  renderHabitFilter();renderCalendar();renderHabitStats();
}

function renderHabitFilter(){
  const select=$('habit-filter'),old=selectedHabit;
  select.innerHTML='<option value="all">All habits</option>'+data.habits.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('');
  if(data.habits.some(h=>h.id===old))select.value=old;else select.value='all';
  selectedHabit=select.value;
}
$('habit-filter').onchange=()=>{
  selectedHabit=$('habit-filter').value;
  selectedCalendarDate=null;$('calendar-detail').classList.add('hidden');
  renderCalendar();renderHabitStats();
};

function renderCalendar(){
  const calendar=$('habit-calendar');calendar.innerHTML='';
  const y=month.getFullYear(),m=month.getMonth();
  const offset=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  for(let i=0;i<offset;i++){
    const el=document.createElement('div');el.className='calendar-day empty';calendar.appendChild(el);
  }
  for(let day=1;day<=days;day++){
    const date=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    let events=data.events.filter(e=>e.type==='habit'&&e.date===date);
    if(selectedHabit!=='all')events=events.filter(e=>e.habitId===selectedHabit);
    const habits=events.map(e=>data.habits.find(h=>h.id===e.habitId)).filter(Boolean);
    const cell=document.createElement('button');
    cell.type='button';
    cell.className='calendar-day'+(habits.length?' completed':'')+(date===today()?' today':'');
    cell.dataset.calendarDate=date;
    cell.innerHTML=`<span class="calendar-date">${day}</span><div class="calendar-habits">${habits.map(h=>`<span class="calendar-habit">${esc(h.name)}</span>`).join('')}</div>`;
    calendar.appendChild(cell);
  }
}

$('habit-calendar').addEventListener('click',e=>{
  const cell=e.target.closest('[data-calendar-date]');if(!cell)return;
  selectedCalendarDate=cell.dataset.calendarDate;renderCalendarDetail(selectedCalendarDate);
});
function renderCalendarDetail(date){
  const box=$('calendar-detail');
  let events=data.events.filter(e=>e.type==='habit'&&e.date===date);
  if(selectedHabit!=='all')events=events.filter(e=>e.habitId===selectedHabit);
  const habits=events.map(e=>data.habits.find(h=>h.id===e.habitId)).filter(Boolean);
  box.classList.remove('hidden');
  box.innerHTML=`<h3>${new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</h3>
    ${habits.length?habits.map(h=>`<div class="calendar-detail-row"><span>✓ ${esc(h.name)}</span><b>${h.stars} ☆</b></div>`).join(''):'<small>No habits completed on this day.</small>'}`;
}
function renderHabitStats(){
  const y=month.getFullYear(),m=month.getMonth(),days=new Date(y,m+1,0).getDate();
  const habits=selectedHabit==='all'?data.habits:data.habits.filter(h=>h.id===selectedHabit);
  $('habit-stats').innerHTML=habits.length?habits.map(h=>{
    const dates=habitDates(h.id).filter(d=>d.slice(0,7)===`${y}-${String(m+1).padStart(2,'0')}`);
    const percent=Math.round(dates.length/days*100),streak=streakFor(h.id);
    return `<div class="item habit-stat-row"><div class="item-text"><strong>${esc(h.name)}</strong>
      <small>${dates.length} days this month · 🔥 ${streak.current} current / ${streak.best} best</small>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div><b>${percent}%</b></div>`;
  }).join(''):empty('Add habits to see statistics');
}

/* MONTH NAVIGATION */
$('prev-month').onclick=()=>{
  month=new Date(month.getFullYear(),month.getMonth()-1,1);
  selectedCalendarDate=null;$('calendar-detail').classList.add('hidden');renderStats();
};
$('next-month').onclick=()=>{
  month=new Date(month.getFullYear(),month.getMonth()+1,1);
  selectedCalendarDate=null;$('calendar-detail').classList.add('hidden');renderStats();
};

/* MODALS */
function modal(title,fields,callback){
  $('modal-title').textContent=title;
  $('modal-fields').innerHTML=fields;
  $('modal').classList.remove('hidden');
  const form=$('modal-form');form.enctype='multipart/form-data';
  form.onsubmit=async e=>{
    e.preventDefault();
    try{
      await callback(new FormData(e.target));
      $('modal').classList.add('hidden');
    }catch(err){console.error(err);toast(err.message||'Something went wrong');}
  };
}
$('modal-close').onclick=()=> $('modal').classList.add('hidden');
$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.add('hidden');};

function purchaseConfirm(reward){
  $('purchase-title').textContent='Reward unlocked! ✨';
  $('purchase-description').textContent=`${reward.name} — ${reward.cost} stars. Enjoy your reward!`;
  $('purchase-modal').classList.remove('hidden');
}
$('purchase-ok').onclick=()=> $('purchase-modal').classList.add('hidden');
$('purchase-modal').onclick=e=>{if(e.target===$('purchase-modal'))$('purchase-modal').classList.add('hidden');};

/* ADD */
$('add-habit').onclick=()=>modal('New habit',
  '<label>Name</label><input name="name" required placeholder="Drink water"><label>Stars per day</label><input name="stars" type="number" min="0" value="1" required>',
  f=>{data.habits.push({id:uid(),name:f.get('name'),stars:+f.get('stars'),done:null});save();render();toast('Habit added 💗');});

$('add-task').onclick=()=>modal('New task',
  `<label>Name</label><input name="name" required placeholder="Read 10 pages"><label>Date</label><input name="date" type="date" required value="${today()}"><label>Stars</label><input name="stars" type="number" min="0" value="1" required>`,
  f=>{data.tasks.push({id:uid(),name:f.get('name'),date:f.get('date'),stars:+f.get('stars'),done:false});save();render();toast('Task added');});

$('add-reward').onclick=()=>modal('New reward',
  '<label>Name</label><input name="name" required placeholder="Coffee date"><label>Price in stars</label><input name="cost" type="number" min="1" value="10" required>',
  f=>{data.rewards.push({id:uid(),name:f.get('name'),cost:+f.get('cost')});save();render();toast('Reward added ✨');});

/* ACTIONS */
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;

  if(b.dataset.habit){
    const h=data.habits.find(x=>x.id===b.dataset.habit),date=today();
    if(h.done===date){
      h.done=null;data.stars=Math.max(0,data.stars-h.stars);
      data.events=data.events.filter(ev=>!(
  (ev.type==='habit'&&ev.habitId===h.id&&ev.date===date)||
  (ev.type==='earn'&&ev.habitId===h.id&&ev.date===date)
));
    }else{
      h.done=date;data.stars+=h.stars;
      data.events.push({type:'habit',date,amount:h.stars,name:h.name,habitId:h.id});
      data.events.push({type:'earn',date,amount:h.stars,name:h.name,habitId:h.id});
    }
    save();render();return;
  }

  if(b.dataset.task){
    const t=data.tasks.find(x=>x.id===b.dataset.task);if(!t)return;
    t.done=!t.done;
    if(t.done){
      data.stars+=t.stars;
      data.events.push({type:'complete',date:today(),amount:t.stars,name:t.name,taskId:t.id});
      data.events.push({type:'earn',date:today(),amount:t.stars,name:t.name,taskId:t.id});
    }else{
      data.stars=Math.max(0,data.stars-t.stars);
      data.events=data.events.filter(ev=>!(
        (ev.type==='complete'&&ev.taskId===t.id)||
        (ev.type==='earn'&&ev.taskId===t.id)
      ));
    }
    save();render();return;
  }

  for(const [arr,type] of [['habits','h'],['tasks','t'],['rewards','r']]){
    const id=b.dataset['del-'+type];if(!id)continue;
    if(!confirm('Delete this item?'))return;
    if(type==='h'){
      const done=data.events.filter(ev=>ev.type==='habit'&&ev.habitId===id);
      data.stars=Math.max(0,data.stars-done.reduce((s,ev)=>s+Number(ev.amount||0),0));
      data.events=data.events.filter(ev=>ev.habitId!==id);
    }
    if(type==='t'){
      const t=data.tasks.find(x=>x.id===id);
      if(t?.done)data.stars=Math.max(0,data.stars-t.stars);
      data.events=data.events.filter(ev=>ev.taskId!==id);
    }
    data[arr]=data[arr].filter(x=>x.id!==id);
    save();render();toast('Deleted');return;
  }

  if(b.dataset['edit-h']){
    const h=data.habits.find(x=>x.id===b.dataset.editH);if(!h)return;
    modal('Edit habit',`<label>Name</label><input name="name" required value="${esc(h.name)}"><label>Stars per day</label><input name="stars" type="number" min="0" value="${h.stars}" required>`,
      f=>{h.name=f.get('name');h.stars=+f.get('stars');save();render();toast('Habit updated');});
    return;
  }
  if(b.dataset['edit-t']){
    const t=data.tasks.find(x=>x.id===b.dataset.editT);if(!t)return;
    modal('Edit task',`<label>Name</label><input name="name" required value="${esc(t.name)}"><label>Date</label><input name="date" type="date" required value="${t.date}"><label>Stars</label><input name="stars" type="number" min="0" value="${t.stars}" required>`,
      f=>{t.name=f.get('name');t.date=f.get('date');t.stars=+f.get('stars');save();render();toast('Task updated');});
    return;
  }
  if(b.dataset['edit-r']){
    const r=data.rewards.find(x=>x.id===b.dataset.editR);if(!r)return;
    modal('Edit reward',`<label>Name</label><input name="name" required value="${esc(r.name)}"><label>Price</label><input name="cost" type="number" min="1" value="${r.cost}" required>`,
      f=>{r.name=f.get('name');r.cost=+f.get('cost');save();render();toast('Reward updated');});
    return;
  }

  if(b.dataset.buy){
    const r=data.rewards.find(x=>x.id===b.dataset.buy);if(!r)return;
    if(data.stars<r.cost){toast('Not enough stars ⭐');return;}
    data.stars-=r.cost;
    data.events.push({type:'buy',date:today(),amount:r.cost,name:r.name,rewardId:r.id});
    save();render();purchaseConfirm(r);return;
  }
});

/* INITIALIZATION */
(async()=>{
  if(!window.supabase){msg('Supabase CDN failed. Check internet and refresh.');return;}
  const {data:sessionData,error}=await sb.auth.getSession();
  if(error)msg(error.message);
  if(sessionData.session)await enter(sessionData.session.user);
})();
