'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type Veiculo = { id: string; placa: string; modelo: string; ano?: number; cor?: string; custo: number; chassi?: string; status: string; obs?: string }
type Aluguel = { id: string; data: string; veiculoId: string; veiculo?: { placa: string; modelo: string }; cliente: string; contato?: string; duracao?: number; valor: number; pagamento: string; statusPagamento: string; dataPagamento?: string; status: string; rota?: string; obs?: string }
type Manutencao = { id: string; data: string; veiculoId: string; veiculo?: { placa: string; modelo: string }; tipo: string; descricao: string; custo: number; oficina?: string; proxima?: string; status: string }
type Lancamento = { id: string; data: string; descricao: string; categoria: string; tipo: string; valor: number; veiculoId?: string; aluguelId?: string; manutencaoId?: string }
type Devedores = { cliente: string; total: number; qtd: number }
type Metricas = { totalVeiculos: number; veiculosDisponiveis: number; totalAlugueis: number; alugueisAndamento: number; totalReceitas: number; totalDespesas: number; lucro: number; custoAquisicao: number; roi: number; ticketMedio: number; totalManutencoes: number; manutencoesAgendadas: number; totalDevedor: number; devedores: Devedores[]; qtdInadimplentes: number }
type DashData = { veiculos: Veiculo[]; alugueis: Aluguel[]; manutencoes: Manutencao[]; lancamentos: Lancamento[]; metricas: Metricas }
type FormRef = Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>

