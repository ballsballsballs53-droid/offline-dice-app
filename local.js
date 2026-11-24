const el=id=>document.getElementById(id);
for(const id of ['usersOnlineCount','bgSelect','leftStreamerList','rightStreamerList'])el(id)?.parentElement?.classList.add('source-hidden-'+id);
const palettes={neon:['#ec4eff','#27f8d3','#89fa31','#4a8bff'],pastel:['#fabbd8','#b4e4ff','#c9ebaf','#e4c2ff'],gold:['#f9d774','#dba640','#ffedac','#c98c24'],monochrome:['#aeb5c2','#8591a5','#d8deea','#6e7c91']};
const colors=[['Red','#ff0000'],['Orange','#ffa500'],['Yellow','#ffd700'],['Green','#008000'],['Blue','#0000ff'],['Purple','#800080']];
function pick(n){const a=new Uint32Array(1),limit=2**32-(2**32%n);do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n;}
let counter=0,rolls=0;
el('diceCount').replaceChildren(...Array.from({length:12},(_,i)=>new Option((i+1)+(i?' DICE':' DIE'),i+1)));
el('diceType').onchange=()=>{const wheel=el('diceType').value==='wheel';el('diceGameView').style.display=wheel?'none':'';el('wheelGameView').style.display=wheel?'block':'none';if(wheel)draw();};
const gameIdKey='offline-dice-game-id';
const idPattern=/^[A-Z2-7]{10}$/;
function getGameId(){
  const fresh=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),byte=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[byte & 31]).join('');
  try{
    const saved=localStorage.getItem(gameIdKey);
    if(saved&&idPattern.test(saved))return saved;
    let latest=null;
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);
      if(!key?.startsWith('offline-dice-proof:'))continue;
      try{
        const {record}=JSON.parse(localStorage.getItem(key));
        if(idPattern.test(record.id)&&typeof record.time==='string'&&(!latest||record.time>latest.time))latest=record;
      }catch{}
    }
    const id=latest?.id??fresh();
    localStorage.setItem(gameIdKey,id);
    return id;
  }catch{return fresh();}
}
const rollSession=getGameId();
el('gameIdDisplay').textContent=rollSession;
el('verifyRollLink').href='verify.html?id='+encodeURIComponent(rollSession);
let rollSequence=0;
async function saveRollProof(results){
  const sequence=++rollSequence;
  const record={id:rollSession,sequence,colors:results.map(([name])=>name),time:new Date().toISOString()};
  try{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(record)));
    const checksum=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(sequence===rollSequence)localStorage.setItem('offline-dice-proof:'+rollSession,JSON.stringify({record,checksum}));
  }catch{}
}
const recentRolls=[];
const historyList=el('inlineHistoryList');
historyList.replaceChildren();
function renderHistory(){
  historyList.replaceChildren(...recentRolls.map((roll,index)=>{
    const row=document.createElement('div');row.className='history-row'+(index===0?' latest-roll-row':'');
    const number=document.createElement('span');number.className='history-number';number.textContent='#'+(index+1);
    const faces=document.createElement('div');faces.className='history-faces';
    for(const [name,color] of roll){
      const face=document.createElement('span');face.className='mini-die';face.style.backgroundColor=color;face.setAttribute('role','img');face.setAttribute('aria-label',name);
      const pip=document.createElement('span');pip.className='mini-die-dot';face.append(pip);faces.append(face);
    }
    row.append(number,faces);
    if(index===0){const tag=document.createElement('span');tag.className='last-roll-tag';tag.textContent='Last roll';row.append(tag);}
    return row;
  }));
}
const rollMessages=["YOU'RE COOKED…","GOOD LUCK :)","AMAZING!","LET'S SEE…","OFFLINE DICE ON TOP!","ROLLING…"];
const rollImpactTime=1.38;
let previousRollMessage=-1;
el('rollBtn').onclick=()=>{
  const audio=el('diceRollAudio');
  const results=Array.from({length:Number(el('diceCount').value)},()=>colors[pick(6)]);
  const button=el('rollBtn'), overlay=el('rollOverlay'), stage=el('overlayDiceContainer');
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let revealed=false;
  let fallback;
  let frame;
  function reveal(){
    if(revealed)return;
    revealed=true;
    overlay.classList.add('hidden');
    el('diceContainer').replaceChildren(...results.map(([name,color])=>{
      const wrap=document.createElement('div');wrap.className='die-wrapper dice-result-reveal';
      const face=document.createElement('div');face.className='die';face.style.backgroundColor=color;
      const pip=document.createElement('div');pip.className='die-dot';face.append(pip);
      const label=document.createElement('div');label.className='die-label';label.style.color=color;label.textContent=name;
      wrap.append(face,label);return wrap;
    }));
    el('rollsTodayCount').textContent=++rolls;
    void saveRollProof(results);recentRolls.unshift(results);if(recentRolls.length>25)recentRolls.pop();
    renderHistory();
  }
  function finish(){
    clearTimeout(fallback);
    cancelAnimationFrame(frame);
    audio.removeEventListener('ended',finish);
    audio.removeEventListener('error',finish);
    reveal();
    button.disabled=false;el('diceCount').disabled=false;
  }
  function followAudio(){
    if(audio.currentTime>=rollImpactTime){reveal();return;}
    frame=requestAnimationFrame(followAudio);
  }
  button.disabled=true;el('diceCount').disabled=true;
  if(!reduceMotion){
    let message=pick(rollMessages.length-(previousRollMessage<0?0:1));
    if(previousRollMessage>=0&&message>=previousRollMessage)message++;
    previousRollMessage=message;
    el('overlayTitle').textContent=rollMessages[message];
    stage.replaceChildren(...results.map(()=>{
      const die=document.createElement('div');die.className='big-die initial-shake';
      const dot=document.createElement('div');dot.className='big-die-dot';die.append(dot);return die;
    }));
    overlay.classList.remove('hidden');
  }
  audio.addEventListener('ended',finish,{once:true});
  audio.addEventListener('error',finish,{once:true});
  fallback=setTimeout(()=>{
    audio.pause();
    finish();
  },4000);
  audio.currentTime=0;
  frame=requestAnimationFrame(followAudio);
  void audio.play().catch(()=>{
    clearTimeout(fallback);
    cancelAnimationFrame(frame);
    if(!button.disabled)return;
    fallback=setTimeout(finish,reduceMotion?0:850);
  });
};
const canvas=el('wheelCanvas'),ctx=canvas.getContext('2d'),box=el('wheelNamesTextarea'),spin=el('spinWheelBtn');
const names=()=>box.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,100);
let angle=0,busy=false;
function draw(){const wheelColors=palettes[el('wheelThemeSelect').value] || colors.map(color=>color[1]);const entries=names(),parts=entries.length?entries:['Add entries'],step=Math.PI*2/parts.length;el('wheelEntryCountBadge').textContent=entries.length+' / 100';spin.disabled=busy||!entries.length;ctx.clearRect(0,0,360,360);ctx.save();ctx.translate(180,180);parts.forEach((name,i)=>{const start=angle+i*step;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,170,start,start+step);ctx.fillStyle=wheelColors[i%wheelColors.length];ctx.fill();if(el('wheelHideTextToggle').checked)return;ctx.save();ctx.rotate(start+step/2);ctx.font='bold 12px sans-serif';ctx.textAlign='right';ctx.fillStyle='#171717';ctx.fillText((el('wheelShowNumbersToggle').checked?(i+1)+'. ':'')+name,157,0,120);ctx.restore();});ctx.fillStyle='#191a28';ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.fill();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(el('wheelCenterTextInput').value||'SPIN',0,0,54);ctx.restore();}
const setNames=list=>{box.value=list.join('\n');draw();};
const result=document.createElement('p');result.setAttribute('role','status');spin.after(result);
for(const id of ['wheelNamesTextarea','wheelHideTextToggle','wheelShowNumbersToggle','wheelCenterTextInput','wheelThemeSelect'])el(id).oninput=draw;
const operations=[()=>{const a=names();for(let i=a.length-1;i>0;i--){const j=pick(i+1);[a[i],a[j]]=[a[j],a[i]];}setNames(a)},()=>setNames(names().sort((a,b)=>a.localeCompare(b))),()=>setNames([...new Set(names())]),()=>setNames(['Alex','Jamie','Morgan','Taylor']),()=>setNames([])];
document.querySelectorAll('.wheel-action-btn').forEach((button,i)=>button.onclick=operations[i]);
spin.onclick=()=>{const list=names(),chosen=pick(list.length),start=angle,tau=Math.PI*2,goal=-Math.PI/2-(chosen+.5)*tau/list.length,distance=3*tau+((goal-start)%tau+tau)%tau;busy=true;box.disabled=true;result.textContent='';const duration=Number(el('wheelDurationSelect').value)*1000;const easing={smooth:3,bouncy:5,sudden:1}[el('wheelEasingSelect').value];const controls=[...el('wheelGameView').querySelectorAll('button,input,select,textarea')];controls.forEach(control=>control.disabled=true);const began=performance.now();function frame(now){const p=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(now-began)/duration);angle=start+distance*(1-(1-p)**easing);draw();if(p<1){requestAnimationFrame(frame);return;}busy=false;controls.forEach(control=>control.disabled=false);result.textContent='Winner: '+list[chosen];if(el('wheelRemoveOnWin').checked){list.splice(chosen,1);setNames(list);}else draw();}requestAnimationFrame(frame);};
draw();

