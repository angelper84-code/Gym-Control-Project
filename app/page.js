'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  Users,
  Layers,
  TrendingDown,
  Settings,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_RATE = 45.5;
const WARNING_DAYS = 5;
const CYCLE_DAYS = 30;

const DEFAULT_PLANS = [
  { id: 'plan-mensual', name: 'Mensualidad General', price_usd: 25, duration_days: 30 },
  { id: 'plan-trimestral', name: 'Trimestral', price_usd: 65, duration_days: 90 },
  { id: 'plan-diario', name: 'Pase Diario', price_usd: 3, duration_days: 1 },
];

function parseDateSafe(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(dateInput, days) {
  const base = parseDateSafe(dateInput) || new Date();
  const res = new Date(base.getTime());
  res.setDate(res.getDate() + Number(days || CYCLE_DAYS));
  return res;
}

function diffDaysFromToday(dateInput) {
  const target = parseDateSafe(dateInput);
  if (!target) return -999;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  return Math.ceil((startTarget - startToday) / (1000 * 60 * 60 * 24));
}

function formatDateShort(dateInput) {
  const d = parseDateSafe(dateInput);
  if (!d) return '—';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeShort(dateInput) {
  const d = parseDateSafe(dateInput);
  if (!d) return '—';
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoneyUsd(val) {
  const num = Number(val || 0);
  return `$${num.toFixed(2)}`;
}

function formatMoneyBs(valUsd, rate) {
  const num = Number(valUsd || 0) * Number(rate || DEFAULT_RATE);
  return `Bs. ${num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMemberStatus(member) {
  const daysLeft = diffDaysFromToday(member.expires_at);
  if (daysLeft < 0) {
    return { key: 'vencido', label: 'Vencido', daysLeft, badgeClass: 'kova-badge-danger' };
  }
  if (daysLeft <= WARNING_DAYS) {
    return {
      key: 'por_vencer',
      label: `Vence en ${daysLeft}d`,
      daysLeft,
      badgeClass: 'kova-badge-warn',
    };
  }
  return {
    key: 'activo',
    label: `Activo (${daysLeft}d)`,
    daysLeft,
    badgeClass: 'kova-badge-ok',
  };
}

export default function KovaGymPage() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [rateInput, setRateInput] = useState(String(DEFAULT_RATE));
  const [loading, setLoading] = useState(false);
  const [syncingRate, setSyncingRate] = useState(false);
  const [toast, setToast] = useState('');

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [attendance, setAttendance] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [checkinQuery, setCheckinQuery] = useState('');
  const [checkinResult, setCheckinResult] = useState(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('todos');

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({
    full_name: '',
    cedula: '',
    phone: '',
    plan_id: DEFAULT_PLANS[0].id,
    paid_usd: DEFAULT_PLANS[0].price_usd,
    duration_days: DEFAULT_PLANS[0].duration_days,
    start_date: new Date().toISOString().slice(0, 10),
  });

  const [planForm, setPlanForm] = useState({
    name: '',
    price_usd: '',
    duration_days: '30',
  });

  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount_usd: '',
    category: 'Operativo',
    date: new Date().toISOString().slice(0, 10),
  });

  const [settingsForm, setSettingsForm] = useState({
    gym_name: 'Kova Gym',
    warning_days: WARNING_DAYS,
    auto_bcv: true,
  });
                const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? '' : prev));
    }, 3200);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        showToast('Modo local sin conexión directa a Supabase');
        setLoading(false);
        return;
      }

      const [mRes, pRes, aRes, eRes, sRes] = await Promise.allSettled([
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('plans').select('*').order('price_usd', { ascending: true }),
        supabase.from('attendance').select('*').order('checked_in_at', { ascending: false }).limit(30),
        supabase.from('expenses').select('*').order('date', { ascending: false }).limit(40),
        supabase.from('settings').select('*').limit(1),
      ]);

      if (mRes.status === 'fulfilled' && !mRes.value.error && Array.isArray(mRes.value.data)) {
        setMembers(mRes.value.data);
      }
      if (
        pRes.status === 'fulfilled' &&
        !pRes.value.error &&
        Array.isArray(pRes.value.data) &&
        pRes.value.data.length > 0
      ) {
        setPlans(pRes.value.data);
      }
      if (aRes.status === 'fulfilled' && !aRes.value.error && Array.isArray(aRes.value.data)) {
        setAttendance(aRes.value.data);
      }
      if (eRes.status === 'fulfilled' && !eRes.value.error && Array.isArray(eRes.value.data)) {
        setExpenses(eRes.value.data);
      }
      if (
        sRes.status === 'fulfilled' &&
        !sRes.value.error &&
        Array.isArray(sRes.value.data) &&
        sRes.value.data.length > 0
      ) {
        const st = sRes.value.data[0];
        if (Number(st.exchange_rate) > 0) {
          setRate(Number(st.exchange_rate));
          setRateInput(String(st.exchange_rate));
        }
        setSettingsForm((prev) => ({
          ...prev,
          gym_name: st.gym_name || prev.gym_name,
          warning_days: Number(st.warning_days) || prev.warning_days,
          auto_bcv: typeof st.auto_bcv === 'boolean' ? st.auto_bcv : prev.auto_bcv,
        }));
      }
    } catch (err) {
      console.error(err);
      showToast('Error al sincronizar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleApplyRate = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(String(rateInput).replace(',', '.'));
    if (!parsed || parsed <= 0) {
      showToast('Ingresa una tasa válida');
      return;
    }
    setRate(parsed);
    setRateInput(String(parsed));
    if (supabase) {
      await supabase.from('settings').upsert({ id: 1, exchange_rate: parsed });
    }
    showToast(`Tasa actualizada a Bs. ${parsed.toFixed(2)}`);
  };

  const handleSyncBcv = async () => {
    setSyncingRate(true);
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!res.ok) throw new Error('Error consultando tasa');
      const data = await res.json();
      const oficial = Number(data?.promedio || data?.venta || data?.compra);
      if (oficial > 0) {
        setRate(oficial);
        setRateInput(String(oficial));
        if (supabase) {
          await supabase.from('settings').upsert({ id: 1, exchange_rate: oficial });
        }
        showToast(`Tasa BCV sincronizada: Bs. ${oficial.toFixed(2)}`);
      } else {
        showToast('No se obtuvo un valor numérico de BCV');
      }
    } catch (err) {
      console.error(err);
      showToast('No se pudo consultar la tasa BCV en este momento');
    } finally {
      setSyncingRate(false);
    }
  };

  const handleCheckin = async (e) => {
    e.preventDefault();
    const q = checkinQuery.trim().toLowerCase();
    if (!q) {
      setCheckinResult(null);
      return;
    }

    const found = members.find(
      (m) =>
        String(m.full_name || '').toLowerCase().includes(q) ||
        String(m.cedula || '').toLowerCase().includes(q) ||
        String(m.phone || '').toLowerCase().includes(q)
    );

    if (!found) {
      setCheckinResult({
        type: 'not_found',
        title: 'Miembro no encontrado',
        detail: 'No hay registros que coincidan con esa búsqueda.',
      });
      return;
    }

    const status = getMemberStatus(found);
    if (status.key === 'vencido') {
      setCheckinResult({
        type: 'expired',
        member: found,
        status,
        title: 'Membresía vencida',
        detail: `Venció el ${formatDateShort(found.expires_at)}. Requiere renovación.`,
      });
      return;
    }

    const entryRecord = {
      id: `att-${Date.now()}`,
      member_id: found.id,
      member_name: found.full_name,
      checked_in_at: new Date().toISOString(),
    };

    setAttendance((prev) => [entryRecord, ...prev]);
    setCheckinResult({
      type: 'allowed',
      member: found,
      status,
      title: 'Acceso concedido',
      detail: `${found.full_name} · ${status.label}`,
    });
    showToast(`Entrada registrada: ${found.full_name}`);

    if (supabase) {
      await supabase.from('attendance').insert({
        member_id: found.id,
        member_name: found.full_name,
        checked_in_at: entryRecord.checked_in_at,
      });
    }
  };
    const openNewMemberModal = () => {
    const firstPlan = plans[0] || DEFAULT_PLANS[0];
    setEditingMember(null);
    setMemberForm({
      full_name: '',
      cedula: '',
      phone: '',
      plan_id: firstPlan.id,
      paid_usd: firstPlan.price_usd,
      duration_days: firstPlan.duration_days || CYCLE_DAYS,
      start_date: new Date().toISOString().slice(0, 10),
    });
    setMemberModalOpen(true);
  };

  const openEditMemberModal = (member) => {
    setEditingMember(member);
    setMemberForm({
      full_name: member.full_name || '',
      cedula: member.cedula || '',
      phone: member.phone || '',
      plan_id: member.plan_id || (plans[0] && plans[0].id) || 'plan-mensual',
      paid_usd: member.paid_usd ?? 25,
      duration_days: member.duration_days || CYCLE_DAYS,
      start_date: (member.expires_at
        ? addDays(member.expires_at, -(member.duration_days || CYCLE_DAYS))
        : new Date()
      )
        .toISOString()
        .slice(0, 10),
    });
    setMemberModalOpen(true);
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!memberForm.full_name.trim()) {
      showToast('El nombre del miembro es obligatorio');
      return;
    }

    const duration = Number(memberForm.duration_days || CYCLE_DAYS);
    const expiresAt = addDays(memberForm.start_date, duration).toISOString();
    const selectedPlan = plans.find((p) => String(p.id) === String(memberForm.plan_id));

    const payload = {
      full_name: memberForm.full_name.trim(),
      cedula: memberForm.cedula.trim(),
      phone: memberForm.phone.trim(),
      plan_id: memberForm.plan_id,
      plan_name: selectedPlan ? selectedPlan.name : 'Plan',
      paid_usd: Number(memberForm.paid_usd || 0),
      duration_days: duration,
      expires_at: expiresAt,
    };

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? { ...m, ...payload } : m))
      );
      if (supabase) {
        await supabase.from('members').update(payload).eq('id', editingMember.id);
      }
      showToast('Miembro actualizado');
    } else {
      const newMember = {
        id: `mem-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...payload,
      };
      setMembers((prev) => [newMember, ...prev]);
      if (supabase) {
        await supabase.from('members').insert(payload);
      }
      showToast('Miembro registrado');
    }

    setMemberModalOpen(false);
  };

  const handleRenewMember = async (member) => {
    const duration = Number(member.duration_days || CYCLE_DAYS);
    const baseDate = diffDaysFromToday(member.expires_at) > 0 ? member.expires_at : new Date();
    const newExpires = addDays(baseDate, duration).toISOString();

    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, expires_at: newExpires } : m))
    );
    if (supabase) {
      await supabase.from('members').update({ expires_at: newExpires }).eq('id', member.id);
    }
    showToast(`Membresía renovada para ${member.full_name}`);
  };

  const handleDeleteMember = async (id) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    if (supabase) {
      await supabase.from('members').delete().eq('id', id);
    }
    showToast('Miembro eliminado');
  };

  const handleNotifyWhatsApp = (member) => {
    const cleanPhone = String(member.phone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hola ${member.full_name}, te saludamos de ${settingsForm.gym_name}. Tu membresía vence el ${formatDateShort(
        member.expires_at
      )}. ¡Te esperamos!`
    );
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const metrics = useMemo(() => {
    let activeCount = 0;
    let expiringCount = 0;
    let estimatedUsd = 0;

    const expiringList = [];
    for (const m of members) {
      const st = getMemberStatus(m);
      if (st.key === 'activo' || st.key === 'por_vencer') {
        activeCount += 1;
        estimatedUsd += Number(m.paid_usd || 0);
      }
      if (st.key === 'por_vencer') {
        expiringCount += 1;
        expiringList.push({ ...m, status: st });
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const entriesToday = attendance.filter((a) =>
      String(a.checked_in_at || '').startsWith(todayStr)
    ).length;

    const totalExpensesUsd = expenses.reduce((acc, item) => acc + Number(item.amount_usd || 0), 0);

    return {
      totalRegistered: members.length,
      activeCount,
      expiringCount,
      expiringList,
      entriesToday,
      estimatedUsd,
      totalExpensesUsd,
    };
  }, [members, attendance, expenses]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      const st = getMemberStatus(m);
      if (memberFilter !== 'todos' && st.key !== memberFilter) return false;
      if (!q) return true;
      return (
        String(m.full_name || '').toLowerCase().includes(q) ||
        String(m.cedula || '').toLowerCase().includes(q) ||
        String(m.phone || '').toLowerCase().includes(q)
      );
    });
  }, [members, memberSearch, memberFilter]);
          const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim() || !planForm.price_usd) {
      showToast('Completa nombre y precio del plan');
      return;
    }
    const newPlan = {
      id: `plan-${Date.now()}`,
      name: planForm.name.trim(),
      price_usd: Number(planForm.price_usd),
      duration_days: Number(planForm.duration_days || CYCLE_DAYS),
    };
    setPlans((prev) => [...prev, newPlan]);
    setPlanForm({ name: '', price_usd: '', duration_days: '30' });
    if (supabase) {
      await supabase.from('plans').insert(newPlan);
    }
    showToast('Plan agregado');
  };

  const handleDeletePlan = async (id) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (supabase) {
      await supabase.from('plans').delete().eq('id', id);
    }
    showToast('Plan eliminado');
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || !expenseForm.amount_usd) {
      showToast('Completa concepto y monto del gasto');
      return;
    }
    const newExpense = {
      id: `exp-${Date.now()}`,
      title: expenseForm.title.trim(),
      amount_usd: Number(expenseForm.amount_usd),
      category: expenseForm.category,
      date: expenseForm.date,
    };
    setExpenses((prev) => [newExpense, ...prev]);
    setExpenseForm({
      title: '',
      amount_usd: '',
      category: 'Operativo',
      date: new Date().toISOString().slice(0, 10),
    });
    if (supabase) {
      await supabase.from('expenses').insert(newExpense);
    }
    showToast('Gasto registrado');
  };

  const handleDeleteExpense = async (id) => {
    setExpenses((prev) => prev.filter((item) => item.id !== id));
    if (supabase) {
      await supabase.from('expenses').delete().eq('id', id);
    }
    showToast('Gasto eliminado');
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (supabase) {
      await supabase.from('settings').upsert({
        id: 1,
        gym_name: settingsForm.gym_name.trim() || 'Kova Gym',
        warning_days: Number(settingsForm.warning_days || WARNING_DAYS),
        auto_bcv: Boolean(settingsForm.auto_bcv),
        exchange_rate: Number(rate),
      });
    }
    showToast('Ajustes guardados');
  };

  const navItems = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'miembros', label: 'Miembros', icon: Users },
    { id: 'planes', label: 'Planes', icon: Layers },
    { id: 'gastos', label: 'Gastos', icon: TrendingDown },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="kova-shell">
      <aside className="kova-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="kova-brand">
            <img
              src="/logo-kova.png"
              alt="Kova Gym"
              style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }}
            />
            <div>
              <h1 className="kova-brand-title">{settingsForm.gym_name}</h1>
              <p className="kova-brand-sub">Control de Acceso y Cobros</p>
            </div>
          </div>

          <nav className="kova-nav" aria-label="Navegación principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`kova-nav-btn ${isActive ? 'is-active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="kova-sidebar-footer">
          <form onSubmit={handleApplyRate} className="kova-rate-box">
            <span className="kova-rate-label">Tasa Bs/$</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="kova-rate-input"
                aria-label="Tasa en bolívares"
              />
              <button type="submit" className="kova-btn kova-btn-primary kova-btn-sm">
                Aplicar
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={handleSyncBcv}
              disabled={syncingRate}
              className="kova-btn kova-btn-sm"
              style={{ flex: 1 }}
              title="Sincronizar tasa BCV"
            >
              <RefreshCw size={13} className={syncingRate ? 'kova-spin' : ''} />
              <span>BCV</span>
            </button>
            <button
              type="button"
              onClick={loadAllData}
              disabled={loading}
              className="kova-btn kova-btn-sm"
              title="Recargar datos"
            >
              <RefreshCw size={13} className={loading ? 'kova-spin' : ''} />
            </button>
          </div>

          <button
            type="button"
            onClick={openNewMemberModal}
            className="kova-btn kova-btn-primary"
            style={{ width: '100%' }}
          >
            <Plus size={15} />
            <span>Nuevo Miembro</span>
          </button>
        </div>
      </aside>
                       <main className="kova-main">
        {activeTab === 'inicio' && (
          <>
            <section className="kova-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span className="kova-kpi-label kova-text-sky">Check-in de recepción</span>
                <span className="kova-text-muted text-xs">
                  Ciclo de {CYCLE_DAYS} días desde el pago
                </span>
              </div>

              <form
                onSubmit={handleCheckin}
                className="kova-checkin-row"
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div className="kova-search-wrap">
                  <Search size={15} className="kova-search-icon" />
                  <input
                    type="text"
                    value={checkinQuery}
                    onChange={(e) => setCheckinQuery(e.target.value)}
                    placeholder="Buscar por nombre, cédula o teléfono..."
                    className="kova-input kova-search-input"
                  />
                </div>
                <button type="submit" className="kova-btn kova-btn-primary">
                  <UserCheck size={15} />
                  <span>Verificar Acceso</span>
                </button>
              </form>

              {checkinResult && (
                <div
                  className="kova-card-subtle"
                  style={{
                    marginTop: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {checkinResult.type === 'allowed' && (
                      <CheckCircle2 size={18} className="kova-text-emerald" />
                    )}
                    {checkinResult.type === 'expired' && (
                      <XCircle size={18} className="kova-text-rose" />
                    )}
                    {checkinResult.type === 'not_found' && (
                      <AlertTriangle size={18} className="kova-text-amber" />
                    )}
                    <div>
                      <div className="text-sm font-semibold">{checkinResult.title}</div>
                      <div className="text-xs kova-text-muted">{checkinResult.detail}</div>
                    </div>
                  </div>
                  {checkinResult.type === 'expired' && checkinResult.member && (
                    <button
                      type="button"
                      onClick={() => handleRenewMember(checkinResult.member)}
                      className="kova-btn kova-btn-success kova-btn-sm"
                    >
                      Renovar ahora
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="kova-grid-kpi">
              <div className="kova-card">
                <div className="kova-kpi-label">Miembros Activos</div>
                <div className="kova-kpi-value">{metrics.activeCount}</div>
                <div className="kova-kpi-meta">Total registrados: {metrics.totalRegistered}</div>
              </div>

              <div className="kova-card">
                <div className="kova-kpi-label">Próximos a Vencer ({WARNING_DAYS}d)</div>
                <div className="kova-kpi-value kova-text-amber">{metrics.expiringCount}</div>
                <div className="kova-kpi-meta">Aviso preventivo activo</div>
              </div>

              <div className="kova-card">
                <div className="kova-kpi-label">Entradas Hoy</div>
                <div className="kova-kpi-value">{metrics.entriesToday}</div>
                <div className="kova-kpi-meta">Control de asistencia</div>
              </div>

              <div className="kova-card">
                <div className="kova-kpi-label">Ingresos Estimados (Activos)</div>
                <div className="kova-kpi-value kova-text-emerald">
                  {formatMoneyUsd(metrics.estimatedUsd)}
                </div>
                <div className="kova-kpi-meta">{formatMoneyBs(metrics.estimatedUsd, rate)}</div>
              </div>
            </section>

            <section className="kova-grid-2">
              <div className="kova-card">
                <h2 className="text-base font-semibold" style={{ margin: '0 0 10px' }}>
                  Próximos a vencer
                </h2>
                {metrics.expiringList.length === 0 ? (
                  <p className="text-xs kova-text-muted" style={{ margin: 0 }}>
                    No hay miembros por vencer en los próximos {WARNING_DAYS} días.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {metrics.expiringList.map((m) => (
                      <div
                        key={m.id}
                        className="kova-card-subtle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div className="text-sm font-semibold">{m.full_name}</div>
                          <div className="text-xs kova-text-muted">
                            Vence: {formatDateShort(m.expires_at)} · {m.status.label}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleNotifyWhatsApp(m)}
                            className="kova-btn kova-btn-sm"
                          >
                            <MessageSquare size={13} />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRenewMember(m)}
                            className="kova-btn kova-btn-success kova-btn-sm"
                          >
                            Renovar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="kova-card">
                <h2 className="text-base font-semibold" style={{ margin: '0 0 10px' }}>
                  Asistencias recientes
                </h2>
                {attendance.length === 0 ? (
                  <p className="text-xs kova-text-muted" style={{ margin: 0 }}>
                    Aún no hay entradas registradas hoy.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {attendance.slice(0, 6).map((a) => (
                      <div
                        key={a.id}
                        className="kova-card-subtle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span className="text-sm font-medium">{a.member_name}</span>
                        <span className="text-xs kova-text-muted">
                          {formatDateTimeShort(a.checked_in_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
                    {activeTab === 'miembros' && (
          <section className="kova-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '12px',
              }}
            >
              <div>
                <h2 className="text-base font-semibold" style={{ margin: 0 }}>
                  Miembros ({filteredMembers.length})
                </h2>
                <p className="text-xs kova-text-muted" style={{ margin: '2px 0 0' }}>
                  Control de vencimientos, renovaciones y avisos por WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={openNewMemberModal}
                className="kova-btn kova-btn-primary kova-btn-sm"
              >
                <Plus size={14} />
                <span>Nuevo Miembro</span>
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '12px',
              }}
            >
              <div className="kova-search-wrap" style={{ minWidth: '210px' }}>
                <Search size={15} className="kova-search-icon" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Filtrar por nombre, cédula o teléfono..."
                  className="kova-input kova-search-input"
                />
              </div>

              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="kova-select"
                style={{ width: 'auto', minWidth: '150px' }}
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="por_vencer">Próximos a vencer</option>
                <option value="vencido">Vencidos</option>
              </select>
            </div>

            {filteredMembers.length === 0 ? (
              <p className="text-xs kova-text-muted" style={{ margin: 0 }}>
                No hay miembros registrados con ese filtro.
              </p>
            ) : (
              <div className="kova-table-wrap">
                <table className="kova-table">
                  <thead>
                    <tr>
                      <th>Miembro</th>
                      <th>Plan</th>
                      <th>Monto</th>
                      <th>Vence</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const st = getMemberStatus(m);
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="font-semibold">{m.full_name}</div>
                            <div className="text-xs kova-text-muted">
                              {m.cedula || 'Sin cédula'} · {m.phone || 'Sin teléfono'}
                            </div>
                          </td>
                          <td>{m.plan_name || 'Plan'}</td>
                          <td>
                            <div className="font-medium">{formatMoneyUsd(m.paid_usd)}</div>
                            <div className="text-xs kova-text-muted">
                              {formatMoneyBs(m.paid_usd, rate)}
                            </div>
                          </td>
                          <td>{formatDateShort(m.expires_at)}</td>
                          <td>
                            <span className={`kova-badge ${st.badgeClass}`}>{st.label}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleRenewMember(m)}
                                className="kova-btn kova-btn-success kova-btn-sm"
                              >
                                Renovar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleNotifyWhatsApp(m)}
                                className="kova-btn kova-btn-sm"
                                title="Notificar por WhatsApp"
                              >
                                <MessageSquare size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditMemberModal(m)}
                                className="kova-btn kova-btn-sm"
                                title="Editar miembro"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(m.id)}
                                className="kova-btn kova-btn-sm kova-text-rose"
                                title="Eliminar miembro"
                              >
                                Borrar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {activeTab === 'planes' && (
          <section className="kova-grid-2">
            <div className="kova-card">
              <h2 className="text-base font-semibold" style={{ margin: '0 0 10px' }}>
                Crear nuevo plan
              </h2>
              <form
                onSubmit={handleAddPlan}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div>
                  <label className="text-xs kova-text-muted">Nombre del plan</label>
                  <input
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Mensualidad Básica"
                    className="kova-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>

                <div className="kova-grid-2">
                  <div>
                    <label className="text-xs kova-text-muted">Precio en USD ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={planForm.price_usd}
                      onChange={(e) =>
                        setPlanForm((prev) => ({ ...prev, price_usd: e.target.value }))
                      }
                      placeholder="25"
                      className="kova-input"
                      style={{ marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs kova-text-muted">Duración (días)</label>
                    <input
                      type="number"
                      value={planForm.duration_days}
                      onChange={(e) =>
                        setPlanForm((prev) => ({ ...prev, duration_days: e.target.value }))
                      }
                      placeholder="30"
                      className="kova-input"
                      style={{ marginTop: '4px' }}
                    />
                  </div>
                </div>

                <button type="submit" className="kova-btn kova-btn-primary">
                  <Plus size={14} />
                  <span>Guardar Plan</span>
                </button>
              </form>
            </div>

            <div className="kova-card">
              <h2 className="text-base font-semibold" style={{ margin: '0 0 10px' }}>
                Planes disponibles ({plans.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="kova-card-subtle"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs kova-text-muted">
                        {formatMoneyUsd(p.price_usd)} · {formatMoneyBs(p.price_usd, rate)} ·{' '}
                        {p.duration_days || CYCLE_DAYS} días
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id)}
                      className="kova-btn kova-btn-sm kova-text-rose"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
                                 {activeTab === 'gastos' && (
          <section className="kova-grid-2">
            <div className="kova-card">
              <h2 className="text-base font-semibold" style={{ margin: '0 0 10px' }}>
                Registrar gasto
              </h2>
              <form
                onSubmit={handleAddExpense}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div>
                  <label className="text-xs kova-text-muted">Concepto</label>
                  <input
                    type="text"
                    value={expenseForm.title}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Ej. Pago de electricidad o limpieza"
                    className="kova-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>

                <div className="kova-grid-2">
                  <div>
                    <label className="text-xs kova-text-muted">Monto en USD ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={expenseForm.amount_usd}
                      onChange={(e) =>
                        setExpenseForm((prev) => ({ ...prev, amount_usd: e.target.value }))
                      }
                      placeholder="50"
                      className="kova-input"
                      style={{ marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs kova-text-muted">Fecha</label>
                    <input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) =>
                        setExpenseForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="kova-input"
                      style={{ marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs kova-text-muted">Categoría</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="kova-select"
                    style={{ marginTop: '4px' }}
                  >
                    <option value="Operativo">Operativo</option>
                    <option value="Equipos">Equipos</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Nómina">Nómina</option>
                  </select>
                </div>

                <button type="submit" className="kova-btn kova-btn-primary">
                  <Plus size={14} />
                  <span>Registrar Gasto</span>
                </button>
              </form>
            </div>

            <div className="kova-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <h2 className="text-base font-semibold" style={{ margin: 0 }}>
                  Gastos registrados
                </h2>
                <div className="text-right">
                  <div className="text-sm font-bold kova-text-rose">
                    {formatMoneyUsd(metrics.totalExpensesUsd)}
                  </div>
                  <div className="text-xs kova-text-muted">
                    {formatMoneyBs(metrics.totalExpensesUsd, rate)}
                  </div>
                </div>
              </div>

              {expenses.length === 0 ? (
                <p className="text-xs kova-text-muted" style={{ margin: 0 }}>
                  No hay gastos registrados todavía.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {expenses.map((item) => (
                    <div
                      key={item.id}
                      className="kova-card-subtle"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-xs kova-text-muted">
                          {item.category} · {formatDateShort(item.date)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {formatMoneyUsd(item.amount_usd)}
                          </div>
                          <div className="text-xs kova-text-muted">
                            {formatMoneyBs(item.amount_usd, rate)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(item.id)}
                          className="kova-btn kova-btn-sm kova-text-rose"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
                                  {activeTab === 'ajustes' && (
          <section className="kova-card" style={{ maxWidth: '640px' }}>
            <h2 className="text-base font-semibold" style={{ margin: '0 0 10px' }}>
              Ajustes del gimnasio
            </h2>
            <form
              onSubmit={handleSaveSettings}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label className="text-xs kova-text-muted">Nombre comercial</label>
                <input
                  type="text"
                  value={settingsForm.gym_name}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, gym_name: e.target.value }))
                  }
                  className="kova-input"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="text-xs kova-text-muted">
                  Días de aviso previo antes de vencer
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settingsForm.warning_days}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, warning_days: e.target.value }))
                  }
                  className="kova-input"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={settingsForm.auto_bcv}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, auto_bcv: e.target.checked }))
                  }
                />
                <span>Permitir sincronización rápida de tasa BCV</span>
              </label>

              <div>
                <button type="submit" className="kova-btn kova-btn-primary">
                  Guardar Ajustes
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      {memberModalOpen && (
        <div
          className="kova-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingMember ? 'Editar miembro' : 'Nuevo miembro'}
        >
          <div className="kova-modal-box">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <h2 className="text-base font-semibold" style={{ margin: 0 }}>
                {editingMember ? 'Editar miembro' : 'Registrar nuevo miembro'}
              </h2>
              <button
                type="button"
                onClick={() => setMemberModalOpen(false)}
                className="kova-btn kova-btn-sm"
                aria-label="Cerrar ventana"
              >
                Cerrar
              </button>
            </div>

            <form
              onSubmit={handleSaveMember}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div>
                <label className="text-xs kova-text-muted">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={memberForm.full_name}
                  onChange={(e) =>
                    setMemberForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  placeholder="Ej. Carlos Pérez"
                  className="kova-input"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div className="kova-grid-2">
                <div>
                  <label className="text-xs kova-text-muted">Cédula</label>
                  <input
                    type="text"
                    value={memberForm.cedula}
                    onChange={(e) =>
                      setMemberForm((prev) => ({ ...prev, cedula: e.target.value }))
                    }
                    placeholder="V-12345678"
                    className="kova-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label className="text-xs kova-text-muted">Teléfono (WhatsApp)</label>
                  <input
                    type="text"
                    value={memberForm.phone}
                    onChange={(e) =>
                      setMemberForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="04141234567"
                    className="kova-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs kova-text-muted">Plan</label>
                <select
                  value={memberForm.plan_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const planObj = plans.find((p) => String(p.id) === String(selectedId));
                    setMemberForm((prev) => ({
                      ...prev,
                      plan_id: selectedId,
                      paid_usd: planObj ? planObj.price_usd : prev.paid_usd,
                      duration_days: planObj
                        ? planObj.duration_days || CYCLE_DAYS
                        : prev.duration_days,
                    }));
                  }}
                  className="kova-select"
                  style={{ marginTop: '4px' }}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoneyUsd(p.price_usd)} ({p.duration_days || CYCLE_DAYS}d)
                    </option>
                  ))}
                </select>
              </div>

              <div className="kova-grid-2">
                <div>
                  <label className="text-xs kova-text-muted">Monto pagado (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={memberForm.paid_usd}
                    onChange={(e) =>
                      setMemberForm((prev) => ({ ...prev, paid_usd: e.target.value }))
                    }
                    className="kova-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label className="text-xs kova-text-muted">Fecha de inicio</label>
                  <input
                    type="date"
                    value={memberForm.start_date}
                    onChange={(e) =>
                      setMemberForm((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                    className="kova-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="kova-btn"
                >
                  Cancelar
                </button>
                <button type="submit" className="kova-btn kova-btn-primary">
                  {editingMember ? 'Guardar Cambios' : 'Registrar Miembro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="kova-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
                                    }
                    
