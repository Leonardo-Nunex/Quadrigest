// src/app/api/manutencoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const tipo = req.nextUrl.searchParams.get('tipo')
    const status = req.nextUrl.searchParams.get('status')

    const manutencoes = await prisma.manutencao.findMany({
      where: {
        ...(tipo ? { tipo: tipo as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { data: 'desc' },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })
    return NextResponse.json(manutencoes)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar manutenções' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, veiculoId, tipo, descricao, custo, oficina, proxima, status } = body

    if (!data || !veiculoId || !descricao) {
      return NextResponse.json({ error: 'Campos obrigatórios: data, veiculoId, descricao' }, { status: 400 })
    }

    const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } })
    if (!veiculo) return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 })

    const manutencao = await prisma.manutencao.create({
      data: {
        data: new Date(data),
        veiculoId,
        tipo: tipo || 'PREVENTIVA',
        descricao: descricao.trim(),
        custo: Number(custo) || 0,
        oficina: oficina || null,
        proxima: proxima || null,
        status: status || 'CONCLUIDA',
      },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })

    // Lançamento financeiro automático (despesa) se tiver custo
    if (manutencao.custo > 0) {
      await prisma.lancamento.create({
        data: {
          data: new Date(data),
          descricao: `Manutenção ${manutencao.tipo.toLowerCase()} — ${veiculo.placa} ${veiculo.modelo}`,
          categoria: 'MANUTENCAO',
          tipo: 'DESPESA',
          valor: manutencao.custo,
          manutencaoId: manutencao.id,
          veiculoId,
        }
      })
    }

    return NextResponse.json(manutencao, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao criar manutenção' }, { status: 500 })
  }
}
