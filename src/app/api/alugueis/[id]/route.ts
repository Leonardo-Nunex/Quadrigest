import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, veiculoId, cliente, contato, duracao, valor, pagamento, statusPagamento, dataPagamento, status, rota, obs } = body

    const aluguelAntes = await prisma.aluguel.findUnique({ where: { id: params.id } })
    if (!aluguelAntes) return NextResponse.json({ error: 'Aluguel não encontrado' }, { status: 404 })

    const aluguel = await prisma.aluguel.update({
      where: { id: params.id },
      data: {
        data: data ? new Date(data) : undefined,
        veiculoId: veiculoId || undefined,
        cliente: cliente?.trim(),
        contato: contato || null,
        duracao: duracao ? Number(duracao) : null,
        valor: valor ? Number(valor) : undefined,
        pagamento: pagamento || undefined,
        statusPagamento: statusPagamento || undefined,
        dataPagamento: dataPagamento ? new Date(dataPagamento) : null,
        status: status || undefined,
        rota: rota || null,
        obs: obs || null,
      },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })

    const lancExistente = await prisma.lancamento.findFirst({ where: { aluguelId: params.id } })

    // Mudou para PAGO e não tinha lançamento → cria receita
    if (aluguel.statusPagamento === 'PAGO' && !lancExistente && aluguel.status !== 'CANCELADO') {
      await prisma.lancamento.create({
        data: {
          data: aluguel.dataPagamento || aluguel.data,
          descricao: `Aluguel — ${aluguel.cliente} (${aluguel.veiculo.placa} ${aluguel.veiculo.modelo})`,
          categoria: 'ALUGUEL',
          tipo: 'RECEITA',
          valor: aluguel.valor,
          aluguelId: aluguel.id,
          veiculoId: aluguel.veiculoId,
        }
      })
    }

    // Mudou para PENDENTE/PARCIAL e tinha lançamento → remove receita
    if ((aluguel.statusPagamento === 'PENDENTE' || aluguel.statusPagamento === 'PARCIAL') && lancExistente) {
      await prisma.lancamento.delete({ where: { id: lancExistente.id } })
    }

    // Estava PAGO, continua PAGO → atualiza valor/data do lançamento
    if (aluguel.statusPagamento === 'PAGO' && lancExistente) {
      await prisma.lancamento.update({
        where: { id: lancExistente.id },
        data: {
          valor: aluguel.valor,
          data: aluguel.dataPagamento || aluguel.data,
          descricao: `Aluguel — ${aluguel.cliente} (${aluguel.veiculo.placa} ${aluguel.veiculo.modelo})`,
        }
      })
    }

    return NextResponse.json(aluguel)
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Aluguel não encontrado' }, { status: 404 })
    console.error(e)
    return NextResponse.json({ error: 'Erro ao atualizar aluguel' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.lancamento.deleteMany({ where: { aluguelId: params.id } })
    await prisma.aluguel.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Aluguel não encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao excluir aluguel' }, { status: 500 })
  }
}