const BRL = (v: number) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const fmtDate = (d: string) => { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-BR') }
const isoDate = (d: string) => d ? new Date(d).toISOString().split('T')[0] : ''
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
  const chartsRef = useRef<Record<string, any>>({})
  const [modal, setModal] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const vf = useRef<FormRef>({})
  const af = useRef<FormRef>({})
  const mf = useRef<FormRef>({})
  const df = useRef<FormRef>({})

  const showToast = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard')
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

  function openModal(type: string, id?: string) {
    setModal(type); setEditId(id || null)
    setTimeout(() => {
      if (!id) { clearForm(type); return }
      const map: Record<string, any[]> = { veiculo: data?.veiculos || [], aluguel: data?.alugueis || [], manutencao: data?.manutencoes || [], despesa: data?.lancamentos || [] }
      const rec = map[type]?.find((x: any) => x.id === id)
      if (rec) fillForm(type, rec)
    }, 10)
  }

  function clearForm(type: string) {
    const today = new Date().toISOString().split('T')[0]
    if (type === 'veiculo') { ['placa','modelo','ano','cor','custo','chassi','obs'].forEach(k => setVal(vf, k, '')); setVal(vf, 'status', 'DISPONIVEL') }
    if (type === 'aluguel') { ['cliente','contato','duracao','valor','rota','obs'].forEach(k => setVal(af, k, '')); setVal(af, 'data', today); setVal(af, 'veiculo', ''); setVal(af, 'pagamento', 'PIX'); setVal(af, 'status', 'CONCLUIDO') }
    if (type === 'manutencao') { ['desc','custo','oficina','proxima'].forEach(k => setVal(mf, k, '')); setVal(mf, 'data', today); setVal(mf, 'veiculo', ''); setVal(mf, 'tipo', 'PREVENTIVA'); setVal(mf, 'status', 'CONCLUIDA') }
    if (type === 'despesa') { ['desc','valor'].forEach(k => setVal(df, k, '')); setVal(df, 'data', today); setVal(df, 'categoria', 'COMBUSTIVEL'); setVal(df, 'veiculo', '') }
  }

  function fillForm(type: string, rec: any) {
    if (type === 'veiculo') { ['placa','modelo','ano','cor','custo','chassi','obs'].forEach(k => setVal(vf, k, String(rec[k] || ''))); setVal(vf, 'status', rec.status) }
    if (type === 'aluguel') { setVal(af, 'data', isoDate(rec.data)); ['cliente','contato','duracao','valor','rota','obs'].forEach(k => setVal(af, k, String(rec[k] || ''))); setVal(af, 'veiculo', rec.veiculoId); setVal(af, 'pagamento', rec.pagamento); setVal(af, 'status', rec.status) }
    if (type === 'manutencao') { setVal(mf, 'data', isoDate(rec.data)); ['desc','custo','oficina','proxima'].forEach(k => setVal(mf, k, String(rec[k] || ''))); setVal(mf, 'veiculo', rec.veiculoId); setVal(mf, 'tipo', rec.tipo); setVal(mf, 'status', rec.status) }
    if (type === 'despesa') { setVal(df, 'data', isoDate(rec.data)); ['desc','valor'].forEach(k => setVal(df, k, String(rec[k] || ''))); setVal(df, 'categoria', rec.categoria); setVal(df, 'veiculo', rec.veiculoId || '') }
  }

  async function saveVeiculo() {
    const body = { placa: getVal(vf,'placa'), modelo: getVal(vf,'modelo'), ano: getVal(vf,'ano'), cor: getVal(vf,'cor'), custo: getVal(vf,'custo'), chassi: getVal(vf,'chassi'), status: getVal(vf,'status'), obs: getVal(vf,'obs') }
    if (!body.placa || !body.modelo) { showToast('Placa e modelo são obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/veiculos/${editId}`, 'PUT', body) : await apiCall('/api/veiculos', 'POST', body); setModal(null); await loadData(); showToast('Veículo salvo!') }
    catch (e: any) { showToast(e.message, true) }
    setSaving(false)
  }

  async function saveAluguel() {
    const body = { data: getVal(af,'data'), veiculoId: getVal(af,'veiculo'), cliente: getVal(af,'cliente'), contato: getVal(af,'contato'), duracao: getVal(af,'duracao'), valor: getVal(af,'valor'), pagamento: getVal(af,'pagamento'), status: getVal(af,'status'), rota: getVal(af,'rota'), obs: getVal(af,'obs') }
    if (!body.data || !body.veiculoId || !body.cliente || !body.valor) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/alugueis/${editId}`, 'PUT', body) : await apiCall('/api/alugueis', 'POST', body); setModal(null); await loadData(); showToast('Aluguel registrado!') }
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

  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', section: 'Visão Geral' },
    { id: 'veiculos', label: 'Veículos', icon: 'car', section: 'Operações', count: data?.veiculos.length },
    { id: 'alugueis', label: 'Aluguéis', icon: 'route', count: data?.alugueis.length },
    { id: 'manutencoes', label: 'Manutenções', icon: 'tool', count: data?.manutencoes.length },
    { id: 'financeiro', label: 'Financeiro', icon: 'cash', section: 'Financeiro' },
    { id: 'roi', label: 'ROI & Análise', icon: 'chart-line' },
  ]

  const veiculos = data?.veiculos || []
  const alugueis = data?.alugueis || []
  const manutencoes = data?.manutencoes || []
  const lancamentos = data?.lancamentos || []
  const m = data?.metricas
  const manutFilt = manutencoes.filter(x => manutFilter === 'TODAS' ? true : manutFilter === 'AGENDADA' ? x.status === 'AGENDADA' : x.tipo === manutFilter)
  const lancFilt = lancamentos.filter(x => finFilter === 'TODAS' ? true : x.tipo === finFilter)

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
                <a className={`nav-item${page === p.id ? ' active' : ''}`} onClick={e => { e.preventDefault(); setPage(p.id) }} href="#">
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

                {page === 'veiculos' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Veículos</div><div className="section-subtitle">Cadastro e controle da frota</div></div><button className="btn btn-primary" onClick={() => openModal('veiculo')}><i className="ti ti-plus"></i> Novo veículo</button></div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Placa</th><th>Modelo</th><th>Ano</th><th>Cor</th><th>Custo aquisição</th><th>Status</th><th>Ações</th></tr></thead>
                      <tbody>{veiculos.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-car-off"></i><p>Nenhum veículo cadastrado</p></div></td></tr> : veiculos.map(v => (
                        <tr key={v.id}><td className="fw-semibold nowrap">{v.placa}</td><td>{v.modelo}</td><td>{v.ano || '—'}</td><td>{v.cor || '—'}</td><td className="nowrap">{BRL(v.custo)}</td><td><Badge s={v.status} /></td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('veiculo', v.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('veiculos', v.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'alugueis' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Aluguéis</div><div className="section-subtitle">Registro de locações</div></div><button className="btn btn-primary" onClick={() => openModal('aluguel')}><i className="ti ti-plus"></i> Novo aluguel</button></div>
                    {m && <div className="metrics-row" style={{ marginBottom: 16 }}>
                      <div className="metric-card metric-accent"><div className="metric-label">Total</div><div className="metric-value">{alugueis.length}</div></div>
                      <div className="metric-card metric-accent"><div className="metric-label">Receita total</div><div className="metric-value metric-up">{BRL(m.totalReceitas)}</div></div>
                      <div className="metric-card metric-accent-amber"><div className="metric-label">Ticket médio</div><div className="metric-value">{BRL(m.ticketMedio)}</div></div>
                      <div className="metric-card metric-accent-blue"><div className="metric-label">Em andamento</div><div className="metric-value">{m.alugueisAndamento}</div></div>
                    </div>}
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Veículo</th><th>Cliente</th><th>Duração</th><th>Valor</th><th>Forma Pgto</th><th>Status Pgto</th><th>Status</th><th>Ações</th></tr></thead>
                      <tbody>{alugueis.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-route-off"></i><p>Nenhum aluguel registrado</p></div></td></tr> : alugueis.map(a => (
                        <tr key={a.id}><td className="nowrap">{fmtDate(a.data)}</td><td className="nowrap">{a.veiculo ? `${a.veiculo.placa} — ${a.veiculo.modelo}` : '—'}</td><td>{a.cliente}</td><td className="nowrap">{a.duracao ? `${a.duracao}h` : '—'}</td><td className="nowrap fw-semibold">{BRL(a.valor)}</td><td>{pagMap[a.pagamento] || a.pagamento}</td><td><Badge s={a.statusPagamento || "PAGO"} /></td><td><Badge s={a.status} /></td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('aluguel', a.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('alugueis', a.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'manutencoes' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Manutenções</div><div className="section-subtitle">Controle preventivo e corretivo</div></div><button className="btn btn-primary" onClick={() => openModal('manutencao')}><i className="ti ti-plus"></i> Nova manutenção</button></div>
                    <div className="tab-bar">{['TODAS','PREVENTIVA','CORRETIVA','AGENDADA'].map(f => <button key={f} className={`tab-btn${manutFilter === f ? ' active' : ''}`} onClick={() => setManutFilter(f)}>{f === 'TODAS' ? 'Todas' : f === 'PREVENTIVA' ? 'Preventivas' : f === 'CORRETIVA' ? 'Corretivas' : 'Agendadas'}</button>)}</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Descrição</th><th>Oficina</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead>
                      <tbody>{manutFilt.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-tool-off"></i><p>Nenhuma manutenção registrada</p></div></td></tr> : manutFilt.map(mn => (
                        <tr key={mn.id}><td className="nowrap">{fmtDate(mn.data)}</td><td className="nowrap">{mn.veiculo ? `${mn.veiculo.placa} — ${mn.veiculo.modelo}` : '—'}</td><td><Badge s={mn.tipo} /></td><td>{mn.descricao}</td><td>{mn.oficina || '—'}</td><td className="nowrap">{BRL(mn.custo)}</td><td><Badge s={mn.status} /></td>
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
                <div className="form-group"><label>Custo de aquisição (R$)</label><input ref={setRef(vf,'custo')} type="number" placeholder="8000" /></div>
                <div className="form-group"><label>Status</label><select ref={setRef(vf,'status')}><option value="DISPONIVEL">Disponível</option><option value="ALUGADO">Alugado</option><option value="MANUTENCAO">Em manutenção</option><option value="INATIVO">Inativo</option></select></div>
              </div>
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
                <div className="form-group"><label>Veículo *</label><select ref={setRef(af,'veiculo')}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Cliente *</label><input ref={setRef(af,'cliente')} /></div>
                <div className="form-group"><label>Contato</label><input ref={setRef(af,'contato')} placeholder="(85) 9 9999-9999" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Duração (h)</label><input ref={setRef(af,'duracao')} type="number" step="0.5" /></div>
                <div className="form-group"><label>Valor (R$) *</label><input ref={setRef(af,'valor')} type="number" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Pagamento</label><select ref={setRef(af,'pagamento')}><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO_DEBITO">Cartão Débito</option><option value="CARTAO_CREDITO">Cartão Crédito</option></select></div>
                <div className="form-group"><label>Status</label><select ref={setRef(af,'status')}><option value="CONCLUIDO">Concluído</option><option value="ANDAMENTO">Em andamento</option><option value="CANCELADO">Cancelado</option></select></div>
              </div>
              <div className="form-group"><label>Rota / Destino</label><input ref={setRef(af,'rota')} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveAluguel} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
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
