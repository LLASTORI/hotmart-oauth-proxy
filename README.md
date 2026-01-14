# Hotmart OAuth Proxy for Railway

Este proxy resolve o problema de bloqueio do Cloudflare quando Supabase Edge Functions tentam acessar as APIs da Hotmart.

## Arquitetura

```
Supabase Edge Function → OAuth Proxy (Railway) → Hotmart API
```

## Deploy no Railway

### 1. Criar projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project"
3. Escolha "Deploy from GitHub repo" ou "Empty project"

### 2. Se usar GitHub:

1. Crie um repositório com os arquivos desta pasta
2. Conecte ao Railway

### 3. Se usar deploy manual:

1. No Railway, clique no projeto
2. Clique em "Add Service" → "Empty Service"
3. Vá em Settings → Deploy → Nixpacks
4. Cole o código via CLI ou conecte um repo

### 4. Configurar variáveis de ambiente

No Railway → Variables, adicione:

```
HOTMART_CLIENT_ID=seu_client_id
HOTMART_CLIENT_SECRET=seu_client_secret
PROXY_API_KEY=uma_chave_secreta_opcional
```

### 5. Copiar URL

Após deploy, copie a URL pública:
```
https://seu-projeto.up.railway.app
```

## Configurar no Cubo Mágico

1. Acesse Lovable Cloud → Settings → Secrets
2. Adicione:
   - `HOTMART_PROXY_URL`: URL do Railway (ex: `https://hotmart-proxy.up.railway.app`)
   - `HOTMART_PROXY_API_KEY`: A mesma chave definida em `PROXY_API_KEY`

## Endpoints

### GET /health

Verifica se o proxy está funcionando.

```bash
curl https://seu-projeto.up.railway.app/health
```

### POST /hotmart

Proxy para qualquer endpoint da Hotmart.

```bash
curl -X POST https://seu-projeto.up.railway.app/hotmart \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{
    "path": "/payments/api/v1/sales/history",
    "params": {
      "start_date": "1704067200000",
      "end_date": "1736774400000",
      "max_results": "10"
    }
  }'
```

## Segurança

- O proxy NÃO armazena dados
- OAuth tokens são cacheados em memória (expiram automaticamente)
- Use `PROXY_API_KEY` para proteger o endpoint
- Configure IP allowlist no Railway se necessário

## Endpoints Hotmart Suportados

O proxy pode acessar qualquer endpoint da Hotmart:

| Endpoint | Descrição |
|----------|-----------|
| `/payments/api/v1/sales/history` | Histórico de vendas |
| `/payments/api/v1/sales/commissions` | Comissões detalhadas |
| `/payments/api/v1/subscriptions` | Assinaturas |
| `/payments/api/v1/refunds` | Reembolsos |

## Troubleshooting

### OAuth failed (401)

Credenciais incorretas. Verifique:
- `HOTMART_CLIENT_ID` e `HOTMART_CLIENT_SECRET` estão corretos
- Credenciais são do ambiente correto (produção vs sandbox)

### Connection timeout

Railway pode ter problemas de rede. Verifique:
- Logs no Railway dashboard
- Status da Hotmart API

### Empty response

A Hotmart pode não ter dados no período. Verifique:
- Datas estão em timestamp milliseconds
- Existem vendas no período solicitado
