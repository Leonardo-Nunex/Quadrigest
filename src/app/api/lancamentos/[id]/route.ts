// src/app/api/lancamentos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, descricao, categoria, valor, veiculoId } = body

    const lancamento = await prisma.lancamento.update({
      where: { id: params.id },
      data: {
        data: data ? new Date(data) : undefined,
        descricao: descricao?.trim(),
        categoria: categoria || undefined,
        valor: valor ? Number(valor) : undefined,
        veiculoId: veiculoId || null,
      }
    })
    return NextResponse.json(lancamento)
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao atualizar lançamento' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.lancamento.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao excluir lançamento' }, { status: 500 })
  }
}
