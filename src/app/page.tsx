'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type Veiculo = { id: string; placa: string; modelo: string; ano?: number; cor?: string; custo: number; chassi?: string; status: string; obs?: string }
type Aluguel = { id: string; data: string; veiculoId: string; veiculo?: { placa: string; modelo: string }; cliente: string; contato?: string; duracao?: number; valor: number; pagamento: string; status: string; rota?: string; obs?: string }
type Manutencao = { id: string; data: string; veiculoId: string; veiculo?: { placa: string; modelo: string }; tipo: string; descricao: string; custo: number; oficina?: string; proxima?: string; status: string }
type Lancamento = { id: string; data: string; descricao: string; categoria: string; tipo: string; valor: number; veiculoId?: string; aluguelId?: string; manutencaoId?: string }
type Metricas = { totalVeiculos: number; veiculosDisponiveis: number; totalAlugueis: number; alugueisAndamento: number; totalReceitas: number; totalDespesas: number; lucro: number; custoAquisicao: number; roi: number; ticketMedio: number; totalManutencoes: number; manutencoesAgendadas: number }
type DashData = { veiculos: Veiculo[]; alugueis: Aluguel[]; manutencoes: Manutencao[]; lancamentos: Lancamento[]; metricas: Metricas }

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
}
const Badge = ({ s }: { s: string }) => { const [cls, label] = statusMap[s] || ['badge-gray', s]; return <span className={`badge ${cls}`}>{label}</span> }
const catMap: Record<string, string> = { ALUGUEL: 'Aluguel', MANUTENCAO: 'Manutenção', COMBUSTIVEL: 'Combustível', SEGURO: 'Seguro', LICENCIAMENTO: 'Licenciamento', PONTO: 'Ponto', MARKETING: 'Marketing', PESSOAL: 'Pessoal', EQUIPAMENTO: 'Equipamento', OUTROS: 'Outros' }
const pagMap: Record<string, string> = { PIX: 'PIX', DINHEIRO: 'Dinheiro', CARTAO_DEBITO: 'Débito', CARTAO_CREDITO: 'Crédito' }
const last6Months = () => { const ms = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); ms.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }) }) } return ms }
const getMonthKey = (d: string) => d ? d.slice(0, 7) : ''

