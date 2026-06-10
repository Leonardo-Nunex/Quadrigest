// src/app/api/veiculos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const veiculos = await prisma.veiculo.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { alugueis: true, manutencoes: true } }
      }
    })
    return NextResponse.json(veiculos)
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar veículos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { placa, modelo, ano, cor, custo, valorAluguel, chassi, status, obs } = body

    if (!placa || !modelo) {
      return NextResponse.json({ error: 'Placa e modelo são obrigatórios' }, { status: 400 })
    }

    const veiculo = await prisma.veiculo.create({
      data: {
        placa: placa.toUpperCase().trim(),
        modelo: modelo.trim(),
        ano: ano ? Number(ano) : null,
        cor: cor || null,
        custo: Number(custo) || 0,
        valorAluguel: Number(valorAluguel) || 0,
        chassi: chassi || null,
        status: status || 'DISPONIVEL',
        obs: obs || null,
      }
    })
    return NextResponse.json(veiculo, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Placa já cadastrada' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar veículo' }, { status: 500 })
  }
}
