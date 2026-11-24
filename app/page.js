'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingDown, Settings, Wallet } from 'lucide-react';

export default function GymControlApp() {
  const [tab, setTab] = useState('resumen');
  const [loading, setLoading] = useState(true);

  // Datos desde Supabase
  const [config, setConfig] = useState({ nombre_gimnasio: 'GymControl Pro', tasa_bcv: 50 });
  const [nuevaTasa, setNuevaTasa] = useState('');
  const [planes, setPlanes] = useState([]);
  const [socios, setSocios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [gastos, setGastos] = useState([]);

  // Formularios rápidos
  const [busqueda, setBusqueda] = useState('');
  const [nuevoSocio, setNuevoSocio] = useState({ cedula: '', nombre_completo: '', telefono: '', plan_id: '' });
  const [cobroModal, setCobroModal] = useState(null);
  const [datosCobro, setDatosCobro] = useState({ plan_id: '', metodo_pago: 'Pago Móvil', referencia: '' });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto_usd: '', metodo_pago: 'Efectivo USD' });
  const [editandoPlan, setEditandoPlan] = useState(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setLoading(true);
    const [resConfig, resPlanes, resSocios, resPagos, resGastos] = await Promise.all([
      supabase.from('configuracion').select('*').eq('id', 1).single(),
      supabase.from('planes').select('*').order('precio_usd', { ascending: false }),
      supabase.from('socios').select('*, planes(nombre, precio_usd, duracion_dias)').order('creado_en', { ascending: false }),
      supabase.from('pagos').select('*, socios(nombre_completo), planes(nombre)').order('fecha_pago', { ascending: false }).limit(50),
      supabase.from('gastos').select('*').order('fecha_gasto', { ascending: false }).limit(50),
    ]);

    if (resConfig.data) {
      setConfig(resConfig.data);
      setNuevaTasa(resConfig.data.tasa_bcv);
    }
    if (resPlanes.data) {
      setPlanes(resPlanes.data);
      if (resPlanes.data.length > 0) {
        setNuevoSocio((prev) => ({ ...prev, plan_id: resPlanes.data[0].id }));
      }
    }
    if (resSocios.data) setSocios(resSocios.data);
    if (resPagos.data) setPagos(resPagos.data);
    if (resGastos.data) setGastos(resGastos.data);
    setLoading(false);
  }

  // Cálculo del Semáforo de cada socio
  function obtenerEstadoSemaforo(fechaVencimiento) {
    if (!fechaVencimiento) return { label: 'Sin plan', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', tipo: 'vencido' };
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(fechaVencimiento + 'T00:00:00');
    const diffDias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) return { label: `Vencido (${Math.abs(diffDias)}d)`, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', tipo: 'vencido' };
    if (diffDias <= 3) return { label: `Vence en ${diffDias}d`, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', tipo: 'por_vencer' };
    return { label: `Activo (${diffDias}d)`, color: '#10b981', bg: 'rgba(16,185,129,0.15)', tipo: 'activo' };
  }

  // Actualizar Tasa BCV
  async function guardarTasa() {
    const valor = parseFloat(nuevaTasa);
    if (!valor || valor <= 0) return alert('Ingresa una tasa válida');
    await supabase.from('configuracion').update({ tasa_bcv: valor, actualizado_en: new Date() }).eq('id', 1);
    setConfig({ ...config, tasa_bcv: valor });
    alert('Tasa BCV actualizada');
  }

  // Registrar nuevo socio + primer pago opcional
  async function registrarSocio(e) {
    e.preventDefault();
    if (!nuevoSocio.cedula || !nuevoSocio.nombre_completo) return alert('Cédula y nombre son obligatorios');
    const planElegido = planes.find((p) => p.id === nuevoSocio.plan_id);
    const hoy = new Date();
    const vence = new Date();
    vence.setDate(hoy.getDate() + (planElegido ? planElegido.duracion_dias : 30));

    const { data: socioCreado, error } = await supabase
      .from('socios')
      .insert([{
        cedula: nuevoSocio.cedula.trim(),
        nombre_completo: nuevoSocio.nombre_completo.trim(),
        telefono: nuevoSocio.telefono.trim(),
        plan_id: nuevoSocio.plan_id || null,
        fecha_inicio: hoy.toISOString().split('T')[0],
        fecha_vencimiento: vence.toISOString().split('T')[0],
        estado: 'activo',
      }])
      .select()
      .single();

    if (error) return alert('Error: ' + error.message);

    if (planElegido && socioCreado) {
      await supabase.from('pagos').insert([{
        socio_id: socioCreado.id,
        plan_id: planElegido.id,
        monto_usd: planElegido.precio_usd,
        tasa_bcv_aplicada: config.tasa_bcv,
        monto_bs: (planElegido.precio_usd * config.tasa_bcv).toFixed(2),
        metodo_pago: 'Efectivo USD',
        referencia: 'Inscripción inicial',
      }]);
    }

    setNuevoSocio({ cedula: '', nombre_completo: '', telefono: '', plan_id: planes[0]?.id || '' });
    cargarTodo();
    alert('Socio inscrito y activado');
  }

  // Renovar / Cobrar a un socio existente
  async function procesarCobro(e) {
    e.preventDefault();
    const plan = planes.find((p) => p.id === datosCobro.plan_id);
    if (!plan || !cobroModal) return;

    const baseFecha = cobroModal.fecha_vencimiento && new Date(cobroModal.fecha_vencimiento) > new Date()
      ? new Date(cobroModal.fecha_vencimiento + 'T00:00:00')
      : new Date();
    baseFecha.setDate(baseFecha.getDate() + plan.duracion_dias);
    const nuevaFechaVenc = baseFecha.toISOString().split('T')[0];

    await supabase.from('pagos').insert([{
      socio_id: cobroModal.id,
      plan_id: plan.id,
      monto_usd: plan.precio_usd,
      tasa_bcv_aplicada: config.tasa_bcv,
      monto_bs: (plan.precio_usd * config.tasa_bcv).toFixed(2),
      metodo_pago: datosCobro.metodo_pago,
      referencia: datosCobro.referencia,
    }]);

    await supabase.from('socios').update({
      plan_id: plan.id,
      fecha_vencimiento: nuevaFechaVenc,
      estado: 'activo',
    }).eq('id', cobroModal.id);

    setCobroModal(null);
    setDatosCobro({ plan_id: '', metodo_pago: 'Pago Móvil', referencia: '' });
    cargarTodo();
    alert('Pago registrado y membresía renovada');
  }

  // Registrar gasto operativo
  async function registrarGasto(e) {
    e.preventDefault();
    const usd = parseFloat(nuevoGasto.monto_usd);
    if (!nuevoGasto.concepto || !usd) return alert('Completa el concepto y el monto');

    await supabase.from('gastos').insert([{
      concepto: nuevoGasto.concepto,
      monto_usd: usd,
      tasa_bcv_aplicada: config.tasa_bcv,
      monto_bs: (usd * config.tasa_bcv).toFixed(2),
      metodo_pago: nuevoGasto.metodo_pago,
    }]);

    setNuevoGasto({ concepto: '', monto_usd: '', metodo_pago: 'Efectivo USD' });
    cargarTodo();
  }

  // Editar precio de plan
  async function guardarPlan(plan) {
    await supabase.from('planes').update({
      nombre: plan.nombre,
      precio_usd: parseFloat(plan.precio_usd),
      duracion_dias: parseInt(plan.duracion_dias),
    }).eq('id', plan.id);
    setEditandoPlan(null);
    cargarTodo();
  }

  // Métricas financieras clave
  const sociosActivos = socios.filter((s) => obtenerEstadoSemaforo(s.fecha_vencimiento).tipo !== 'vencido');
  const ingresoMensualPlanes = sociosActivos.reduce((acc, s) => acc + Number(s.planes?.precio_usd || 0), 0);
  const totalCobradoHistorial = pagos.reduce((acc, p) => acc + Number(p.monto_usd || 0), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto_usd || 0), 0);

  const sociosFiltrados = socios.filter(
    (s) =>
      s.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.cedula.includes(busqueda)
  );

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando GymControl Pro...</div>;
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 90px' }}>
      {/* Encabezado + Tasa BCV */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: 16, borderRadius: 14, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#38bdf8' }}>{config.nombre_gimnasio}</h1>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Panel Operativo</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>TASA BCV</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{config.tasa_bcv} Bs/$</div>
        </div>
      </header>

      {/* PESTAÑA 1: RESUMEN / TERMÓMETRO FINANCIERO */}
      {tab === 'resumen' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg, #0284c7, #1e3a8a)', padding: 20, borderRadius: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Cartera Activa ({sociosActivos.length} socios al día)</div>
            <div style={{ fontSize: 34, fontWeight: 800, margin: '4px 0' }}>${ingresoMensualPlanes.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 400 }}>/ ciclo</span></div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Equivalente: {(ingresoMensualPlanes * config.tasa_bcv).toLocaleString('es-VE')} Bs</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 14 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Cobros Registrados</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981', marginTop: 4 }}>${totalCobradoHistorial.toFixed(2)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 14 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Gastos Operativos</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f87171', marginTop: 4 }}>-${totalGastos.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 16, borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Últimos Pagos Recibidos</h3>
            {pagos.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>Aún no hay pagos registrados.</p>}
            {pagos.slice(0, 8).map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #334155', fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.socios?.nombre_completo || 'Socio'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.metodo_pago} {p.referencia ? `• Ref: ${p.referencia}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>${Number(p.monto_usd).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{Number(p.monto_bs).toLocaleString('es-VE')} Bs</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: SOCIOS Y SEMÁFORO */}
      {tab === 'socios' && (
        <div>
          <form onSubmit={registrarSocio} style={{ background: '#1e293b', padding: 16, borderRadius: 14, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Inscribir Nuevo Socio</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <input placeholder="Cédula (ej. 28123456)" value={nuevoSocio.cedula} onChange={(e) => setNuevoSocio({ ...nuevoSocio, cedula: e.target.value })} style={inputStyle} />
              <input placeholder="Nombre y Apellido" value={nuevoSocio.nombre_completo} onChange={(e) => setNuevoSocio({ ...nuevoSocio, nombre_completo: e.target.value })} style={inputStyle} />
              <input placeholder="WhatsApp (ej. 04141234567)" value={nuevoSocio.telefono} onChange={(e) => setNuevoSocio({ ...nuevoSocio, telefono: e.target.value })} style={inputStyle} />
              <select value={nuevoSocio.plan_id} onChange={(e) => setNuevoSocio({ ...nuevoSocio, plan_id: e.target.value })} style={inputStyle}>
                {planes.map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.nombre} — ${pl.precio_usd} ({(pl.precio_usd * config.tasa_bcv).toFixed(0)} Bs)</option>
                ))}
              </select>
              <button type="submit" style={btnPrimary}>+ Inscribir y Activar Plan</button>
            </div>
          </form>

          <input placeholder="Buscar socio por nombre o cédula..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

          <div style={{ display: 'grid', gap: 10 }}>
            {sociosFiltrados.map((s) => {
              const sem = obtenerEstadoSemaforo(s.fecha_vencimiento);
              return (
                <div key={s.id} style={{ background: '#1e293b', padding: 14, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.nombre_completo}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>CI: {s.cedula} • {s.planes?.nombre || 'Sin plan'}</div>
                    <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: sem.color, background: sem.bg }}>
                      {sem.label}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCobroModal(s);
                      setDatosCobro({ plan_id: s.plan_id || planes[0]?.id || '', metodo_pago: 'Pago Móvil', referencia: '' });
                    }}
                    style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 700, fontSize: 12 }}
                  >
                    Renovar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE RENOVACIÓN / COBRO */}
      {cobroModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <form onSubmit={procesarCobro} style={{ background: '#1e293b', padding: 20, borderRadius: 16, width: '100%', maxWidth: 400, display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Cobrar a {cobroModal.nombre_completo}</h3>
            <select value={datosCobro.plan_id} onChange={(e) => setDatosCobro({ ...datosCobro, plan_id: e.target.value })} style={inputStyle}>
              {planes.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.nombre} — ${pl.precio_usd} ({(pl.precio_usd * config.tasa_bcv).toFixed(2)} Bs)</option>
              ))}
            </select>
            <select value={datosCobro.metodo_pago} onChange={(e) => setDatosCobro({ ...datosCobro, metodo_pago: e.target.value })} style={inputStyle}>
              <option>Pago Móvil</option>
              <option>Efectivo USD</option>
              <option>Efectivo Bs</option>
              <option>Punto de Venta</option>
              <option>Zelle</option>
            </select>
            <input placeholder="Referencia (opcional)" value={datosCobro.referencia} onChange={(e) => setDatosCobro({ ...datosCobro, referencia: e.target.value })} style={inputStyle} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setCobroModal(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff' }}>Cancelar</button>
              <button type="submit" style={{ ...btnPrimary, flex: 1 }}>Confirmar Pago</button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 3: GASTOS OPERATIVOS */}
      {tab === 'gastos' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <form onSubmit={registrarGasto} style={{ background: '#1e293b', padding: 16, borderRadius: 14, display: 'grid', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Reportar Gasto del Gimnasio</h3>
            <input placeholder="Concepto (ej. 3 botellones de agua, cloro)" value={nuevoGasto.concepto} onChange={(e) => setNuevoGasto({ ...nuevoGasto, concepto: e.target.value })} style={inputStyle} />
            <input type="number" step="0.01" placeholder="Monto en USD (ej. 5.00)" value={nuevoGasto.monto_usd} onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto_usd: e.target.value })} style={inputStyle} />
            <select value={nuevoGasto.metodo_pago} onChange={(e) => setNuevoGasto({ ...nuevoGasto, metodo_pago: e.target.value })} style={inputStyle}>
              <option>Efectivo USD</option>
              <option>Pago Móvil</option>
              <option>Efectivo Bs</option>
            </select>
            <button type="submit" style={{ ...btnPrimary, background: '#ef4444' }}>Registrar Gasto</button>
          </form>

          <div style={{ background: '#1e293b', padding: 16, borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Historial de Gastos</h3>
            {gastos.map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #334155', fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{g.concepto}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{g.metodo_pago}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#f87171' }}>-${Number(g.monto_usd).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{Number(g.monto_bs).toLocaleString('es-VE')} Bs</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: AJUSTES (TASA Y PRECIOS DE PLANES) */}
      {tab === 'ajustes' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Actualizar Tasa del Día (Bs/$)</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="number" step="0.01" value={nuevaTasa} onChange={(e) => setNuevaTasa(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={guardarTasa} style={btnPrimary}>Guardar Tasa</button>
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 16, borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Editar Precios de Planes</h3>
            {planes.map((pl) => (
              <div key={pl.id} style={{ padding: '12px 0', borderBottom: '1px solid #334155' }}>
                {editandoPlan?.id === pl.id ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input value={editandoPlan.nombre} onChange={(e) => setEditandoPlan({ ...editandoPlan, nombre: e.target.value })} style={inputStyle} />
                    <input type="number" step="0.01" value={editandoPlan.precio_usd} onChange={(e) => setEditandoPlan({ ...editandoPlan, precio_usd: e.target.value })} style={inputStyle} />
                    <button onClick={() => guardarPlan(editandoPlan)} style={btnPrimary}>Guardar Cambios</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{pl.nombre} ({pl.duracion_dias} días)</div>
                      <div style={{ fontSize: 13, color: '#10b981' }}>${Number(pl.precio_usd).toFixed(2)} • {(pl.precio_usd * config.tasa_bcv).toFixed(2)} Bs</div>
                    </div>
                    <button onClick={() => setEditandoPlan(pl)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Editar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-around', padding: '10px 0' }}>
        <button onClick={() => setTab('resumen')} style={navBtn(tab === 'resumen')}><Wallet size={20} /><span>Resumen</span></button>
        <button onClick={() => setTab('socios')} style={navBtn(tab === 'socios')}><Users size={20} /><span>Socios</span></button>
        <button onClick={() => setTab('gastos')} style={navBtn(tab === 'gastos')}><TrendingDown size={20} /><span>Gastos</span></button>
        <button onClick={() => setTab('ajustes')} style={navBtn(tab === 'ajustes')}><Settings size={20} /><span>Ajustes</span></button>
      </nav>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14, boxSizing: 'border-box' };
const btnPrimary = { background: '#10b981', color: '#0f172a', border: 'none', padding: '12px 16px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' };
const navBtn = (active) => ({ background: 'none', border: 'none', color: active ? '#38bdf8' : '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: active ? 700 : 400 });
