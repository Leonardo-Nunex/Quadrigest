import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const alugueis = await prisma.aluguel.findMany({
      orderBy: { data: 'desc' },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })
    return NextResponse.json(alugueis)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar aluguéis' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, veiculoId, cliente, contato, duracao, valor, valorPago, pagamento, statusPagamento, dataPagamento, status, rota, obs } = body

    if (!data || !veiculoId || !cliente || !valor) {
      return NextResponse.json({ error: 'Campos obrigatórios: data, veiculoId, cliente, valor' }, { status: 400 })
    }

    const valorTotal = Number(valor)
    const valorPagoInformado = valorPago !== undefined && valorPago !== ''
    const statusSolicitado = statusPagamento || 'PAGO'
    const valorPagoBase = valorPagoInformado ? Number(valorPago) : statusSolicitado === 'PAGO' ? valorTotal : 0
    const pago = Math.min(Math.max(valorPagoBase, 0), valorTotal)
    const statusPgto = pago >= valorTotal ? 'PAGO' : pago > 0 ? 'PARCIAL' : 'PENDENTE'
    const dataPgto = dataPagamento ? new Date(dataPagamento) : statusPgto === 'PAGO' ? new Date() : null

    const aluguel = await prisma.aluguel.create({
      data: {
        data: new Date(data),
        veiculoId,
        cliente: cliente.trim(),
        contato: contato || null,
        duracao: duracao ? Number(duracao) : null,
        valor: valorTotal,
        valorPago: pago,
        pagamento: pagamento || 'PIX',
        statusPagamento: statusPgto,
        dataPagamento: dataPgto,
        status: status || 'CONCLUIDO',
        rota: rota || null,
        obs: obs || null,
      },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })

    // Lançamento automático apenas se pagamento não estiver pendente
    if (aluguel.status !== 'CANCELADO' && aluguel.valorPago > 0) {
      const v = aluguel.veiculo
      await prisma.lancamento.create({
        data: {
          data: new Date(data),
          descricao: `Aluguel — ${cliente} (${v.placa} ${v.modelo})`,
          categoria: 'ALUGUEL',
          tipo: 'RECEITA',
          valor: aluguel.valorPago,
          aluguelId: aluguel.id,
          veiculoId,
        }
      })
    }

    return NextResponse.json(aluguel, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao criar aluguel' }, { status: 500 })
  }
}
