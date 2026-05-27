// src/app/api/manutencoes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, veiculoId, tipo, descricao, custo, oficina, proxima, status } = body

    const manutencao = await prisma.manutencao.update({
      where: { id: params.id },
      data: {
        data: data ? new Date(data) : undefined,
        veiculoId: veiculoId || undefined,
        tipo: tipo || undefined,
        descricao: descricao?.trim(),
        custo: custo !== undefined ? Number(custo) : undefined,
        oficina: oficina || null,
        proxima: proxima || null,
        status: status || undefined,
      },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })

    // Atualiza lançamento vinculado
    const lanc = await prisma.lancamento.findFirst({ where: { manutencaoId: params.id } })
    if (lanc) {
      await prisma.lancamento.update({
        where: { id: lanc.id },
        data: { valor: manutencao.custo, data: manutencao.data }
      })
    } else if (manutencao.custo > 0) {
      await prisma.lancamento.create({
        data: {
          data: manutencao.data,
          descricao: `Manutenção ${manutencao.tipo.toLowerCase()} — ${manutencao.veiculo.placa}`,
          categoria: 'MANUTENCAO',
          tipo: 'DESPESA',
          valor: manutencao.custo,
          manutencaoId: manutencao.id,
          veiculoId: manutencao.veiculoId,
        }
      })
    }

    return NextResponse.json(manutencao)
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Manutenção não encontrada' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao atualizar manutenção' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.lancamento.deleteMany({ where: { manutencaoId: params.id } })
    await prisma.manutencao.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Manutenção não encontrada' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao excluir manutenção' }, { status: 500 })
  }
}
