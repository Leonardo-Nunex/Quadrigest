# QuadriGest — Sistema de Gestão de Aluguel de Quadriciclos

Sistema web completo para gestão de aluguel de quadriciclos. Inclui CRUD de veículos, aluguéis, manutenções, controle financeiro e dashboard de ROI.

## Funcionalidades

- **Veículos** — cadastro completo com placa, modelo, ano, cor, custo de aquisição, chassi e status
- **Aluguéis** — registro de locações com cliente, veículo, duração, valor, forma de pagamento e status
- **Manutenções** — controle preventivo e corretivo com custo, oficina e agendamento
- **Financeiro** — lançamentos automáticos de receitas (aluguéis) e despesas (manutenções + custos operacionais)
- **ROI & Análise** — dashboard com retorno sobre investimento, ticket médio, payback estimado e composição de despesas
- **Exportar / Importar** — backup dos dados em JSON

## Tecnologias

- HTML5 + CSS3 + JavaScript puro (zero dependências backend)
- Chart.js para gráficos
- localStorage para persistência de dados
- Tabler Icons

## Deploy no Vercel

### Opção 1 — Via Vercel CLI (recomendado)

```bash
# Instalar Vercel CLI
npm install -g vercel

# Na pasta do projeto
vercel

# Seguir as instruções interativas
# Quando perguntar "Which scope?": selecione sua conta
# "Link to existing project?": N
# "What's your project's name?": quadrigest
# "In which directory is your code located?": ./
# Confirmar e aguardar o deploy
```

### Opção 2 — Via GitHub + Vercel Dashboard

1. Crie um repositório no GitHub e faça push desta pasta
2. Acesse [vercel.com](https://vercel.com) e clique em "Add New Project"
3. Importe o repositório do GitHub
4. Nas configurações do projeto, deixe tudo padrão (Framework: Other)
5. Clique em "Deploy"

### Opção 3 — Drag & Drop

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Arraste a pasta `quadrigest` para a área de upload
3. Aguarde o deploy automático

## Estrutura do projeto

```
quadrigest/
├── index.html      # Aplicação completa (HTML + CSS + JS)
├── vercel.json     # Configuração do Vercel
└── README.md       # Este arquivo
```

## Dados

Os dados são salvos no `localStorage` do navegador. Para não perder os dados:
- Use o botão **Exportar** para salvar um arquivo `.json` de backup
- Use o botão **Importar** para restaurar um backup

## Personalização

Para alterar o nome do sistema ou as cores, edite as variáveis CSS no início do arquivo `index.html`:

```css
:root {
  --green: #1a9e6e;       /* Cor principal */
  --sidebar-bg: #0d1b16;  /* Fundo da sidebar */
  /* ... */
}
```
