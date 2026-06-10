import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET() {
  try {
    const [veiculos, alugueis, manutencoes, lancamentos, clientes] = await Promise.all([
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
      prisma.cliente.findMany({ orderBy: { nome: 'asc' } }),
    ])

    const totalReceitas = lancamentos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + l.valor, 0)
    const totalDespesas = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0)
    const lucro = totalReceitas - totalDespesas
    const custoAquisicao = veiculos.reduce((s, v) => s + v.custo, 0)
    const roi = custoAquisicao > 0 ? (lucro / custoAquisicao) * 100 : 0

    const aluguelConcluidos = alugueis.filter(a => a.status === 'CONCLUIDO')
    const ticketMedio = aluguelConcluidos.length > 0 ? totalReceitas / aluguelConcluidos.length : 0

    // Saldo devedor — aluguéis não cancelados com pagamento PENDENTE ou PARCIAL
    const saldoAReceber = (a: { valor: number; valorPago?: number | null }) =>
      Math.max(Number(a.valor || 0) - Number(a.valorPago || 0), 0)

    const inadimplentes = alugueis.filter(a =>
      a.status !== 'CANCELADO' &&
      (a.statusPagamento === 'PENDENTE' || a.statusPagamento === 'PARCIAL')
    )
    const totalDevedor = inadimplentes.reduce((s, a) => s + saldoAReceber(a), 0)

    // Agrupado por cliente
    const devedoresPorCliente: Record<string, { cliente: string; total: number; qtd: number }> = {}
    inadimplentes.forEach(a => {
      if (!devedoresPorCliente[a.cliente]) devedoresPorCliente[a.cliente] = { cliente: a.cliente, total: 0, qtd: 0 }
      devedoresPorCliente[a.cliente].total += saldoAReceber(a)
      devedoresPorCliente[a.cliente].qtd += 1
    })

    return NextResponse.json({
      veiculos,
      alugueis,
      manutencoes,
      lancamentos,
      clientes,
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
        totalDevedor,
        devedores: Object.values(devedoresPorCliente),
        qtdInadimplentes: inadimplentes.length,
      }
    }, { headers: noStoreHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500, headers: noStoreHeaders })
  }
}
