'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type Veiculo = { id: string; placa: string; modelo: string; ano?: number; cor?: string; custo: number; valorAluguel: number; chassi?: string; status: string; obs?: string }
type Aluguel = { id: string; data: string; veiculoId: string; veiculo?: { placa: string; modelo: string }; cliente: string; contato?: string; duracao?: number; valor: number; valorPago: number; pagamento: string; statusPagamento: string; dataPagamento?: string; status: string; rota?: string; obs?: string }
type Manutencao = { id: string; data: string; veiculoId: string; veiculo?: { placa: string; modelo: string }; tipo: string; descricao: string; custo: number; oficina?: string; proxima?: string; status: string }
type Lancamento = { id: string; data: string; descricao: string; categoria: string; tipo: string; valor: number; veiculoId?: string; aluguelId?: string; manutencaoId?: string }
type Cliente = { id: string; nome: string; telefone: string; obs?: string }
type Devedores = { cliente: string; total: number; qtd: number }
type Metricas = { totalVeiculos: number; veiculosDisponiveis: number; totalAlugueis: number; alugueisAndamento: number; totalReceitas: number; totalDespesas: number; lucro: number; custoAquisicao: number; roi: number; ticketMedio: number; totalManutencoes: number; manutencoesAgendadas: number; totalDevedor: number; devedores: Devedores[]; qtdInadimplentes: number }
type DashData = { veiculos: Veiculo[]; alugueis: Aluguel[]; manutencoes: Manutencao[]; lancamentos: Lancamento[]; clientes: Cliente[]; metricas: Metricas }
type FormRef = Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>

const BRL = (v: number) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const saldoReceber = (a: Pick<Aluguel, 'valor' | 'valorPago'>) => Math.max(Number(a.valor || 0) - Number(a.valorPago || 0), 0)
const dateOnly = (d?: string) => d ? d.slice(0, 10) : ''
const fmtDate = (d: string) => {
  const iso = dateOnly(d)
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
const isoDate = (d: string) => dateOnly(d)
const COLORS = ['#1a9e6e', '#3b82c4', '#e05252', '#f5a623', '#7c6fe0', '#d4538b', '#4cbf94']
const statusMap: Record<string, [string, string]> = {
  DISPONIVEL: ['badge-green', 'Disponível'], ALUGADO: ['badge-blue', 'Alugado'], MANUTENCAO: ['badge-amber', 'Manutenção'], INATIVO: ['badge-gray', 'Inativo'],
  CONCLUIDO: ['badge-green', 'Concluído'], ANDAMENTO: ['badge-blue', 'Andamento'], CANCELADO: ['badge-red', 'Cancelado'],
  CONCLUIDA: ['badge-green', 'Concluída'], AGENDADA: ['badge-amber', 'Agendada'],
  PREVENTIVA: ['badge-amber', 'Preventiva'], CORRETIVA: ['badge-red', 'Corretiva'],
  RECEITA: ['badge-green', 'Receita'], DESPESA: ['badge-red', 'Despesa'],
  PAGO: ['badge-green', 'Pago'], PENDENTE: ['badge-red', 'Pendente'], PARCIAL: ['badge-amber', 'Parcial'],
}
const Badge = ({ s }: { s: string }) => { const [cls, label] = statusMap[s] || ['badge-gray', s]; return <span className={`badge ${cls}`}>{label}</span> }
const catMap: Record<string, string> = { ALUGUEL: 'Aluguel', MANUTENCAO: 'Manutenção', COMBUSTIVEL: 'Combustível', SEGURO: 'Seguro', LICENCIAMENTO: 'Licenciamento', PONTO: 'Ponto', MARKETING: 'Marketing', PESSOAL: 'Pessoal', EQUIPAMENTO: 'Equipamento', OUTROS: 'Outros' }
const pagMap: Record<string, string> = { PIX: 'PIX', DINHEIRO: 'Dinheiro', CARTAO_DEBITO: 'Débito', CARTAO_CREDITO: 'Crédito' }
const last6Months = () => { const ms = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); ms.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }) }) } return ms }
const getMonthKey = (d: string) => d ? d.slice(0, 7) : ''

function Toast({ msg, err }: { msg: string; err?: boolean }) {
  return <div className={`toast${err ? ' error' : ''}`}><i className={`ti ti-${err ? 'alert-circle' : 'circle-check'}`}></i>{msg}</div>
}