function Toast({ msg, err }: { msg: string; err?: boolean }) {
  return <div className={`toast${err ? ' error' : ''}`}><i className={`ti ti-${err ? 'alert-circle' : 'circle-check'}`}></i>{msg}</div>
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

  // refs veículo
  const vPlaca = useRef<HTMLInputElement>(null)
  const vModelo = useRef<HTMLInputElement>(null)
  const vAno = useRef<HTMLInputElement>(null)
  const vCor = useRef<HTMLInputElement>(null)
  const vCusto = useRef<HTMLInputElement>(null)
  const vChassi = useRef<HTMLInputElement>(null)
  const vStatus = useRef<HTMLSelectElement>(null)
  const vObs = useRef<HTMLTextAreaElement>(null)

  // refs aluguel
  const aData = useRef<HTMLInputElement>(null)
  const aVeiculo = useRef<HTMLSelectElement>(null)
  const aCliente = useRef<HTMLInputElement>(null)
  const aContato = useRef<HTMLInputElement>(null)
  const aDuracao = useRef<HTMLInputElement>(null)
  const aValor = useRef<HTMLInputElement>(null)
  const aPagamento = useRef<HTMLSelectElement>(null)
  const aStatus = useRef<HTMLSelectElement>(null)
  const aRota = useRef<HTMLInputElement>(null)

  // refs manutenção
  const mData = useRef<HTMLInputElement>(null)
  const mVeiculo = useRef<HTMLSelectElement>(null)
  const mTipo = useRef<HTMLSelectElement>(null)
  const mStatus = useRef<HTMLSelectElement>(null)
  const mDesc = useRef<HTMLTextAreaElement>(null)
  const mOficina = useRef<HTMLInputElement>(null)
  const mCusto = useRef<HTMLInputElement>(null)
  const mProxima = useRef<HTMLInputElement>(null)

  // refs despesa
  const dData = useRef<HTMLInputElement>(null)
  const dCategoria = useRef<HTMLSelectElement>(null)
  const dDesc = useRef<HTMLInputElement>(null)
  const dValor = useRef<HTMLInputElement>(null)
  const dVeiculo = useRef<HTMLSelectElement>(null)

  const showToast = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { showToast('Erro ao carregar dados.', true) }
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

  const g = (ref: React.RefObject<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => ref.current?.value || ''
  const s = (ref: React.RefObject<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, val: string) => { if (ref.current) ref.current.value = val }

  function openModal(type: string, id?: string) {
    setModal(type); setEditId(id || null)
    setTimeout(() => {
      if (!id) { clearForm(type); return }
      const map: Record<string, any[]> = { veiculo: data?.veiculos || [], aluguel: data?.alugueis || [], manutencao: data?.manutencoes || [], despesa: data?.lancamentos || [] }
      const rec = map[type]?.find((x: any) => x.id === id)
      if (rec) fillForm(type, rec)
    }, 10)
  }

  const today = () => new Date().toISOString().split('T')[0]

  function clearForm(type: string) {
    if (type === 'veiculo') { [vPlaca,vModelo,vAno,vCor,vCusto,vChassi].forEach(r => s(r,'')); s(vStatus,'DISPONIVEL'); s(vObs,'') }
    if (type === 'aluguel') { [aCliente,aContato,aDuracao,aValor,aRota].forEach(r => s(r,'')); s(aData,today()); s(aVeiculo,''); s(aPagamento,'PIX'); s(aStatus,'CONCLUIDO') }
    if (type === 'manutencao') { [mDesc,mOficina,mCusto,mProxima].forEach(r => s(r,'')); s(mData,today()); s(mVeiculo,''); s(mTipo,'PREVENTIVA'); s(mStatus,'CONCLUIDA') }
    if (type === 'despesa') { [dDesc,dValor].forEach(r => s(r,'')); s(dData,today()); s(dCategoria,'COMBUSTIVEL'); s(dVeiculo,'') }
  }

  function fillForm(type: string, rec: any) {
    if (type === 'veiculo') { s(vPlaca,rec.placa||''); s(vModelo,rec.modelo||''); s(vAno,String(rec.ano||'')); s(vCor,rec.cor||''); s(vCusto,String(rec.custo||'')); s(vChassi,rec.chassi||''); s(vStatus,rec.status); s(vObs,rec.obs||'') }
    if (type === 'aluguel') { s(aData,isoDate(rec.data)); s(aVeiculo,rec.veiculoId); s(aCliente,rec.cliente||''); s(aContato,rec.contato||''); s(aDuracao,String(rec.duracao||'')); s(aValor,String(rec.valor||'')); s(aPagamento,rec.pagamento); s(aStatus,rec.status); s(aRota,rec.rota||'') }
    if (type === 'manutencao') { s(mData,isoDate(rec.data)); s(mVeiculo,rec.veiculoId); s(mTipo,rec.tipo); s(mStatus,rec.status); s(mDesc,rec.descricao||''); s(mOficina,rec.oficina||''); s(mCusto,String(rec.custo||'')); s(mProxima,rec.proxima||'') }
    if (type === 'despesa') { s(dData,isoDate(rec.data)); s(dDesc,rec.descricao||''); s(dCategoria,rec.categoria); s(dValor,String(rec.valor||'')); s(dVeiculo,rec.veiculoId||'') }
  }

  async function saveVeiculo() {
    const body = { placa: g(vPlaca), modelo: g(vModelo), ano: g(vAno), cor: g(vCor), custo: g(vCusto), chassi: g(vChassi), status: g(vStatus), obs: g(vObs) }
    if (!body.placa || !body.modelo) { showToast('Placa e modelo são obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/veiculos/${editId}`, 'PUT', body) : await apiCall('/api/veiculos', 'POST', body); setModal(null); await loadData(); showToast('Veículo salvo!') }
    catch (e: any) { showToast(e.message, true) } finally { setSaving(false) }
  }

  async function saveAluguel() {
    const body = { data: g(aData), veiculoId: g(aVeiculo), cliente: g(aCliente), contato: g(aContato), duracao: g(aDuracao), valor: g(aValor), pagamento: g(aPagamento), status: g(aStatus), rota: g(aRota) }
    if (!body.data || !body.veiculoId || !body.cliente || !body.valor) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/alugueis/${editId}`, 'PUT', body) : await apiCall('/api/alugueis', 'POST', body); setModal(null); await loadData(); showToast('Aluguel registrado!') }
    catch (e: any) { showToast(e.message, true) } finally { setSaving(false) }
  }

  async function saveManutencao() {
    const body = { data: g(mData), veiculoId: g(mVeiculo), tipo: g(mTipo), descricao: g(mDesc), custo: g(mCusto), oficina: g(mOficina), proxima: g(mProxima), status: g(mStatus) }
    if (!body.data || !body.veiculoId || !body.descricao) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/manutencoes/${editId}`, 'PUT', body) : await apiCall('/api/manutencoes', 'POST', body); setModal(null); await loadData(); showToast('Manutenção registrada!') }
    catch (e: any) { showToast(e.message, true) } finally { setSaving(false) }
  }

  async function saveDespesa() {
    const body = { data: g(dData), descricao: g(dDesc), categoria: g(dCategoria), valor: g(dValor), veiculoId: g(dVeiculo) || null }
    if (!body.data || !body.descricao || !body.valor) { showToast('Preencha os campos obrigatórios', true); return }
    setSaving(true)
    try { editId ? await apiCall(`/api/lancamentos/${editId}`, 'PUT', body) : await apiCall('/api/lancamentos', 'POST', body); setModal(null); await loadData(); showToast('Despesa registrada!') }
    catch (e: any) { showToast(e.message, true) } finally { setSaving(false) }
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
                        <tr key={v.id}><td className="fw-semibold nowrap">{v.placa}</td><td>{v.modelo}</td><td>{v.ano||'—'}</td><td>{v.cor||'—'}</td><td className="nowrap">{BRL(v.custo)}</td><td><Badge s={v.status} /></td>
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
                      <thead><tr><th>Data</th><th>Veículo</th><th>Cliente</th><th>Duração</th><th>Valor</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr></thead>
                      <tbody>{alugueis.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-route-off"></i><p>Nenhum aluguel registrado</p></div></td></tr> : alugueis.map(a => (
                        <tr key={a.id}><td className="nowrap">{fmtDate(a.data)}</td><td className="nowrap">{a.veiculo ? `${a.veiculo.placa} — ${a.veiculo.modelo}` : '—'}</td><td>{a.cliente}</td><td className="nowrap">{a.duracao ? `${a.duracao}h` : '—'}</td><td className="nowrap fw-semibold">{BRL(a.valor)}</td><td>{pagMap[a.pagamento]||a.pagamento}</td><td><Badge s={a.status} /></td>
                        <td><div className="td-actions"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal('aluguel', a.id)}><i className="ti ti-edit"></i></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteItem('alugueis', a.id)}><i className="ti ti-trash"></i></button></div></td></tr>
                      ))}</tbody>
                    </table></div></div>
                  </div>
                )}

                {page === 'manutencoes' && (
                  <div>
                    <div className="section-header"><div><div className="section-title">Manutenções</div><div className="section-subtitle">Controle preventivo e corretivo</div></div><button className="btn btn-primary" onClick={() => openModal('manutencao')}><i className="ti ti-plus"></i> Nova manutenção</button></div>
                    <div className="tab-bar">{['TODAS','PREVENTIVA','CORRETIVA','AGENDADA'].map(f => <button key={f} className={`tab-btn${manutFilter === f ? ' active' : ''}`} onClick={() => setManutFilter(f)}>{f==='TODAS'?'Todas':f==='PREVENTIVA'?'Preventivas':f==='CORRETIVA'?'Corretivas':'Agendadas'}</button>)}</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Descrição</th><th>Oficina</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead>
                      <tbody>{manutFilt.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-tool-off"></i><p>Nenhuma manutenção registrada</p></div></td></tr> : manutFilt.map(mn => (
                        <tr key={mn.id}><td className="nowrap">{fmtDate(mn.data)}</td><td className="nowrap">{mn.veiculo ? `${mn.veiculo.placa} — ${mn.veiculo.modelo}` : '—'}</td><td><Badge s={mn.tipo} /></td><td>{mn.descricao}</td><td>{mn.oficina||'—'}</td><td className="nowrap">{BRL(mn.custo)}</td><td><Badge s={mn.status} /></td>
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
                    <div className="tab-bar">{['TODAS','RECEITA','DESPESA'].map(f => <button key={f} className={`tab-btn${finFilter === f ? ' active' : ''}`} onClick={() => setFinFilter(f)}>{f==='TODAS'?'Todas':f==='RECEITA'?'Receitas':'Despesas'}</button>)}</div>
                    <div className="card"><div className="table-wrapper"><table>
                      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Ações</th></tr></thead>
                      <tbody>{lancFilt.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-coin-off"></i><p>Nenhuma movimentação</p></div></td></tr> : lancFilt.map(l => (
                        <tr key={l.id}><td className="nowrap">{fmtDate(l.data)}</td><td>{l.descricao}</td><td>{catMap[l.categoria]||l.categoria}</td><td><Badge s={l.tipo} /></td><td className={`nowrap fw-semibold ${l.tipo === 'RECEITA' ? 'text-green' : 'text-red'}`}>{l.tipo==='RECEITA'?'+':'-'} {BRL(l.valor)}</td>
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

      {modal === 'veiculo' && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">{editId ? 'Editar' : 'Cadastrar'} Veículo</div><button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Placa *</label><input ref={vPlaca} placeholder="ABC-1234" /></div>
                <div className="form-group"><label>Modelo *</label><input ref={vModelo} placeholder="Quadriciclo Sport 150" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Ano</label><input ref={vAno} type="number" placeholder="2024" /></div>
                <div className="form-group"><label>Cor</label><input ref={vCor} placeholder="Vermelho" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Custo de aquisição (R$)</label><input ref={vCusto} type="number" placeholder="8000" /></div>
                <div className="form-group"><label>Status</label><select ref={vStatus}><option value="DISPONIVEL">Disponível</option><option value="ALUGADO">Alugado</option><option value="MANUTENCAO">Em manutenção</option><option value="INATIVO">Inativo</option></select></div>
              </div>
              <div className="form-group"><label>Chassi</label><input ref={vChassi} /></div>
              <div className="form-group"><label>Observações</label><textarea ref={vObs}></textarea></div>
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
                <div className="form-group"><label>Data *</label><input ref={aData} type="date" /></div>
                <div className="form-group"><label>Veículo *</label><select ref={aVeiculo}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Cliente *</label><input ref={aCliente} /></div>
                <div className="form-group"><label>Contato</label><input ref={aContato} placeholder="(85) 9 9999-9999" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Duração (h)</label><input ref={aDuracao} type="number" step="0.5" /></div>
                <div className="form-group"><label>Valor (R$) *</label><input ref={aValor} type="number" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Pagamento</label><select ref={aPagamento}><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO_DEBITO">Cartão Débito</option><option value="CARTAO_CREDITO">Cartão Crédito</option></select></div>
                <div className="form-group"><label>Status</label><select ref={aStatus}><option value="CONCLUIDO">Concluído</option><option value="ANDAMENTO">Em andamento</option><option value="CANCELADO">Cancelado</option></select></div>
              </div>
              <div className="form-group"><label>Rota / Destino</label><input ref={aRota} /></div>
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
                <div className="form-group"><label>Data *</label><input ref={mData} type="date" /></div>
                <div className="form-group"><label>Veículo *</label><select ref={mVeiculo}><option value="">Selecione...</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Tipo *</label><select ref={mTipo}><option value="PREVENTIVA">Preventiva</option><option value="CORRETIVA">Corretiva</option></select></div>
                <div className="form-group"><label>Status</label><select ref={mStatus}><option value="CONCLUIDA">Concluída</option><option value="AGENDADA">Agendada</option><option value="ANDAMENTO">Em andamento</option></select></div>
              </div>
              <div className="form-group"><label>Descrição *</label><textarea ref={mDesc}></textarea></div>
              <div className="form-row">
                <div className="form-group"><label>Oficina</label><input ref={mOficina} /></div>
                <div className="form-group"><label>Custo (R$)</label><input ref={mCusto} type="number" /></div>
              </div>
              <div className="form-group"><label>Próxima revisão</label><input ref={mProxima} placeholder="3000 km ou 01/06/2025" /></div>
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
                <div className="form-group"><label>Data *</label><input ref={dData} type="date" /></div>
                <div className="form-group"><label>Categoria</label><select ref={dCategoria}><option value="COMBUSTIVEL">Combustível</option><option value="SEGURO">Seguro</option><option value="LICENCIAMENTO">Licenciamento</option><option value="PONTO">Ponto/Aluguel</option><option value="MARKETING">Marketing</option><option value="PESSOAL">Pessoal</option><option value="EQUIPAMENTO">Equipamento</option><option value="OUTROS">Outros</option></select></div>
              </div>
              <div className="form-group"><label>Descrição *</label><input ref={dDesc} /></div>
              <div className="form-row">
                <div className="form-group"><label>Valor (R$) *</label><input ref={dValor} type="number" /></div>
                <div className="form-group"><label>Veículo (se aplicável)</label><select ref={dVeiculo}><option value="">Geral</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}</select></div>
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
