'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users,
  TrendingDown,
  Settings,
  Wallet,
  RefreshCw,
  Search,
  Check,
  X,
  Plus,
  Edit3,
  Layers,
  Home,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';

function KovaLogoMark({ size = 34 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Isotipo Kova Gym"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="kovaOceanGrad" x1="18" y1="20" x2="96" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="55%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="kovaGraphiteGrad" x1="48" y1="36" x2="102" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4B5563" />
          <stop offset="100%" stopColor="#272D36" />
        </linearGradient>
      </defs>
      {/* Trazo vertical y diagonal superior de la K */}
      <path
        d="M24 22H38V53L76 22H95L48 60L96 98H76L38 67V98H24V22Z"
        fill="url(#kovaOceanGrad)"
      />
      {/* Curva superior y brazo de la G */}
      <path
        d="M54 44C63 36 78 35 90 42C97 46 102 53 104 61H88C85 55 79 51 72 51C65 51 59 54 55 59L47 52C49 49 51 46 54 44Z"
        fill="url(#kovaGraphiteGrad)"
      />
      <path
        d="M64 64H104C104 82 90 96 72 96C62 96 54 92 48 85L59 75C62 79 67 82 72 82C81 82 88 76 89 68H64V64Z"
        fill="url(#kovaGraphiteGrad)"
      />
    </svg>
  );
        }
      export default function GymControlApp() {
  const [tab, setTab] = useState('inicio');
  const [theme, setTheme] = useState('dark');
  const [tasaBs, setTasaBs] = useState(45.5);
  const [tasaInput, setTasaInput] = useState('45.50');
  const [diasAviso, setDiasAviso] = useState(5);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [miembros, setMiembros] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [asistencias, setAsistencias] = useState([]);

  const [checkinQuery, setCheckinQuery] = useState('');
  const [checkinResultado, setCheckinResultado] = useState(null);
  const [busquedaMiembro, setBusquedaMiembro] = useState('');

  const [modalMiembro, setModalMiembro] = useState(false);
  const [nuevoMiembro, setNuevoMiembro] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    planId: '',
    fechaPago: new Date().toISOString().slice(0, 10),
  });

  const [nuevoPlan, setNuevoPlan] = useState({ nombre: '', precioUsd: '' });
  const [editPlanId, setEditPlanId] = useState(null);
  const [editPlanData, setEditPlanData] = useState({ nombre: '', precioUsd: '' });

  const [nuevoGasto, setNuevoGasto] = useState({
    concepto: '',
    categoria: 'Operación',
    montoUsd: '',
    fecha: new Date().toISOString().slice(0, 10),
  });

  const [infoSistema] = useState({
    marca: 'Kova Gym',
    desarrollador: 'Angel Perdomo',
    version: 'v1.0',
  });

  const isDark = theme === 'dark';

  const notificar = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const sumar30Dias = (fechaStr) => {
    const base = fechaStr ? new Date(`${fechaStr}T12:00:00`) : new Date();
    const vence = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    return vence.toISOString().slice(0, 10);
  };

  const diasRestantes = (fechaVenc) => {
    if (!fechaVenc) return -999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(`${fechaVenc.slice(0, 10)}T00:00:00`);
    return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
  };

  const fmtUsd = (val) => `$${Number(val || 0).toFixed(2)}`;
  const fmtBs = (usdVal) =>
    `Bs. ${(Number(usdVal || 0) * Number(tasaBs || 0)).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const aplicarTasa = (e) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(String(tasaInput).replace(',', '.'));
    if (!parsed || parsed <= 0) {
      notificar('Ingresa una tasa válida mayor a 0');
      return;
    }
    setTasaBs(parsed);
    setTasaInput(parsed.toFixed(2));
    notificar(`Tasa actualizada a Bs. ${parsed.toFixed(2)} / $`);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [mRes, pRes, gRes, aRes] = await Promise.all([
        supabase.from('miembros').select('*').order('created_at', { ascending: false }),
        supabase.from('planes').select('*').order('precio_usd', { ascending: true }),
        supabase.from('gastos').select('*').order('fecha', { ascending: false }),
        supabase.from('asistencias').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      const planesList = pRes.data || [];
      setPlanes(planesList);
      if (planesList.length > 0 && !nuevoMiembro.planId) {
        setNuevoMiembro((prev) => ({ ...prev, planId: planesList[0].id }));
      }

      setMiembros(
        (mRes.data || []).map((m) => ({
          id: m.id,
          nombre: m.nombre || '',
          cedula: m.cedula || '',
          telefono: m.telefono || '',
          planId: m.plan_id,
          planNombre: m.plan_nombre || 'Plan Mensual',
          montoUsd: Number(m.monto_usd || 0),
          ultimoPago: m.ultimo_pago || new Date().toISOString().slice(0, 10),
          venceEl: m.vence_el || sumar30Dias(m.ultimo_pago),
        }))
      );

      setGastos(
        (gRes.data || []).map((g) => ({
          id: g.id,
          concepto: g.concepto || '',
          categoria: g.categoria || 'Operación',
          montoUsd: Number(g.monto_usd || 0),
          fecha: g.fecha || new Date().toISOString().slice(0, 10),
        }))
      );

      setAsistencias(aRes.data || []);
    } catch (err) {
      notificar('Revisa la conexión o permisos RLS en Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);
        const buscarCheckin = (e) => {
    if (e) e.preventDefault();
    const q = checkinQuery.trim().toLowerCase();
    if (!q) {
      setCheckinResultado(null);
      return;
    }
    const encontrado = miembros.find(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        String(m.cedula || '').toLowerCase().includes(q) ||
        String(m.telefono || '').toLowerCase().includes(q)
    );
    if (!encontrado) {
      setCheckinResultado({ ok: false, mensaje: 'No se encontró ningún miembro con ese dato.' });
      return;
    }
    const dias = diasRestantes(encontrado.venceEl);
    if (dias < 0) {
      setCheckinResultado({
        ok: false,
        miembro: encontrado,
        dias,
        mensaje: `Membresía vencida hace ${Math.abs(dias)} día(s). Requiere renovación.`,
      });
    } else {
      setCheckinResultado({
        ok: true,
        miembro: encontrado,
        dias,
        mensaje: `Acceso permitido · ${dias === 0 ? 'Vence hoy' : `${dias} día(s) restantes`}.`,
      });
    }
  };

  const registrarAsistencia = async (miembro) => {
    if (!miembro) return;
    if (diasRestantes(miembro.venceEl) < 0) {
      notificar('No se puede registrar entrada: la membresía está vencida.');
      return;
    }
    const hoyStr = new Date().toISOString().slice(0, 10);
    const horaStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const nuevaEntrada = {
      id: Date.now(),
      miembro_id: miembro.id,
      nombre: miembro.nombre,
      fecha: hoyStr,
      hora: horaStr,
      created_at: new Date().toISOString(),
    };
    setAsistencias((prev) => [nuevaEntrada, ...prev.slice(0, 19)]);
    notificar(`Check-in registrado para ${miembro.nombre}`);
    try {
      await supabase.from('asistencias').insert([
        {
          miembro_id: miembro.id,
          nombre: miembro.nombre,
          fecha: hoyStr,
          hora: horaStr,
        },
      ]);
    } catch (_) {}
  };

  const crearMiembro = async (e) => {
    e.preventDefault();
    if (!nuevoMiembro.nombre.trim()) {
      notificar('Escribe el nombre del miembro');
      return;
    }
    const planSel = planes.find((p) => String(p.id) === String(nuevoMiembro.planId)) || planes[0];
    const fechaPago = nuevoMiembro.fechaPago || new Date().toISOString().slice(0, 10);
    const venceEl = sumar30Dias(fechaPago);
    const payload = {
      nombre: nuevoMiembro.nombre.trim(),
      cedula: nuevoMiembro.cedula.trim(),
      telefono: nuevoMiembro.telefono.trim(),
      plan_id: planSel ? planSel.id : null,
      plan_nombre: planSel ? planSel.nombre : 'Plan Mensual',
      monto_usd: planSel ? Number(planSel.precio_usd || 0) : 0,
      ultimo_pago: fechaPago,
      vence_el: venceEl,
    };

    try {
      const { data, error } = await supabase.from('miembros').insert([payload]).select().single();
      if (error) throw error;
      setMiembros((prev) => [
        {
          id: data.id,
          nombre: data.nombre,
          cedula: data.cedula || '',
          telefono: data.telefono || '',
          planId: data.plan_id,
          planNombre: data.plan_nombre,
          montoUsd: Number(data.monto_usd || 0),
          ultimoPago: data.ultimo_pago,
          venceEl: data.vence_el,
        },
        ...prev,
      ]);
      setModalMiembro(false);
      setNuevoMiembro({
        nombre: '',
        cedula: '',
        telefono: '',
        planId: planes[0]?.id || '',
        fechaPago: new Date().toISOString().slice(0, 10),
      });
      notificar(`${data.nombre} registrado · Ciclo de 30 días activo`);
    } catch (err) {
      notificar('Error al guardar miembro en Supabase');
    }
  };

  const renovarMiembro = async (miembro) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const base = diasRestantes(miembro.venceEl) >= 0 ? miembro.venceEl : hoy;
    const nuevaFechaVenc = sumar30Dias(base);
    try {
      const { error } = await supabase
        .from('miembros')
        .update({ ultimo_pago: hoy, vence_el: nuevaFechaVenc })
        .eq('id', miembro.id);
      if (error) throw error;
      setMiembros((prev) =>
        prev.map((m) =>
          m.id === miembro.id ? { ...m, ultimoPago: hoy, venceEl: nuevaFechaVenc } : m
        )
      );
      if (checkinResultado?.miembro?.id === miembro.id) {
        setCheckinResultado({
          ok: true,
          miembro: { ...miembro, ultimoPago: hoy, venceEl: nuevaFechaVenc },
          dias: diasRestantes(nuevaFechaVenc),
          mensaje: 'Membresía renovada por 30 días adicionales.',
        });
      }
      notificar(`Membresía renovada (+30 días) para ${miembro.nombre}`);
    } catch (err) {
      notificar('No se pudo renovar en Supabase');
    }
  };

  const abrirWhatsApp = (miembro) => {
    const tel = String(miembro.telefono || '').replace(/\D/g, '');
    const dias = diasRestantes(miembro.venceEl);
    const estadoTexto =
      dias < 0
        ? `venció hace ${Math.abs(dias)} día(s)`
        : dias === 0
        ? 'vence hoy'
        : `vence en ${dias} día(s) (${miembro.venceEl})`;
    const texto = encodeURIComponent(
      `Hola ${miembro.nombre}, te saludamos de *Kova Gym*. Te recordamos que tu membresía (${miembro.planNombre}) ${estadoTexto}. ¡Escríbenos o pasa por recepción para renovar!`
    );
    const url = tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const crearPlan = async (e) => {
    e.preventDefault();
    const precio = parseFloat(String(nuevoPlan.precioUsd).replace(',', '.'));
    if (!nuevoPlan.nombre.trim() || !precio || precio <= 0) {
      notificar('Completa nombre y precio en USD del plan');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('planes')
        .insert([{ nombre: nuevoPlan.nombre.trim(), precio_usd: precio, duracion_dias: 30 }])
        .select()
        .single();
      if (error) throw error;
      setPlanes((prev) => [...prev, data]);
      setNuevoPlan({ nombre: '', precioUsd: '' });
      notificar('Plan creado');
    } catch (err) {
      notificar('Error al crear plan');
    }
  };

  const guardarEdicionPlan = async (id) => {
    const precio = parseFloat(String(editPlanData.precioUsd).replace(',', '.'));
    if (!editPlanData.nombre.trim() || !precio || precio <= 0) return;
    try {
      const { error } = await supabase
        .from('planes')
        .update({ nombre: editPlanData.nombre.trim(), precio_usd: precio })
        .eq('id', id);
      if (error) throw error;
      setPlanes((prev) =>
        prev.map((p) => (p.id === id ? { ...p, nombre: editPlanData.nombre.trim(), precio_usd: precio } : p))
      );
      setEditPlanId(null);
      notificar('Plan actualizado');
    } catch (err) {
      notificar('Error al editar plan');
    }
  };

  const eliminarPlan = async (id) => {
    try {
      const { error } = await supabase.from('planes').delete().eq('id', id);
      if (error) throw error;
      setPlanes((prev) => prev.filter((p) => p.id !== id));
      notificar('Plan eliminado');
    } catch (err) {
      notificar('Error al eliminar plan');
    }
  };

  const crearGasto = async (e) => {
    e.preventDefault();
    const monto = parseFloat(String(nuevoGasto.montoUsd).replace(',', '.'));
    if (!nuevoGasto.concepto.trim() || !monto || monto <= 0) {
      notificar('Indica el concepto y monto en USD');
      return;
    }
    const payload = {
      concepto: nuevoGasto.concepto.trim(),
      categoria: nuevoGasto.categoria,
      monto_usd: monto,
      fecha: nuevoGasto.fecha || new Date().toISOString().slice(0, 10),
    };
    try {
      const { data, error } = await supabase.from('gastos').insert([payload]).select().single();
      if (error) throw error;
      setGastos((prev) => [
        {
          id: data.id,
          concepto: data.concepto,
          categoria: data.categoria,
          montoUsd: Number(data.monto_usd),
          fecha: data.fecha,
        },
        ...prev,
      ]);
      setNuevoGasto({
        concepto: '',
        categoria: 'Operación',
        montoUsd: '',
        fecha: new Date().toISOString().slice(0, 10),
      });
      notificar('Gasto registrado');
    } catch (err) {
      notificar('Error al guardar gasto');
    }
  };

  const activos = miembros.filter((m) => diasRestantes(m.venceEl) >= 0);
  const porVencer = miembros.filter((m) => {
    const d = diasRestantes(m.venceEl);
    return d >= 0 && d <= diasAviso;
  });
  const hoyStr = new Date().toISOString().slice(0, 10);
  const entradasHoy = asistencias.filter((a) => a.fecha === hoyStr).length;
  const ingresosMesUsd = activos.reduce((acc, m) => acc + Number(m.montoUsd || 0), 0);
  const gastosMesUsd = gastos.reduce((acc, g) => acc + Number(g.montoUsd || 0), 0);

  const bgMain = isDark ? 'bg-[#09131D] text-[#E6EDF5]' : 'bg-[#F4F7FA] text-[#0F1E2E]';
  const bgSurface = isDark ? 'bg-[#0E1C2A] border-[#1B2F44]' : 'bg-white border-[#D6E0EA]';
  const bgSubtle = isDark ? 'bg-[#132537] border-[#213952]' : 'bg-[#EEF3F8] border-[#D6E0EA]';
  const textMuted = isDark ? 'text-[#8FA4B8]' : 'text-[#5A6E82]';
        return (
    <div className={`min-h-screen ${bgMain} transition-colors duration-150`}>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-[4px] border border-sky-500/40 bg-[#0B2239] px-4 py-2.5 text-sm font-medium text-sky-100 shadow-lg">
          {toast}
        </div>
      )}

      {/* Encabezado superior y control único de tasa diaria */}
      <header className={`sticky top-0 z-30 border-b ${bgSurface}`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setTab('inicio')}
              className="flex items-center gap-2.5 text-left"
            >
              <KovaLogoMark size={34} />
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-wide">Kova Gym</div>
                <div className={`text-[11px] ${textMuted}`}>Control de Acceso y Cobros</div>
              </div>
            </button>

            <nav className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'inicio', label: 'Inicio', icon: Home },
                { id: 'miembros', label: 'Miembros', icon: Users },
                { id: 'planes', label: 'Planes', icon: Layers },
                { id: 'gastos', label: 'Gastos', icon: TrendingDown },
                { id: 'ajustes', label: 'Ajustes', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-sky-600 text-white'
                        : `${textMuted} hover:bg-sky-500/10 hover:text-current`
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={aplicarTasa} className={`flex items-center rounded-[4px] border px-2 py-1 ${bgSubtle}`}>
              <span className={`mr-1.5 text-[11px] font-medium ${textMuted}`}>Tasa Bs/$</span>
              <input
                type="text"
                value={tasaInput}
                onChange={(e) => setTasaInput(e.target.value)}
                className="w-16 bg-transparent text-xs font-semibold outline-none"
                aria-label="Tasa del día en bolívares"
              />
              <button
                type="submit"
                className="ml-1.5 rounded-[4px] bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-500"
              >
                Aplicar
              </button>
            </form>

            <button
              type="button"
              onClick={cargarDatos}
              className={`rounded-[4px] border p-1.5 ${bgSubtle} ${textMuted} hover:text-current`}
              title="Actualizar datos"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setModalMiembro(true)}
              className="flex items-center gap-1 rounded-[4px] bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nuevo Miembro</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {tab === 'inicio' && (
          <div className="space-y-5">
            {/* Check-in rápido */}
            <section className={`rounded-[4px] border p-4 ${bgSurface}`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Check-in de Recepción
                </h2>
                <span className={`text-xs ${textMuted}`}>Ciclo de 30 días desde el pago</span>
              </div>
              <form onSubmit={buscarCheckin} className="flex flex-col gap-2 sm:flex-row">
                <div className={`relative flex-1 rounded-[4px] border ${bgSubtle}`}>
                  <Search className={`absolute left-3 top-2.5 h-4 w-4 ${textMuted}`} />
                  <input
                    type="text"
                    value={checkinQuery}
                    onChange={(e) => setCheckinQuery(e.target.value)}
                    placeholder="Buscar por nombre, cédula o teléfono..."
                    className="w-full bg-transparent py-2 pl-9 pr-3 text-sm outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-[4px] bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  Verificar Acceso
                </button>
              </form>

              {checkinResultado && (
                <div
                  className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[4px] border p-3 text-xs ${
                    checkinResultado.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  <div>
                    <div className="font-semibold">
                      {checkinResultado.miembro ? checkinResultado.miembro.nombre : 'Sin coincidencia'}
                    </div>
                    <div>{checkinResultado.mensaje}</div>
                  </div>
                  {checkinResultado.miembro && (
                    <div className="flex items-center gap-2">
                      {checkinResultado.ok ? (
                        <button
                          type="button"
                          onClick={() => registrarAsistencia(checkinResultado.miembro)}
                          className="rounded-[4px] bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500"
                        >
                          Registrar Entrada
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => renovarMiembro(checkinResultado.miembro)}
                          className="rounded-[4px] bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-500"
                        >
                          Renovar (+30 días)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirWhatsApp(checkinResultado.miembro)}
                        className="flex items-center gap-1 rounded-[4px] border border-current/30 px-2.5 py-1.5 font-medium"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Métricas en USD y Bs */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`rounded-[4px] border p-4 ${bgSurface}`}>
                <div className={`text-xs ${textMuted}`}>Miembros Activos</div>
                <div className="mt-1 text-2xl font-bold">{activos.length}</div>
                <div className={`mt-1 text-xs ${textMuted}`}>Total registrados: {miembros.length}</div>
              </div>
              <div className={`rounded-[4px] border p-4 ${bgSurface}`}>
                <div className={`text-xs ${textMuted}`}>Próximos a Vencer ({diasAviso}d)</div>
                <div className="mt-1 text-2xl font-bold text-amber-400">{porVencer.length}</div>
                <div className={`mt-1 text-xs ${textMuted}`}>Aviso preventivo activo</div>
              </div>
              <div className={`rounded-[4px] border p-4 ${bgSurface}`}>
                <div className={`text-xs ${textMuted}`}>Entradas Hoy</div>
                <div className="mt-1 text-2xl font-bold text-sky-400">{entradasHoy}</div>
                <div className={`mt-1 text-xs ${textMuted}`}>Control de asistencia</div>
              </div>
              <div className={`rounded-[4px] border p-4 ${bgSurface}`}>
                <div className={`text-xs ${textMuted}`}>Ingresos Estimados (Activos)</div>
                <div className="mt-1 text-xl font-bold">{fmtUsd(ingresosMesUsd)}</div>
                <div className={`mt-0.5 text-xs ${textMuted}`}>{fmtBs(ingresosMesUsd)}</div>
              </div>
            </section>

            {/* Por vencer y actividad reciente */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={`rounded-[4px] border p-4 ${bgSurface}`}>
                <h3 className="mb-3 text-sm font-semibold">Próximos a vencer</h3>
                <div className="space-y-2">
                  {porVencer.length === 0 ? (
                    <p className={`text-xs ${textMuted}`}>No hay miembros por vencer en los próximos {diasAviso} días.</p>
                  ) : (
                    porVencer.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-[4px] border p-2.5 text-xs ${bgSubtle}`}
                      >
                        <div>
                          <div className="font-semibold">{m.nombre}</div>
                          <div className={textMuted}>
                            Vence: {m.venceEl} ({diasRestantes(m.venceEl)}d) · {fmtUsd(m.montoUsd)} / {fmtBs(m.montoUsd)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirWhatsApp(m)}
                            className="flex items-center gap-1 rounded-[4px] bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => renovarMiembro(m)}
                            className="rounded-[4px] bg-sky-600 px-2.5 py-1 font-semibold text-white hover:bg-sky-500"
                          >
                            Renovar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`rounded-[4px] border p-4 ${bgSurface}`}>
                <h3 className="mb-3 text-sm font-semibold">Asistencias recientes</h3>
                <div className="space-y-2">
                  {asistencias.length === 0 ? (
                    <p className={`text-xs ${textMuted}`}>Aún no hay entradas registradas hoy.</p>
                  ) : (
                    asistencias.slice(0, 8).map((a) => (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-[4px] border px-3 py-2 text-xs ${bgSubtle}`}
                      >
                        <span className="font-medium">{a.nombre}</span>
                        <span className={textMuted}>
                          {a.fecha} · {a.hora}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'miembros' && (
          <section className={`rounded-[4px] border p-4 ${bgSurface}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Miembros</h2>
              <div className={`relative w-full sm:w-72 rounded-[4px] border ${bgSubtle}`}>
                <Search className={`absolute left-2.5 top-2 h-4 w-4 ${textMuted}`} />
                <input
                  type="text"
                  value={busquedaMiembro}
                  onChange={(e) => setBusquedaMiembro(e.target.value)}
                  placeholder="Filtrar miembro..."
                  className="w-full bg-transparent py-1.5 pl-8 pr-3 text-xs outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${textMuted}`}>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Monto (USD / Bs)</th>
                    <th className="py-2 pr-3">Último Pago</th>
                    <th className="py-2 pr-3">Vence (30d)</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {miembros
                    .filter((m) =>
                      `${m.nombre} ${m.cedula} ${m.telefono}`
                        .toLowerCase()
                        .includes(busquedaMiembro.toLowerCase())
                    )
                    .map((m) => {
                      const d = diasRestantes(m.venceEl);
                      const vigente = d >= 0;
                      return (
                        <tr key={m.id} className={`border-b border-current/10`}>
                          <td className="py-2.5 pr-3 font-medium">{m.nombre}</td>
                          <td className="py-2.5 pr-3">{m.planNombre}</td>
                          <td className="py-2.5 pr-3">
                            <div>{fmtUsd(m.montoUsd)}</div>
                            <div className={textMuted}>{fmtBs(m.montoUsd)}</div>
                          </td>
                          <td className="py-2.5 pr-3">{m.ultimoPago}</td>
                          <td className="py-2.5 pr-3">{m.venceEl}</td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`rounded-[4px] px-2 py-0.5 font-semibold ${
                                vigente
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {vigente ? `Activo (${d}d)` : 'Vencido'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => abrirWhatsApp(m)}
                                className="rounded-[4px] bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-500"
                              >
                                WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => renovarMiembro(m)}
                                className="rounded-[4px] bg-sky-600 px-2 py-1 font-semibold text-white hover:bg-sky-500"
                              >
                                Renovar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
                  {tab === 'planes' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <form onSubmit={crearPlan} className={`rounded-[4px] border p-4 space-y-3 ${bgSurface}`}>
              <h2 className="text-sm font-semibold">Nuevo Plan (30 días)</h2>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Nombre del plan</label>
                <input
                  type="text"
                  value={nuevoPlan.nombre}
                  onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })}
                  placeholder="Ej. Mensualidad General"
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Precio en USD ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoPlan.precioUsd}
                  onChange={(e) => setNuevoPlan({ ...nuevoPlan, precioUsd: e.target.value })}
                  placeholder="25.00"
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-[4px] bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Guardar Plan
              </button>
            </form>

            <div className={`lg:col-span-2 rounded-[4px] border p-4 ${bgSurface}`}>
              <h2 className="mb-3 text-sm font-semibold">Planes configurados</h2>
              <div className="space-y-2">
                {planes.map((p) => (
                  <div
                    key={p.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-[4px] border p-3 text-xs ${bgSubtle}`}
                  >
                    {editPlanId === p.id ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editPlanData.nombre}
                          onChange={(e) => setEditPlanData({ ...editPlanData, nombre: e.target.value })}
                          className={`rounded-[4px] border px-2 py-1 ${bgSurface}`}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editPlanData.precioUsd}
                          onChange={(e) => setEditPlanData({ ...editPlanData, precioUsd: e.target.value })}
                          className={`w-24 rounded-[4px] border px-2 py-1 ${bgSurface}`}
                        />
                        <button
                          type="button"
                          onClick={() => guardarEdicionPlan(p.id)}
                          className="rounded-[4px] bg-emerald-600 px-2.5 py-1 font-semibold text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditPlanId(null)}
                          className="rounded-[4px] border px-2 py-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-semibold">{p.nombre}</div>
                          <div className={textMuted}>
                            {fmtUsd(p.precio_usd)} · {fmtBs(p.precio_usd)} · Ciclo de 30 días
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditPlanId(p.id);
                              setEditPlanData({ nombre: p.nombre, precioUsd: p.precio_usd });
                            }}
                            className="rounded-[4px] border px-2.5 py-1 font-medium hover:bg-sky-500/10"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarPlan(p.id)}
                            className="rounded-[4px] border border-rose-500/30 px-2.5 py-1 text-rose-400 hover:bg-rose-500/10"
                          >
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'gastos' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <form onSubmit={crearGasto} className={`rounded-[4px] border p-4 space-y-3 ${bgSurface}`}>
              <h2 className="text-sm font-semibold">Registrar Gasto</h2>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Concepto</label>
                <input
                  type="text"
                  value={nuevoGasto.concepto}
                  onChange={(e) => setNuevoGasto({ ...nuevoGasto, concepto: e.target.value })}
                  placeholder="Ej. Limpieza, mantenimiento..."
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Monto en USD ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoGasto.montoUsd}
                  onChange={(e) => setNuevoGasto({ ...nuevoGasto, montoUsd: e.target.value })}
                  placeholder="15.00"
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Fecha</label>
                <input
                  type="date"
                  value={nuevoGasto.fecha}
                  onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })}
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-[4px] bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Agregar Gasto
              </button>
            </form>

            <div className={`lg:col-span-2 rounded-[4px] border p-4 ${bgSurface}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Historial de Gastos</h2>
                <div className="text-xs font-semibold text-rose-400">
                  Total: {fmtUsd(gastosMesUsd)} ({fmtBs(gastosMesUsd)})
                </div>
              </div>
              <div className="space-y-2">
                {gastos.map((g) => (
                  <div
                    key={g.id}
                    className={`flex items-center justify-between rounded-[4px] border p-3 text-xs ${bgSubtle}`}
                  >
                    <div>
                      <div className="font-semibold">{g.concepto}</div>
                      <div className={textMuted}>
                        {g.fecha} · {g.categoria}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{fmtUsd(g.montoUsd)}</div>
                      <div className={textMuted}>{fmtBs(g.montoUsd)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'ajustes' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={`rounded-[4px] border p-4 space-y-4 ${bgSurface}`}>
              <h2 className="text-sm font-semibold">Preferencias del Sistema</h2>
              <div>
                <label className={`block text-xs mb-1.5 ${textMuted}`}>Apariencia</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${
                      theme === 'dark' ? 'bg-sky-600 text-white border-sky-600' : bgSubtle
                    }`}
                  >
                    Oscuro Océano
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${
                      theme === 'light' ? 'bg-sky-600 text-white border-sky-600' : bgSubtle
                    }`}
                  >
                    Claro
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>
                  Días de anticipación para aviso de vencimiento
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={diasAviso}
                  onChange={(e) => setDiasAviso(Number(e.target.value) || 5)}
                  className={`w-28 rounded-[4px] border px-3 py-1.5 text-xs outline-none ${bgSubtle}`}
                />
              </div>
            </section>

            <section className={`rounded-[4px] border p-4 space-y-3 ${bgSurface}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-400" />
                <h2 className="text-sm font-semibold">Estado y Datos del Sistema</h2>
              </div>
              <div className={`rounded-[4px] border p-3 text-xs space-y-1.5 ${bgSubtle}`}>
                <div>
                  <span className={textMuted}>Marca: </span>
                  <span className="font-semibold">{infoSistema.marca}</span>
                </div>
                <div>
                  <span className={textMuted}>Desarrollado por: </span>
                  <span className="font-semibold">{infoSistema.desarrollador}</span>
                </div>
                <div>
                  <span className={textMuted}>Versión: </span>
                  <span className="font-semibold">{infoSistema.version}</span>
                </div>
                <div>
                  <span className={textMuted}>Base de datos: </span>
                  <span className="font-semibold">Supabase (tablas: miembros, planes, gastos, asistencias)</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Modal Nuevo Miembro */}
      {modalMiembro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={crearMiembro} className={`w-full max-w-md rounded-[4px] border p-5 space-y-3 ${bgSurface}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Registrar Nuevo Miembro</h2>
              <button type="button" onClick={() => setModalMiembro(false)} className={textMuted}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className={`block text-xs mb-1 ${textMuted}`}>Nombre completo</label>
              <input
                type="text"
                value={nuevoMiembro.nombre}
                onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, nombre: e.target.value })}
                className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Cédula</label>
                <input
                  type="text"
                  value={nuevoMiembro.cedula}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, cedula: e.target.value })}
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Teléfono (WhatsApp)</label>
                <input
                  type="text"
                  value={nuevoMiembro.telefono}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, telefono: e.target.value })}
                  placeholder="58412..."
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Plan (30 días)</label>
                <select
                  value={nuevoMiembro.planId}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, planId: e.target.value })}
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                >
                  {planes.length === 0 ? (
                    <option value="">Plan Mensual</option>
                  ) : (
                    planes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({fmtUsd(p.precio_usd)})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${textMuted}`}>Fecha de pago</label>
                <input
                  type="date"
                  value={nuevoMiembro.fechaPago}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, fechaPago: e.target.value })}
                  className={`w-full rounded-[4px] border px-3 py-2 text-xs outline-none ${bgSubtle}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalMiembro(false)}
                className={`rounded-[4px] border px-3 py-1.5 text-xs ${bgSubtle}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-[4px] bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Guardar Miembro
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
                                  }
                    
