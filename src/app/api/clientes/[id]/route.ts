import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { nome, telefone, obs } = body

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        nome: nome?.trim(),
        telefone: telefone?.trim(),
        obs: obs || null,
      }
    })

    return NextResponse.json(cliente)
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.cliente.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao excluir cliente' }, { status: 500 })
  }
}
