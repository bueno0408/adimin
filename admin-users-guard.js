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
