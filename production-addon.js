// Felipe OS - Perfil Producao real
// Este arquivo ja e carregado pelo index.html.
// Ele adiciona o perfil Producao no cadastro e limita o acesso a Producao + Calendario.
(function(){
  const PLAN = 'Producao - Planejamento';
  const REP = 'Producao - Relatorio';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const list = () => (typeof tasks !== 'undefined' && Array.isArray(tasks)) ? tasks : [];
  const today = () => new Date().toISOString().slice(0,10);
  const role = () => (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
  const isAdmin = () => role() === 'admin';
  const isProduction = () => role() === 'production';
  const canProduction = () => isAdmin() || isProduction();

  function field(text,label){
    const m = String(text || '').match(new RegExp(label + ':\\s*([^\\n]*)','i'));
    return m ? m[1].trim() : '';
  }

  function reportText(text){
    const s = String(text || '');
    const marker = 'Relatorio:\n';
    const i = s.indexOf(marker);
    return i >= 0 ? s.slice(i + marker.length) : s;
  }

  function ensureStyle(){
    if($('#productionStyleOk')) return;
    const st = document.createElement('style');
    st.id = 'productionStyleOk';
    st.textContent = `
      .prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .prod-full{grid-column:1/-1}
      .prod-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .prod-card{border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:16px;padding:14px;margin-bottom:10px}
      .prod-meta,.prod-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
      .prod-report{white-space:pre-wrap;line-height:1.45}
      @media(max-width:900px){.prod-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function ensureRoleOption(){
    const sel = $('#newRole');
    if(!sel) return;
    if(!sel.querySelector('option[value="production"]')){
      const op = document.createElement('option');
      op.value = 'production';
      op.textContent = 'Producao';
      sel.appendChild(op);
    }
  }

  function ensureProductionUi(){
    ensureStyle();
    ensureRoleOption();

    const nav = $('aside nav');
    if(nav && !nav.querySelector('button[data-page="production"]')){
      const btn = document.createElement('button');
      btn.className = 'nav-btn only-production';
      btn.dataset.page = 'production';
      btn.textContent = 'Producao';
      btn.onclick = () => switchPage('production');
      const calendar = nav.querySelector('button[data-page="calendar"]');
      if(calendar && calendar.nextSibling) nav.insertBefore(btn, calendar.nextSibling);
      else nav.appendChild(btn);
    }

    const content = $('.content');
    if(content && !$('#production')){
      const sec = document.createElement('section');
      sec.id = 'production';
      sec.className = 'page';
      sec.innerHTML = `
        <div class="prod-grid">
          <div class="panel prod-full">
            <div class="panel-head">
              <div>
                <h3>Producao</h3>
                <p class="muted">Relatorios de quadro e planejamento dos proximos quadros.</p>
              </div>
              <div class="actions">
                <button id="addProdPlan" class="primary">+ Planejar quadro</button>
                <button id="addProdReport" class="ghost">+ Relatorio de quadro</button>
              </div>
            </div>
            <div class="prod-summary">
              <span class="chip">Montando: <strong id="prodDoingCount">0</strong></span>
              <span class="chip">Proximos: <strong id="prodNextCount">0</strong></span>
              <span class="chip">Relatorios: <strong id="prodReportCount">0</strong></span>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Quadros em montagem</h3><span class="pill">Agora</span></div>
            <div id="prodDoingList" class="mini-list"></div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Proximos quadros</h3><span class="pill">Planejamento</span></div>
            <div id="prodNextList" class="mini-list"></div>
          </div>
          <div class="panel prod-full">
            <div class="panel-head"><h3>Relatorios salvos</h3><span class="pill">Quadros</span></div>
            <div id="prodReportsList" class="mini-list"></div>
          </div>
        </div>
      `;
      content.appendChild(sec);
    }

    const p = $('#addProdPlan');
    const r = $('#addProdReport');
    if(p) p.onclick = () => openProdPlan();
    if(r) r.onclick = () => openProdReport();
  }

  function applyProductionAccess(){
    ensureProductionUi();

    $$('.only-production').forEach(el => el.style.display = canProduction() ? '' : 'none');

    if(isProduction()){
      $$('.nav-btn').forEach(btn => {
        const page = btn.dataset.page;
        btn.style.display = (page === 'production' || page === 'calendar') ? '' : 'none';
      });
      const ar = $('#activeRole');
      if(ar) ar.textContent = 'Producao';
      if(typeof currentPage !== 'undefined' && !['production','calendar'].includes(currentPage)){
        setTimeout(() => switchPage('production'), 80);
      }
    }
  }

  const plans = () => list().filter(t => t.area === PLAN);
  const reports = () => list().filter(t => t.area === REP);
  const setText = (id,v) => { const el = $('#'+id); if(el) el.textContent = v; };

  window.renderProduction = function(){
    ensureProductionUi();
    if(!canProduction()) return;

    const pl = plans();
    const rep = reports();
    const doing = pl.filter(t => t.status === 'Em Andamento');
    const next = pl.filter(t => t.status !== 'Em Andamento' && t.status !== 'Concluido' && t.status !== 'Concluído')
      .sort((a,b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));

    setText('prodDoingCount', doing.length);
    setText('prodNextCount', next.length);
    setText('prodReportCount', rep.length);

    const card = t => `
      <div class="prod-card">
        <h4>${safe(t.title)}</h4>
        <p class="muted">Obra: ${safe(field(t.description,'Obra') || '-')}</p>
        <div class="prod-meta">
          <span class="chip">${safe(t.status || '-')}</span>
          <span class="chip">Data: ${safe(t.due_date || '-')}</span>
          <span class="chip">Resp: ${safe(field(t.description,'Responsavel') || '-')}</span>
        </div>
        <p><strong>Etapa:</strong> ${safe(field(t.description,'Etapa') || '-')}</p>
        <p><strong>Proximo:</strong> ${safe(field(t.description,'Proximo passo') || '-')}</p>
        <div class="prod-actions">
          <button class="small-btn" onclick="openProdPlan('${t.id}')">Editar</button>
          ${t.status !== 'Em Andamento' ? `<button class="small-btn" onclick="prodSetStatus('${t.id}','Em Andamento')">Montando</button>` : ''}
          ${t.status !== 'Concluído' ? `<button class="small-btn" onclick="prodSetStatus('${t.id}','Concluído')">Finalizar</button>` : ''}
          <button class="danger small-btn" onclick="prodDelete('${t.id}')">Excluir</button>
        </div>
      </div>`;

    const db = $('#prodDoingList');
    const nb = $('#prodNextList');
    const rb = $('#prodReportsList');
    if(db) db.innerHTML = doing.map(card).join('') || '<p class="muted">Nenhum quadro em montagem.</p>';
    if(nb) nb.innerHTML = next.map(card).join('') || '<p class="muted">Nenhum proximo quadro planejado.</p>';
    if(rb) rb.innerHTML = rep.slice().sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).map(t => `
      <div class="prod-card">
        <h4>${safe(String(t.title || '').replace(/^Relatorio - /,''))}</h4>
        <div class="prod-meta">
          <span class="chip">Obra: ${safe(field(t.description,'Obra') || '-')}</span>
          <span class="chip">${safe(t.due_date || '-')}</span>
          <span class="chip">Resp: ${safe(field(t.description,'Responsavel') || '-')}</span>
        </div>
        <div class="prod-report">${safe(reportText(t.description))}</div>
        <div class="prod-actions">
          <button class="small-btn" onclick="openProdReport('${t.id}')">Editar</button>
          <button class="danger small-btn" onclick="prodDelete('${t.id}')">Excluir</button>
        </div>
      </div>`).join('') || '<p class="muted">Nenhum relatorio salvo.</p>';
  };

  window.openProdPlan = function(id=null){
    if(!canProduction()) return alert('Apenas Producao ou ADM.');
    const t = id ? plans().find(x => x.id === id) : null;
    const d = t ? t.description || '' : '';
    modal(id ? 'Editar planejamento' : 'Planejar quadro', `
      <form id="prodPlanForm" class="form">
        <input type="hidden" id="prodPlanId" value="${safe(t?.id || '')}">
        <div class="form-grid">
          <label>Nome do quadro<input id="prodQuadro" value="${safe(t?.title || '')}" required></label>
          <label>Obra<input id="prodObra" value="${safe(field(d,'Obra'))}"></label>
          <label>Etapa<select id="prodEtapa">${['Separacao','Montagem','Barramento','Ligacao','Teste','Finalizacao'].map(x=>`<option ${field(d,'Etapa')===x?'selected':''}>${x}</option>`).join('')}</select></label>
          <label>Status<select id="prodStatus">${['A Fazer','Em Andamento','Concluído'].map(x=>`<option ${t?.status===x?'selected':''}>${x}</option>`).join('')}</select></label>
          <label>Data prevista<input id="prodDate" type="date" value="${safe(t?.due_date || today())}"></label>
          <label>Responsavel<input id="prodResp" value="${safe(field(d,'Responsavel'))}"></label>
          <label class="full-row">Proximo passo<textarea id="prodProximo">${safe(field(d,'Proximo passo'))}</textarea></label>
          <label class="full-row">Observacao<textarea id="prodObs">${safe(field(d,'Observacao'))}</textarea></label>
        </div>
        <button class="primary full">Salvar planejamento</button>
      </form>`);
    $('#prodPlanForm').onsubmit = saveProdPlan;
  };

  async function saveProdPlan(e){
    e.preventDefault();
    const id = $('#prodPlanId').value;
    const p = {
      title: $('#prodQuadro').value.trim(),
      description: 'Obra: '+($('#prodObra').value.trim() || '-')+'\nEtapa: '+($('#prodEtapa').value || '-')+'\nResponsavel: '+($('#prodResp').value.trim() || '-')+'\nProximo passo: '+($('#prodProximo').value.trim() || '-')+'\nObservacao: '+($('#prodObs').value.trim() || '-'),
      due_date: $('#prodDate').value || null,
      area: PLAN,
      priority: 'Média',
      status: $('#prodStatus').value,
      assigned_to: null,
      updated_at: new Date().toISOString()
    };
    const res = id ? await sb.from('fo_tasks').update(p).eq('id', id) : await sb.from('fo_tasks').insert({...p, created_by: currentUser.id});
    if(res.error) return alert(res.error.message);
    closeModal(); await refresh(true); renderProduction();
  }

  window.openProdReport = function(id=null){
    if(!canProduction()) return alert('Apenas Producao ou ADM.');
    const t = id ? reports().find(x => x.id === id) : null;
    const d = t ? t.description || '' : '';
    modal(id ? 'Editar relatorio' : 'Relatorio de quadro', `
      <form id="prodReportForm" class="form">
        <input type="hidden" id="prodReportId" value="${safe(t?.id || '')}">
        <div class="form-grid">
          <label>Nome do quadro<input id="repQuadro" value="${safe(String(t?.title || '').replace(/^Relatorio - /,''))}" required></label>
          <label>Obra<input id="repObra" value="${safe(field(d,'Obra'))}"></label>
          <label>Data<input id="repDate" type="date" value="${safe(t?.due_date || today())}"></label>
          <label>Responsavel<input id="repResp" value="${safe(field(d,'Responsavel'))}"></label>
          <label class="full-row">Relatorio<textarea id="repText" required>${safe(reportText(d))}</textarea></label>
        </div>
        <button class="primary full">Salvar relatorio</button>
      </form>`);
    $('#prodReportForm').onsubmit = saveProdReport;
  };

  async function saveProdReport(e){
    e.preventDefault();
    const id = $('#prodReportId').value;
    const quadro = $('#repQuadro').value.trim();
    const p = {
      title: 'Relatorio - ' + quadro,
      description: 'Obra: '+($('#repObra').value.trim() || '-')+'\nResponsavel: '+($('#repResp').value.trim() || '-')+'\nRelatorio:\n'+($('#repText').value.trim() || '-'),
      due_date: $('#repDate').value || null,
      area: REP,
      priority: 'Média',
      status: 'Concluído',
      assigned_to: null,
      updated_at: new Date().toISOString()
    };
    const res = id ? await sb.from('fo_tasks').update(p).eq('id', id) : await sb.from('fo_tasks').insert({...p, created_by: currentUser.id});
    if(res.error) return alert(res.error.message);
    closeModal(); await refresh(true); renderProduction();
  }

  window.prodSetStatus = async function(id,status){
    if(!canProduction()) return alert('Apenas Producao ou ADM.');
    const r = await sb.from('fo_tasks').update({status, updated_at:new Date().toISOString()}).eq('id', id);
    if(r.error) return alert(r.error.message);
    await refresh(true); renderProduction();
  };

  window.prodDelete = async function(id){
    if(!canProduction()) return alert('Apenas Producao ou ADM.');
    if(!confirm('Excluir este item da producao?')) return;
    const r = await sb.from('fo_tasks').delete().eq('id', id);
    if(r.error) return alert(r.error.message);
    await refresh(true); renderProduction();
  };

  const oldApplyRole = typeof applyRole === 'function' ? applyRole : null;
  window.applyRole = applyRole = function(){
    if(oldApplyRole) oldApplyRole();
    applyProductionAccess();
  };

  const oldSwitchPage = typeof switchPage === 'function' ? switchPage : null;
  window.switchPage = switchPage = function(page){
    ensureProductionUi();
    if(isProduction() && !['production','calendar'].includes(page)){
      page = 'production';
    }
    if(page === 'production'){
      if(!canProduction()) return alert('Apenas Producao ou ADM.');
      currentPage = 'production';
      $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
      $$('.page').forEach(p => p.classList.toggle('active', p.id === page));
      const title = $('#pageTitle'); if(title) title.textContent = 'Producao';
      renderProduction();
      return;
    }
    if(oldSwitchPage) return oldSwitchPage(page);
  };

  const oldRender = typeof render === 'function' ? render : null;
  window.render = render = function(){
    if(oldRender) oldRender();
    applyProductionAccess();
    if(typeof currentPage !== 'undefined' && currentPage === 'production') renderProduction();
  };

  function boot(){
    ensureProductionUi();
    applyProductionAccess();
    setInterval(() => {
      ensureProductionUi();
      applyProductionAccess();
      if(typeof currentPage !== 'undefined' && currentPage === 'production') renderProduction();
    }, 1000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
