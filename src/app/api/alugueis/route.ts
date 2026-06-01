import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const alugueis = await prisma.aluguel.findMany({
      orderBy: { data: 'desc' },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })
    return NextResponse.json(alugueis)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar aluguéis' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, veiculoId, cliente, contato, duracao, valor, pagamento, statusPagamento, dataPagamento, status, rota, obs } = body

    if (!data || !veiculoId || !cliente || !valor) {
      return NextResponse.json({ error: 'Campos obrigatórios: data, veiculoId, cliente, valor' }, { status: 400 })
    }

    const aluguel = await prisma.aluguel.create({
      data: {
        data: new Date(data),
        veiculoId,
        cliente: cliente.trim(),
        contato: contato || null,
        duracao: duracao ? Number(duracao) : null,
        valor: Number(valor),
        pagamento: pagamento || 'PIX',
        statusPagamento: statusPagamento || 'PAGO',
        dataPagamento: dataPagamento ? new Date(dataPagamento) : null,
        status: status || 'CONCLUIDO',
        rota: rota || null,
        obs: obs || null,
      },
      include: { veiculo: { select: { placa: true, modelo: true } } }
    })

    // Lançamento automático apenas se pagamento não estiver pendente
    if (aluguel.status !== 'CANCELADO' && aluguel.statusPagamento !== 'PENDENTE') {
      const v = aluguel.veiculo
      await prisma.lancamento.create({
        data: {
          data: new Date(data),
          descricao: `Aluguel — ${cliente} (${v.placa} ${v.modelo})`,
          categoria: 'ALUGUEL',
          tipo: 'RECEITA',
          valor: Number(valor),
          aluguelId: aluguel.id,
          veiculoId,
        }
      })
    }

    return NextResponse.json(aluguel, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao criar aluguel' }, { status: 500 })
  }
}
