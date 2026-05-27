// src/app/api/dashboard/route.ts
// Retorna todos os dados agregados para o dashboard em uma única chamada
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [veiculos, alugueis, manutencoes, lancamentos] = await Promise.all([
      prisma.veiculo.findMany({ orderBy: { criadoEm: 'desc' } }),
      prisma.aluguel.findMany({
        orderBy: { data: 'desc' },
        include: { veiculo: { select: { placa: true, modelo: true } } }
      }),
      prisma.manutencao.findMany({
        orderBy: { data: 'desc' },
        include: { veiculo: { select: { placa: true, modelo: true } } }
      }),
      prisma.lancamento.findMany({
        orderBy: { data: 'desc' },
        include: { veiculo: { select: { placa: true, modelo: true } } }
      }),
    ])

    const totalReceitas = lancamentos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + l.valor, 0)
    const totalDespesas = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0)
    const lucro = totalReceitas - totalDespesas
    const custoAquisicao = veiculos.reduce((s, v) => s + v.custo, 0)
    const roi = custoAquisicao > 0 ? (lucro / custoAquisicao) * 100 : 0

    // Aluguéis concluídos
    const aluguelConcluidos = alugueis.filter(a => a.status === 'CONCLUIDO')
    const ticketMedio = aluguelConcluidos.length > 0 ? totalReceitas / aluguelConcluidos.length : 0

    return NextResponse.json({
      veiculos,
      alugueis,
      manutencoes,
      lancamentos,
      metricas: {
        totalVeiculos: veiculos.length,
        veiculosDisponiveis: veiculos.filter(v => v.status === 'DISPONIVEL').length,
        totalAlugueis: alugueis.length,
        alugueisAndamento: alugueis.filter(a => a.status === 'ANDAMENTO').length,
        totalReceitas,
        totalDespesas,
        lucro,
        custoAquisicao,
        roi,
        ticketMedio,
        totalManutencoes: manutencoes.length,
        manutencoesAgendadas: manutencoes.filter(m => m.status === 'AGENDADA').length,
      }
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
