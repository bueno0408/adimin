# ENGCOM

Aplicativo web mobile-first para geração de orçamento de quadros elétricos personalizados com componentes **WEG**.

## Como executar

```bash
python3 app.py
```

Abre em `http://localhost:8000`.

## Credenciais padrão do admin

- Usuário: `admin`
- Senha: `engcom123`

Pode alterar com variáveis de ambiente `ADMIN_USER` e `ADMIN_PASS`.

## Envio de e-mail

O orçamento é enviado para `felipe@engteck.com.br`.

Para envio real, configure:
- `SMTP_HOST`
- `SMTP_PORT` (padrão 587)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Sem SMTP configurado, o conteúdo é salvo em `sent_emails.log`.