const background=el('bgSelect');
background.replaceChildren(...[["sabblack.png","BLACK"],["sabblue.png","BLUE"],["sabgreen.png","GREEN"],["sabyellow.png","YELLOW"],["sabred.png","RED"],["sabpurple.png","PURPLE"],["saborange.png","ORANGE"],["ronaldobackground.png","RONALDO"],["lapeacebackground.png","LA PEACE"],["darkfantasy.png","DARK FANTASY"],["dessertbackground.png","DESSERT"],["sasukebackground.png","SASUKE"],["mentalistbackground.png","MENTALIST"],["rickmortybackground.png","CHILLING RICK"]].map(([file,label])=>new Option(label,file)));
background.setAttribute('aria-label','Background theme');
background.onchange=()=>{document.body.style.setProperty('--app-background', 'url("themes/'+background.value+'")');};
background.onchange();
const options={
  wheelDurationSelect:{3:'3 seconds',5:'5 seconds',8:'8 seconds',10:'10 seconds',15:'15 seconds'},
  wheelEasingSelect:{smooth:'Smooth glide',bouncy:'Quick slowdown',sudden:'Sudden stop'},
  wheelThemeSelect:{vibrant:'Vibrant rainbow',neon:'Neon',pastel:'Pastel',gold:'Gold',monochrome:'Monochrome'}
};
for(const [id,labels] of Object.entries(options))for(const option of el(id).options)if(labels[option.value])option.textContent=labels[option.value];
el('diceCount').setAttribute('aria-label','Number of dice');
el('diceType').setAttribute('aria-label','Dice or wheel');

