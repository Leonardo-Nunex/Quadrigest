import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { nome: 'asc' } })
    return NextResponse.json(clientes)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, telefone, obs } = body

    if (!nome || !telefone) {
      return NextResponse.json({ error: 'Nome e telefone sao obrigatorios' }, { status: 400 })
    }

    const cliente = await prisma.cliente.create({
      data: {
        nome: nome.trim(),
        telefone: telefone.trim(),
        obs: obs || null,
      }
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
