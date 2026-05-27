// src/app/api/lancamentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const tipo = req.nextUrl.searchParams.get('tipo')
    const lancamentos = await prisma.lancamento.findMany({
      where: tipo ? { tipo: tipo as any } : {},
      orderBy: { data: 'desc' },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })
    return NextResponse.json(lancamentos)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar lançamentos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, descricao, categoria, valor, veiculoId } = body

    if (!data || !descricao || !valor) {
      return NextResponse.json({ error: 'Campos obrigatórios: data, descricao, valor' }, { status: 400 })
    }

    const lancamento = await prisma.lancamento.create({
      data: {
        data: new Date(data),
        descricao: descricao.trim(),
        categoria: categoria || 'OUTROS',
        tipo: 'DESPESA',
        valor: Number(valor),
        veiculoId: veiculoId || null,
      }
    })
    return NextResponse.json(lancamento, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao criar lançamento' }, { status: 500 })
  }
}
