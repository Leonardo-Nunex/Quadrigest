// prisma/seed.ts
// Popula o banco com dados de exemplo para testes
// Executar: npx ts-node prisma/seed.ts  (ou: npx prisma db seed)

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Limpar dados existentes
  await prisma.lancamento.deleteMany()
  await prisma.aluguel.deleteMany()
  await prisma.manutencao.deleteMany()
  await prisma.veiculo.deleteMany()

  // ── Veículos ──
  const v1 = await prisma.veiculo.create({
    data: { placa: 'QUA-0001', modelo: 'Quadriciclo Sport 150', ano: 2023, cor: 'Vermelho', custo: 9500, status: 'DISPONIVEL' }
  })
  const v2 = await prisma.veiculo.create({
    data: { placa: 'QUA-0002', modelo: 'Quadriciclo Trail 200', ano: 2022, cor: 'Azul', custo: 8200, status: 'DISPONIVEL' }
  })
  const v3 = await prisma.veiculo.create({
    data: { placa: 'QUA-0003', modelo: 'Quadriciclo Kids 110', ano: 2024, cor: 'Verde', custo: 5800, status: 'DISPONIVEL' }
  })

  console.log('✅ Veículos criados')

  // ── Aluguéis dos últimos 3 meses ──
  const alugueis = [
    { dias: 60, v: v1, cliente: 'João Silva',     valor: 120, pag: 'PIX' },
    { dias: 58, v: v2, cliente: 'Maria Santos',   valor: 90,  pag: 'DINHEIRO' },
    { dias: 55, v: v3, cliente: 'Pedro Oliveira', valor: 70,  pag: 'PIX' },
    { dias: 50, v: v1, cliente: 'Ana Costa',      valor: 120, pag: 'CARTAO_DEBITO' },
    { dias: 45, v: v2, cliente: 'Carlos Lima',    valor: 90,  pag: 'PIX' },
    { dias: 40, v: v1, cliente: 'Fernanda Reis',  valor: 120, pag: 'PIX' },
    { dias: 35, v: v3, cliente: 'Ricardo Alves',  valor: 70,  pag: 'DINHEIRO' },
    { dias: 30, v: v2, cliente: 'Juliana Neves',  valor: 90,  pag: 'PIX' },
    { dias: 25, v: v1, cliente: 'Bruno Sousa',    valor: 120, pag: 'PIX' },
    { dias: 20, v: v3, cliente: 'Larissa Moura',  valor: 70,  pag: 'CARTAO_CREDITO' },
    { dias: 15, v: v2, cliente: 'Diego Ferreira', valor: 90,  pag: 'PIX' },
    { dias: 10, v: v1, cliente: 'Camila Rocha',   valor: 120, pag: 'PIX' },
    { dias: 5,  v: v3, cliente: 'Thiago Mendes',  valor: 70,  pag: 'DINHEIRO' },
    { dias: 2,  v: v2, cliente: 'Letícia Pires',  valor: 90,  pag: 'PIX' },
  ]

  for (const a of alugueis) {
    const data = new Date(); data.setDate(data.getDate() - a.dias)
    const aluguel = await prisma.aluguel.create({
      data: { data, veiculoId: a.v.id, cliente: a.cliente, duracao: 2, valor: a.valor, pagamento: a.pag as any, status: 'CONCLUIDO' }
    })
    await prisma.lancamento.create({
      data: { data, descricao: `Aluguel — ${a.cliente} (${a.v.placa})`, categoria: 'ALUGUEL', tipo: 'RECEITA', valor: a.valor, aluguelId: aluguel.id, veiculoId: a.v.id }
    })
  }

  console.log('✅ Aluguéis criados')

  // ── Manutenções ──
  const manuts = [
    { dias: 50, v: v1, tipo: 'PREVENTIVA', desc: 'Troca de óleo e filtros',          custo: 180 },
    { dias: 45, v: v2, tipo: 'PREVENTIVA', desc: 'Revisão geral 3000 km',            custo: 220 },
    { dias: 30, v: v3, tipo: 'CORRETIVA',  desc: 'Reparo na embreagem',              custo: 350 },
    { dias: 20, v: v1, tipo: 'PREVENTIVA', desc: 'Lubrificação de corrente',         custo: 80  },
    { dias: 10, v: v2, tipo: 'CORRETIVA',  desc: 'Substituição de pneu traseiro',   custo: 290 },
    { dias: 5,  v: v3, tipo: 'PREVENTIVA', desc: 'Calibração e verificação de freios', custo: 60 },
  ]

  for (const mn of manuts) {
    const data = new Date(); data.setDate(data.getDate() - mn.dias)
    const manut = await prisma.manutencao.create({
      data: { data, veiculoId: mn.v.id, tipo: mn.tipo as any, descricao: mn.desc, custo: mn.custo, oficina: 'Mecânica QuadriTech', status: 'CONCLUIDA' }
    })
    await prisma.lancamento.create({
      data: { data, descricao: `Manutenção ${mn.tipo.toLowerCase()} — ${mn.v.placa}`, categoria: 'MANUTENCAO', tipo: 'DESPESA', valor: mn.custo, manutencaoId: manut.id, veiculoId: mn.v.id }
    })
  }

  console.log('✅ Manutenções criadas')

  // ── Despesas operacionais ──
  const despesas = [
    { dias: 60, desc: 'Combustível — abastecimento frota',    cat: 'COMBUSTIVEL',   valor: 200 },
    { dias: 55, desc: 'Seguro anual — frota',                 cat: 'SEGURO',        valor: 1200 },
    { dias: 45, desc: 'Aluguel do ponto — Praia do Futuro',   cat: 'PONTO',         valor: 800 },
    { dias: 30, desc: 'Combustível',                          cat: 'COMBUSTIVEL',   valor: 180 },
    { dias: 20, desc: 'Impulsionamento Instagram',            cat: 'MARKETING',     valor: 150 },
    { dias: 15, desc: 'Aluguel do ponto — Praia do Futuro',   cat: 'PONTO',         valor: 800 },
    { dias: 5,  desc: 'Combustível',                          cat: 'COMBUSTIVEL',   valor: 160 },
  ]

  for (const d of despesas) {
    const data = new Date(); data.setDate(data.getDate() - d.dias)
    await prisma.lancamento.create({
      data: { data, descricao: d.desc, categoria: d.cat as any, tipo: 'DESPESA', valor: d.valor }
    })
  }

  console.log('✅ Despesas operacionais criadas')
  console.log('\n🎉 Seed concluído com sucesso!')
  console.log(`   ${alugueis.length} aluguéis | ${manuts.length} manutenções | ${despesas.length} despesas`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
