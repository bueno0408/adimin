const $ = (id) => document.getElementById(id);

async function loadAll() {
  const [products, customers, quotes] = await Promise.all([
    fetch('/api/admin/products').then((r) => r.json()),
    fetch('/api/admin/customers').then((r) => r.json()),
    fetch('/api/admin/quotes').then((r) => r.json()),
  ]);

  $('plist').innerHTML = products.map((p) => `<div>#${p.id} ${p.description} | ${p.category} | R$ ${Number(p.price).toFixed(2)}</div>`).join('');
  $('customers').innerHTML = customers.map((c) => `<div>#${c.id} ${c.name} - ${c.phone} - ${c.email}</div>`).join('');
  $('quotes').innerHTML = quotes.map((q) => `<div><strong>#${q.id}</strong> ${q.name} - Total: R$ ${Number(q.total).toFixed(2)}<br/>Itens: ${q.items.map(i => `${i.description} (${i.quantity})`).join(', ')}</div><hr/></div>`).join('');
}

$('add').addEventListener('click', async () => {
  const payload = {
    category: $('cat').value,
    description: $('desc').value,
    price: Number($('price').value),
  };
  const res = await fetch('/api/admin/products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (res.ok) {
    $('cat').value = '';
    $('desc').value = '';
    $('price').value = '';
    loadAll();
  }
});

loadAll();
