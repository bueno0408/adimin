// Complemento Felipe OS: gerenciamento de usuários somente para ADM
(function(){
  function admOk(){ return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin'; }

  renderUsers = function(){
    const box = document.getElementById('usersList');
    if(!box) return;
    if(!admOk()){
      box.innerHTML = '<p class="muted">Apenas ADM pode gerenciar usuários.</p>';
      return;
    }
    box.innerHTML = users.map(function(u){
      const canDelete = u.username !== 'ADM' && u.id !== currentUser.id;
      return `<div class="mini-item"><div><strong>${esc(u.username)}</strong><br><span class="muted">${ROLE_LABEL[u.role] || u.role}</span></div><div class="actions"><button class="small-btn" onclick="changeUserPassword('${u.id}')">Trocar senha</button>${canDelete ? `<button class="danger small-btn" onclick="delUser('${u.id}')">Excluir</button>` : ''}</div></div>`;
    }).join('') || '<p class="muted">Nenhum usuário cadastrado.</p>';
  };

  saveUser = async function(e){
    e.preventDefault();
    if(!admOk()) return alert('Apenas ADM pode criar usuários.');
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    if(!username) return alert('Digite um usuário.');
    if(password.length < 4) return alert('Senha mínima de 4 caracteres.');
    const password_hash = await sha256(password);
    const result = await sb.from('fo_users').insert({ username, password_hash, role });
    if(result.error) return alert(result.error.message);
    document.getElementById('userForm').reset();
    refresh(true);
  };

  changeUserPassword = async function(id){
    if(!admOk()) return alert('Apenas ADM pode trocar senha de usuários.');
    const u = users.find(x => x.id === id);
    if(!u) return alert('Usuário não encontrado.');
    const password = prompt('Nova senha para ' + u.username + ':');
    if(password === null) return;
    if(password.length < 4) return alert('Senha mínima de 4 caracteres.');
    const password_hash = await sha256(password);
    const result = await sb.from('fo_users').update({ password_hash, updated_at: new Date().toISOString() }).eq('id', id);
    if(result.error) return alert(result.error.message);
    alert('Senha alterada com sucesso.');
    refresh(true);
  };

  delUser = async function(id){
    if(!admOk()) return alert('Apenas ADM pode excluir usuários.');
    const u = users.find(x => x.id === id);
    if(!u) return alert('Usuário não encontrado.');
    if(u.username === 'ADM') return alert('O usuário ADM principal não pode ser excluído.');
    if(u.id === currentUser.id) return alert('Você não pode excluir o próprio usuário logado.');
    if(!confirm('Excluir o usuário ' + u.username + '?')) return;
    const result = await sb.from('fo_users').delete().eq('id', id);
    if(result.error) return alert(result.error.message);
    refresh(true);
  };

  Object.assign(window, { renderUsers, saveUser, delUser, changeUserPassword });
  const form = document.getElementById('userForm');
  if(form) form.onsubmit = saveUser;
})();

// Complemento Felipe OS: importador de catálogo WEG dentro da aba Estoque
(function(){
  function stockOk(){ return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'stock'; }

  function ensureWegButton(){
    const addStock = document.getElementById('addStock');
    if(!addStock || document.getElementById('importWegCatalogBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'importWegCatalogBtn';
    btn.type = 'button';
    btn.className = 'ghost';
    btn.textContent = 'Importar catálogo WEG';
    btn.onclick = openWegImportModal;
    addStock.parentNode.insertBefore(btn, addStock);
  }

  function openWegImportModal(){
    if(!stockOk()) return alert('Apenas o perfil ESTOQUE pode importar catálogo.');
    modal('Importar catálogo WEG', `
      <form id="wegImportForm" class="form">
        <p class="muted">Cole aqui o catálogo WEG que você mandou no chat. O sistema vai ler código, nome e categoria automaticamente.</p>
        <textarea id="wegCatalogText" style="min-height:260px" placeholder="Cole aqui o catálogo WEG completo..."></textarea>
        <button class="primary full" type="submit">Importar para o estoque</button>
      </form>
    `);
    document.getElementById('wegImportForm').onsubmit = importWegCatalog;
  }

  function parseWegCatalog(text){
    let main = '', series = '', sub = '';
    const items = [];
    String(text || '').split(/\r?\n/).forEach(function(raw){
      const line = raw.trim();
      if(!line) return;
      const item = line.match(/^(.+?)\s+—\s+(\d{8})$/);
      if(item){
        const name = item[1].trim();
        const code = item[2].trim();
        const category = [main, series, sub].filter(Boolean).join(' > ');
        items.push({ code, name, category, quantity: 0, min_quantity: 0, location: 'ESTOQUE WEG' });
        return;
      }
      if(line.startsWith('ESTOQUE —')){
        main = line.replace('ESTOQUE —', '').trim();
        series = '';
        sub = '';
        return;
      }
      if(/^\d+\s*mA\s+—/.test(line)){
        sub = line;
        return;
      }
      if(line.includes('—')){
        series = line;
        sub = '';
        return;
      }
      series = line;
      sub = '';
    });
    const unique = new Map();
    items.forEach(function(i){ unique.set(i.code, i); });
    return Array.from(unique.values());
  }

  async function importWegCatalog(e){
    e.preventDefault();
    if(!stockOk()) return alert('Apenas o perfil ESTOQUE pode importar catálogo.');
    const text = document.getElementById('wegCatalogText').value;
    const items = parseWegCatalog(text);
    if(!items.length) return alert('Não encontrei itens no texto. Cole o catálogo completo com código WEG.');

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Importando...';

    const current = await sb.from('fo_inventory').select('code');
    if(current.error){
      btn.disabled = false;
      btn.textContent = 'Importar para o estoque';
      return alert('Erro ao ler estoque: ' + current.error.message);
    }

    const existing = new Set((current.data || []).map(function(i){ return String(i.code || '').trim(); }));
    const missing = items.filter(function(i){ return !existing.has(String(i.code || '').trim()); });

    let inserted = 0;
    for(let i = 0; i < missing.length; i += 80){
      const chunk = missing.slice(i, i + 80);
      const result = await sb.from('fo_inventory').insert(chunk);
      if(result.error){
        btn.disabled = false;
        btn.textContent = 'Importar para o estoque';
        return alert('Erro ao importar: ' + result.error.message);
      }
      inserted += chunk.length;
      btn.textContent = 'Importando... ' + inserted + '/' + missing.length;
    }

    closeModal();
    await refresh(true);
    alert('Catálogo WEG processado. Importados: ' + inserted + '. Já existiam: ' + (items.length - missing.length) + '.');
  }

  const originalSwitchPage = typeof switchPage === 'function' ? switchPage : null;
  if(originalSwitchPage){
    switchPage = function(p){
      originalSwitchPage(p);
      setTimeout(ensureWegButton, 50);
    };
  }

  setInterval(ensureWegButton, 1000);
  Object.assign(window, { openWegImportModal, importWegCatalog });
})();