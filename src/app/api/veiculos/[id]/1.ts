// src/app/api/veiculos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { placa, modelo, ano, cor, custo, chassi, status, obs } = body

    const veiculo = await prisma.veiculo.update({
      where: { id: params.id },
      data: {
        placa: placa?.toUpperCase().trim(),
        modelo: modelo?.trim(),
        ano: ano ? Number(ano) : null,
        cor: cor || null,
        custo: Number(custo) || 0,
        chassi: chassi || null,
        status: status || 'DISPONIVEL',
        obs: obs || null,
      }
    })
    return NextResponse.json(veiculo)
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 })
    if (e.code === 'P2002') return NextResponse.json({ error: 'Placa já cadastrada' }, { status: 409 })
    return NextResponse.json({ error: 'Erro ao atualizar veículo' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.veiculo.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 })
    return NextResponse.json({ error: 'Erro ao excluir veículo' }, { status: 500 })
  }
}
