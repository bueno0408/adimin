#!/usr/bin/env python3
import base64
import json
import os
import sqlite3
from datetime import datetime
from email.message import EmailMessage
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import smtplib

ROOT = Path(__file__).parent
DB_PATH = ROOT / "engcom.db"
PUBLIC_DIR = ROOT / "public"
DEST_EMAIL = "felipe@engteck.com.br"

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "engcom123")


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            brand TEXT NOT NULL DEFAULT 'WEG',
            active INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            observations TEXT,
            total REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS quote_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY(quote_id) REFERENCES quotes(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
        """
    )
    cur.execute("SELECT COUNT(*) AS c FROM products")
    if cur.fetchone()["c"] == 0:
        products = [
            ("Caixa do quadro", "Caixa metálica WEG 400x300", 420.00, "WEG"),
            ("Caixa do quadro", "Caixa metálica WEG 600x400", 690.00, "WEG"),
            ("Disjuntores WEG", "Disjuntor WEG MDW-C10 1P", 38.90, "WEG"),
            ("Disjuntores WEG", "Disjuntor WEG MDW-C20 1P", 44.50, "WEG"),
            ("Disjuntores WEG", "Disjuntor WEG MDW-C32 3P", 129.90, "WEG"),
        ]
        cur.executemany(
            "INSERT INTO products (category, description, price, brand) VALUES (?, ?, ?, ?)",
            products,
        )
    conn.commit()
    conn.close()


def send_quote_email(customer, items, total, observations):
    rows = "".join(
        f"<tr><td>{it['description']}</td><td>{it['quantity']}</td><td>R$ {it['subtotal']:.2f}</td></tr>"
        for it in items
    )
    html = f"""
    <h2>ENGCOM - Novo Orçamento</h2>
    <p><strong>Nome:</strong> {customer['name']}</p>
    <p><strong>Telefone:</strong> {customer['phone']}</p>
    <p><strong>Email:</strong> {customer['email']}</p>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><th>Componente</th><th>Qtd</th><th>Subtotal</th></tr>
      {rows}
    </table>
    <p><strong>Total:</strong> R$ {total:.2f}</p>
    <p><strong>Observações:</strong> {observations or '-'}</p>
    """

    msg = EmailMessage()
    msg["Subject"] = "ENGCOM - Novo orçamento de quadro elétrico"
    msg["From"] = os.getenv("SMTP_FROM", "no-reply@engcom.local")
    msg["To"] = DEST_EMAIL
    msg.set_content("Visualize este e-mail em formato HTML.")
    msg.add_alternative(html, subtype="html")

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    if smtp_host:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    else:
        with open(ROOT / "sent_emails.log", "a", encoding="utf-8") as fp:
            fp.write(f"\n[{datetime.now().isoformat()}] PARA: {DEST_EMAIL}\n{html}\n")


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _serve_file(self, path):
        file_path = PUBLIC_DIR / path
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return
        content = file_path.read_bytes()
        ctype = "text/html; charset=utf-8"
        if file_path.suffix == ".css":
            ctype = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            ctype = "application/javascript; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _admin_ok(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return False
        decoded = base64.b64decode(auth.split(" ", 1)[1]).decode("utf-8")
        username, _, password = decoded.partition(":")
        return username == ADMIN_USER and password == ADMIN_PASS

    def do_GET(self):
        if self.path == "/":
            return self._serve_file("index.html")
        if self.path == "/admin":
            return self._serve_file("admin.html")
        if self.path.startswith("/public/"):
            return self._serve_file(self.path.replace("/public/", ""))

        conn = db_conn()
        cur = conn.cursor()
        if self.path == "/api/products":
            cur.execute("SELECT id, category, description, price, brand FROM products WHERE active = 1 AND brand = 'WEG' ORDER BY category, id")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return self._json(200, rows)

        if self.path == "/api/admin/customers":
            if not self._admin_ok():
                conn.close()
                return self._json(401, {"error": "Não autorizado"})
            cur.execute("SELECT id, name, phone, email, created_at FROM customers ORDER BY id DESC")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return self._json(200, rows)

        if self.path == "/api/admin/quotes":
            if not self._admin_ok():
                conn.close()
                return self._json(401, {"error": "Não autorizado"})
            cur.execute(
                """
                SELECT q.id, q.total, q.observations, q.created_at, c.name, c.phone, c.email
                FROM quotes q JOIN customers c ON c.id = q.customer_id
                ORDER BY q.id DESC
                """
            )
            quotes = [dict(r) for r in cur.fetchall()]
            for q in quotes:
                cur.execute(
                    """
                    SELECT p.description, qi.quantity, qi.unit_price, qi.subtotal
                    FROM quote_items qi JOIN products p ON p.id = qi.product_id
                    WHERE qi.quote_id = ?
                    """,
                    (q["id"],),
                )
                q["items"] = [dict(x) for x in cur.fetchall()]
            conn.close()
            return self._json(200, quotes)

        if self.path == "/api/admin/products":
            if not self._admin_ok():
                conn.close()
                return self._json(401, {"error": "Não autorizado"})
            cur.execute("SELECT id, category, description, price, brand, active FROM products WHERE brand = 'WEG' ORDER BY id DESC")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return self._json(200, rows)

        conn.close()
        self.send_error(404)

    def do_POST(self):
        conn = db_conn()
        cur = conn.cursor()
        if self.path == "/api/register":
            body = self._read_json()
            name = body.get("name", "").strip()
            phone = body.get("phone", "").strip()
            email = body.get("email", "").strip().lower()
            if not (name and phone and email):
                conn.close()
                return self._json(400, {"error": "Preencha nome, telefone e email"})
            now = datetime.now().isoformat()
            cur.execute("SELECT id FROM customers WHERE email = ?", (email,))
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE customers SET name=?, phone=? WHERE id=?", (name, phone, row["id"]))
                customer_id = row["id"]
            else:
                cur.execute(
                    "INSERT INTO customers (name, phone, email, created_at) VALUES (?, ?, ?, ?)",
                    (name, phone, email, now),
                )
                customer_id = cur.lastrowid
            conn.commit()
            conn.close()
            return self._json(200, {"customer_id": customer_id})

        if self.path == "/api/quotes":
            body = self._read_json()
            customer_id = body.get("customer_id")
            items = body.get("items", [])
            observations = body.get("observations", "").strip()
            if not customer_id or not items:
                conn.close()
                return self._json(400, {"error": "Cliente e itens são obrigatórios"})

            cur.execute("SELECT id, name, phone, email FROM customers WHERE id = ?", (customer_id,))
            customer = cur.fetchone()
            if not customer:
                conn.close()
                return self._json(404, {"error": "Cliente não encontrado"})

            quote_items = []
            total = 0.0
            for item in items:
                pid = int(item.get("product_id", 0))
                qty = int(item.get("quantity", 0))
                if qty <= 0:
                    continue
                cur.execute("SELECT id, description, price, brand FROM products WHERE id = ? AND active = 1", (pid,))
                p = cur.fetchone()
                if not p or p["brand"] != "WEG":
                    continue
                subtotal = p["price"] * qty
                total += subtotal
                quote_items.append(
                    {
                        "product_id": p["id"],
                        "description": p["description"],
                        "quantity": qty,
                        "unit_price": p["price"],
                        "subtotal": subtotal,
                    }
                )

            if not quote_items:
                conn.close()
                return self._json(400, {"error": "Selecione componentes válidos WEG"})

            now = datetime.now().isoformat()
            cur.execute(
                "INSERT INTO quotes (customer_id, observations, total, created_at) VALUES (?, ?, ?, ?)",
                (customer_id, observations, total, now),
            )
            quote_id = cur.lastrowid
            for qi in quote_items:
                cur.execute(
                    """
                    INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (quote_id, qi["product_id"], qi["quantity"], qi["unit_price"], qi["subtotal"]),
                )
            conn.commit()

            try:
                send_quote_email(dict(customer), quote_items, total, observations)
                email_status = "sent"
            except Exception as exc:
                email_status = f"failed: {exc}"

            conn.close()
            return self._json(201, {"quote_id": quote_id, "total": round(total, 2), "email": email_status})

        if self.path == "/api/admin/products":
            if not self._admin_ok():
                conn.close()
                return self._json(401, {"error": "Não autorizado"})
            body = self._read_json()
            category = body.get("category", "").strip()
            description = body.get("description", "").strip()
            price = float(body.get("price", 0))
            if not (category and description and price > 0):
                conn.close()
                return self._json(400, {"error": "Dados inválidos"})
            cur.execute(
                "INSERT INTO products (category, description, price, brand, active) VALUES (?, ?, ?, 'WEG', 1)",
                (category, description, price),
            )
            conn.commit()
            pid = cur.lastrowid
            conn.close()
            return self._json(201, {"id": pid})

        conn.close()
        self.send_error(404)

    def do_PUT(self):
        if self.path.startswith("/api/admin/products/"):
            if not self._admin_ok():
                return self._json(401, {"error": "Não autorizado"})
            pid = int(self.path.rsplit("/", 1)[1])
            body = self._read_json()
            conn = db_conn()
            cur = conn.cursor()
            cur.execute("SELECT id FROM products WHERE id = ?", (pid,))
            if not cur.fetchone():
                conn.close()
                return self._json(404, {"error": "Produto não encontrado"})
            category = body.get("category", "").strip()
            description = body.get("description", "").strip()
            price = float(body.get("price", 0))
            active = 1 if body.get("active", True) else 0
            brand = body.get("brand", "WEG")
            if brand != "WEG":
                conn.close()
                return self._json(400, {"error": "Somente produtos WEG são permitidos"})
            cur.execute(
                "UPDATE products SET category=?, description=?, price=?, active=?, brand='WEG' WHERE id=?",
                (category, description, price, active, pid),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"updated": True})
        self.send_error(404)


def run():
    init_db()
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"ENGCOM running on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