// helper para setar ref sem retornar valor (corrige erro de tipo do TypeScript)
function setRef(refs: React.MutableRefObject<FormRef>, key: string) {
  return (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => { refs.current[key] = el }
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [manutFilter, setManutFilter] = useState('TODAS')
  const [finFilter, setFinFilter] = useState('TODAS')
  const [veiStatusFilter, setVeiStatusFilter] = useState('TODOS')
  const [veiSearch, setVeiSearch] = useState('')
  const [aluVeiculoFilter, setAluVeiculoFilter] = useState('TODOS')
  const [aluPgtoFilter, setAluPgtoFilter] = useState('TODOS')
  const [aluStatusFilter, setAluStatusFilter] = useState('TODOS')
  const [aluInicio, setAluInicio] = useState('')
  const [aluFim, setAluFim] = useState('')
  const [aluSearch, setAluSearch] = useState('')
  const [aluView, setAluView] = useState<'tabela' | 'calendario'>('tabela')
  const [aluCalendarMonth, setAluCalendarMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [aluSelectedDays, setAluSelectedDays] = useState<string[]>([])
  const [batchPgto, setBatchPgto] = useState('PAGO')
  const [batchStatus, setBatchStatus] = useState('CONCLUIDO')
  const [batchDataMode, setBatchDataMode] = useState('DATA_ALUGUEL')
  const [batchFixedDate, setBatchFixedDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [manutVeiculoFilter, setManutVeiculoFilter] = useState('TODOS')
  const [manutStatusFilter, setManutStatusFilter] = useState('TODOS')
  const [manutInicio, setManutInicio] = useState('')
  const [manutFim, setManutFim] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const chartsRef = useRef<Record<string, any>>({})
  const [modal, setModal] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const vf = useRef<FormRef>({})
  const af = useRef<FormRef>({})
  const mf = useRef<FormRef>({})
  const df = useRef<FormRef>({})
  const cf = useRef<FormRef>({})

  const showToast = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/dashboard?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { showToast('Erro ao carregar dados. Verifique a conexão com o banco.', true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (data && page === 'dashboard') setTimeout(renderCharts, 100) }, [data, page])

  function renderCharts() {
    if (!data || typeof window === 'undefined') return
    const w = window as any
    if (!w.Chart) { setTimeout(renderCharts, 300); return }
    const months = last6Months()
    const { lancamentos, alugueis, manutencoes, veiculos } = data
    const destroy = (k: string) => { if (chartsRef.current[k]) { chartsRef.current[k].destroy(); delete chartsRef.current[k] } }
    const opts = (yFmt: (v: number) => string) => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { callback: yFmt, font: { size: 10 } } } } })
    const recM = months.map(mo => lancamentos.filter(l => l.tipo === 'RECEITA' && getMonthKey(l.data) === mo.key).reduce((s, l) => s + l.valor, 0))
    const desM = months.map(mo => lancamentos.filter(l => l.tipo === 'DESPESA' && getMonthKey(l.data) === mo.key).reduce((s, l) => s + l.valor, 0))
    const labels = months.map(m => m.label)
    destroy('rc'); const rc = document.getElementById('chartRC') as HTMLCanvasElement
    if (rc) chartsRef.current.rc = new w.Chart(rc, { type: 'bar', data: { labels, datasets: [{ label: 'Receita', data: recM, backgroundColor: '#1a9e6e', borderRadius: 4 }, { label: 'Custos', data: desM, backgroundColor: '#e05252', borderRadius: 4 }] }, options: opts(v => 'R$' + v.toLocaleString('pt-BR')) })
    destroy('lc'); const lc = document.getElementById('chartLC') as HTMLCanvasElement
    if (lc) chartsRef.current.lc = new w.Chart(lc, { type: 'line', data: { labels, datasets: [{ data: months.map((_, i) => recM[i] - desM[i]), borderColor: '#3b82c4', backgroundColor: 'rgba(59,130,196,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#3b82c4', pointRadius: 4 }] }, options: opts(v => 'R$' + v.toLocaleString('pt-BR')) })
    destroy('vei'); const vc = document.getElementById('chartVei') as HTMLCanvasElement
    if (vc && veiculos.length) { const vData = veiculos.map(v => ({ l: v.placa, n: alugueis.filter(a => a.veiculoId === v.id && a.status === 'CONCLUIDO').length })); chartsRef.current.vei = new w.Chart(vc, { type: 'doughnut', data: { labels: vData.map(v => v.l), datasets: [{ data: vData.map(v => v.n), backgroundColor: COLORS }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '60%' } }) }
    destroy('mn'); const mn = document.getElementById('chartMn') as HTMLCanvasElement
    if (mn) chartsRef.current.mn = new w.Chart(mn, { type: 'bar', data: { labels, datasets: [{ label: 'Preventiva', data: months.map(mo => manutencoes.filter(m => m.tipo === 'PREVENTIVA' && getMonthKey(m.data) === mo.key).reduce((s, m) => s + m.custo, 0)), backgroundColor: '#f5a623', borderRadius: 4 }, { label: 'Corretiva', data: months.map(mo => manutencoes.filter(m => m.tipo === 'CORRETIVA' && getMonthKey(m.data) === mo.key).reduce((s, m) => s + m.custo, 0)), backgroundColor: '#e05252', borderRadius: 4 }] }, options: opts(v => 'R$' + v.toLocaleString('pt-BR')) })
  }

  async function apiCall(url: string, method: string, body?: object) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Erro')
    return json
  }

  const getVal = (refs: React.MutableRefObject<FormRef>, key: string) => refs.current[key]?.value || ''
  const setVal = (refs: React.MutableRefObject<FormRef>, key: string, val: string) => { if (refs.current[key]) refs.current[key]!.value = val }
  const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function handleStatusPagamentoChange() {
    if (getVal(af, 'statusPagamento') !== 'PAGO') return
    if (!getVal(af, 'dataPagamento')) setVal(af, 'dataPagamento', todayISO())
    if (!getVal(af, 'valorPago') && getVal(af, 'valor')) setVal(af, 'valorPago', getVal(af, 'valor'))
  }

  function handleClienteAluguelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cliente = data?.clientes.find(c => c.id === e.target.value)
    if (!cliente) return
    setVal(af, 'cliente', cliente.nome)
    setVal(af, 'contato', cliente.telefone)
  }

  function handleVeiculoAluguelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const veiculo = data?.veiculos.find(v => v.id === e.target.value)
    if (veiculo?.valorAluguel) setVal(af, 'valor', String(veiculo.valorAluguel))
  }

  function openModal(type: string, id?: string) {
    setModal(type); setEditId(id || null)
    setTimeout(() => {
      if (!id) { clearForm(type); return }
      const map: Record<string, any[]> = { veiculo: data?.veiculos || [], aluguel: data?.alugueis || [], manutencao: data?.manutencoes || [], despesa: data?.lancamentos || [], cliente: data?.clientes || [] }
      const rec = map[type]?.find((x: any) => x.id === id)
      if (rec) fillForm(type, rec)
    }, 10)
  }

  function clearForm(type: string) {
    const today = todayISO()
    if (type === 'veiculo') { ['placa','modelo','ano','cor','custo','valorAluguel','chassi','obs'].forEach(k => setVal(vf, k, '')); setVal(vf, 'status', 'DISPONIVEL') }
    if (type === 'aluguel') { ['cliente','contato','duracao','valor','valorPago','dataPagamento','rota','obs'].forEach(k => setVal(af, k, '')); setVal(af, 'data', today); setVal(af, 'clienteLista', ''); setVal(af, 'veiculo', ''); setVal(af, 'pagamento', 'PIX'); setVal(af, 'statusPagamento', 'PENDENTE'); setVal(af, 'status', 'CONCLUIDO') }
    if (type === 'manutencao') { ['desc','custo','oficina','proxima'].forEach(k => setVal(mf, k, '')); setVal(mf, 'data', today); setVal(mf, 'veiculo', ''); setVal(mf, 'tipo', 'PREVENTIVA'); setVal(mf, 'status', 'CONCLUIDA') }
    if (type === 'despesa') { ['desc','valor'].forEach(k => setVal(df, k, '')); setVal(df, 'data', today); setVal(df, 'categoria', 'COMBUSTIVEL'); setVal(df, 'veiculo', '') }
    if (type === 'cliente') { ['nome','telefone','obs'].forEach(k => setVal(cf, k, '')) }
  }

  function fillForm(type: string, rec: any) {
    if (type === 'veiculo') { ['placa','modelo','ano','cor','custo','valorAluguel','chassi','obs'].forEach(k => setVal(vf, k, String(rec[k] || ''))); setVal(vf, 'status', rec.status) }
    if (type === 'aluguel') { setVal(af, 'data', isoDate(rec.data)); setVal(af, 'dataPagamento', isoDate(rec.dataPagamento)); ['cliente','contato','duracao','valor','valorPago','rota','obs'].forEach(k => setVal(af, k, String(rec[k] || ''))); setVal(af, 'clienteLista', ''); setVal(af, 'veiculo', rec.veiculoId); setVal(af, 'pagamento', rec.pagamento); setVal(af, 'statusPagamento', rec.statusPagamento || 'PENDENTE'); setVal(af, 'status', rec.status) }
    if (type === 'manutencao') { setVal(mf, 'data', isoDate(rec.data)); ['desc','custo','oficina','proxima'].forEach(k => setVal(mf, k, String(rec[k] || ''))); setVal(mf, 'veiculo', rec.veiculoId); setVal(mf, 'tipo', rec.tipo); setVal(mf, 'status', rec.status) }
    if (type === 'despesa') { setVal(df, 'data', isoDate(rec.data)); ['desc','valor'].forEach(k => setVal(df, k, String(rec[k] || ''))); setVal(df, 'categoria', rec.categoria); setVal(df, 'veiculo', rec.veiculoId || '') }
    if (type === 'cliente') { ['nome','telefone','obs'].forEach(k => setVal(cf, k, String(rec[k] || ''))) }
  }

  async function saveVeiculo() {
    const body = { placa: getVal(vf,'placa'), modelo: getVal(vf,'modelo'), ano: getVal(vf,'ano'), cor: getVal(vf,'cor'), custo: getVal(vf,'custo'), valorAluguel: getVal(vf,'valorAluguel'), chassi: getVal(vf,'chassi'), status: getVal(vf,'status'), obs: getVal(vf,'obs') }
    if (!body.placa || !body.modelo) { showToast('Placa e modelo são obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/veiculos/${editId}`, 'PUT', body) : await apiCall('/api/veiculos', 'POST', body); setModal(null); await loadData(); showToast('Veículo salvo!') }
    catch (e: any) { showToast(e.message, true) }
    setSaving(false)
  }

  async function saveAluguel() {
    const body = { data: getVal(af,'data'), veiculoId: getVal(af,'veiculo'), cliente: getVal(af,'cliente'), contato: getVal(af,'contato'), duracao: getVal(af,'duracao'), valor: getVal(af,'valor'), valorPago: getVal(af,'valorPago'), pagamento: getVal(af,'pagamento'), statusPagamento: getVal(af,'statusPagamento'), dataPagamento: getVal(af,'dataPagamento'), status: getVal(af,'status'), rota: getVal(af,'rota'), obs: getVal(af,'obs') }
    if (!body.data || !body.veiculoId || !body.cliente || !body.valor) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/alugueis/${editId}`, 'PUT', body) : await apiCall('/api/alugueis', 'POST', body); setModal(null); await loadData(); showToast('Aluguel registrado!') }
    catch (e: any) { showToast(e.message, true) }
    setSaving(false)
  }

  async function saveCliente() {
    const body = { nome: getVal(cf,'nome'), telefone: getVal(cf,'telefone'), obs: getVal(cf,'obs') }
    if (!body.nome || !body.telefone) { showToast('Nome e telefone sao obrigatorios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/clientes/${editId}`, 'PUT', body) : await apiCall('/api/clientes', 'POST', body); setModal(null); await loadData(); showToast('Cliente salvo!') }
    catch (e: any) { showToast(e.message, true) }
    setSaving(false)
  }

  async function saveManutencao() {
    const body = { data: getVal(mf,'data'), veiculoId: getVal(mf,'veiculo'), tipo: getVal(mf,'tipo'), descricao: getVal(mf,'desc'), custo: getVal(mf,'custo'), oficina: getVal(mf,'oficina'), proxima: getVal(mf,'proxima'), status: getVal(mf,'status') }
    if (!body.data || !body.veiculoId || !body.descricao) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/manutencoes/${editId}`, 'PUT', body) : await apiCall('/api/manutencoes', 'POST', body); setModal(null); await loadData(); showToast('Manutenção registrada!') }
    catch (e: any) { showToast(e.message, true) }
    setSaving(false)
  }

  async function saveDespesa() {
    const body = { data: getVal(df,'data'), descricao: getVal(df,'desc'), categoria: getVal(df,'categoria'), valor: getVal(df,'valor'), veiculoId: getVal(df,'veiculo') || null }
    if (!body.data || !body.descricao || !body.valor) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/lancamentos/${editId}`, 'PUT', body) : await apiCall('/api/lancamentos', 'POST', body); setModal(null); await loadData(); showToast('Despesa registrada!') }
    catch (e: any) { showToast(e.message, true) }
    setSaving(false)
  }

  async function deleteItem(store: string, id: string) {
    if (!confirm('Remover este registro?')) return
    try { await apiCall(`/api/${store}/${id}`, 'DELETE'); await loadData(); showToast('Registro removido.') }
    catch (e: any) { showToast(e.message, true) }
  }

  const buildAluguelBody = (a: Aluguel, overrides: Partial<Aluguel>) => ({
    data: dateOnly(overrides.data || a.data),
    veiculoId: overrides.veiculoId || a.veiculoId,
    cliente: overrides.cliente || a.cliente,
    contato: overrides.contato ?? a.contato ?? '',
    duracao: overrides.duracao ?? a.duracao ?? '',
    valor: overrides.valor ?? a.valor,
    valorPago: overrides.valorPago ?? a.valorPago,
    pagamento: overrides.pagamento || a.pagamento,
    statusPagamento: overrides.statusPagamento || a.statusPagamento,
    dataPagamento: overrides.dataPagamento !== undefined ? dateOnly(overrides.dataPagamento) : dateOnly(a.dataPagamento),
    status: overrides.status || a.status,
    rota: overrides.rota ?? a.rota ?? '',
    obs: overrides.obs ?? a.obs ?? '',
  })

  async function applyAluguelBatch() {
    const selecionados = alugueisFilt.filter(a => aluSelectedDays.includes(dateOnly(a.data)) && getMonthKey(a.data) === aluCalendarMonth)
    if (!selecionados.length) { showToast('Selecione dias com aluguéis no calendário.', true); return }
    if (!confirm(`Atualizar ${selecionados.length} aluguel(is) selecionado(s)?`)) return

    setSaving(true)
    try {
      await Promise.all(selecionados.map(a => {
        const dataPagamento = batchPgto === 'PENDENTE' ? '' :
          batchDataMode === 'DATA_ALUGUEL' ? dateOnly(a.data) :
          batchDataMode === 'DATA_FIXA' ? batchFixedDate :
          dateOnly(a.dataPagamento)
        const valorPago = batchPgto === 'PAGO' ? a.valor : batchPgto === 'PENDENTE' ? 0 : a.valorPago
        const body = buildAluguelBody(a, {
          statusPagamento: batchPgto,
          status: batchStatus,
          valorPago,
          dataPagamento,
        })
        return apiCall(`/api/alugueis/${a.id}`, 'PUT', body)
      }))
      setAluSelectedDays([])
      await loadData()
      showToast('Aluguéis atualizados em lote!')
    } catch (e: any) {
      showToast(e.message || 'Erro na atualização em lote', true)
    }
    setSaving(false)
  }

  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', section: 'Visão Geral' },
    { id: 'clientes', label: 'Clientes', icon: 'users', section: 'Cadastros', count: data?.clientes.length },

    { id: 'veiculos', label: 'Veículos', icon: 'car', section: 'Operações', count: data?.veiculos.length },
    { id: 'alugueis', label: 'Aluguéis', icon: 'route', count: data?.alugueis.length },
    { id: 'manutencoes', label: 'Manutenções', icon: 'tool', count: data?.manutencoes.length },
    { id: 'financeiro', label: 'Financeiro', icon: 'cash', section: 'Financeiro' },
    { id: 'roi', label: 'ROI & Análise', icon: 'chart-line' },
    { id: 'playbook', label: 'Playbook', icon: 'book', section: 'Ajuda' },
  ]

  const veiculos = data?.veiculos || []
  const alugueis = data?.alugueis || []
  const manutencoes = data?.manutencoes || []
  const lancamentos = data?.lancamentos || []
  const clientes = data?.clientes || []
  const m = data?.metricas
  const inDateRange = (d: string, start: string, end: string) => {
    const dt = dateOnly(d)
    return (!start || dt >= start) && (!end || dt <= end)
  }
  const veiculosFilt = veiculos.filter(v => {
    const q = veiSearch.trim().toLowerCase()
    return (veiStatusFilter === 'TODOS' || v.status === veiStatusFilter) &&
      (!q || [v.placa, v.modelo, v.cor || '', v.chassi || ''].some(x => x.toLowerCase().includes(q)))
  })
  const clientesFilt = clientes.filter(c => {
    const q = clienteSearch.trim().toLowerCase()
    return !q || [c.nome, c.telefone, c.obs || ''].some(x => x.toLowerCase().includes(q))
  })
  const alugueisFilt = alugueis.filter(a => {
    const q = aluSearch.trim().toLowerCase()
    return (aluVeiculoFilter === 'TODOS' || a.veiculoId === aluVeiculoFilter) &&
      (aluPgtoFilter === 'TODOS' || a.statusPagamento === aluPgtoFilter) &&
      (aluStatusFilter === 'TODOS' || a.status === aluStatusFilter) &&
      inDateRange(a.data, aluInicio, aluFim) &&
      (!q || [a.cliente, a.contato || '', a.rota || '', a.veiculo?.placa || '', a.veiculo?.modelo || ''].some(x => x.toLowerCase().includes(q)))
  })
  const calendarMonthDate = new Date(`${aluCalendarMonth}-01T12:00:00`)
  const calendarMonthLabel = calendarMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const calendarYear = calendarMonthDate.getFullYear()
  const calendarMonth = calendarMonthDate.getMonth()
  const calendarStartPad = new Date(calendarYear, calendarMonth, 1).getDay()
  const calendarDaysCount = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const calendarCells = [
    ...Array.from({ length: calendarStartPad }, () => null),
    ...Array.from({ length: calendarDaysCount }, (_, i) => `${aluCalendarMonth}-${String(i + 1).padStart(2, '0')}`)
  ]
  const calendarAlugueis = alugueisFilt.filter(a => getMonthKey(a.data) === aluCalendarMonth)
  const selectedCalendarAlugueis = calendarAlugueis.filter(a => aluSelectedDays.includes(dateOnly(a.data)))
  const moveAluguelMonth = (delta: number) => {
    const d = new Date(`${aluCalendarMonth}-01T12:00:00`)
    d.setMonth(d.getMonth() + delta)
    setAluCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setAluSelectedDays([])
  }
  const toggleAluguelDay = (day: string) => {
    setAluSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }
  const manutFilt = manutencoes.filter(x =>
    (manutFilter === 'TODAS' ? true : manutFilter === 'AGENDADA' ? x.status === 'AGENDADA' : x.tipo === manutFilter) &&
    (manutVeiculoFilter === 'TODOS' || x.veiculoId === manutVeiculoFilter) &&
    (manutStatusFilter === 'TODOS' || x.status === manutStatusFilter) &&
    inDateRange(x.data, manutInicio, manutFim)
  )
  const lancFilt = lancamentos.filter(x => finFilter === 'TODAS' ? true : x.tipo === finFilter)
  const clearVeiculoFilters = () => { setVeiStatusFilter('TODOS'); setVeiSearch('') }
  const clearAluguelFilters = () => { setAluVeiculoFilter('TODOS'); setAluPgtoFilter('TODOS'); setAluStatusFilter('TODOS'); setAluInicio(''); setAluFim(''); setAluSearch(''); setAluSelectedDays([]) }
  const clearManutFilters = () => { setManutFilter('TODAS'); setManutVeiculoFilter('TODOS'); setManutStatusFilter('TODOS'); setManutInicio(''); setManutFim('') }
  const roiPorVeiculo = veiculos.map(v => {
    const receitas = lancamentos.filter(l => l.veiculoId === v.id && l.tipo === 'RECEITA').reduce((s, l) => s + l.valor, 0)
    const despesas = lancamentos.filter(l => l.veiculoId === v.id && l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0)
    const lucro = receitas - despesas
    const roi = v.custo > 0 ? (lucro / v.custo) * 100 : 0
    return { veiculo: v, receitas, despesas, lucro, roi }
  })

  return (
    <>
      <div className="app">
        <aside className="sidebar" id="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon"><i className="ti ti-steering-wheel"></i></div>
            <div><div className="sidebar-logo-text">QuadriGest</div><div className="sidebar-logo-sub">Gestão de Aluguel</div></div>
          </div>
          <nav className="sidebar-nav">
            {pages.map((p) => (
              <div key={p.id}>
                {p.section && <div className="nav-section-label">{p.section}</div>}
                <a className={`nav-item${page === p.id ? ' active' : ''}`} onClick={e => { e.preventDefault(); setPage(p.id); document.getElementById('sidebar')?.classList.remove('open') }} href="#">
                  <i className={`ti ti-${p.icon}`}></i> {p.label}
                  {p.count !== undefined && <span className="badge-count">{p.count}</span>}
                </a>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom"><div className="sidebar-version">QuadriGest v2.0 · Prisma + PostgreSQL</div></div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="mobile-toggle" onClick={() => document.getElementById('sidebar')?.classList.toggle('open')}><i className="ti ti-menu-2"></i></button>
              <div className="topbar-title">
                <i className={`ti ti-${pages.find(p => p.id === page)?.icon || 'layout-dashboard'}`}></i>
                {pages.find(p => p.id === page)?.label}
              </div>
            </div>
            <div className="topbar-actions">
              <span className="topbar-date">{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <button className="btn btn-secondary btn-sm" onClick={loadData}><i className="ti ti-refresh"></i> Atualizar</button>
            </div>
          </header>

          <main className="page-content">
            {loading ? (
              <div className="loading"><div className="spinner"></div> Carregando dados...</div>
            ) : (
              <>
                {page === 'dashboard' && m && (
                  <div>
                    <div className="dash-welcome">
                      <div><h2>Bem-vindo ao QuadriGest</h2><p>{veiculos.length} veículo(s) · {m.alugueisAndamento} em andamento</p></div>
                      <i className="ti ti-steering-wheel dash-welcome-icon"></i>
                    </div>
                    <div className="metrics-row">
                      <div className="metric-card metric-accent"><div className="metric-label">Veículos</div><div className="metric-value">{m.totalVeiculos}</div><div className="metric-sub">{m.veiculosDisponiveis} disponíveis</div></div>
                      <div className="metric-card metric-accent"><div className="metric-label">Aluguéis</div><div className="metric-value">{m.totalAlugueis}</div></div>
                      <div className="metric-card metric-accent"><div className="metric-label">Receita total</div><div className="metric-value metric-up">{BRL(m.totalReceitas)}</div></div>
                      <div className="metric-card metric-accent-blue"><div className="metric-label">Lucro líquido</div><div className={`metric-value ${m.lucro >= 0 ? 'metric-up' : 'metric-down'}`}>{BRL(m.lucro)}</div></div>
                      <div className="metric-card metric-accent-amber"><div className="metric-label">ROI</div><div className="metric-value" style={{ color: m.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>{m.roi.toFixed(1)}%</div></div>
                      <div className="metric-card metric-accent-red"><div className="metric-label">Manutenções</div><div className="metric-value">{m.totalManutencoes}</div><div className="metric-sub">{m.manutencoesAgendadas} agendadas</div></div>
                      <div className="metric-card" style={{borderLeft:'3px solid #e05252',background:m.totalDevedor>0?'#fdeaea':undefined}}><div className="metric-label">💰 A receber</div><div className="metric-value" style={{color:m.totalDevedor>0?'var(--red)':'var(--green)'}}>{BRL(m.totalDevedor)}</div><div className="metric-sub">{m.qtdInadimplentes} aluguel(is) pendente(s)</div></div>
                    </div>
                    <div className="charts-grid">
                      <div className="chart-card"><div className="chart-card-title"><i className="ti ti-chart-bar"></i> Receita vs Custos</div><div style={{ position: 'relative', height: 220 }}><canvas id="chartRC"></canvas></div></div>
                      <div className="chart-card"><div className="chart-card-title"><i className="ti ti-trending-up"></i> Lucro mensal</div><div style={{ position: 'relative', height: 220 }}><canvas id="chartLC"></canvas></div></div>
                      <div className="chart-card"><div className="chart-card-title"><i className="ti ti-car"></i> Aluguéis por veículo</div><div style={{ position: 'relative', height: 220 }}><canvas id="chartVei"></canvas></div></div>
                      <div className="chart-card"><div className="chart-card-title"><i className="ti ti-tool"></i> Custo de manutenção</div><div style={{ position: 'relative', height: 220 }}><canvas id="chartMn"></canvas></div></div>
                    </div>
                  </div>
                )}


                {page === 'clientes' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Clientes</div><div className="section-subtitle">Cadastro de clientes para agilizar alugueis</div></div><button className="btn btn-primary" onClick={() => openModal('cliente')}><i className="ti ti-plus"></i> Novo cliente</button></div>
                    <div className="filter-bar"><div className="filter-group filter-grow"><label>Buscar</label><input value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} placeholder="Nome, telefone ou observacao" /></div></div>
                    <div className="filter-summary">Mostrando {clientesFilt.length} de {clientes.length} cliente(s)</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Nome</th><th>Telefone</th><th>Observacoes</th><th>Acoes</th></tr></thead>
                      <tbody>{clientesFilt.length === 0 ? <tr><td colSpan={4}><div className="empty-state"><i className="ti ti-users-off"></i><p>Nenhum cliente encontrado</p></div></td></tr> : clientesFilt.map(c => (
                        <tr key={c.id}><td className="fw-semibold">{c.nome}</td><td className="nowrap">{c.telefone}</td><td>{c.obs || '-'}</td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('cliente', c.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('clientes', c.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'veiculos' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Veiculos</div><div className="section-subtitle">Cadastro e controle da frota</div></div><button className="btn btn-primary" onClick={() => openModal('veiculo')}><i className="ti ti-plus"></i> Novo veiculo</button></div>
                    <div className="filter-bar">
                      <div className="filter-group"><label>Status</label><select value={veiStatusFilter} onChange={e => setVeiStatusFilter(e.target.value)}><option value="TODOS">Todos</option><option value="DISPONIVEL">Disponivel</option><option value="ALUGADO">Alugado</option><option value="MANUTENCAO">Manutencao</option><option value="INATIVO">Inativo</option></select></div>
                      <div className="filter-group filter-grow"><label>Buscar</label><input value={veiSearch} onChange={e => setVeiSearch(e.target.value)} placeholder="Placa, modelo, cor ou chassi" /></div>
                      <button className="btn btn-secondary btn-sm filter-clear" onClick={clearVeiculoFilters}><i className="ti ti-filter-x"></i> Limpar</button>
                    </div>
                    <div className="filter-summary">Mostrando {veiculosFilt.length} de {veiculos.length} veiculo(s)</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Placa</th><th>Modelo</th><th>Ano</th><th>Cor</th><th>Custo aquisicao</th><th>Valor aluguel</th><th>Status</th><th>Acoes</th></tr></thead>
                      <tbody>{veiculosFilt.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-car-off"></i><p>Nenhum veiculo encontrado</p></div></td></tr> : veiculosFilt.map(v => (
                        <tr key={v.id}><td className="fw-semibold nowrap">{v.placa}</td><td>{v.modelo}</td><td>{v.ano || '-'}</td><td>{v.cor || '-'}</td><td className="nowrap">{BRL(v.custo)}</td><td className="nowrap">{BRL(v.valorAluguel)}</td><td><Badge s={v.status} /></td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('veiculo', v.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('veiculos', v.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'alugueis' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Alugueis</div><div className="section-subtitle">Registro de locacoes</div></div><button className="btn btn-primary" onClick={() => openModal('aluguel')}><i className="ti ti-plus"></i> Novo aluguel</button></div>
                    {m && <div className="metrics-row" style={{ marginBottom: 16 }}>
                      <div className="metric-card metric-accent"><div className="metric-label">Total filtrado</div><div className="metric-value">{alugueisFilt.length}</div><div className="metric-sub">de {alugueis.length} aluguel(is)</div></div>
                      <div className="metric-card metric-accent"><div className="metric-label">Receita total</div><div className="metric-value metric-up">{BRL(m.totalReceitas)}</div></div>
                      <div className="metric-card metric-accent-amber"><div className="metric-label">Ticket medio</div><div className="metric-value">{BRL(m.ticketMedio)}</div></div>
                      <div className="metric-card metric-accent-blue"><div className="metric-label">Em andamento</div><div className="metric-value">{m.alugueisAndamento}</div></div>
                    </div>}
                    <div className="view-switch">
                      <button className={'tab-btn' + (aluView === 'tabela' ? ' active' : '')} onClick={() => setAluView('tabela')}><i className="ti ti-table"></i> Tabela</button>
                      <button className={'tab-btn' + (aluView === 'calendario' ? ' active' : '')} onClick={() => setAluView('calendario')}><i className="ti ti-calendar-month"></i> Calendario mensal</button>
                    </div>
                    <div className="filter-bar filter-bar-wide">
                      <div className="filter-group"><label>Veiculo</label><select value={aluVeiculoFilter} onChange={e => setAluVeiculoFilter(e.target.value)}><option value="TODOS">Todos</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}</select></div>
                      <div className="filter-group"><label>Status pgto</label><select value={aluPgtoFilter} onChange={e => setAluPgtoFilter(e.target.value)}><option value="TODOS">Todos</option><option value="PENDENTE">Pendente</option><option value="PAGO">Pago</option><option value="PARCIAL">Parcial</option></select></div>
                      <div className="filter-group"><label>Status</label><select value={aluStatusFilter} onChange={e => setAluStatusFilter(e.target.value)}><option value="TODOS">Todos</option><option value="CONCLUIDO">Concluido</option><option value="ANDAMENTO">Andamento</option><option value="CANCELADO">Cancelado</option></select></div>
                      <div className="filter-group"><label>De</label><input type="date" value={aluInicio} onChange={e => setAluInicio(e.target.value)} /></div>
                      <div className="filter-group"><label>Ate</label><input type="date" value={aluFim} onChange={e => setAluFim(e.target.value)} /></div>
                      <div className="filter-group filter-grow"><label>Buscar</label><input value={aluSearch} onChange={e => setAluSearch(e.target.value)} placeholder="Cliente, contato, rota ou veiculo" /></div>
                      <button className="btn btn-secondary btn-sm filter-clear" onClick={clearAluguelFilters}><i className="ti ti-filter-x"></i> Limpar</button>
                    </div>
                    {aluView === 'calendario' && (
                      <div className="calendar-stack">
                        <div className="calendar-toolbar">
                          <div className="calendar-nav">
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moveAluguelMonth(-1)}><i className="ti ti-chevron-left"></i></button>
                            <div>
                              <div className="calendar-title">{calendarMonthLabel}</div>
                              <div className="calendar-subtitle">{calendarAlugueis.length} aluguel(is) no mes filtrado</div>
                            </div>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moveAluguelMonth(1)}><i className="ti ti-chevron-right"></i></button>
                          </div>
                          <input className="calendar-month-input" type="month" value={aluCalendarMonth} onChange={e => { setAluCalendarMonth(e.target.value); setAluSelectedDays([]) }} />
                        </div>
                        <div className="batch-panel">
                          <div className="batch-summary"><strong>{aluSelectedDays.length}</strong> dia(s) selecionado(s) · <strong>{selectedCalendarAlugueis.length}</strong> aluguel(is)</div>
                          <div className="batch-fields">
                            <div className="form-group"><label>Status pgto</label><select value={batchPgto} onChange={e => setBatchPgto(e.target.value)}><option value="PAGO">Pago</option><option value="PENDENTE">Pendente</option><option value="PARCIAL">Parcial</option></select></div>
                            <div className="form-group"><label>Status aluguel</label><select value={batchStatus} onChange={e => setBatchStatus(e.target.value)}><option value="CONCLUIDO">Concluido</option><option value="ANDAMENTO">Andamento</option><option value="CANCELADO">Cancelado</option></select></div>
                            <div className="form-group"><label>Data pagamento</label><select value={batchDataMode} onChange={e => setBatchDataMode(e.target.value)}><option value="DATA_ALUGUEL">Data do aluguel</option><option value="DATA_FIXA">Data fixa</option><option value="MANTER">Manter atual</option></select></div>
                            {batchDataMode === 'DATA_FIXA' && <div className="form-group"><label>Data fixa</label><input type="date" value={batchFixedDate} onChange={e => setBatchFixedDate(e.target.value)} /></div>}
                            <button className="btn btn-primary batch-apply" onClick={applyAluguelBatch} disabled={saving || selectedCalendarAlugueis.length === 0}><i className="ti ti-checks"></i> Aplicar lote</button>
                          </div>
                        </div>
                        <div className="calendar-card">
                          <div className="calendar-weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => <div key={d}>{d}</div>)}</div>
                          <div className="calendar-grid">
                            {calendarCells.map((day, idx) => {
                              const items = day ? calendarAlugueis.filter(a => dateOnly(a.data) === day) : []
                              const totalDia = items.reduce((s, a) => s + a.valor, 0)
                              const selected = !!day && aluSelectedDays.includes(day)
                              return (
                                <button key={day || `empty-${idx}`} className={'calendar-day' + (!day ? ' empty' : '') + (selected ? ' selected' : '') + (items.length ? ' has-items' : '')} disabled={!day} onClick={() => day && toggleAluguelDay(day)}>
                                  {day && <><span className="calendar-day-number">{Number(day.slice(8, 10))}</span>{items.length > 0 && <span className="calendar-day-count">{items.length} aluguel(is)</span>}{items.slice(0, 2).map(a => <span key={a.id} className="calendar-event"><span className="calendar-event-main"><strong>{a.veiculo?.placa || '-'}</strong> {a.cliente}</span><span className="calendar-event-status"><Badge s={a.statusPagamento || 'PENDENTE'} /><Badge s={a.status} /></span></span>)}{items.length > 2 && <span className="calendar-more">+{items.length - 2}</span>}{items.length > 0 && <span className="calendar-total">{BRL(totalDia)}</span>}</>}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    {aluView === 'tabela' && <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Veiculo</th><th>Cliente</th><th>Duracao</th><th>Valor</th><th>Pago</th><th>A receber</th><th>Forma Pgto</th><th>Status Pgto</th><th>Status</th><th>Acoes</th></tr></thead>
                      <tbody>{alugueisFilt.length === 0 ? <tr><td colSpan={11}><div className="empty-state"><i className="ti ti-route-off"></i><p>Nenhum aluguel encontrado</p></div></td></tr> : alugueisFilt.map(a => (
                        <tr key={a.id}><td className="nowrap">{fmtDate(a.data)}</td><td className="nowrap">{a.veiculo ? a.veiculo.placa + ' - ' + a.veiculo.modelo : '-'}</td><td>{a.cliente}</td><td className="nowrap">{a.duracao ? a.duracao + 'h' : '-'}</td><td className="nowrap fw-semibold">{BRL(a.valor)}</td><td className="nowrap text-green">{BRL(a.valorPago)}</td><td className={'nowrap fw-semibold ' + (saldoReceber(a) > 0 ? 'text-red' : 'text-green')}>{BRL(saldoReceber(a))}</td><td>{pagMap[a.pagamento] || a.pagamento}</td><td><Badge s={a.statusPagamento || "PENDENTE"} /></td><td><Badge s={a.status} /></td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('aluguel', a.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('alugueis', a.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>}
                  </div>
                )}

                {page === 'manutencoes' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Manutencoes</div><div className="section-subtitle">Controle preventivo e corretivo</div></div><button className="btn btn-primary" onClick={() => openModal('manutencao')}><i className="ti ti-plus"></i> Nova manutencao</button></div>
                    <div className="tab-bar">{['TODAS','PREVENTIVA','CORRETIVA','AGENDADA'].map(f => <button key={f} className={'tab-btn' + (manutFilter === f ? ' active' : '')} onClick={() => setManutFilter(f)}>{f === 'TODAS' ? 'Todas' : f === 'PREVENTIVA' ? 'Preventivas' : f === 'CORRETIVA' ? 'Corretivas' : 'Agendadas'}</button>)}</div>
                    <div className="filter-bar filter-bar-wide">
                      <div className="filter-group"><label>Veiculo</label><select value={manutVeiculoFilter} onChange={e => setManutVeiculoFilter(e.target.value)}><option value="TODOS">Todos</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}</select></div>
                      <div className="filter-group"><label>Status</label><select value={manutStatusFilter} onChange={e => setManutStatusFilter(e.target.value)}><option value="TODOS">Todos</option><option value="CONCLUIDA">Concluida</option><option value="AGENDADA">Agendada</option><option value="ANDAMENTO">Andamento</option></select></div>
                      <div className="filter-group"><label>De</label><input type="date" value={manutInicio} onChange={e => setManutInicio(e.target.value)} /></div>
                      <div className="filter-group"><label>Ate</label><input type="date" value={manutFim} onChange={e => setManutFim(e.target.value)} /></div>
                      <button className="btn btn-secondary btn-sm filter-clear" onClick={clearManutFilters}><i className="ti ti-filter-x"></i> Limpar</button>
                    </div>
                    <div className="filter-summary">Mostrando {manutFilt.length} de {manutencoes.length} manutencao(oes)</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Veiculo</th><th>Tipo</th><th>Descricao</th><th>Oficina</th><th>Custo</th><th>Status</th><th>Acoes</th></tr></thead>
                      <tbody>{manutFilt.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-tool-off"></i><p>Nenhuma manutencao encontrada</p></div></td></tr> : manutFilt.map(mn => (
                        <tr key={mn.id}><td className="nowrap">{fmtDate(mn.data)}</td><td className="nowrap">{mn.veiculo ? mn.veiculo.placa + ' - ' + mn.veiculo.modelo : '-'}</td><td><Badge s={mn.tipo} /></td><td>{mn.descricao}</td><td>{mn.oficina || '-'}</td><td className="nowrap">{BRL(mn.custo)}</td><td><Badge s={mn.status} /></td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('manutencao', mn.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('manutencoes', mn.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'financeiro' && m && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Financeiro</div><div className="section-subtitle">Receitas, despesas e fluxo de caixa</div></div><button className="btn btn-primary" onClick={() => openModal('despesa')}><i className="ti ti-plus"></i> Nova despesa</button></div>
                    <div className="metrics-row">
                      <div className="metric-card metric-accent"><div className="metric-label">Receitas</div><div className="metric-value metric-up">{BRL(m.totalReceitas)}</div></div>
                      <div className="metric-card metric-accent-red"><div className="metric-label">Despesas</div><div className="metric-value metric-down">{BRL(m.totalDespesas)}</div></div>
                      <div className="metric-card metric-accent-blue"><div className="metric-label">Lucro líquido</div><div className={`metric-value ${m.lucro >= 0 ? 'metric-up' : 'metric-down'}`}>{BRL(m.lucro)}</div></div>
                    </div>
                    <div className="tab-bar">{['TODAS','RECEITA','DESPESA'].map(f => <button key={f} className={`tab-btn${finFilter === f ? ' active' : ''}`} onClick={() => setFinFilter(f)}>{f === 'TODAS' ? 'Todas' : f === 'RECEITA' ? 'Receitas' : 'Despesas'}</button>)}</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Ações</th></tr></thead>
                      <tbody>{lancFilt.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-coin-off"></i><p>Nenhuma movimentação</p></div></td></tr> : lancFilt.map(l => (
                        <tr key={l.id}><td className="nowrap">{fmtDate(l.data)}</td><td>{l.descricao}</td><td>{catMap[l.categoria] || l.categoria}</td><td><Badge s={l.tipo} /></td><td className={`nowrap fw-semibold ${l.tipo === 'RECEITA' ? 'text-green' : 'text-red'}`}>{l.tipo === 'RECEITA' ? '+' : '-'} {BRL(l.valor)}</td>
                        <td><div className="td-actions">{!l.aluguelId && !l.manutencaoId && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('despesa', l.id)}><i className="ti ti-edit"></i></button>}<button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('lancamentos', l.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'roi' && m && (
                  <div>
                    <div className="section-header"><div><div className="section-title">ROI &amp; Análise</div><div className="section-subtitle">Retorno sobre investimento</div></div></div>
                    <div className="roi-card">
                      <div><div className="roi-label">ROI acumulado</div><div className="roi-value">{m.roi.toFixed(1)}%</div><div className="roi-detail">Sobre {BRL(m.custoAquisicao)} investidos</div></div>
                      <div className="roi-breakdown">
                        <div className="roi-row"><span>Receita total</span><strong style={{ color: '#4cbf94' }}>{BRL(m.totalReceitas)}</strong></div>
                        <div className="roi-row"><span>Despesas totais</span><strong style={{ color: '#e05252' }}>{BRL(m.totalDespesas)}</strong></div>
                        <div className="roi-row"><span>Lucro líquido</span><strong style={{ color: m.lucro >= 0 ? '#4cbf94' : '#e05252' }}>{BRL(m.lucro)}</strong></div>
                      </div>
                    </div>
                    <div className="metrics-row">
                      <div className="metric-card metric-accent"><div className="metric-label">Ticket médio</div><div className="metric-value">{BRL(m.ticketMedio)}</div></div>
                      <div className="metric-card metric-accent-red"><div className="metric-label">Custo manutenções</div><div className="metric-value metric-down">{BRL(manutencoes.reduce((s, mn) => s + mn.custo, 0))}</div></div>
                      <div className="metric-card metric-accent-amber"><div className="metric-label">Receita/veículo</div><div className="metric-value">{veiculos.length > 0 ? BRL(m.totalReceitas / veiculos.length) : '—'}</div></div>
                    </div>
                    <div className="section-header"><div><div className="section-title">ROI por veiculo</div><div className="section-subtitle">Receita, despesa, lucro e retorno individual</div></div></div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Veiculo</th><th>Custo aquisicao</th><th>Receitas</th><th>Despesas</th><th>Lucro</th><th>ROI</th></tr></thead>
                      <tbody>{roiPorVeiculo.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-chart-line"></i><p>Nenhum veiculo cadastrado</p></div></td></tr> : roiPorVeiculo.map(r => (
                        <tr key={r.veiculo.id}><td className="fw-semibold nowrap">{r.veiculo.placa} - {r.veiculo.modelo}</td><td className="nowrap">{BRL(r.veiculo.custo)}</td><td className="nowrap text-green">{BRL(r.receitas)}</td><td className="nowrap text-red">{BRL(r.despesas)}</td><td className={'nowrap fw-semibold ' + (r.lucro >= 0 ? 'text-green' : 'text-red')}>{BRL(r.lucro)}</td><td className={'nowrap fw-semibold ' + (r.roi >= 0 ? 'text-green' : 'text-red')}>{r.roi.toFixed(1)}%</td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'playbook' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Playbook</div><div className="section-subtitle">Manual de passos para os usuários</div></div></div>
                    <div className="playbook-hero">
                      <div>
                        <div className="playbook-kicker">Operação diária</div>
                        <h2>Manual rápido do QuadriGest</h2>
                        <p>Use este roteiro para manter locações, frota, manutenção e financeiro sempre atualizados.</p>
                      </div>
                      <i className="ti ti-book"></i>
                    </div>
                    <div className="playbook-grid">
                      <div className="playbook-step">
                        <div className="playbook-step-num">1</div>
                        <div><h3>Veiculos</h3><p>Cadastro base da frota. Sem veiculo cadastrado, nao e possivel registrar aluguel nem manutencao.</p>
                          <ul><li><strong>Obrigatorios:</strong> placa e modelo.</li><li><strong>Status:</strong> disponivel, alugado, manutencao ou inativo organiza a operacao, mas nao cria lancamento financeiro sozinho.</li><li><strong>Custo de aquisicao:</strong> entra no calculo de ROI.</li><li><strong>Ao excluir:</strong> tambem remove alugueis, manutencoes e lancamentos vinculados ao veiculo.</li></ul>
                        </div>
                      </div>
                      <div className="playbook-step">
                        <div className="playbook-step-num">2</div>
                        <div><h3>Alugueis</h3><p>Registro que alimenta quantidade de locacoes, receita, saldo a receber e historico por veiculo.</p>
                          <ul><li><strong>Obrigatorios:</strong> data, veiculo, cliente e valor total.</li><li><strong>Pago:</strong> para gerar receita corretamente, use status de pagamento Pago, valor pago igual ao valor total e data de pagamento preenchida.</li><li><strong>Parcial:</strong> informe apenas o valor recebido. O saldo a receber sera valor total menos valor pago.</li><li><strong>Pendente:</strong> deixe valor pago zerado. O valor total entra como a receber.</li><li><strong>Cancelado:</strong> remove ou impede receita automatica desse aluguel.</li></ul>
                        </div>
                      </div>
                      <div className="playbook-step">
                        <div className="playbook-step-num">3</div>
                        <div><h3>Receita automatica</h3><p>O financeiro recebe lancamento de receita a partir do aluguel quando existe valor pago e o aluguel nao esta cancelado.</p>
                          <ul><li><strong>Valor da receita:</strong> usa o campo Valor pago, nao o valor total.</li><li><strong>Data da receita:</strong> na edicao usa a data de pagamento; se ela estiver vazia, usa a data do aluguel.</li><li><strong>Ao mudar pagamento:</strong> se o valor pago virar zero, a receita vinculada e removida.</li><li><strong>Ao editar:</strong> valor, data e descricao do lancamento vinculado sao atualizados.</li></ul>
                        </div>
                      </div>
                      <div className="playbook-step">
                        <div className="playbook-step-num">4</div>
                        <div><h3>Manutencoes</h3><p>Controle preventivo e corretivo da frota, com despesa automatica quando houver custo.</p>
                          <ul><li><strong>Obrigatorios:</strong> data, veiculo e descricao.</li><li><strong>Tipo:</strong> preventiva ou corretiva ajuda a analisar custos.</li><li><strong>Custo maior que zero:</strong> cria despesa automatica em Financeiro na categoria Manutencao.</li><li><strong>Ao editar custo/data:</strong> a despesa vinculada e atualizada.</li><li><strong>Ao excluir:</strong> tambem remove a despesa vinculada.</li></ul>
                        </div>
                      </div>
                      <div className="playbook-step">
                        <div className="playbook-step-num">5</div>
                        <div><h3>Financeiro</h3><p>Area para acompanhar receitas automaticas e cadastrar despesas manuais da operacao.</p>
                          <ul><li><strong>Nova despesa:</strong> exige data, descricao e valor.</li><li><strong>Categoria:</strong> combustivel, seguro, licenciamento, ponto, marketing, pessoal, equipamento ou outros.</li><li><strong>Receitas de aluguel:</strong> sao geradas pelo cadastro de Alugueis e nao devem ser duplicadas manualmente.</li><li><strong>Despesas de manutencao:</strong> sao geradas pela tela Manutencoes quando houver custo.</li></ul>
                        </div>
                      </div>
                      <div className="playbook-step">
                        <div className="playbook-step-num">6</div>
                        <div><h3>Dashboard e ROI</h3><p>Os indicadores dependem da qualidade dos cadastros e dos lancamentos financeiros vinculados.</p>
                          <ul><li><strong>A receber:</strong> soma apenas alugueis nao cancelados com pagamento Pendente ou Parcial.</li><li><strong>Receita total:</strong> soma lancamentos financeiros do tipo Receita.</li><li><strong>Despesas:</strong> somam manutencoes com custo e despesas manuais cadastradas no Financeiro.</li><li><strong>ROI:</strong> compara lucro liquido com o custo de aquisicao dos veiculos.</li></ul>
                        </div>
                      </div>
                    </div>
                    <div className="playbook-checklist">
                      <div className="chart-card-title"><i className="ti ti-clipboard-check"></i> Conferencia antes de fechar o dia</div>
                      <div className="playbook-check-row"><i className="ti ti-circle-check"></i><span>Alugueis pagos estao com status Pago, valor pago preenchido e data de pagamento informada.</span></div>
                      <div className="playbook-check-row"><i className="ti ti-circle-check"></i><span>Alugueis parciais mostram somente o valor recebido no campo Valor pago.</span></div>
                      <div className="playbook-check-row"><i className="ti ti-circle-check"></i><span>Alugueis pendentes permanecem com valor pago zerado para aparecerem no A receber.</span></div>
                      <div className="playbook-check-row"><i className="ti ti-circle-check"></i><span>Manutencoes com custo foram cadastradas na tela Manutencoes, nao duplicadas como despesa manual.</span></div>
                      <div className="playbook-check-row"><i className="ti ti-circle-check"></i><span>Despesas gerais foram registradas no Financeiro com categoria correta e veiculo quando aplicavel.</span></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* MODAIS */}
      {modal === 'veiculo' && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editId ? 'Editar' : 'Cadastrar'} Veículo</div><button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Placa *</label><input ref={setRef(vf,'placa')} placeholder="ABC-1234" /></div>
                <div className="form-group"><label>Modelo *</label><input ref={setRef(vf,'modelo')} placeholder="Quadriciclo Sport 150" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Ano</label><input ref={setRef(vf,'ano')} type="number" placeholder="2024" /></div>
                <div className="form-group"><label>Cor</label><input ref={setRef(vf,'cor')} placeholder="Vermelho" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Custo de aquisicao (R$)</label><input ref={setRef(vf,'custo')} type="number" placeholder="8000" /></div>
                <div className="form-group"><label>Valor padrao aluguel (R$)</label><input ref={setRef(vf,'valorAluguel')} type="number" step="0.01" placeholder="350" /></div>
              </div>
              <div className="form-group"><label>Status</label><select ref={setRef(vf,'status')}><option value="DISPONIVEL">Disponivel</option><option value="ALUGADO">Alugado</option><option value="MANUTENCAO">Em manutencao</option><option value="INATIVO">Inativo</option></select></div>
              <div className="form-group"><label>Chassi</label><input ref={setRef(vf,'chassi')} /></div>
              <div className="form-group"><label>Observações</label><textarea ref={setRef(vf,'obs')}></textarea></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveVeiculo} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}

      {modal === 'aluguel' && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editId ? 'Editar' : 'Registrar'} Aluguel</div><button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Data *</label><input ref={setRef(af,'data')} type="date" /></div>
                <div className="form-group"><label>Veiculo *</label><select ref={setRef(af,'veiculo')} onChange={handleVeiculoAluguelChange}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}</select></div>
              </div>
              <div className="form-group"><label>Cliente cadastrado</label><select ref={setRef(af,'clienteLista')} onChange={handleClienteAluguelChange}><option value="">Selecione um cliente...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.telefone}</option>)}</select></div>
              <div className="form-row">
                <div className="form-group"><label>Cliente *</label><input ref={setRef(af,'cliente')} /></div>
                <div className="form-group"><label>Contato</label><input ref={setRef(af,'contato')} placeholder="(85) 9 9999-9999" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Duração (h)</label><input ref={setRef(af,'duracao')} type="number" step="0.5" /></div>
                <div className="form-group"><label>Valor total (R$) *</label><input ref={setRef(af,'valor')} type="number" step="0.01" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Valor pago (R$)</label><input ref={setRef(af,'valorPago')} type="number" step="0.01" /></div>
                <div className="form-group"><label>Data do pagamento</label><input ref={setRef(af,'dataPagamento')} type="date" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Pagamento</label><select ref={setRef(af,'pagamento')}><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO_DEBITO">Cartão Débito</option><option value="CARTAO_CREDITO">Cartão Crédito</option></select></div>
                <div className="form-group"><label>Status pagamento</label><select ref={setRef(af,'statusPagamento')} onChange={handleStatusPagamentoChange}><option value="PENDENTE">Pendente</option><option value="PAGO">Pago</option><option value="PARCIAL">Parcial</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Status</label><select ref={setRef(af,'status')}><option value="CONCLUIDO">Concluído</option><option value="ANDAMENTO">Em andamento</option><option value="CANCELADO">Cancelado</option></select></div>
                <div className="form-group"><label>Rota / Destino</label><input ref={setRef(af,'rota')} /></div>
              </div>
              <div className="form-group"><label>Observações</label><textarea ref={setRef(af,'obs')}></textarea></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveAluguel} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}

      {modal === 'cliente' && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editId ? 'Editar' : 'Cadastrar'} Cliente</div><button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Nome *</label><input ref={setRef(cf,'nome')} placeholder="Nome do cliente" /></div>
                <div className="form-group"><label>Telefone *</label><input ref={setRef(cf,'telefone')} placeholder="(85) 9 9999-9999" /></div>
              </div>
              <div className="form-group"><label>Observacoes</label><textarea ref={setRef(cf,'obs')}></textarea></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveCliente} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}

      {modal === 'manutencao' && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editId ? 'Editar' : 'Registrar'} Manutenção</div><button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Data *</label><input ref={setRef(mf,'data')} type="date" /></div>
                <div className="form-group"><label>Veículo *</label><select ref={setRef(mf,'veiculo')}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Tipo *</label><select ref={setRef(mf,'tipo')}><option value="PREVENTIVA">Preventiva</option><option value="CORRETIVA">Corretiva</option></select></div>
                <div className="form-group"><label>Status</label><select ref={setRef(mf,'status')}><option value="CONCLUIDA">Concluída</option><option value="AGENDADA">Agendada</option><option value="ANDAMENTO">Em andamento</option></select></div>
              </div>
              <div className="form-group"><label>Descrição *</label><textarea ref={setRef(mf,'desc')}></textarea></div>
              <div className="form-row">
                <div className="form-group"><label>Oficina</label><input ref={setRef(mf,'oficina')} /></div>
                <div className="form-group"><label>Custo (R$)</label><input ref={setRef(mf,'custo')} type="number" /></div>
              </div>
              <div className="form-group"><label>Próxima revisão</label><input ref={setRef(mf,'proxima')} placeholder="3000 km ou 01/06/2025" /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveManutencao} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}

      {modal === 'despesa' && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editId ? 'Editar' : 'Registrar'} Despesa</div><button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Data *</label><input ref={setRef(df,'data')} type="date" /></div>
                <div className="form-group"><label>Categoria</label><select ref={setRef(df,'categoria')}><option value="COMBUSTIVEL">Combustível</option><option value="SEGURO">Seguro</option><option value="LICENCIAMENTO">Licenciamento</option><option value="PONTO">Ponto/Aluguel</option><option value="MARKETING">Marketing</option><option value="PESSOAL">Pessoal</option><option value="EQUIPAMENTO">Equipamento</option><option value="OUTROS">Outros</option></select></div>
              </div>
              <div className="form-group"><label>Descrição *</label><input ref={setRef(df,'desc')} /></div>
              <div className="form-row">
                <div className="form-group"><label>Valor (R$) *</label><input ref={setRef(df,'valor')} type="number" /></div>
                <div className="form-group"><label>Veículo (se aplicável)</label><select ref={setRef(df,'veiculo')}><option value="">Geral</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}</select></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveDespesa} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} err={toast.err} />}
    </>
  )
}
