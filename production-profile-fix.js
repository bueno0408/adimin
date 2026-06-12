// Corrige perfil Producao real
(function(){
  const ROLE='production';
  const isProd=()=>window.currentUser&&currentUser.role===ROLE;
  const allow=p=>p==='production'||p==='calendar';

  function setup(){
    try{ if(window.ROLE_LABEL) ROLE_LABEL[ROLE]='Produção'; }catch(e){}
    const sel=document.querySelector('#newRole');
    if(sel&&!sel.querySelector('option[value="production"]')){
      const op=document.createElement('option');
      op.value='production';
      op.textContent='Produção';
      const stock=sel.querySelector('option[value="stock"]');
      sel.insertBefore(op,stock||null);
    }
  }

  const oldApply=typeof applyRole==='function'?applyRole:null;
  window.applyRole=applyRole=function(){
    if(oldApply)oldApply();
    setup();
    if(isProd()){
      const originalName=currentUser.username;
      currentUser.username='PRODUCAO';
      document.querySelectorAll('.nav-btn').forEach(b=>{
        b.style.display=allow(b.dataset.page)?'':'none';
      });
      const role=document.querySelector('#activeRole');
      if(role)role.textContent='Produção';
      const user=document.querySelector('#activeUser');
      if(user)user.textContent=originalName;
      const top=document.querySelector('#newTaskTop');
      if(top)top.style.display='none';
      if(!allow(window.currentPage||currentPage)) setTimeout(()=>switchPage('production'),50);
    }
  };

  const oldSwitch=typeof switchPage==='function'?switchPage:null;
  window.switchPage=switchPage=function(p){
    if(isProd()&&!allow(p)){
      alert('O perfil Produção acessa somente Produção e Calendário.');
      p='production';
    }
    if(oldSwitch)oldSwitch(p);
    setup();
    if(isProd()){
      document.querySelectorAll('.nav-btn').forEach(b=>{
        b.style.display=allow(b.dataset.page)?'':'none';
      });
    }
  };

  document.addEventListener('DOMContentLoaded',setup);
  setInterval(setup,1000);
})();