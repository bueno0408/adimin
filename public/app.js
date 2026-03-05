let customerId = null;
let products = [];

const currency = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  const container = document.getElementById('products');
  container.innerHTML = '';
  products.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'product';
    div.innerHTML = `<div><label>${p.category} - ${p.description} (${p.brand}) - ${currency(p.price)}</label></div>
    <input type="number" min="0" value="0" data-product-id="${p.id}" />`;
    container.appendChild(div);
  });
  container.addEventListener('input', updateTotal);
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll('[data-product-id]').forEach((input) => {
    const p = products.find((x) => x.id === Number(input.dataset.productId));
    total += Number(input.value || 0) * p.price;
  });
  document.getElementById('total').textContent = `Total: ${currency(total)}`;
}

document.getElementById('btnRegister').addEventListener('click', async () => {
  const payload = {
    name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value,
  };
  const res = await fetch('/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return (document.getElementById('regMsg').textContent = data.error);
  customerId = data.customer_id;
  document.getElementById('regMsg').textContent = 'Cadastro salvo com sucesso!';
});

document.getElementById('btnQuote').addEventListener('click', async () => {
  if (!customerId) return (document.getElementById('quoteMsg').textContent = 'Salve o cadastro primeiro.');
  const items = [];
  document.querySelectorAll('[data-product-id]').forEach((input) => {
    const q = Number(input.value || 0);
    if (q > 0) items.push({ product_id: Number(input.dataset.productId), quantity: q });
  });
  const payload = { customer_id: customerId, items, observations: document.getElementById('obs').value };
  const res = await fetch('/api/quotes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return (document.getElementById('quoteMsg').textContent = data.error);
  document.getElementById('quoteMsg').textContent = `Orçamento #${data.quote_id} gerado. Status do e-mail: ${data.email}`;
});

loadProducts();
