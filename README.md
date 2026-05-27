# QuadriGest v2 — Next.js + Prisma + PostgreSQL

Sistema completo de gestão de aluguel de quadriciclos com banco de dados real na nuvem.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 |
| Backend | Next.js API Routes (REST) |
| ORM | Prisma 5 |
| Banco | PostgreSQL — Neon.tech (gratuito) |
| Deploy | Vercel (gratuito) |

---

## Passo 1 — Criar banco de dados gratuito no Neon

1. Acesse **https://neon.tech** e clique em **Sign Up** (pode entrar com GitHub)
2. Clique em **New Project**
3. Dê um nome: `quadrigest`
4. Região: **South America (São Paulo)** → confirmar
5. Clique em **Create Project**
6. Na tela seguinte, vá em **Connection Details**
7. No dropdown, selecione **Prisma** como framework
8. Copie as duas strings que aparecem:
   - `DATABASE_URL` (pooled — começa com `postgresql://...pgbouncer=true`)
   - `DIRECT_URL` (direct — sem pgbouncer)

---

## Passo 2 — Configurar variáveis locais

```bash
# Na pasta do projeto, crie o .env
cp .env.example .env
```

Edite o `.env` e cole as duas URLs copiadas do Neon:

```env
DATABASE_URL="postgresql://usuario:senha@host/quadrigest?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://usuario:senha@host/quadrigest?sslmode=require"
```

---

## Passo 3 — Instalar dependências e criar as tabelas

```bash
# Instalar pacotes
npm install

# Criar as tabelas no banco (roda as migrations)
npx prisma db push

# (Opcional) Popular com dados de exemplo para testar
npx ts-node prisma/seed.ts
```

---

## Passo 4 — Rodar localmente

```bash
npm run dev
```

Acesse **http://localhost:3000** — o sistema estará funcionando com banco real.

---

## Passo 5 — Deploy no Vercel

### 5.1 — Subir o código para o GitHub

```bash
git init
git add .
git commit -m "QuadriGest v2 - Next.js + Prisma"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/quadrigest.git
git push -u origin main
```

### 5.2 — Criar projeto no Vercel

1. Acesse **https://vercel.com** → **New Project**
2. Importe o repositório `quadrigest` do GitHub
3. **Framework Preset**: Next.js (detecta automaticamente)
4. Clique em **Environment Variables** e adicione:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | (cole a URL pooled do Neon) |
| `DIRECT_URL` | (cole a URL direct do Neon) |

5. Clique em **Deploy**

### 5.3 — Criar as tabelas no banco de produção

Após o primeiro deploy, execute uma vez:

```bash
# Aponta para o banco de produção e cria as tabelas
npx prisma db push
```

Ou via Vercel CLI:
```bash
npm i -g vercel
vercel env pull .env.production
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2) npx prisma db push
```

---

## Estrutura do projeto

```
quadrigest-next/
├── prisma/
│   ├── schema.prisma        # Modelos do banco (ORM)
│   └── seed.ts              # Dados de exemplo
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dashboard/route.ts      # GET — métricas agregadas
│   │   │   ├── veiculos/
│   │   │   │   ├── route.ts            # GET, POST
│   │   │   │   └── [id]/route.ts       # PUT, DELETE
│   │   │   ├── alugueis/
│   │   │   │   ├── route.ts            # GET, POST
│   │   │   │   └── [id]/route.ts       # PUT, DELETE
│   │   │   ├── manutencoes/
│   │   │   │   ├── route.ts            # GET, POST
│   │   │   │   └── [id]/route.ts       # PUT, DELETE
│   │   │   └── lancamentos/
│   │   │       ├── route.ts            # GET, POST
│   │   │       └── [id]/route.ts       # PUT, DELETE
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                    # Frontend SPA completo
│   └── lib/
│       └── prisma.ts                   # Singleton Prisma Client
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/dashboard` | Todos os dados + métricas |
| GET | `/api/veiculos` | Listar veículos |
| POST | `/api/veiculos` | Criar veículo |
| PUT | `/api/veiculos/:id` | Atualizar veículo |
| DELETE | `/api/veiculos/:id` | Excluir veículo |
| GET | `/api/alugueis` | Listar aluguéis |
| POST | `/api/alugueis` | Criar aluguel + lançamento automático |
| PUT | `/api/alugueis/:id` | Atualizar aluguel |
| DELETE | `/api/alugueis/:id` | Excluir aluguel + lançamento |
| GET | `/api/manutencoes` | Listar manutenções |
| POST | `/api/manutencoes` | Criar manutenção + despesa automática |
| PUT | `/api/manutencoes/:id` | Atualizar manutenção |
| DELETE | `/api/manutencoes/:id` | Excluir manutenção |
| GET | `/api/lancamentos` | Listar lançamentos financeiros |
| POST | `/api/lancamentos` | Criar despesa manual |
| PUT | `/api/lancamentos/:id` | Atualizar lançamento |
| DELETE | `/api/lancamentos/:id` | Excluir lançamento |

---

## Diferença da v1

| | v1 (HTML puro) | v2 (Next.js + Prisma) |
|---|---|---|
| Dados | localStorage (navegador) | PostgreSQL na nuvem |
| Persistência | Só no mesmo computador | Qualquer dispositivo |
| Backend | Nenhum | API REST completa |
| Multi-usuário | Não | Sim |
| Deploy | Arquivo estático | Vercel serverless |
