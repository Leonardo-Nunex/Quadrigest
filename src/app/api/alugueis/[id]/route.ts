// src/app/api/alugueis/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, veiculoId, cliente, contato, duracao, valor, pagamento, status, rota, obs } = body

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
        status: status || undefined,
        rota: rota || null,
        obs: obs || null,
      },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })

    // Atualiza lançamento vinculado se existir
    const lanc = await prisma.lancamento.findFirst({ where: { aluguelId: params.id } })
    if (lanc) {
      await prisma.lancamento.update({
        where: { id: lanc.id },
        data: {
          valor: aluguel.valor,
          data: aluguel.data,
          descricao: `Aluguel — ${aluguel.cliente} (${aluguel.veiculo.placa} ${aluguel.veiculo.modelo})`,
        }
      })
    }

    return NextResponse.json(aluguel)
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Aluguel não encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao atualizar aluguel' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Remove lançamento vinculado primeiro
    await prisma.lancamento.deleteMany({ where: { aluguelId: params.id } })
    await prisma.aluguel.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Aluguel não encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao excluir aluguel' }, { status: 500 })
  }
}
