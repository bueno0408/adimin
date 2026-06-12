// Felipe OS - Perfil Produção
// Relatórios de quadro e planejamento de produção
(function(){
  const $p=s=>document.querySelector(s);
  const $$p=s=>Array.from(document.querySelectorAll(s));
  const PLAN_AREA='Produção - Planejamento';
  const REPORT_AREA='Produção - Relatório';
  const html=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const canProd=()=>typeof currentUser!=='undefined'&&currentUser&&(currentUser.role==='production'||currentUser.role==='admin');
  const now=()=>new Date().toISOString();
  if(typeof ROLE_LABEL!=='undefined') ROLE_LABEL.production='Produção';

  function field(txt,label){
    const m=String(txt||'').match(new RegExp(label+':\\s*([^\\n]*)','i'));
    return m?m[1].trim():'';
  }

  function planDesc(d){
    return `Obra: ${d.obra||'-'}\nEtapa: ${d.etapa||'-'}\nResponsável: ${d.resp||'-'}\nPróximo passo: ${d.prox||'-'}\nObservação: ${d.obs||'-'}`;
  }

  function reportDesc(d){
    return `Obra: ${d.obra||'-'}\nResponsável: ${d.resp||'-'}\nRelatório:\n${d.relatorio||'-'}`;
  }

  function reportText(desc){
    return String(desc||'').replace(/^Obra:.*\nResponsável:.*\nRelatório:\n/s,'');
  }

  function addStyle(){
    if($p('#production-addon-style')) return;
    const st=document.createElement('style');
    st.id='production-addon-style';
    st.textContent=`
      .prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.prod-full{grid-column:1/-1}
      .prod-summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 14px}
      .prod-card{border:1px solid var(--border);background:var(--card2,rgba(255,255,255,.04));border-radius:16px;padding:14px;margin-bottom:10px}
      .prod-card h4{margin:0 0 6px}.prod-card p{margin:4px 0}.prod-meta,.prod-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.prod-report{white-space:pre-wrap;line-height:1.45}
      @media(max-width:900px){.prod-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function addRoleOption(){
    const sel=$p('#newRole');
    if(sel&&!sel.querySelector('option[value="production"]')){
      const opt=document.createElement('option');
      opt.value='production';
      opt.textContent='Produção';
      sel.appendChild(opt);
    }
  }

  function ensureUi(){
    addStyle();
    addRoleOption();

    if(!$p('button[data-page="production"]')){
      const nav=$p('aside nav');
      if(nav){
        const btn=document.createElement('button');
        btn.className='nav-btn only-production';
        btn.dataset.page='production';
        btn.textContent='Produção';
        btn.onclick=()=>switchPage('production');
        nav.insertBefore(btn,$p('button[data-page="users"]')||null);
      }
    }

    if(!$p('#production')){
      const content=$p('.content');
      if(content){
        const sec=document.createElement('section');
        sec.id='production';
        sec.className='page';
        sec.innerHTML=`
          <div class="prod-grid">
            <div class="panel prod-full">
              <div class="panel-head">
                <div><h3>Produção</h3><p class="muted">Relatórios de quadro e planejamento dos próximos quadros.</p></div>
                <div class="actions"><button id="addProdPlan" class="primary">+ Planejar quadro</button><button id="addProdReport" class="ghost">+ Relatório de quadro</button></div>
              </div>
              <div class="prod-summary"><span class="chip">Montando: <strong id="prodDoingCount">0</strong></span><span class="chip">Próximos: <strong id="prodNextCount">0</strong></span><span class="chip">Relatórios: <strong id="prodReportCount">0</strong></span></div>
            </div>
            <div class="panel"><div class="panel-head"><h3>Quadros em montagem</h3><span class="pill">Agora</span></div><div id="prodDoingList" class="mini-list"></div></div>
            <div class="panel"><div class="panel-head"><h3>Próximos quadros</h3><span class="pill">Planejamento</span></div><div id="prodNextList" class="mini-list"></div></div>
            <div class="panel prod-full"><div class="panel-head"><h3>Relatórios salvos</h3><span class="pill">Quadros</span></div><div id="prodReportsList" class="mini-list"></div></div>
          </div>`;
        content.appendChild(sec);
      }
    }

    const a=$p('#addProdPlan'),b=$p('#addProdReport');
    if(a) a.onclick=()=>openProdPlan();
    if(b) b.onclick=()=>openProdReport();
    applyProdVisibility();
  }

  function applyProdVisibility(){
    $$p('.only-production').forEach(x=>x.style.display=canProd()?'':'none');
  }

  function plans(){return (typeof tasks!=='undefined'?tasks:[]).filter(t=>t.area===PLAN_AREA)}
  function reports(){return (typeof tasks!=='undefined'?tasks:[]).filter(t=>t.area===REPORT_AREA)}
  function setTxt(id,v){const e=$p('#'+id);if(e)e.textContent=v}

  window.renderProduction=function(){
    ensureUi();
    if(!canProd()) return;
    const pl=plans(), rep=reports();
    const doing=pl.filter(t=>t.status==='Em Andamento');
    const next=pl.filter(t=>t.status!=='Concluído'&&t.status!=='Em Andamento').sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')));
    setTxt('prodDoingCount',doing.length);setTxt('prodNextCount',next.length);setTxt('prodReportCount',rep.length);

    const card=t=>`<div class="prod-card"><h4>${html(t.title)}</h4><p class="muted">${html(field(t.description,'Obra')||'-')}</p><div class="prod-meta"><span class="chip">${html(t.status||'-')}</span><span class="chip">Data: ${typeof date==='function'?date(t.due_date):html(t.due_date||'-')}</span><span class="chip">Resp: ${html(field(t.description,'Responsável')||'-')}</span></div><p><strong>Próximo:</strong> ${html(field(t.description,'Próximo passo')||field(t.description,'Etapa')||'-')}</p><div class="prod-actions"><button class="small-btn" onclick="openProdPlan('${t.id}')">Editar</button>${t.status!=='Em Andamento'?`<button class="small-btn" onclick="prodSetStatus('${t.id}','Em Andamento')">Montando</button>`:''}${t.status!=='Concluído'?`<button class="small-btn" onclick="prodSetStatus('${t.id}','Concluído')">Finalizar</button>`:''}<button class="danger small-btn" onclick="prodDelete('${t.id}')">Excluir</button></div></div>`;

    const doingBox=$p('#prodDoingList'), nextBox=$p('#prodNextList'), reportBox=$p('#prodReportsList');
    if(doingBox) doingBox.innerHTML=doing.map(card).join('')||'<p class="muted">Nenhum quadro em montagem.</p>';
    if(nextBox) nextBox.innerHTML=next.map(card).join('')||'<p class="muted">Nenhum próximo quadro planejado.</p>';
    if(reportBox) reportBox.innerHTML=rep.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(t=>`<div class="prod-card"><h4>${html(t.title.replace(/^Relatório - /,''))}</h4><div class="prod-meta"><span class="chip">${html(field(t.description,'Obra')||'-')}</span><span class="chip">${typeof date==='function'?date(t.due_date):html(t.due_date||'-')}</span><span class="chip">Resp: ${html(field(t.description,'Responsável')||'-')}</span></div><div class="prod-report">${html(reportText(t.description))}</div><div class="prod-actions"><button class="small-btn" onclick="openProdReport('${t.id}')">Editar</button><button class="danger small-btn" onclick="prodDelete('${t.id}')">Excluir</button></div></div>`).join('')||'<p class="muted">Nenhum relatório salvo.</p>';
  };

  window.openProdPlan=function(id=null){
    if(!canProd()) return alert('Apenas Produção ou ADM.');
    const t=id?plans().find(x=>x.id===id):null, d=t?.description||'';
    modal(id?'Editar planejamento':'Planejar quadro',`<form id="prodPlanForm" class="form"><input type="hidden" id="prodPlanId" value="${html(t?.id||'')}"><div class="form-grid"><label>Nome do quadro<input id="prodQuadro" value="${html(t?.title||'')}" required></label><label>Obra<input id="prodObra" value="${html(field(d,'Obra'))}"></label><label>Etapa<select id="prodEtapa">${['Separação','Montagem','Barramento','Ligação','Teste','Finalização'].map(x=>`<option ${field(d,'Etapa')===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Status<select id="prodStatus">${['A Fazer','Em Andamento','Concluído'].map(x=>`<option ${t?.status===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Data prevista<input id="prodDate" type="date" value="${html(t?.due_date||today())}"></label><label>Responsável<input id="prodResp" value="${html(field(d,'Responsável'))}"></label><label class="full-row">Próximo passo<textarea id="prodProximo">${html(field(d,'Próximo passo'))}</textarea></label><label class="full-row">Observação<textarea id="prodObs">${html(field(d,'Observação'))}</textarea></label></div><button class="primary full">Salvar planejamento</button></form>`);
    $p('#prodPlanForm').onsubmit=saveProdPlan;
  };

  async function saveProdPlan(e){
    e.preventDefault();
    const id=$p('#prodPlanId').value;
    const d={obra:$p('#prodObra').value.trim(),etapa:$p('#prodEtapa').value,resp:$p('#prodResp').value.trim(),prox:$p('#prodProximo').value.trim(),obs:$p('#prodObs').value.trim()};
    const p={title:$p('#prodQuadro').value.trim(),description:planDesc(d),due_date:$p('#prodDate').value||null,area:PLAN_AREA,priority:'Média',status:$p('#prodStatus').value,assigned_to:null,updated_at:now()};
    const r=id?await sb.from('fo_tasks').update(p).eq('id',id):await sb.from('fo_tasks').insert({...p,created_by:currentUser.id});
    if(r.error) return alert(r.error.message);
    closeModal();await refresh(true);renderProduction();
  }

  window.openProdReport=function(id=null){
    if(!canProd()) return alert('Apenas Produção ou ADM.');
    const t=id?reports().find(x=>x.id===id):null, d=t?.description||'';
    modal(id?'Editar relatório':'Relatório de quadro',`<form id="prodReportForm" class="form"><input type="hidden" id="prodReportId" value="${html(t?.id||'')}"><div class="form-grid"><label>Nome do quadro<input id="repQuadro" value="${html((t?.title||'').replace(/^Relatório - /,''))}" required></label><label>Obra<input id="repObra" value="${html(field(d,'Obra'))}"></label><label>Data<input id="repDate" type="date" value="${html(t?.due_date||today())}"></label><label>Responsável<input id="repResp" value="${html(field(d,'Responsável'))}"></label><label class="full-row">Relatório<textarea id="repText" required>${html(reportText(d))}</textarea></label></div><button class="primary full">Salvar relatório</button></form>`);
    $p('#prodReportForm').onsubmit=saveProdReport;
  };

  async function saveProdReport(e){
    e.preventDefault();
    const id=$p('#prodReportId').value, quadro=$p('#repQuadro').value.trim();
    const d={obra:$p('#repObra').value.trim(),resp:$p('#repResp').value.trim(),relatorio:$p('#repText').value.trim()};
    const p={title:'Relatório - '+quadro,description:reportDesc(d),due_date:$p('#repDate').value||null,area:REPORT_AREA,priority:'Média',status:'Concluído',assigned_to:null,updated_at:now()};
    const r=id?await sb.from('fo_tasks').update(p).eq('id',id):await sb.from('fo_tasks').insert({...p,created_by:currentUser.id});
    if(r.error) return alert(r.error.message);
    closeModal();await refresh(true);renderProduction();
  }

  window.prodSetStatus=async function(id,status){
    if(!canProd()) return alert('Apenas Produção ou ADM.');
    const r=await sb.from('fo_tasks').update({status,updated_at:now()}).eq('id',id);
    if(r.error) return alert(r.error.message);
    await refresh(true);renderProduction();
  };

  window.prodDelete=async function(id){
    if(!canProd()) return alert('Apenas Produção ou ADM.');
    if(!confirm('Excluir este item da produção?')) return;
    const r=await sb.from('fo_tasks').delete().eq('id',id);
    if(r.error) return alert(r.error.message);
    await refresh(true);renderProduction();
  };

  const oldApply=typeof applyRole==='function'?applyRole:null;
  window.applyRole=applyRole=function(){if(oldApply)oldApply();ensureUi();applyProdVisibility();};
  const oldSwitch=typeof switchPage==='function'?switchPage:null;
  window.switchPage=switchPage=function(p){
    if(p==='production'){
      if(!canProd()) return alert('Apenas Produção ou ADM.');
      currentPage='production';
      $$p('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
      $$p('.page').forEach(x=>x.classList.toggle('active',x.id===p));
      const title=$p('#pageTitle'); if(title) title.textContent='Produção';
      renderProduction();
      return;
    }
    if(oldSwitch) return oldSwitch(p);
  };
  const oldRender=typeof render==='function'?render:null;
  window.render=render=function(){if(oldRender)oldRender();ensureUi();applyProdVisibility();if(typeof currentPage!=='undefined'&&currentPage==='production')renderProduction();};

  function boot(){ensureUi();setInterval(()=>{ensureUi();applyProdVisibility();},1500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();