setNames(Array.from({length:6},(_,i)=>'Player '+(i+1)));

const streamerRosters=[[["TKrots","@TKrots","tkrotspfp.jpg","https://www.youtube.com/channel/UCEmyYfFR-ZugJfcf-BgrHLg"],["BloxTapped","@BloxTapped","bloxtappedpfp.jpg","https://www.youtube.com/channel/UCNGosp3MADlWmB6jfJ_0sHw"],["MEDX","@medxlive","medxpfp.jpg","https://www.tiktok.com/@medxlive"],["FROZY","@frozy777","frozy.jpg","https://www.tiktok.com/@frozy777"],["CYOQIELWRLD","@cyoqielwrld","cyoqiewrldpfp.jpg","https://www.tiktok.com/@cyoqielwrlds"],["FortiFacts","@FortiFacts","fortifactspfp.jpg","https://www.youtube.com/@fortifacts"],["VoidsBlox","@VoidsBloxYT","voidpfp.jpg","https://www.youtube.com/@VoidsBloxYT"],["Panda Z Greysen","@PZG","pzgpfp.jpg","https://www.youtube.com/@PZG"]],[["BeanieRot","@BeanieRot","beanierotpfp.jpg","https://www.youtube.com/@BeanieRot"],["Blinder","@BlinderFps","blinderpfp.jpg","https://www.youtube.com/channel/UCY0xyOs3Yd7pCRE6d-ilMSA"],["DRAVENOX","@no1x.zzin0","dravenoxpfp.jpg","https://www.tiktok.com/@no1x.zzin0"],["LIAM KING","@liamking_4000","liamkingpfp.jpg","https://www.tiktok.com/@liamking_4000"],["DARKSON","@dark___son","darksonpfp.jpg","https://www.tiktok.com/@dark___son"],["SIN_YOU85","@sin_you85","sin_you85pfp.jpg","https://www.tiktok.com/@sin_you85"],["sugar stalker","@sugar_stalker","sugarstalkerpfp.jpg","https://www.tiktok.com/@sugar_stalker"],["iceytrades","@Iceytradess","iceytradespfp.jpg","https://www.youtube.com/@Iceytradess"],["Rhinotrades","@rhinotrades2","rhinotradespfp.jpg","https://www.tiktok.com/@rhinotrades2"]]];
for(const [index,id] of ['leftStreamerList','rightStreamerList'].entries()){
  const list=el(id);
  list.replaceChildren(...streamerRosters[index].map(([name,handle,avatar,url])=>{
    const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='streamer-card-link';
    const card=document.createElement('div');card.className='streamer-card';
    const portrait=document.createElement('img');portrait.src=avatar;portrait.alt='';portrait.width=40;portrait.height=40;portrait.loading='lazy';
    const details=document.createElement('div');
    const title=document.createElement('strong');title.textContent=name;
    const badge=document.createElement('img');badge.className='verify-badge';badge.src='verify.png';badge.alt='';title.append(badge);
    const username=document.createElement('span');username.textContent=handle;
    details.append(title,username);card.append(portrait,details);link.append(card);return link;
  }));
}
el('diceCount').value='4';

