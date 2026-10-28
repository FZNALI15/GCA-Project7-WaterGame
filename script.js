'use strict';

/* WATER RUSH — no frameworks, no external dependencies.
   Every puzzle is built from a verified solution path, then scrambled. */
const LEVELS = [
  { size:4, title:'Clean Water Connection', description:'Connect the water source to the house.',
    ports:{source:0, waterHouse:3},
    water:[[0,0],[1,0],[1,1],[1,2],[1,3],[0,3]], sewage:[] },
  { size:5, title:'Safe Water, Safe Waste', description:'Bring clean water home and route sewage to treatment. Never mix the systems!',
    ports:{source:0, waterHouse:2, wasteHouse:3, treatment:4},
    water:[[0,0],[1,0],[1,1],[1,2],[0,2]],
    sewage:[[0,3],[1,3],[1,4],[0,4]] },
  { size:6, title:'The Ultimate Pipeline', description:'Two longer routes, more pipes, and more chances for contamination.',
    ports:{source:0, waterHouse:2, wasteHouse:3, treatment:5},
    water:[[0,0],[1,0],[2,0],[2,1],[3,1],[3,2],[2,2],[1,2],[0,2]],
    sewage:[[0,3],[1,3],[2,3],[2,4],[3,4],[3,5],[2,5],[1,5],[0,5]] }
];
const DIRS=['N','E','S','W'];
const VECTORS={N:[-1,0],E:[0,1],S:[1,0],W:[0,-1]};
const OPP={N:'S',S:'N',E:'W',W:'E'};
const BASE={straight:['N','S'],elbow:['N','E'],tee:['N','E','S'],cross:['N','E','S','W']};
const $=id=>document.getElementById(id);
let currentLevel=0, tiles=[], initialRotations=[], seconds=0, ticker=null, playing=false, startedAt=0, elapsedBefore=0;
const storageKey='water-rush-v1';
let progress=loadProgress();
function loadProgress(){try{const saved=JSON.parse(localStorage.getItem(storageKey));return {unlocked:Math.max(1,Math.min(3,Number(saved?.unlocked)||1)),best:Array.isArray(saved?.best)?saved.best.slice(0,3):[null,null,null]};}catch{return {unlocked:1,best:[null,null,null]};}}
function saveProgress(){try{localStorage.setItem(storageKey,JSON.stringify(progress));}catch{/* Game still works when storage is blocked. */}}
function showScreen(name){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===name+'-screen'));window.scrollTo({top:0,behavior:'instant'});}
function formatTime(s){s=Math.floor(s);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function showLevels(){stopTimer();playing=false;closeModal();renderLevelCards();showScreen('levels');}
function renderLevelCards(){const root=$('level-cards');root.innerHTML='';LEVELS.forEach((level,i)=>{const locked=i+1>progress.unlocked;const card=document.createElement('article');card.className='level-card'+(locked?' locked':'');card.innerHTML=`<div class="level-number">${locked?'🔒':String(i+1).padStart(2,'0')}</div><h2>${level.title}</h2><p>${level.description}</p><span class="record">🏆 Best time: ${progress.best[i]==null?'--:--':formatTime(progress.best[i])}</span>`;const button=document.createElement('button');button.className='btn '+(locked?'btn-outline':'btn-primary');button.disabled=locked;button.textContent=locked?'LOCKED — COMPLETE PREVIOUS LEVEL':'PLAY LEVEL '+(i+1)+' →';button.addEventListener('click',()=>startLevel(i));card.append(button);root.append(card);});}
function rotateDirs(dirs,turns){return dirs.map(d=>DIRS[(DIRS.indexOf(d)+turns)%4]);}
function getOpen(tile){return rotateDirs(BASE[tile.type],tile.rotation);}
function tileKey(r,c){return `${r},${c}`;}
function getTile(r,c){const level=LEVELS[currentLevel];if(r<0||c<0||r>=level.size||c>=level.size)return null;return tiles[r*level.size+c];}
function directionBetween(a,b){const dr=b[0]-a[0],dc=b[1]-a[1];return Object.keys(VECTORS).find(d=>VECTORS[d][0]===dr&&VECTORS[d][1]===dc);}
function typeAndRotation(dirs){for(const type of ['straight','elbow','tee','cross']){if(BASE[type].length!==dirs.length)continue;for(let turn=0;turn<4;turn++){const rotated=rotateDirs(BASE[type],turn);if(dirs.every(d=>rotated.includes(d)))return {type,rotation:turn};}}throw Error('Invalid pipe directions: '+dirs);}
function installPath(path){path.forEach((point,i)=>{const dirs=[];if(i===0||i===path.length-1)dirs.push('N');if(i>0)dirs.push(directionBetween(point,path[i-1]));if(i<path.length-1)dirs.push(directionBetween(point,path[i+1]));const piece=typeAndRotation(dirs);const tile=getTile(...point);tile.type=piece.type;tile.solvedRotation=piece.rotation;tile.isSolution=true;});}
function createTiles(){const level=LEVELS[currentLevel];tiles=Array.from({length:level.size*level.size},(_,i)=>({r:Math.floor(i/level.size),c:i%level.size,type:'elbow',rotation:0,isSolution:false}));installPath(level.water);if(level.sewage.length)installPath(level.sewage);
  tiles.forEach((tile,i)=>{if(!tile.isSolution){tile.type=['straight','elbow','tee','straight','elbow'][((tile.r*7+tile.c*11+currentLevel*3)%5)];tile.solvedRotation=0;}
    // Deterministic scrambling makes Reset reproduce exactly the same puzzle.
    const turns=tile.isSolution?1+((i*7+currentLevel)%3):((i*5+currentLevel*2)%4);
    tile.rotation=(tile.solvedRotation+turns)%4;
  });
  initialRotations=tiles.map(t=>t.rotation);
}
function positionAssets(){const level=LEVELS[currentLevel],p=level.ports;const pct=c=>`${(c+.5)/level.size*100}%`;$('source-asset').style.left=pct(p.source);$('house-asset').style.left=pct((p.waterHouse+(p.wasteHouse??p.waterHouse))/2);$('treatment-asset').style.left=pct(p.treatment??p.waterHouse);$('treatment-asset').hidden=!level.sewage.length;$('sewage-legend').hidden=!level.sewage.length;}
function renderPorts(){const level=LEVELS[currentLevel];const root=$('port-labels');root.style.gridTemplateColumns=`repeat(${level.size},minmax(0,1fr))`;root.innerHTML='';const labels={};labels[level.ports.source]=['SOURCE','water'];labels[level.ports.waterHouse]=['WATER IN','water'];if(level.sewage.length){labels[level.ports.wasteHouse]=['WASTE OUT','sewage'];labels[level.ports.treatment]=['TREATMENT','sewage'];}for(let c=0;c<level.size;c++){const el=document.createElement('div');el.className='port '+(labels[c]?.[1]||'');el.textContent=labels[c]?.[0]||'';if(!labels[c])el.style.visibility='hidden';root.append(el);}}
function pathForTile(tile){const dirs=getOpen(tile),x=50,y=50,points={N:[50,0],E:[100,50],S:[50,100],W:[0,50]};return dirs.map(d=>`M ${x} ${y} L ${points[d][0]} ${points[d][1]}`).join(' ');}
function drawTiles(){const root=$('pipe-grid');const level=LEVELS[currentLevel];root.innerHTML='';root.style.gridTemplateColumns=`repeat(${level.size},minmax(0,1fr))`;tiles.forEach((tile,i)=>{const b=document.createElement('button');b.className='pipe-tile';b.type='button';b.setAttribute('aria-label',`Rotate pipe at row ${tile.r+1}, column ${tile.c+1}`);b.dataset.index=i;b.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><path class="pipe-shape"/><path class="pipe-inner"/><path class="flow-overlay"/></svg>';b.addEventListener('click',()=>rotateTile(i));root.append(b);drawTile(i);});}
function drawTile(i){const el=$('pipe-grid').children[i],path=pathForTile(tiles[i]);el.querySelectorAll('path').forEach(p=>p.setAttribute('d',path));}
function startLevel(index){if(index+1>progress.unlocked)return;closeModal();currentLevel=index;createTiles();positionAssets();renderPorts();drawTiles();$('game-title').textContent=`LEVEL ${index+1} / 3`;$('mission-title').textContent=LEVELS[index].title;$('mission-detail').textContent=LEVELS[index].description;$('best-time').textContent=progress.best[index]==null?'--:--':formatTime(progress.best[index]);$('game-feedback').textContent='Tap pipes to rotate them clockwise.';seconds=0;$('timer').textContent='00:00';playing=true;showScreen('game');startTimer();updateFlow();}
function startTimer(){stopTimer();startedAt=performance.now();elapsedBefore=0;ticker=setInterval(()=>{if(!playing)return;seconds=Math.floor((performance.now()-startedAt+elapsedBefore)/1000);$('timer').textContent=formatTime(seconds);},200);}
function stopTimer(){if(ticker!==null){clearInterval(ticker);ticker=null;}}
function rotateTile(index){if(!playing)return;tiles[index].rotation=(tiles[index].rotation+1)%4;drawTile(index);evaluateBoard();}
function resetPuzzle(){if(!playing)return;tiles.forEach((t,i)=>{t.rotation=initialRotations[i];drawTile(i);});seconds=0;$('timer').textContent='00:00';startTimer();$('game-feedback').textContent='Puzzle reset. You have a fresh start!';updateFlow();}
function getConnectedFrom(portColumn){const visited=new Set(),queue=[];const top=getTile(0,portColumn);if(!top||!getOpen(top).includes('N'))return visited;queue.push(top);visited.add(tileKey(top.r,top.c));while(queue.length){const t=queue.shift();for(const dir of getOpen(t)){const [dr,dc]=VECTORS[dir],next=getTile(t.r+dr,t.c+dc);if(!next||!getOpen(next).includes(OPP[dir]))continue;const key=tileKey(next.r,next.c);if(!visited.has(key)){visited.add(key);queue.push(next);}}}return visited;}
function portConnected(component,column){return component.has(tileKey(0,column))&&getOpen(getTile(0,column)).includes('N');}
function evaluateBoard(){const p=LEVELS[currentLevel].ports,water=getConnectedFrom(p.source),waste=p.wasteHouse===undefined?new Set():getConnectedFrom(p.wasteHouse);
  const waterComplete=portConnected(water,p.waterHouse),sewageComplete=p.wasteHouse===undefined||portConnected(waste,p.treatment);
  const mixed=p.wasteHouse!==undefined&&(portConnected(water,p.wasteHouse)||portConnected(water,p.treatment)||portConnected(waste,p.source)||portConnected(waste,p.waterHouse)||[...water].some(key=>waste.has(key)));
  updateFlow(water,waste,mixed);
  if(mixed){playing=false;stopTimer();$('game-feedback').textContent='Contamination! Clean water and sewage have mixed.';showResult('contamination');return;}
  if(waterComplete&&sewageComplete){playing=false;stopTimer();seconds=Math.floor((performance.now()-startedAt+elapsedBefore)/1000);$('timer').textContent=formatTime(seconds);const old=progress.best[currentLevel];const newRecord=old===null||seconds<old;if(newRecord)progress.best[currentLevel]=seconds;progress.unlocked=Math.max(progress.unlocked,Math.min(3,currentLevel+2));saveProgress();showResult('win',newRecord);confetti();return;}
  $('game-feedback').textContent=waterComplete?'✓ Clean water connected! Now finish the sewage line.':sewageComplete&&p.wasteHouse!==undefined?'✓ Sewage safely connected! Now deliver clean water.':'Rotate pipes to connect the matching endpoints.';
}
function updateFlow(water,waste,mixed=false){const p=LEVELS[currentLevel].ports;water=water??getConnectedFrom(p.source);waste=waste??(p.wasteHouse===undefined?new Set():getConnectedFrom(p.wasteHouse));tiles.forEach((tile,i)=>{const el=$('pipe-grid').children[i],key=tileKey(tile.r,tile.c);el.classList.toggle('flow-water',water.has(key));el.classList.toggle('flow-sewage',!water.has(key)&&waste.has(key));el.classList.toggle('contaminated',mixed&&(water.has(key)&&waste.has(key)));});}
function closeModal(){$('result-modal').classList.add('hidden');}
function showResult(type,newRecord=false){const win=type==='win',final=win&&currentLevel===2;$('result-icon').textContent=win?(final?'🏆':'🎉'):'⚠️';$('result-title').textContent=win?(final?'ALL COMMUNITIES CONNECTED!':'CLEAN WATER CONNECTED!'):'WATER CONTAMINATED!';$('result-title').style.color=win?'#087fbc':'#c43d38';$('result-message').textContent=win?(final?'You completed every pipeline! Safe water and responsible wastewater management protect communities.':'Excellent work! You delivered clean water and kept wastewater safely separated.'):'A pipe connection allowed sewage to reach the clean-water system. Reset the puzzle and try a safer route.';$('result-stats').textContent=win?`Completion time: ${formatTime(seconds)}${newRecord?' · 🏅 NEW BEST TIME!':''}`:'Your best time is safe. This attempt does not count.';
  const actions=$('result-actions');actions.innerHTML='';const add=(label,fn,primary=true)=>{const b=document.createElement('button');b.className='btn '+(primary?'btn-primary':'btn-outline');b.textContent=label;b.addEventListener('click',fn);actions.append(b);};
  if(win){if(!final)add('NEXT LEVEL →',()=>startLevel(currentLevel+1));else add('PLAY AGAIN ↻',()=>startLevel(0));add('LEVEL SELECT',showLevels,false);}else{add('RESET LEVEL ↻',()=>{closeModal();startLevel(currentLevel);});add('LEVEL SELECT',showLevels,false);}
  $('result-modal').classList.remove('hidden');actions.querySelector('button')?.focus();}
function confetti(){const root=$('confetti');root.innerHTML='';const colors=['#ffcf24','#008fe3','#31c0f5','#ff8a4c','#6bd783'];for(let i=0;i<75;i++){const piece=document.createElement('div');piece.className='confetti-piece';piece.style.left=Math.random()*100+'%';piece.style.background=colors[i%colors.length];piece.style.animationDelay=Math.random()*.8+'s';piece.style.animationDuration=2+Math.random()*2+'s';root.append(piece);}setTimeout(()=>root.innerHTML='',4500);}
$('play-button').addEventListener('click',showLevels);$('levels-home').addEventListener('click',()=>{stopTimer();showScreen('home');});$('back-button').addEventListener('click',showLevels);$('reset-button').addEventListener('click',resetPuzzle);
renderLevelCards();
