// Felipe OS - Ajustes do estoque e usuários
// Carregado depois do app.js
(function () {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  function h(v) {
    if (typeof esc === "function") return esc(v);
    return String(v ?? "").replace(/[&<>\"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  }

  function num(v) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function canStock() {
    return typeof currentUser !== "undefined" && currentUser && currentUser.role === "stock";
  }

  function canAdmin() {
    return typeof currentUser !== "undefined" && currentUser && currentUser.role === "admin";
  }

  function stockStatus(item) {
    const qtd = num(item.quantity);
    const min = num(item.min_quantity);
    if (qtd <= 0) return "sem";
    if (min > 0 && qtd <= min) return "baixo";
    return "ok";
  }

  function stockStatusLabel(st) {
    if (st === "sem") return "Sem estoque";
    if (st === "baixo") return "Baixo estoque";
    return "OK";
  }

  function ensureExtraStyle() {
    if (qs("#fo-extra-stock-style")) return;
    const style = document.createElement("style");
    style.id = "fo-extra-stock-style";
    style.textContent = `
      .stock-extra-bar{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 16px;align-items:center}
      .stock-extra-bar select{min-width:190px}
      .stock-summary{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
      .stock-actions-cell{display:flex;gap:6px;flex-wrap:wrap}
      .stock-ok{color:#22c55e!important;border-color:rgba(34,197,94,.45)!important;background:rgba(34,197,94,.10)!important}
      .stock-baixo{color:#f59e0b!important;border-color:rgba(245,158,11,.5)!important;background:rgba(245,158,11,.12)!important}
      .stock-sem{color:#ef4444!important;border-color:rgba(239,68,68,.5)!important;background:rgba(239,68,68,.12)!important}
      tr.row-baixo td{background:rgba(245,158,11,.04)}
      tr.row-sem td{background:rgba(239,68,68,.05)}
      .movement-box{white-space:pre-wrap;max-height:160px;overflow:auto;font-size:12px;line-height:1.4}
    `;
    document.head.appendChild(style);
  }

  function ensureStockUi() {
    ensureExtraStyle();
    const page = qs("#stock");
    const search = qs("#stockSearch");
    if (!page || !search) return;

    let filters = search.closest(".filters");
    if (!filters) return;

    if (!qs("#stockStatusFilter")) {
      filters.classList.remove("one");
      const select = document.createElement("select");
      select.id = "stockStatusFilter";
      select.innerHTML = `
        <option value="">Todos os estoques</option>
        <option value="ok">OK</option>
        <option value="baixo">Baixo estoque</option>
        <option value="sem">Sem estoque</option>
      `;
      select.onchange = () => renderStock();
      filters.appendChild(select);
    }

    if (!qs("#stockSummary")) {
      const box = document.createElement("div");
      box.id = "stockSummary";
      box.className = "stock-summary";
      box.innerHTML = `
        <span class="chip">Total: <strong id="stockTotal">0</strong></span>
        <span class="chip stock-ok">OK: <strong id="stockOk">0</strong></span>
        <span class="chip stock-baixo">Baixo: <strong id="stockLow">0</strong></span>
        <span class="chip stock-sem">Sem: <strong id="stockZero">0</strong></span>
      `;
      const tableWrap = page.querySelector(".table-wrap");
      if (tableWrap) tableWrap.parentNode.insertBefore(box, tableWrap);
    }

    const head = page.querySelector("thead tr");
    if (head && head.dataset.foStockHeader !== "1") {
      head.dataset.foStockHeader = "1";
      head.innerHTML = `
        <th>Código</th>
        <th>Item</th>
        <th>Categoria</th>
        <th>Status</th>
        <th>Qtd</th>
        <th>Mínimo</th>
        <th>Local</th>
        <th>Entrada / Saída</th>
        <th>Ações</th>
      `;
    }

    search.oninput = () => renderStock();
  }

  function setText(id, value) {
    const el = qs("#" + id);
    if (el) el.textContent = value;
  }

  function updateStockSummary(list) {
    setText("stockTotal", list.length);
    setText("stockOk", list.filter((i) => stockStatus(i) === "ok").length);
    setText("stockLow", list.filter((i) => stockStatus(i) === "baixo").length);
    setText("stockZero", list.filter((i) => stockStatus(i) === "sem").length);
  }

  window.renderStock = renderStock = function () {
    ensureStockUi();
    const tbody = qs("#stockTable");
    if (!tbody) return;

    const searchText = (qs("#stockSearch")?.value || "").toLowerCase();
    const filterStatus = qs("#stockStatusFilter")?.value || "";

    const base = (typeof stock !== "undefined" ? stock : []).filter((item) => {
      const text = `${item.code || ""} ${item.name || ""} ${item.category || ""} ${item.location || ""} ${item.supplier || ""}`.toLowerCase();
      return !searchText || text.includes(searchText);
    });

    updateStockSummary(base);

    const order = { sem: 0, baixo: 1, ok: 2 };
    const rows = base
      .filter((item) => !filterStatus || stockStatus(item) === filterStatus)
      .sort((a, b) => {
        const diff = order[stockStatus(a)] - order[stockStatus(b)];
        if (diff !== 0) return diff;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });

    tbody.innerHTML = rows.map((item) => {
      const st = stockStatus(item);
      return `
        <tr class="row-${st}">
          <td>${h(item.code || "")}</td>
          <td>${h(item.name || "")}</td>
          <td>${h(item.category || "")}</td>
          <td><span class="chip stock-${st}">${stockStatusLabel(st)}</span></td>
          <td><strong>${num(item.quantity)}</strong></td>
          <td>${num(item.min_quantity)}</td>
          <td>${h(item.location || "")}</td>
          <td>
            <div class="stock-actions-cell">
              <button class="small-btn" onclick="openStockMove('${item.id}','entrada')">Entrada</button>
              <button class="danger small-btn" onclick="openStockMove('${item.id}','saida')">Saída</button>
            </div>
          </td>
          <td>
            <button class="small-btn" onclick="openStock('${item.id}')">Editar</button>
            <button class="danger small-btn" onclick="delStock('${item.id}')">Excluir</button>
          </td>
        </tr>`;
    }).join("") || '<tr><td colspan="9">Nenhum item encontrado.</td></tr>';
  };

  window.openStockMove = function (id, type) {
    if (!canStock()) return alert("Apenas o perfil ESTOQUE pode movimentar estoque.");

    const item = (typeof stock !== "undefined" ? stock : []).find((x) => x.id === id);
    if (!item) return alert("Item não encontrado.");

    const isEntrada = type === "entrada";
    const title = isEntrada ? "Entrada de disjuntor" : "Saída de disjuntor";

    modal(title, `
      <form id="stockMoveForm" class="form">
        <input type="hidden" id="moveItemId" value="${h(id)}">
        <input type="hidden" id="moveType" value="${h(type)}">
        <p class="muted">
          <strong>${h(item.name || "")}</strong><br>
          Código: ${h(item.code || "-")}<br>
          Estoque atual: <strong>${num(item.quantity)}</strong>
        </p>
        <div class="form-grid">
          <label>Quantidade
            <input id="moveQty" type="number" min="1" step="1" required>
          </label>
          <label>Obra / destino / origem
            <input id="movePlace" placeholder="Ex: MC Giovanni, QL-T, compra, obra...">
          </label>
          <label class="full-row">Observação
            <textarea id="moveObs" placeholder="Motivo da movimentação"></textarea>
          </label>
        </div>
        <button class="primary full" type="submit">${isEntrada ? "Confirmar entrada" : "Confirmar saída"}</button>
      </form>
    `);

    qs("#stockMoveForm").onsubmit = saveStockMove;
    setTimeout(() => qs("#moveQty")?.focus(), 50);
  };

  async function saveStockMove(e) {
    e.preventDefault();
    if (!canStock()) return alert("Apenas o perfil ESTOQUE pode movimentar estoque.");

    const id = qs("#moveItemId").value;
    const type = qs("#moveType").value;
    const qty = Number(qs("#moveQty").value || 0);
    const place = qs("#movePlace").value.trim();
    const obs = qs("#moveObs").value.trim();

    if (!qty || qty <= 0) return alert("Digite uma quantidade válida.");

    const item = (typeof stock !== "undefined" ? stock : []).find((x) => x.id === id);
    if (!item) return alert("Item não encontrado.");

    const before = num(item.quantity);
    if (type === "saida" && qty > before) {
      return alert("Não dá para sair mais do que tem em estoque. Estoque atual: " + before);
    }

    const after = type === "entrada" ? before + qty : before - qty;
    const sign = type === "entrada" ? "+" : "-";
    const user = currentUser?.username || "Sistema";
    const line = `[${new Date().toLocaleString("pt-BR")}] ${type.toUpperCase()} ${sign}${qty} | Antes: ${before} | Depois: ${after} | Local/Obra: ${place || "-"} | Obs: ${obs || "-"} | Usuário: ${user}`;
    const oldObs = String(item.observation || "").trim();

    const result = await sb.from("fo_inventory").update({
      quantity: after,
      observation: oldObs ? oldObs + "\n" + line : line,
      updated_at: new Date().toISOString()
    }).eq("id", id);

    if (result.error) return alert("Erro ao salvar movimentação: " + result.error.message);

    closeModal();
    await refresh(true);
  }

  window.renderUsers = renderUsers = function () {
    const box = qs("#usersList");
    if (!box) return;

    if (!canAdmin()) {
      box.innerHTML = '<p class="muted">Apenas ADM pode gerenciar usuários.</p>';
      return;
    }

    box.innerHTML = (typeof users !== "undefined" ? users : []).map((u) => {
      const roleName = ROLE_LABEL[u.role] || u.role;
      const canDelete = u.username !== "ADM" && (!currentUser || u.id !== currentUser.id);
      return `
        <div class="mini-item">
          <div><strong>${h(u.username)}</strong><br><span class="muted">${h(roleName)}</span></div>
          <div class="stock-actions-cell">
            <button class="small-btn" onclick="changeUserPassword('${u.id}')">Trocar senha</button>
            ${canDelete ? `<button class="danger small-btn" onclick="delUser('${u.id}')">Excluir</button>` : ""}
          </div>
        </div>`;
    }).join("") || '<p class="muted">Nenhum usuário cadastrado.</p>';
  };

  window.changeUserPassword = async function (id) {
    if (!canAdmin()) return alert("Apenas ADM pode trocar senha.");

    const user = (typeof users !== "undefined" ? users : []).find((x) => x.id === id);
    if (!user) return alert("Usuário não encontrado.");

    const pass = prompt("Nova senha para " + user.username + ":");
    if (pass === null) return;
    if (pass.length < 4) return alert("Senha mínima de 4 caracteres.");

    const password_hash = await sha256(pass);
    const result = await sb.from("fo_users").update({
      password_hash,
      updated_at: new Date().toISOString()
    }).eq("id", id);

    if (result.error) return alert("Erro ao trocar senha: " + result.error.message);
    alert("Senha alterada com sucesso.");
    await refresh(true);
  };

  const oldSaveUser = typeof saveUser === "function" ? saveUser : null;
  window.saveUser = saveUser = async function (e) {
    if (!canAdmin()) {
      e.preventDefault();
      return alert("Apenas ADM pode criar usuários.");
    }
    if (oldSaveUser) return oldSaveUser(e);
  };

  const oldDelUser = typeof delUser === "function" ? delUser : null;
  window.delUser = delUser = async function (id) {
    if (!canAdmin()) return alert("Apenas ADM pode excluir usuários.");
    const user = (typeof users !== "undefined" ? users : []).find((x) => x.id === id);
    if (!user) return alert("Usuário não encontrado.");
    if (user.username === "ADM") return alert("O usuário ADM principal não pode ser excluído.");
    if (currentUser && user.id === currentUser.id) return alert("Você não pode excluir o próprio usuário logado.");
    if (oldDelUser) return oldDelUser(id);
  };

  function bootExtra() {
    ensureExtraStyle();
    ensureStockUi();
    const stockSearch = qs("#stockSearch");
    if (stockSearch) stockSearch.oninput = () => renderStock();
    const userForm = qs("#userForm");
    if (userForm) userForm.onsubmit = saveUser;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootExtra);
  } else {
    bootExtra();
  }
})();
