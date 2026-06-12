// Felipe OS - Producao simples e estavel
(function(){
  const PLAN='Producao - Planejamento';
  const REP='Producao - Relatorio';
  const $p=s=>document.querySelector(s);
  const $$p=s=>Array.from(document.querySelectorAll(s));
  const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const tasksList=()=>typeof tasks!=='undefined'&&Array.isArray(tasks)?tasks:[];
  const usersList=()=>typeof users!=='undefined'&&Array.isArray(users)?users:[];
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const prodName=u=>{u=norm(u);return u==='producao'||u==='prod'||u.startsWith('prod-')||u.startsWith('prod_')||u.includes('producao')};
  const canProd=()=>typeof currentUser!=='undefined'&&currentUser&&(currentUser.role==='admin'||prodName(currentUser.username));
  const isAdm=()=>typeof currentUser!=='undefined'&&currentUser&&currentUser.role==='admin';
  const todaySafe=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const dateSafe=v=>typeof date==='function'?date(v):String(v||'-');

  function field(txt,label){const m=String(txt||'').match(new RegExp(label+':\\s*([^\\n]*)','i'));return m?m[1].trim():''}
  function reportBody(txt){const s=String(txt||''),m='Relatorio:\n',i=s.indexOf(m);return i>=0?s.slice(i+m.length):s}

  function ensureStyle(){
    if($p('#prod-style-ok'))return;
    let st=document.createElement('style');
    st.id='prod-style-ok';
    st.textContent='.prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.prod-full{grid-column:1/-1}.prod-summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.prod-card{border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:16px;padding:14px;margin-bottom:10px}.prod-meta,.prod-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.prod-report{white-space:pre-wrap;line-height:1.45}.prod-warn{border:1px solid rgba(249,115,22,.4);background:rgba(249,115,22,.1);padding:10px;border-radius:12px;margin-top:10px}@media(max-width:900px){.prod-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  function ensureUi(){
    ensureStyle();
    let nav=$p('aside nav');
    if(nav&&!$p('button[data-page="production"]')){
      let b=document.createElement('button');
      b.className='nav-btn only-production';
      b.dataset.page='production';
      b.textContent='Producao';
      b.onclick=()=>switchPage('production');
      nav.insertBefore(b,$p('button[data-page="users"]')||null);
    }
    let content=$p('.content');
    if(content&&!$p('#production')){
      let sec=document.createElement('section');
      sec.id='production';
      sec.className='page';
      sec.innerHTML='<div class="prod-grid"><div class="panel prod-full"><div class="panel-head"><div><h3>Producao</h3><p class="muted">Relatorios de quadro e planejamento dos proximos quadros.</p></div><div class="actions"><button id="addProdPlan" class="primary">+ Planejar quadro</button><button id="addProdReport" class="ghost">+ Relatorio de quadro</button></div></div><div class="prod-summary"><span class="chip">Montando: <strong id="prodDoingCount">0</strong></span><span class="chip">Proximos: <strong id="prodNextCount">0</strong></span><span class="chip">Relatorios: <strong id="prodReportCount">0</strong></span></div><div class="prod-warn">Para criar login de producao, crie um usuario normal com nome PRODUCAO ou comecando com PROD.</div></div><div class="panel"><div class="panel-head"><h3>Quadros em montagem</h3><span class="pill">Agora</span></div><div id="prodDoingList" class="mini-list"></div></div><div class="panel"><div class="panel-head"><h3>Proximos quadros</h3><span class="pill">Planejamento</span></div><div id="prodNextList" class="mini-list"></div></div><div class="panel prod-full"><div class="panel-head"><h3>Relatorios salvos</h3><span class="pill">Quadros</span></div><div id="prodReportsList" class="mini-list"></div></div></div>';
      content.appendChild(sec);
    }
    let a=$p('#addProdPlan'),r=$p('#addProdReport');
    if(a)a.onclick=()=>openProdPlan();
    if(r)r.onclick=()=>openProdReport();
    applyProd();
  }

  function applyProd(){
    let ok=canProd();
    $$p('.only-production').forEach(e=>e.style.display=ok?'':'none');
    if(ok&&currentUser&&currentUser.role!=='admin'){
      let ar=$p('#activeRole');
      if(ar)ar.textContent='Producao';
    }
  }

  const plans=()=>tasksList().filter(t=>t.area===PLAN);
  const reports=()=>tasksList().filter(t=>t.area===REP);
  function set(id,v){let e=$p('#'+id);if(e)e.textContent=v}

  window.renderProduction=function(){
    ensureUi();
    if(!canProd())return;
    let pl=plans(),rep=reports(),doing=pl.filter(t=>t.status==='Em Andamento'),next=pl.filter(t=>t.status!=='Concluido'&&t.status!=='Concluído'&&t.status!=='Em Andamento').sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')));
    set('prodDoingCount',doing.length);set('prodNextCount',next.length);set('prodReportCount',rep.length);
    let card=t=>'<div class="prod-card"><h4>'+safe(t.title)+'</h4><p class="muted">Obra: '+safe(field(t.description,'Obra')||'-')+'</p><div class="prod-meta"><span class="chip">'+safe(t.status||'-')+'</span><span class="chip">Data: '+dateSafe(t.due_date)+'</span><span class="chip">Resp: '+safe(field(t.description,'Responsavel')||field(t.description,'Responsável')||'-')+'</span></div><p><strong>Etapa:</strong> '+safe(field(t.description,'Etapa')||'-')+'</p><p><strong>Proximo:</strong> '+safe(field(t.description,'Proximo passo')||field(t.description,'Próximo passo')||'-')+'</p><div class="prod-actions"><button class="small-btn" onclick="openProdPlan(\''+t.id+'\')">Editar</button>'+(t.status!=='Em Andamento'?'<button class="small-btn" onclick="prodSetStatus(\''+t.id+'\',\'Em Andamento\')">Montando</button>':'')+(t.status!=='Concluido'&&t.status!=='Concluído'?'<button class="small-btn" onclick="prodSetStatus(\''+t.id+'\',\'Concluído\')">Finalizar</button>':'')+'<button class="danger small-btn" onclick="prodDelete(\''+t.id+'\')">Excluir</button></div></div>';
    let db=$p('#prodDoingList'),nb=$p('#prodNextList'),rb=$p('#prodReportsList');
    if(db)db.innerHTML=doing.map(card).join('')||'<p class="muted">Nenhum quadro em montagem.</p>';
    if(nb)nb.innerHTML=next.map(card).join('')||'<p class="muted">Nenhum proximo quadro planejado.</p>';
    if(rb)rb.innerHTML=rep.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(t=>'<div class="prod-card"><h4>'+safe(String(t.title||'').replace(/^Relatorio - /,'').replace(/^Relatório - /,''))+'</h4><div class="prod-meta"><span class="chip">Obra: '+safe(field(t.description,'Obra')||'-')+'</span><span class="chip">'+dateSafe(t.due_date)+'</span><span class="chip">Resp: '+safe(field(t.description,'Responsavel')||field(t.description,'Responsável')||'-')+'</span></div><div class="prod-report">'+safe(reportBody(t.description))+'</div><div class="prod-actions"><button class="small-btn" onclick="openProdReport(\''+t.id+'\')">Editar</button><button class="danger small-btn" onclick="prodDelete(\''+t.id+'\')">Excluir</button></div></div>').join('')||'<p class="muted">Nenhum relatorio salvo.</p>';
  };

  window.openProdPlan=function(id=null){
    if(!canProd())return alert('Apenas Producao ou ADM.');
    let t=id?plans().find(x=>x.id===id):null,d=t?.description||'';
    modal(id?'Editar planejamento':'Planejar quadro','<form id="prodPlanForm" class="form"><input type="hidden" id="prodPlanId" value="'+safe(t?.id||'')+'"><div class="form-grid"><label>Nome do quadro<input id="prodQuadro" value="'+safe(t?.title||'')+'" required></label><label>Obra<input id="prodObra" value="'+safe(field(d,'Obra'))+'"></label><label>Etapa<select id="prodEtapa">'+['Separacao','Montagem','Barramento','Ligacao','Teste','Finalizacao'].map(x=>'<option '+(field(d,'Etapa')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Status<select id="prodStatus">'+['A Fazer','Em Andamento','Concluído'].map(x=>'<option '+(t?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Data prevista<input id="prodDate" type="date" value="'+safe(t?.due_date||todaySafe())+'"></label><label>Responsavel<input id="prodResp" value="'+safe(field(d,'Responsavel')||field(d,'Responsável'))+'"></label><label class="full-row">Proximo passo<textarea id="prodProximo">'+safe(field(d,'Proximo passo')||field(d,'Próximo passo'))+'</textarea></label><label class="full-row">Observacao<textarea id="prodObs">'+safe(field(d,'Observacao')||field(d,'Observação'))+'</textarea></label></div><button class="primary full">Salvar planejamento</button></form>');
    $p('#prodPlanForm').onsubmit=saveProdPlan;
  };

  async function saveProdPlan(e){
    e.preventDefault();
    let id=$p('#prodPlanId').value,d={obra:$p('#prodObra').value.trim(),etapa:$p('#prodEtapa').value,resp:$p('#prodResp').value.trim(),prox:$p('#prodProximo').value.trim(),obs:$p('#prodObs').value.trim()},p={title:$p('#prodQuadro').value.trim(),description:'Obra: '+(d.obra||'-')+'\nEtapa: '+(d.etapa||'-')+'\nResponsavel: '+(d.resp||'-')+'\nProximo passo: '+(d.prox||'-')+'\nObservacao: '+(d.obs||'-'),due_date:$p('#prodDate').value||null,area:PLAN,priority:'Média',status:$p('#prodStatus').value,assigned_to:null,updated_at:new Date().toISOString()};
    let res=id?await sb.from('fo_tasks').update(p).eq('id',id):await sb.from('fo_tasks').insert({...p,created_by:currentUser.id});
    if(res.error)return alert(res.error.message);
    closeModal();await refresh(true);renderProduction();
  }

  window.openProdReport=function(id=null){
    if(!canProd())return alert('Apenas Producao ou ADM.');
    let t=id?reports().find(x=>x.id===id):null,d=t?.description||'';
    modal(id?'Editar relatorio':'Relatorio de quadro','<form id="prodReportForm" class="form"><input type="hidden" id="prodReportId" value="'+safe(t?.id||'')+'"><div class="form-grid"><label>Nome do quadro<input id="repQuadro" value="'+safe(String(t?.title||'').replace(/^Relatorio - /,'').replace(/^Relatório - /,''))+'" required></label><label>Obra<input id="repObra" value="'+safe(field(d,'Obra'))+'"></label><label>Data<input id="repDate" type="date" value="'+safe(t?.due_date||todaySafe())+'"></label><label>Responsavel<input id="repResp" value="'+safe(field(d,'Responsavel')||field(d,'Responsável'))+'"></label><label class="full-row">Relatorio<textarea id="repText" required>'+safe(reportBody(d))+'</textarea></label></div><button class="primary full">Salvar relatorio</button></form>');
    $p('#prodReportForm').onsubmit=saveProdReport;
  };

  async function saveProdReport(e){
    e.preventDefault();
    let id=$p('#prodReportId').value,quadro=$p('#repQuadro').value.trim(),desc='Obra: '+($p('#repObra').value.trim()||'-')+'\nResponsavel: '+($p('#repResp').value.trim()||'-')+'\nRelatorio:\n'+($p('#repText').value.trim()||'-'),p={title:'Relatorio - '+quadro,description:desc,due_date:$p('#repDate').value||null,area:REP,priority:'Média',status:'Concluído',assigned_to:null,updated_at:new Date().toISOString()};
    let res=id?await sb.from('fo_tasks').update(p).eq('id',id):await sb.from('fo_tasks').insert({...p,created_by:currentUser.id});
    if(res.error)return alert(res.error.message);
    closeModal();await refresh(true);renderProduction();
  }

  window.prodSetStatus=async function(id,status){if(!canProd())return alert('Apenas Producao ou ADM.');let r=await sb.from('fo_tasks').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(r.error)return alert(r.error.message);await refresh(true);renderProduction()};
  window.prodDelete=async function(id){if(!canProd())return alert('Apenas Producao ou ADM.');if(!confirm('Excluir este item da producao?'))return;let r=await sb.from('fo_tasks').delete().eq('id',id);if(r.error)return alert(r.error.message);await refresh(true);renderProduction()};

  const oldRenderUsers=typeof renderUsers==='function'?renderUsers:null;
  window.renderUsers=renderUsers=function(){
    if(oldRenderUsers)oldRenderUsers();
    if(!isAdm())return;
    let box=$p('#usersList');if(!box)return;
    box.innerHTML=usersList().map(u=>'<div class="mini-item"><div><strong>'+safe(u.username)+'</strong><br><span class="muted">'+safe(prodName(u.username)?'Producao':((typeof ROLE_LABEL!=='undefined'&&ROLE_LABEL[u.role])||u.role))+'</span></div><div class="stock-actions-cell"><button class="small-btn" onclick="changeUserPassword(\''+u.id+'\')">Trocar senha</button>'+(u.username!=='ADM'&&(!currentUser||u.id!==currentUser.id)?'<button class="danger small-btn" onclick="delUser(\''+u.id+'\')">Excluir</button>':'')+'</div></div>').join('')||'<p class="muted">Nenhum usuario cadastrado.</p>';
  };

  const oldApply=typeof applyRole==='function'?applyRole:null;
  window.applyRole=applyRole=function(){if(oldApply)oldApply();ensureUi();applyProd()};

  const oldSwitch=typeof switchPage==='function'?switchPage:null;
  window.switchPage=switchPage=function(p){
    if(p==='production'){
      ensureUi();
      if(!canProd())return alert('Apenas Producao ou ADM.');
      currentPage='production';
      $$p('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
      $$p('.page').forEach(x=>x.classList.toggle('active',x.id===p));
      let title=$p('#pageTitle');if(title)title.textContent='Producao';
      renderProduction();return;
    }
    if(oldSwitch)return oldSwitch(p);
  };

  const oldRender=typeof render==='function'?render:null;
  window.render=render=function(){if(oldRender)oldRender();ensureUi();applyProd();if(typeof currentPage!=='undefined'&&currentPage==='production')renderProduction()};

  function boot(){ensureUi();setInterval(()=>{ensureUi();applyProd();if(typeof currentPage!=='undefined'&&currentPage==='production')renderProduction()},1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