const counterPicker=el('counterChoice');
const counterOutput=el('mainCounter');
const counterMenu=el('counterItems');
const itemButtons=[...counterMenu.querySelectorAll('[data-counter-item]')];
const counterItems=itemButtons.map(button=>button.dataset.counterItem);
let selectedItem=counterItems[0];
function toggleCounterMenu(open){
  counterMenu.hidden=!open;
  counterPicker.setAttribute('aria-expanded',String(open));
}
counterPicker.onclick=()=>toggleCounterMenu(counterMenu.hidden);
for(const button of itemButtons)button.onclick=()=>{
  selectedItem=button.dataset.counterItem;
  toggleCounterMenu(false);
  renderCounter();
  counterPicker.focus();
};
document.addEventListener('click',event=>{
  if(!counterPicker.parentElement.contains(event.target))toggleCounterMenu(false);
});
counterPicker.parentElement.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!counterMenu.hidden){
    event.preventDefault();
    toggleCounterMenu(false);
    counterPicker.focus();
  }
});
const totals=Object.fromEntries(counterItems.map(item=>[item,0]));
function renderCounter(){
  for(const button of itemButtons){
    const active=button.dataset.counterItem===selectedItem;
    button.setAttribute('aria-pressed',String(active));
    if(active){const image=button.querySelector('img');const preview=counterPicker.querySelector('img');preview.src=image.getAttribute('src');preview.alt=image.alt;counterPicker.setAttribute('aria-label','Choose counter item: '+image.alt);}
  }
  const total=totals[selectedItem]/4;
  counterOutput.textContent=(total>=0?'+':'−')+Math.abs(total);
}
for(const button of el('itemCounter').querySelectorAll('[data-counter-change]')){
  button.onclick=()=>{
    const item=selectedItem;
    totals[item]+=Number(button.dataset.counterChange)*4;
    renderCounter();
  };
}
renderCounter();

// Public, read-only status feed used by the reference's streamer panels.
const liveStatusUrl='https://offline-dice-verify-default-rtdb.europe-west1.firebasedatabase.app/streamer_live_status.json';
const streamerLists=['leftStreamerList','rightStreamerList'].map(id=>[...el(id).children]);
const normalizeHandle=value=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const streamerAliases={no1xzzin0:['dravenox','no1xzzin0'],liamking4000:['liamking'],pzg:['pandazgreysen']};
function showLiveStreamers(status){
  const now=Date.now();
  const active=new Set(Object.entries(status??{}).filter(([,entry])=>{
    if(!entry?.isLive)return false;
    const age=now-Number(entry.last_seen);
    return Number.isFinite(age)&&age>=-10000&&age<=90000;
  }).map(([handle])=>normalizeHandle(handle)));
  for(const links of streamerLists){
    for(const link of links){
      const handle=normalizeHandle(link.querySelector('.streamer-card span').textContent);
      const live=[handle,...(streamerAliases[handle]??[])].some(key=>active.has(key));
      link.firstElementChild.classList.toggle('is-live',live);
      const name=link.querySelector('strong').textContent;
      link.setAttribute('aria-label',live?name+' (live)':name);
    }
    const list=links[0].parentElement;
    const sorted=[...links].sort((a,b)=>Number(b.firstElementChild.classList.contains('is-live'))-Number(a.firstElementChild.classList.contains('is-live')));
    if(sorted.some((link,index)=>list.children[index]!==link))list.append(...sorted);
  }
}
async function refreshStreamerStatus(){
  try{
    const response=await fetch(liveStatusUrl,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Status unavailable');
    showLiveStreamers(await response.json());
  }catch{showLiveStreamers(null);}
}
void refreshStreamerStatus();
setInterval(refreshStreamerStatus,25000);


const tickerToggle=el('tickerToggle');
tickerToggle.onclick=()=>{
  const paused=el('newsTickerText').classList.toggle('ticker-paused');
  tickerToggle.setAttribute('aria-pressed',String(paused));
  tickerToggle.setAttribute('aria-label',paused?'Resume updates':'Pause updates');
};

el('vipInfoButton').onclick=()=>el('vipInfoDialog').showModal();
