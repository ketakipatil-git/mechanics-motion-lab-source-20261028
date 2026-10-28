(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const speedInput = $('speedInput'), angleInput = $('angleInput'), heightInput = $('heightInput'), gravityInput = $('gravityInput');
  const trajectory = $('trajectoryCanvas'), graph = $('graphCanvas');
  const keys = {
    t:['Time','t','s'], x:['Horizontal position','x','m'], y:['Vertical position','y','m'], s:['Along-plane position','s','m'], h:['Height above plane','h','m'],
    ux:['Initial horizontal velocity','uₓ','m/s'], uy:['Initial vertical velocity','uᵧ','m/s'], vx:['Horizontal velocity','vₓ','m/s'], vy:['Vertical velocity','vᵧ','m/s'],
    vs:['Along-plane velocity','vₛ','m/s'], vn:['Normal velocity','vₙ','m/s'], speed:['Speed','|v|','m/s'], ax:['Horizontal acceleration','aₓ','m/s²'], ay:['Vertical acceleration','aᵧ','m/s²'],
    as:['Along-plane acceleration','aₛ','m/s²'], an:['Normal acceleration','aₙ','m/s²'], acc:['Acceleration magnitude','|a|','m/s²'], path:['Distance from launch','r','m'],
    v2:['Speed squared','v²','m²/s²'], a2:['Acceleration squared','a²','m²/s⁴'], hmax:['Running maximum height','hₘₐₓ','m']
  };
  const get = (p, k) => p[k];
  let state, mode = 'flat', playTime = 0, playing = false, lastFrame = 0, animationId = 0;
  let drag = false, toastTimer;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const fmt = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '—';

  function getState() {
    const u = clamp(Number(speedInput.value) || .1, .1, 150), g = clamp(Number(gravityInput.value) || 9.81, .1, 30);
    const alpha = (mode === 'incline' ? Number($('slopeInput').value) : 0) * Math.PI/180;
    const beta = (mode === 'incline' ? Number($('angleInclineInput').value) : Number(angleInput.value)) * Math.PI/180;
    const y0 = mode === 'flat' ? clamp(Number(heightInput.value) || 0, 0, 100) : 0;
    const us = u*Math.cos(beta), un = u*Math.sin(beta), as = -g*Math.sin(alpha), an = -g*Math.cos(alpha);
    const flight = mode === 'incline' ? (2*un)/(g*Math.cos(alpha)) : (un+Math.sqrt(un*un+2*g*y0))/g;
    const hmax = mode === 'incline' ? un*un/(2*g*Math.cos(alpha)) : y0+un*un/(2*g);
    const range = us*flight+.5*as*flight*flight;
    const finalVs = us+as*flight, finalVn = un+an*flight;
    const finalVx = finalVs*Math.cos(alpha)-finalVn*Math.sin(alpha);
    const finalVy = finalVs*Math.sin(alpha)+finalVn*Math.cos(alpha);
    return {u,g,alpha,beta,y0,us,un,as,an,flight,hmax,range,finalVs,finalVn,finalVx,finalVy,impactAngle:Math.atan2(finalVn,finalVs)*180/Math.PI};
  }
  function sample(t, s=state) {
    const vs=s.us+s.as*t, vn=s.un+s.an*t;
    const along=s.us*t+.5*s.as*t*t;
    const height=mode==='incline' ? s.un*t+.5*s.an*t*t : s.y0+s.un*t-.5*s.g*t*t;
    const x=mode==='incline' ? along*Math.cos(s.alpha)-height*Math.sin(s.alpha) : s.us*t;
    const y=mode==='incline' ? along*Math.sin(s.alpha)+height*Math.cos(s.alpha) : height;
    const vx=mode==='incline' ? vs*Math.cos(s.alpha)-vn*Math.sin(s.alpha) : s.us;
    const vy=mode==='incline' ? vs*Math.sin(s.alpha)+vn*Math.cos(s.alpha) : s.un-s.g*t;
    const maxReached=mode==='incline' ? Math.min(s.hmax,Math.max(0,height)) : Math.min(s.hmax,Math.max(s.y0,height));
    return {t,x,y,s:along,h:height,ux:s.us*Math.cos(s.alpha)-s.un*Math.sin(s.alpha),uy:s.us*Math.sin(s.alpha)+s.un*Math.cos(s.alpha),vx,vy,vs,vn,ax:0,ay:-s.g,as:s.as,an:s.an,g:s.g,path:Math.hypot(x,y-(mode==='flat'?s.y0:0)),speed:Math.hypot(vx,vy),acc:s.g,v2:vx*vx+vy*vy,a2:s.g*s.g,hmax:maxReached};
  }
  function showToast(msg) { const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  function update() {
    const oldFlight=state?.flight||0; state=getState();
    if(playing&&oldFlight) playTime=Math.min(state.flight,playTime/oldFlight*state.flight);
    playTime=clamp(playTime,0,state.flight);
    $('angleOutput').value=`${angleInput.value}°`; $('slopeOutput').value=`${$('slopeInput').value}°`; $('angleInclineOutput').value=`${$('angleInclineInput').value}°`;
    $('groundFields').hidden=mode!=='flat'; $('inclineFields').hidden=mode!=='incline'; $('impactAngleMetric').hidden=mode!=='incline';
    $('rangeValue').parentElement.querySelector('span').firstChild.textContent=mode==='incline'?'RANGE ALONG INCLINE ':'HORIZONTAL RANGE ';
    $('heightValue').parentElement.querySelector('span').firstChild.textContent=mode==='incline'?'MAX HEIGHT ABOVE PLANE ':'MAXIMUM HEIGHT ';
    $('readH').parentElement.firstChild.textContent=mode==='incline'?'Height above plane ':'Vertical position y ';
    $('rangeValue').innerHTML=`${fmt(state.range)} <small>m</small>`; $('heightValue').innerHTML=`${fmt(state.hmax)} <small>m</small>`;
    $('flightValue').innerHTML=`${fmt(state.flight)} <small>s</small>`; $('finalSpeedValue').innerHTML=`${fmt(Math.hypot(state.finalVx,state.finalVy))} <small>m/s</small>`;
    $('impactAngleValue').innerHTML=`${fmt(state.impactAngle)} <small>°</small>`;
    $('timeSlider').max=1000; $('timeSlider').value=Math.round(playTime/state.flight*1000)||0; $('scrubEnd').textContent=`${fmt(state.flight)} s`;
    setGraphSelects(); updateMotionReadout(); drawTrajectory(); updateGraph();
  }
  function fitCanvas(canvas) {
    const r=canvas.getBoundingClientRect(); if(!r.width||!r.height)return null;
    const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:r.width,h:r.height};
  }
  function drawTrajectory() {
    if(!state)return; const f=fitCanvas(trajectory);if(!f)return;const{ctx,w,h}=f;ctx.clearRect(0,0,w,h);
    const pad={l:44,r:18,t:14,b:25},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    const xmax=Math.max(Math.abs(state.range)*1.18, state.u*state.flight*.25,1), ymin=Math.min(0,mode==='flat'?state.y0:0), ymax=Math.max(state.hmax*1.25,state.y0+1,1);
    const xmin=Math.min(0,state.range<0?state.range*1.15:0), xmax2=Math.max(xmax,state.range*1.12);
    const px=x=>pad.l+(x-xmin)/(xmax2-xmin)*pw,py=y=>pad.t+ph-(y-ymin)/(ymax-ymin)*ph;
    ctx.font='9px DM Mono, monospace';
    for(let i=0;i<=4;i++){
      const xv=xmin+(xmax2-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;
      ctx.strokeStyle='#e9ece6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px(xv),pad.t);ctx.lineTo(px(xv),pad.t+ph);ctx.stroke();ctx.beginPath();ctx.moveTo(pad.l,py(yv));ctx.lineTo(pad.l+pw,py(yv));ctx.stroke();
      ctx.fillStyle='#919b93';ctx.textAlign='center';ctx.fillText(fmt(xv,0),px(xv),h-8);ctx.textAlign='right';ctx.fillText(fmt(yv,0),pad.l-7,py(yv)+3);
    }
    ctx.strokeStyle='#839087';ctx.beginPath();ctx.moveTo(pad.l,py(0));ctx.lineTo(pad.l+pw,py(0));ctx.stroke();ctx.beginPath();ctx.moveTo(pad.l,py(ymin));ctx.lineTo(pad.l,py(ymax));ctx.stroke();
    ctx.fillStyle='#6f7d74';ctx.textAlign='center';ctx.fillText(mode==='incline'?'s along plane (m)':'x (m)',pad.l+pw/2,h-1);
    ctx.save();ctx.translate(10,pad.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText(mode==='incline'?'height normal to plane (m)':'y (m)',0,0);ctx.restore();
    ctx.beginPath();for(let i=0;i<=100;i++){const p=sample(state.flight*i/100);i?ctx.lineTo(px(mode==='incline'?p.s:p.x),py(mode==='incline'?p.h:p.y)):ctx.moveTo(px(mode==='incline'?p.s:p.x),py(mode==='incline'?p.h:p.y));}
    ctx.strokeStyle='#ef7952';ctx.lineWidth=2.5;ctx.stroke();
    const cur=sample(playTime),cx=px(mode==='incline'?cur.s:cur.x),cy=py(mode==='incline'?cur.h:cur.y);
    if($('trailToggle').checked&&playTime>0){ctx.beginPath();ctx.moveTo(px(0),py(mode==='incline'?0:state.y0));ctx.lineTo(cx,cy);ctx.strokeStyle='#ef7952';ctx.globalAlpha=.18;ctx.lineWidth=7;ctx.stroke();ctx.globalAlpha=1;}
    if($('vectorToggle').checked){const vx=mode==='incline'?cur.vs:cur.vx,vy=mode==='incline'?cur.vn:cur.vy;const scale=Math.min(1.3,pw/Math.max(state.u*6,1));const dx=vx*scale,dy=-vy*ph/Math.max(ymax-ymin,1)*scale;ctx.strokeStyle='#477e64';ctx.fillStyle='#477e64';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+dx,cy+dy);ctx.stroke();const a=Math.atan2(dy,dx);ctx.beginPath();ctx.moveTo(cx+dx,cy+dy);ctx.lineTo(cx+dx-7*Math.cos(a-.45),cy+dy-7*Math.sin(a-.45));ctx.lineTo(cx+dx-7*Math.cos(a+.45),cy+dy-7*Math.sin(a+.45));ctx.closePath();ctx.fill();}
    ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fillStyle='#ef7952';ctx.fill();ctx.strokeStyle='#fffefa';ctx.lineWidth=2;ctx.stroke();$('timeReadout').textContent=`t = ${fmt(playTime)} s`;
  }
  function updateMotionReadout() {
    const p=sample(playTime);$('readX').textContent=`${fmt(mode==='incline'?p.s:p.x)} m`;$('readH').textContent=`${fmt(mode==='incline'?p.h:p.y)} m`;
    $('readVx').textContent=`${fmt(p.vx)} m/s`;$('readVy').textContent=`${fmt(p.vy)} m/s`;$('readAx').textContent=`0.00 m/s²`; $('readAy').textContent=`−${fmt(state.g)} m/s²`;
    $('readVs').textContent=`${fmt(p.vs)} m/s`; $('readAn').textContent=`${fmt(p.an)} m/s²`;
  }
  function setGraphSelects() {
    const x=$('xAxisSelect'),y=$('yAxisSelect');const oldX=x.value||'t',oldY=y.value||'x';
    const included=Object.entries(keys).filter(([k])=>mode==='incline'||!['s','h','vs','vn','as','an'].includes(k));
    const html=included.map(([k,v])=>`<option value="${k}">${v[0]} (${v[1]}, ${v[2]})</option>`).join('');
    if(x.options.length!==included.length){x.innerHTML=html;y.innerHTML=html;x.value=included.some(e=>e[0]===oldX)?oldX:'t';y.value=included.some(e=>e[0]===oldY)?oldY:(mode==='incline'?'h':'x');}
  }
  function niceMax(v){if(!Number.isFinite(v)||v<=0)return 1;const p=10**Math.floor(Math.log10(v)),q=v/p;return(q<=1?1:q<=2?2:q<=5?5:10)*p;}
  function formatTick(n){if(Math.abs(n)<.0001)return'0';if(Math.abs(n)>=1000||Math.abs(n)<.01)return n.toExponential(1);return Number(n.toPrecision(2)).toString();}
  function updateGraph(){if(!state)return;const xk=$('xAxisSelect').value,yk=$('yAxisSelect').value,points=Array.from({length:101},(_,i)=>{const p=sample(state.flight*i/100);return{x:get(p,xk),y:get(p,yk)}});const x0=Math.min(0,...points.map(p=>p.x)),x1=Math.max(0,...points.map(p=>p.x)),y0=Math.min(0,...points.map(p=>p.y)),y1=Math.max(0,...points.map(p=>p.y));const xs=x1-x0||1,ys=y1-y0||1;
    $('chartTitle').textContent=`${keys[yk][0]} vs ${keys[xk][0]}`;$('pointCount').textContent=`${points.length} data points`;
    $('graphXHeading').textContent=`${keys[xk][1]} (${keys[xk][2]})`;$('graphYHeading').textContent=`${keys[yk][1]} (${keys[yk][2]})`;
    $('graphDataRows').innerHTML=points.map(p=>`<tr><td>${fmt(p.x,3)}</td><td>${fmt(p.y,3)}</td></tr>`).join('');
    updateGraphMeaning(xk,yk,points);
    drawChart(points,{x:keys[xk],y:keys[yk],x0:x0-xs*.06,x1:x1+xs*.06,y0:y0-ys*.1,y1:y1+ys*.1});}
  function updateGraphMeaning(xk,yk,points){
    const xName=keys[xk][0].toLowerCase(),yName=keys[yk][0].toLowerCase();
    $('graphMeaningSummary').textContent=`This graph shows ${yName} as ${xName} changes. The table below lists the plotted coordinate pairs.`;
    let slope='The slope is the rate of change of the vertical-axis quantity with respect to the horizontal-axis quantity; this pair has no single standard kinematics interpretation.';
    if(xk==='t'){
      const positions={x:'The slope gives horizontal velocity vₓ.',y:'The slope gives vertical velocity vᵧ.',s:'The slope gives velocity along the plane vₛ.',h:'The slope gives velocity normal to the plane vₙ.',path:'The slope gives the rate of change of radial distance from launch.'};
      const velocities={vx:'The slope gives horizontal acceleration aₓ.',vy:'The slope gives vertical acceleration aᵧ.',vs:'The slope gives acceleration along the plane aₛ.',vn:'The slope gives normal acceleration aₙ.'};
      const accelerations={ax:'The slope is horizontal jerk; it is zero in this constant-gravity model.',ay:'The slope is vertical jerk; it is zero in this constant-gravity model.',as:'The slope is along-plane jerk; it is zero in this constant-gravity model.',an:'The slope is normal jerk; it is zero in this constant-gravity model.'};
      slope=positions[yk]||velocities[yk]||accelerations[yk]||(yk==='speed'?'The slope gives the rate of change of speed (tangential acceleration).':yk==='v2'?'The slope gives the rate of change of speed squared, d(v²)/dt = 2v·a.':yk==='hmax'?'The slope shows how quickly the running maximum height is increasing; it becomes zero after the apex.':yk==='ux'?'The horizontal velocity is constant, so this graph has zero slope.':'The slope describes the rate of change of this quantity over time.');
    }
    let area=0;for(let i=1;i<points.length;i++)area+=(points[i].x-points[i-1].x)*(points[i].y+points[i-1].y)/2;
    const areaRules={
      't|vx':['horizontal displacement Δx', 'm'], 't|ux':['horizontal displacement Δx', 'm'], 't|vy':['vertical displacement Δy', 'm'],
      't|vs':['along-plane displacement Δs', 'm'], 't|vn':['normal displacement Δh', 'm'], 't|speed':['distance traveled along the trajectory (numerical estimate)', 'm'], 't|acc':['magnitude of the velocity change |Δv| (gravity keeps a constant direction)', 'm/s'],
      't|ax':['change in horizontal velocity Δvₓ', 'm/s'], 't|ay':['change in vertical velocity Δvᵧ', 'm/s'],
      't|as':['change in along-plane velocity Δvₛ', 'm/s'], 't|an':['change in normal velocity Δvₙ', 'm/s']
    };
    const coordAccel={x:'ax',y:'ay',s:'as',h:'an'};
    let rule=areaRules[`${xk}|${yk}`];
    if(!rule&&coordAccel[xk]===yk)rule=['change in kinetic energy per unit mass along this coordinate, Δ(v²)/2', 'm²/s²'];
    $('graphSlopeMeaning').textContent=slope;
    if(rule)$('graphAreaMeaning').textContent=`Signed area ≈ ${fmt(area,3)} ${rule[1]}; it represents ${rule[0]}.`;
    else $('graphAreaMeaning').textContent=`Signed area ≈ ${fmt(area,3)} ${keys[xk][2]}·${keys[yk][2]}, but this axis pairing has no single standard kinematics quantity represented by its area.`;
  }
  function drawChart(points,o){const f=fitCanvas(graph);if(!f)return;const{ctx,w,h}=f;ctx.clearRect(0,0,w,h);const p={l:53,r:17,t:16,b:40},pw=w-p.l-p.r,ph=h-p.t-p.b,sx=x=>p.l+(x-o.x0)/(o.x1-o.x0)*pw,sy=y=>p.t+ph-(y-o.y0)/(o.y1-o.y0)*ph;ctx.font='9px DM Mono, monospace';
    for(let i=0;i<=4;i++){const xv=o.x0+(o.x1-o.x0)*i/4,yv=o.y0+(o.y1-o.y0)*i/4;ctx.strokeStyle='#edf0eb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx(xv),p.t);ctx.lineTo(sx(xv),p.t+ph);ctx.stroke();ctx.beginPath();ctx.moveTo(p.l,sy(yv));ctx.lineTo(p.l+pw,sy(yv));ctx.stroke();ctx.fillStyle='#919b93';ctx.textAlign='center';ctx.fillText(formatTick(xv),sx(xv),h-20);ctx.textAlign='right';ctx.fillText(formatTick(yv),p.l-8,sy(yv)+3);}
    ctx.strokeStyle='#a6b0a7';ctx.beginPath();ctx.moveTo(p.l,p.t);ctx.lineTo(p.l,p.t+ph);ctx.lineTo(p.l+pw,p.t+ph);ctx.stroke();ctx.fillStyle='#6e7b74';ctx.textAlign='center';ctx.fillText(`${o.x[1]} (${o.x[2]})`,p.l+pw/2,h-2);ctx.save();ctx.translate(11,p.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${o.y[1]} (${o.y[2]})`,0,0);ctx.restore();ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(sx(v.x),sy(v.y)):ctx.moveTo(sx(v.x),sy(v.y)));ctx.strokeStyle='#ef7952';ctx.lineWidth=2.4;ctx.stroke();for(let i=0;i<points.length;i+=10){ctx.beginPath();ctx.arc(sx(points[i].x),sy(points[i].y),2.6,0,Math.PI*2);ctx.fillStyle='#ef7952';ctx.fill();}}
  function animate(ts){if(!playing)return;if(!lastFrame)lastFrame=ts;playTime+=Math.min((ts-lastFrame)/1000,.05)*Math.max(.1,state.flight/3.2);lastFrame=ts;if(playTime>=state.flight){playTime=state.flight;playing=false;$('playButton').innerHTML='↻ &nbsp; Replay motion';}$('timeSlider').value=Math.round(playTime/state.flight*1000);drawTrajectory();updateMotionReadout();if(playing)animationId=requestAnimationFrame(animate);}
  function startPlay(){if(playing){playing=false;cancelAnimationFrame(animationId);$('playButton').innerHTML='▶ &nbsp; Resume motion';return;}if(playTime>=state.flight)playTime=0;playing=true;lastFrame=0;$('playButton').innerHTML='Ⅱ &nbsp; Pause motion';animationId=requestAnimationFrame(animate);}
  function scrubToRatio(r){playing=false;cancelAnimationFrame(animationId);playTime=clamp(r,0,1)*state.flight;$('playButton').innerHTML='▶ &nbsp; Play motion';$('timeSlider').value=Math.round(r*1000);drawTrajectory();updateMotionReadout();}
  function downloadCsv(){const xk=$('xAxisSelect').value,yk=$('yAxisSelect').value;const rows=[['time_s','x_global_m','y_global_m','s_along_plane_m','h_normal_m','vx_m_s','vy_m_s','vs_m_s','vn_m_s','ax_m_s2','ay_m_s2','as_m_s2','an_m_s2',`${xk}_${keys[xk][2]}`,`${yk}_${keys[yk][2]}`]];for(let i=0;i<=100;i++){const p=sample(state.flight*i/100);rows.push([p.t,p.x,p.y,p.s,p.h,p.vx,p.vy,p.vs,p.vn,p.ax,p.ay,p.as,p.an,get(p,xk),get(p,yk)].map(v=>Number(v).toFixed(5)));}const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`projectile-${mode}-data.csv`;a.click();URL.revokeObjectURL(a.href);}
  [speedInput,heightInput,gravityInput].forEach(el=>el.addEventListener('input',update));[angleInput,$('slopeInput'),$('angleInclineInput')].forEach(el=>el.addEventListener('input',update));[$('vectorToggle'),$('trailToggle')].forEach(el=>el.addEventListener('change',drawTrajectory));[$('xAxisSelect'),$('yAxisSelect')].forEach(el=>el.addEventListener('change',updateGraph));
  document.querySelectorAll('.mode-tab').forEach(btn=>btn.addEventListener('click',()=>{mode=btn.dataset.mode;document.querySelectorAll('.mode-tab').forEach(b=>{const yes=b===btn;b.classList.toggle('selected',yes);b.setAttribute('aria-selected',String(yes));});playing=false;playTime=0;$('playButton').innerHTML='▶ &nbsp; Play motion';update();}));
  $('playButton').addEventListener('click',startPlay);$('replayCanvas').addEventListener('click',()=>{playing=false;cancelAnimationFrame(animationId);playTime=0;$('playButton').innerHTML='Ⅱ &nbsp; Pause motion';startPlay();});$('resetButton').addEventListener('click',()=>scrubToRatio(0));$('timeSlider').addEventListener('input',e=>scrubToRatio(Number(e.target.value)/1000));$('downloadCsv').addEventListener('click',downloadCsv);
  document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{const[x,y]=btn.dataset.preset.split(',');if([...$('xAxisSelect').options].some(o=>o.value===x)){ $('xAxisSelect').value=x;$('yAxisSelect').value=y;updateGraph();}}));
  $('addPractical').addEventListener('click',()=>showToast('Your next practical can be added here — SHM is up next.'));document.querySelector('.menu-toggle').addEventListener('click',()=>document.querySelector('.topbar nav').classList.toggle('open'));document.querySelectorAll('.topbar nav a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.topbar nav').classList.remove('open')));
  trajectory.addEventListener('pointerdown',e=>{drag=true;trajectory.setPointerCapture(e.pointerId);scrubCanvas(e);});trajectory.addEventListener('pointermove',e=>{if(drag)scrubCanvas(e);});trajectory.addEventListener('pointerup',()=>drag=false);trajectory.addEventListener('pointercancel',()=>drag=false);
  function scrubCanvas(e){const r=trajectory.getBoundingClientRect();scrubToRatio(clamp((e.clientX-r.left-44)/(r.width-62),0,1));}
  initGraphOptions();update();window.addEventListener('resize',()=>{drawTrajectory();updateGraph();});
  function initGraphOptions(){const html=Object.entries(keys).map(([k,v])=>`<option value="${k}">${v[0]} (${v[1]}, ${v[2]})</option>`).join('');$('xAxisSelect').innerHTML=html;$('yAxisSelect').innerHTML=html;$('xAxisSelect').value='t';$('yAxisSelect').value='x';}
})();
