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
} from 'lucide-react';

export default function GymControlApp() {
  const [tab, setTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [sincronizandoTasa, setSincronizandoTasa] = useState(false);
  const [toast, setToast] = useState(null);

  const [config, setConfig] = useState({
    id: 1,
    nombre_gimnasio: 'GymControl Pro',
    tasa_bcv: null,
    actualizado_en: null,
  });
  const [inputTasa, setInputTasa] = useState('');
  const [editandoTasaRapida, setEditandoTasaRapida] = useState(false);

  const [planes, setPlanes] = useState([]);
  const [socios, setSocios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [gastos, setGastos] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [nuevoSocio, setNuevoSocio] = useState({
    cedula: '',
    nombre_completo: '',
    telefono: '',
    plan_id: '',
  });
  const [cobroModal, setCobroModal] = useState(null);
  const [datosCobro, setDatosCobro] = useState({
    plan_id: '',
    metodo_pago: 'Pago Móvil',
    referencia: '',
  });
  const [nuevoGasto, setNuevoGasto] = useState({
    concepto: '',
    monto_usd: '',
    metodo_pago: 'Efectivo USD',
  });
  const [editandoPlan, setEditandoPlan] = useState(null);

  function notificar(mensaje, tipo = 'ok') {
    setToast({ mensaje, tipo });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  }

  async function consultarTasaBCVAutomatica() {
    const endpoints = [
      {
        url: 'https://ve.dolarapi.com/v1/dolares/oficial',
        extraer: (d) => d?.promedio ?? d?.venta ?? d?.compra,
      },
      {
        url: 'https://pydolarve.org/api/v1/dollar?page=bcv',
        extraer: (d) => d?.monitors?.usd?.price ?? d?.price,
      },
    ];

    for (const fuente of endpoints) {
      try {
        const res = await fetch(fuente.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        const valor = parseFloat(fuente.extraer(data));
        if (valor && !Number.isNaN(valor) && valor > 10) {
          return Number(valor.toFixed(2));
        }
      } catch {}
    }
    return null;
      }
    async function sincronizarTasa(forzarGuardar = true) {
    setSincronizandoTasa(true);
    const tasaDetectada = await consultarTasaBCVAutomatica();
    setSincronizandoTasa(false);

    if (tasaDetectada) {
      setInputTasa(String(tasaDetectada));
      if (forzarGuardar) {
        const ahora = new Date().toISOString();
        const { error } = await supabase
          .from('configuracion')
          .upsert(
            {
              id: 1,
              nombre_gimnasio: config.nombre_gimnasio || 'GymControl Pro',
              tasa_bcv: tasaDetectada,
              actualizado_en: ahora,
            },
            { onConflict: 'id' }
          );

        if (!error) {
          setConfig((prev) => ({
            ...prev,
            tasa_bcv: tasaDetectada,
            actualizado_en: ahora,
          }));
          notificar(`Tasa BCV actualizada: ${tasaDetectada.toFixed(2)} Bs/$`);
          return;
        }
      }
      setConfig((prev) => ({ ...prev, tasa_bcv: tasaDetectada }));
      notificar(`Tasa BCV detectada: ${tasaDetectada.toFixed(2)} Bs/$`);
    } else {
      setEditandoTasaRapida(true);
      notificar(
        'No se pudo consultar la tasa automáticamente. Ingrésala manualmente.',
        'aviso'
      );
    }
  }

  async function cargarTodo() {
    setLoading(true);
    const [resConfig, resPlanes, resSocios, resPagos, resGastos] =
      await Promise.all([
        supabase.from('configuracion').select('*').eq('id', 1).maybeSingle(),
        supabase
          .from('planes')
          .select('*')
          .order('precio_usd', { ascending: false }),
        supabase
          .from('socios')
          .select('*, planes(nombre, precio_usd, duracion_dias)')
          .order('creado_en', { ascending: false }),
        supabase
          .from('pagos')
          .select('*, socios(nombre_completo), planes(nombre)')
          .order('fecha_pago', { ascending: false })
          .limit(50),
        supabase
          .from('gastos')
          .select('*')
          .order('fecha_gasto', { ascending: false })
          .limit(50),
      ]);

    let tasaActual = null;
    if (resConfig.data) {
      setConfig(resConfig.data);
      if (resConfig.data.tasa_bcv && Number(resConfig.data.tasa_bcv) > 0) {
        tasaActual = Number(resConfig.data.tasa_bcv);
        setInputTasa(String(tasaActual));
      }
    }

    if (resPlanes.data) {
      setPlanes(resPlanes.data);
      if (resPlanes.data.length > 0) {
        setNuevoSocio((prev) => ({
          ...prev,
          plan_id: prev.plan_id || resPlanes.data[0].id,
        }));
      }
    }
    if (resSocios.data) setSocios(resSocios.data);
    if (resPagos.data) setPagos(resPagos.data);
    if (resGastos.data) setGastos(resGastos.data);

    setLoading(false);

    const autoTasa = await consultarTasaBCVAutomatica();
    if (autoTasa) {
      setInputTasa(String(autoTasa));
      if (autoTasa !== tasaActual) {
        const ahora = new Date().toISOString();
        await supabase
          .from('configuracion')
          .upsert(
            {
              id: 1,
              nombre_gimnasio: resConfig.data?.nombre_gimnasio || 'GymControl Pro',
              tasa_bcv: autoTasa,
              actualizado_en: ahora,
            },
            { onConflict: 'id' }
          );
        setConfig((prev) => ({
          ...prev,
          tasa_bcv: autoTasa,
          actualizado_en: ahora,
        }));
      }
    } else if (!tasaActual) {
      setEditandoTasaRapida(true);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  const tasaActiva =
    config.tasa_bcv && Number(config.tasa_bcv) > 0
      ? Number(config.tasa_bcv)
      : parseFloat(inputTasa) || 0;

  function formatBs(montoUsd) {
    if (!tasaActiva) return 'Sin tasa';
    const total = Number(montoUsd || 0) * tasaActiva;
    return `${total.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Bs`;
  }

  function obtenerEstadoSemaforo(fechaVencimiento) {
    if (!fechaVencimiento) {
      return {
        label: 'Sin plan',
        color: '#f87171',
        bg: 'rgba(248, 113, 113, 0.12)',
        border: 'rgba(248, 113, 113, 0.28)',
        tipo: 'vencido',
      };
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(fechaVencimiento + 'T00:00:00');
    const diffDias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return {
        label: `Vencido hace ${Math.abs(diffDias)}d`,
        color: '#f87171',
        bg: 'rgba(248, 113, 113, 0.12)',
        border: 'rgba(248, 113, 113, 0.28)',
        tipo: 'vencido',
      };
    }
    if (diffDias <= 3) {
      return {
        label: diffDias === 0 ? 'Vence hoy' : `Vence en ${diffDias}d`,
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.12)',
        border: 'rgba(251, 191, 36, 0.28)',
        tipo: 'por_vencer',
      };
    }
    return {
      label: `Al día (${diffDias}d)`,
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.12)',
      border: 'rgba(52, 211, 153, 0.28)',
      tipo: 'activo',
    };
  }

  async function guardarTasaManual(e) {
    if (e) e.preventDefault();
    const valor = parseFloat(String(inputTasa).replace(',', '.'));
    if (!valor || Number.isNaN(valor) || valor <= 0) {
      notificar('Ingresa un valor de tasa válido', 'aviso');
      return;
    }
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from('configuracion')
      .upsert(
        {
          id: 1,
          nombre_gimnasio: config.nombre_gimnasio || 'GymControl Pro',
          tasa_bcv: valor,
          actualizado_en: ahora,
        },
        { onConflict: 'id' }
      );

    if (error) {
      notificar('Error al guardar la tasa: ' + error.message, 'aviso');
      return;
    }

    setConfig((prev) => ({ ...prev, tasa_bcv: valor, actualizado_en: ahora }));
    setInputTasa(String(valor));
    setEditandoTasaRapida(false);
    notificar(`Tasa guardada: ${valor.toFixed(2)} Bs/$`);
  }

  async function registrarSocio(e) {
    e.preventDefault();
    if (!nuevoSocio.cedula.trim() || !nuevoSocio.nombre_completo.trim()) {
      notificar('Cédula y nombre son obligatorios', 'aviso');
      return;
    }

    const planElegido = planes.find((p) => p.id === nuevoSocio.plan_id);
    const hoy = new Date();
    const vence = new Date();
    vence.setDate(hoy.getDate() + (planElegido ? planElegido.duracion_dias : 30));

    const { data: socioCreado, error } = await supabase
      .from('socios')
      .insert([
        {
          cedula: nuevoSocio.cedula.trim(),
          nombre_completo: nuevoSocio.nombre_completo.trim(),
          telefono: nuevoSocio.telefono.trim(),
          plan_id: nuevoSocio.plan_id || null,
          fecha_inicio: hoy.toISOString().split('T')[0],
          fecha_vencimiento: vence.toISOString().split('T')[0],
          estado: 'activo',
        },
      ])
      .select()
      .single();

    if (error) {
      notificar('Error al registrar: ' + error.message, 'aviso');
      return;
    }

    if (planElegido && socioCreado) {
      const montoUsd = Number(planElegido.precio_usd || 0);
      await supabase.from('pagos').insert([
        {
          socio_id: socioCreado.id,
          plan_id: planElegido.id,
          monto_usd: montoUsd,
          tasa_bcv_aplicada: tasaActiva || 0,
          monto_bs: Number((montoUsd * (tasaActiva || 0)).toFixed(2)),
          metodo_pago: 'Efectivo USD',
          referencia: 'Inscripción inicial',
        },
      ]);
    }

    setNuevoSocio({
      cedula: '',
      nombre_completo: '',
      telefono: '',
      plan_id: planes[0]?.id || '',
    });
    await cargarTodo();
    notificar('Socio registrado correctamente');
  }

  async function procesarCobro(e) {
    e.preventDefault();
    const plan = planes.find((p) => p.id === datosCobro.plan_id);
    if (!plan || !cobroModal) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencActual = cobroModal.fecha_vencimiento
      ? new Date(cobroModal.fecha_vencimiento + 'T00:00:00')
      : null;

    const baseFecha = vencActual && vencActual >= hoy ? vencActual : hoy;
    baseFecha.setDate(baseFecha.getDate() + Number(plan.duracion_dias || 30));
    const nuevaFechaVenc = baseFecha.toISOString().split('T')[0];

    const montoUsd = Number(plan.precio_usd || 0);

    await supabase.from('pagos').insert([
      {
        socio_id: cobroModal.id,
        plan_id: plan.id,
        monto_usd: montoUsd,
        tasa_bcv_aplicada: tasaActiva || 0,
        monto_bs: Number((montoUsd * (tasaActiva || 0)).toFixed(2)),
        metodo_pago: datosCobro.metodo_pago,
        referencia: datosCobro.referencia.trim(),
      },
    ]);

    await supabase
      .from('socios')
      .update({
        plan_id: plan.id,
        fecha_vencimiento: nuevaFechaVenc,
        estado: 'activo',
      })
      .eq('id', cobroModal.id);

    setCobroModal(null);
    setDatosCobro({ plan_id: '', metodo_pago: 'Pago Móvil', referencia: '' });
    await cargarTodo();
    notificar('Cobro registrado y plan renovado');
  }

  async function registrarGasto(e) {
    e.preventDefault();
    const usd = parseFloat(String(nuevoGasto.monto_usd).replace(',', '.'));
    if (!nuevoGasto.concepto.trim() || !usd || usd <= 0) {
      notificar('Indica el concepto y un monto válido', 'aviso');
      return;
    }

    await supabase.from('gastos').insert([
      {
        concepto: nuevoGasto.concepto.trim(),
        monto_usd: usd,
        tasa_bcv_aplicada: tasaActiva || 0,
        monto_bs: Number((usd * (tasaActiva || 0)).toFixed(2)),
        metodo_pago: nuevoGasto.metodo_pago,
      },
    ]);

    setNuevoGasto({ concepto: '', monto_usd: '', metodo_pago: 'Efectivo USD' });
    await cargarTodo();
    notificar('Gasto registrado');
  }

  async function guardarPlan(plan) {
    await supabase
      .from('planes')
      .update({
        nombre: plan.nombre.trim(),
        precio_usd: parseFloat(plan.precio_usd),
        duracion_dias: parseInt(plan.duracion_dias, 10),
      })
      .eq('id', plan.id);
    setEditandoPlan(null);
    await cargarTodo();
    notificar('Plan actualizado');
  }

  const sociosConEstado = socios.map((s) => ({
    ...s,
    sem: obtenerEstadoSemaforo(s.fecha_vencimiento),
  }));

  const sociosAlDia = sociosConEstado.filter((s) => s.sem.tipo !== 'vencido');
  const sociosVencidos = sociosConEstado.filter((s) => s.sem.tipo === 'vencido');
  const carteraActivaUsd = sociosAlDia.reduce(
    (acc, s) => acc + Number(s.planes?.precio_usd || 0),
    0
  );
  const totalCobradoUsd = pagos.reduce(
    (acc, p) => acc + Number(p.monto_usd || 0),
    0
  );
  const totalGastosUsd = gastos.reduce(
    (acc, g) => acc + Number(g.monto_usd || 0),
    0
  );
  const balanceCajaUsd = totalCobradoUsd - totalGastosUsd;

  const sociosFiltrados = sociosConEstado.filter((s) => {
    const coincideTexto =
      s.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      String(s.cedula).toLowerCase().includes(busqueda.toLowerCase());
    if (!coincideTexto) return false;
    if (filtroEstado === 'todos') return true;
    return s.sem.tipo === filtroEstado;
  });

  if (loading) {
    return (
      <div style={styles.pantallaCarga}>
        <div style={styles.spinnerDot} />
        <span style={{ color: '#9aa5b8', fontSize: 14 }}>
          Cargando panel...
        </span>
      </div>
    );
}
      return (
    <div style={styles.appShell}>
      {/* Aviso flotante limpio */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            borderColor:
              toast.tipo === 'aviso'
                ? 'rgba(251, 191, 36, 0.45)'
                : 'rgba(52, 211, 153, 0.45)',
            color: toast.tipo === 'aviso' ? '#fde68a' : '#a7f3d0',
          }}
        >
          {toast.mensaje}
        </div>
      )}

      {/* Encabezado superior con Tasa BCV */}
      <header style={styles.header}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.eyebrow}>GESTIÓN DE SERVICIOS</div>
          <h1 style={styles.brandTitle}>{config.nombre_gimnasio}</h1>
        </div>

        <div style={styles.tasaBox}>
          <div style={styles.tasaTopRow}>
            <span style={styles.tasaLabel}>TASA BCV</span>
            <button
              type="button"
              onClick={() => sincronizarTasa(true)}
              title="Actualizar tasa automáticamente"
              style={styles.iconBtn}
            >
              <RefreshCw
                size={13}
                style={{
                  animation: sincronizandoTasa
                    ? 'spin 1s linear infinite'
                    : 'none',
                }}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                setInputTasa(tasaActiva ? String(tasaActiva) : '');
                setEditandoTasaRapida((v) => !v);
              }}
              title="Editar tasa manualmente"
              style={styles.iconBtn}
            >
              <Edit3 size={13} />
            </button>
          </div>

          {editandoTasaRapida ? (
            <form onSubmit={guardarTasaManual} style={styles.tasaEditForm}>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 46.80"
                value={inputTasa}
                onChange={(e) => setInputTasa(e.target.value)}
                autoFocus
                style={styles.tasaMiniInput}
              />
              <button type="submit" style={styles.tasaSaveBtn} title="Guardar">
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditandoTasaRapida(false)}
                style={styles.tasaCancelBtn}
                title="Cancelar"
              >
                <X size={14} />
              </button>
            </form>
          ) : (
            <div
              onClick={() => {
                setInputTasa(tasaActiva ? String(tasaActiva) : '');
                setEditandoTasaRapida(true);
              }}
              style={styles.tasaValueRow}
            >
              {tasaActiva > 0 ? (
                <span style={styles.tasaValue}>
                  {tasaActiva.toFixed(2)}{' '}
                  <span style={styles.tasaUnit}>Bs/$</span>
                </span>
              ) : (
                <span style={styles.tasaMissing}>Definir tasa</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Banner de aviso si no hay tasa definida */}
      {!(tasaActiva > 0) && (
        <div style={styles.alertaTasa}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Tasa del día pendiente
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
              Sincroniza la tasa BCV o escríbela para calcular montos en
              bolívares.
            </div>
          </div>
          <button
            type="button"
            onClick={() => sincronizarTasa(true)}
            style={styles.btnSecundario}
          >
            Sincronizar
          </button>
        </div>
      )}

      {/* PESTAÑA 1: RESUMEN */}
      {tab === 'resumen' && (
        <div style={styles.stack}>
          <section style={styles.cardPrincipal}>
            <div style={styles.cardHeaderRow}>
              <span style={styles.cardLabel}>
                INGRESO PROYECTADO POR PLANES ACTIVOS
              </span>
              <span style={styles.pillNeutral}>
                {sociosAlDia.length} al día · {sociosVencidos.length} vencidos
              </span>
            </div>

            <div style={styles.bigNumberRow}>
              <span style={styles.bigUsd}>${carteraActivaUsd.toFixed(2)}</span>
              <span style={styles.subBs}>{formatBs(carteraActivaUsd)}</span>
            </div>

            <p style={styles.helperText}>
              Suma estimada de membresías activas en el ciclo actual (sin
              inventario).
            </p>
          </section>

          <section style={styles.grid2}>
            <div style={styles.card}>
              <span style={styles.cardLabel}>COBRADO EN CAJA</span>
              <div style={{ ...styles.metricUsd, color: '#34d399' }}>
                ${totalCobradoUsd.toFixed(2)}
              </div>
              <div style={styles.metricBs}>{formatBs(totalCobradoUsd)}</div>
            </div>

            <div style={styles.card}>
              <span style={styles.cardLabel}>GASTOS OPERATIVOS</span>
              <div style={{ ...styles.metricUsd, color: '#f87171' }}>
                -${totalGastosUsd.toFixed(2)}
              </div>
              <div style={styles.metricBs}>{formatBs(totalGastosUsd)}</div>
            </div>
          </section>

          <section style={styles.cardCompacto}>
            <span style={styles.cardLabel}>FLUJO NETO REGISTRADO</span>
            <div style={styles.netoRow}>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: balanceCajaUsd >= 0 ? '#e2e8f0' : '#f87171',
                }}
              >
                {balanceCajaUsd >= 0 ? '' : '-'}$
                {Math.abs(balanceCajaUsd).toFixed(2)}
              </span>
              <span style={styles.metricBs}>{formatBs(balanceCajaUsd)}</span>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <h2 style={styles.sectionTitle}>Últimos pagos</h2>
              <span style={styles.countBadge}>{pagos.length}</span>
            </div>

            {pagos.length === 0 ? (
              <div style={styles.emptyState}>
                Todavía no hay pagos registrados.
              </div>
            ) : (
              <div>
                {pagos.slice(0, 8).map((p, idx) => (
                  <div
                    key={p.id}
                    style={{
                      ...styles.listRow,
                      borderBottom:
                        idx === Math.min(pagos.length, 8) - 1
                          ? 'none'
                          : '1px solid #262f40',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.rowPrimary}>
                        {p.socios?.nombre_completo || 'Socio'}
                      </div>
                      <div style={styles.rowSecondary}>
                        {p.planes?.nombre ? `${p.planes.nombre} · ` : ''}
                        {p.metodo_pago}
                        {p.referencia ? ` · Ref ${p.referencia}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={styles.montoVerde}>
                        +${Number(p.monto_usd).toFixed(2)}
                      </div>
                      <div style={styles.rowSecondary}>
                        {Number(p.monto_bs || 0) > 0
                          ? `${Number(p.monto_bs).toLocaleString('es-VE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} Bs`
                          : formatBs(p.monto_usd)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* PESTAÑA 2: SOCIOS */}
      {tab === 'socios' && (
        <div style={styles.stack}>
          <form onSubmit={registrarSocio} style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <h2 style={styles.sectionTitle}>Registrar socio</h2>
              <Plus size={16} color="#94a3b8" />
            </div>

            <div style={styles.formGrid}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Cédula</label>
                <input
                  placeholder="Ej. 26450123"
                  value={nuevoSocio.cedula}
                  onChange={(e) =>
                    setNuevoSocio({ ...nuevoSocio, cedula: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Teléfono</label>
                <input
                  placeholder="Ej. 04120000000"
                  value={nuevoSocio.telefono}
                  onChange={(e) =>
                    setNuevoSocio({ ...nuevoSocio, telefono: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              <div style={{ ...styles.fieldGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Nombre y apellido</label>
                <input
                  placeholder="Nombre completo del socio"
                  value={nuevoSocio.nombre_completo}
                  onChange={(e) =>
                    setNuevoSocio({
                      ...nuevoSocio,
                      nombre_completo: e.target.value,
                    })
                  }
                  style={styles.input}
                />
              </div>

              <div style={{ ...styles.fieldGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Plan asignado</label>
                <select
                  value={nuevoSocio.plan_id}
                  onChange={(e) =>
                    setNuevoSocio({ ...nuevoSocio, plan_id: e.target.value })
                  }
                  style={styles.select}
                >
                  {planes.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.nombre} — ${Number(pl.precio_usd).toFixed(2)} (
                      {formatBs(pl.precio_usd)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" style={styles.btnPrimario}>
              Guardar y activar socio
            </button>
          </form>

          <section style={styles.card}>
            <div style={styles.searchBox}>
              <Search size={16} color="#7c879c" />
              <input
                placeholder="Buscar por nombre o cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.filterRow}>
              {[
                { id: 'todos', label: `Todos (${socios.length})` },
                {
                  id: 'activo',
                  label: `Al día (${
                    sociosConEstado.filter((s) => s.sem.tipo === 'activo').length
                  })`,
                },
                {
                  id: 'por_vencer',
                  label: `Por vencer (${
                    sociosConEstado.filter((s) => s.sem.tipo === 'por_vencer')
                      .length
                  })`,
                },
                {
                  id: 'vencido',
                  label: `Vencidos (${sociosVencidos.length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroEstado(f.id)}
                  style={{
                    ...styles.filterChip,
                    background:
                      filtroEstado === f.id ? '#273247' : 'transparent',
                    color: filtroEstado === f.id ? '#f1f5f9' : '#94a3b8',
                    borderColor:
                      filtroEstado === f.id ? '#3e4d68' : '#262f40',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {sociosFiltrados.length === 0 ? (
              <div style={styles.emptyState}>
                No hay socios que coincidan con el filtro.
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {sociosFiltrados.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      ...styles.socioRow,
                      borderBottom:
                        idx === sociosFiltrados.length - 1
                          ? 'none'
                          : '1px solid #262f40',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.rowPrimary}>{s.nombre_completo}</div>
                      <div style={styles.rowSecondary}>
                        CI {s.cedula} · {s.planes?.nombre || 'Sin plan'}
                        {s.fecha_vencimiento
                          ? ` · Vence ${s.fecha_vencimiento}`
                          : ''}
                      </div>
                      <span
                        style={{
                          ...styles.semBadge,
                          color: s.sem.color,
                          background: s.sem.bg,
                          borderColor: s.sem.border,
                        }}
                      >
                        {s.sem.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCobroModal(s);
                        setDatosCobro({
                          plan_id: s.plan_id || planes[0]?.id || '',
                          metodo_pago: 'Pago Móvil',
                          referencia: '',
                        });
                      }}
                      style={styles.btnCobrar}
                    >
                      Cobrar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* PESTAÑA 3: GASTOS */}
      {tab === 'gastos' && (
        <div style={styles.stack}>
          <form onSubmit={registrarGasto} style={styles.card}>
            <h2 style={styles.sectionTitle}>Registrar gasto operativo</h2>
            <div style={{ ...styles.formGrid, marginTop: 12 }}>
              <div style={{ ...styles.fieldGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Concepto</label>
                <input
                  placeholder="Ej. Botellones de agua, insumos de limpieza"
                  value={nuevoGasto.concepto}
                  onChange={(e) =>
                    setNuevoGasto({ ...nuevoGasto, concepto: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Monto (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={nuevoGasto.monto_usd}
                  onChange={(e) =>
                    setNuevoGasto({ ...nuevoGasto, monto_usd: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Método</label>
                <select
                  value={nuevoGasto.metodo_pago}
                  onChange={(e) =>
                    setNuevoGasto({
                      ...nuevoGasto,
                      metodo_pago: e.target.value,
                    })
                  }
                  style={styles.select}
                >
                  <option>Efectivo USD</option>
                  <option>Pago Móvil</option>
                  <option>Efectivo Bs</option>
                  <option>Transferencia</option>
                </select>
              </div>
            </div>

            <button type="submit" style={styles.btnGasto}>
              Guardar gasto
            </button>
          </form>

          <section style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <h2 style={styles.sectionTitle}>Historial de gastos</h2>
              <span style={styles.countBadge}>{gastos.length}</span>
            </div>

            {gastos.length === 0 ? (
              <div style={styles.emptyState}>
                No hay gastos operativos registrados.
              </div>
            ) : (
              <div>
                {gastos.map((g, idx) => (
                  <div
                    key={g.id}
                    style={{
                      ...styles.listRow,
                      borderBottom:
                        idx === gastos.length - 1
                          ? 'none'
                          : '1px solid #262f40',
                    }}
                  >
                    <div>
                      <div style={styles.rowPrimary}>{g.concepto}</div>
                      <div style={styles.rowSecondary}>
                        {g.metodo_pago}
                        {g.fecha_gasto
                          ? ` · ${String(g.fecha_gasto).slice(0, 10)}`
                          : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={styles.montoRojo}>
                        -${Number(g.monto_usd).toFixed(2)}
                      </div>
                      <div style={styles.rowSecondary}>
                        {Number(g.monto_bs || 0) > 0
                          ? `${Number(g.monto_bs).toLocaleString('es-VE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} Bs`
                          : formatBs(g.monto_usd)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* PESTAÑA 4: AJUSTES */}
      {tab === 'ajustes' && (
        <div style={styles.stack}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Tasa del día (BCV)</h2>
            <p style={{ ...styles.helperText, marginTop: 4, marginBottom: 12 }}>
              Se sincroniza automáticamente al abrir y puedes ajustarla cuando
              lo necesites.
            </p>
            <form onSubmit={guardarTasaManual} style={styles.inlineRow}>
              <input
                type="number"
                step="0.01"
                value={inputTasa}
                onChange={(e) => setInputTasa(e.target.value)}
                placeholder="Monto en Bs"
                style={{ ...styles.input, flex: 1 }}
              />
              <button type="submit" style={styles.btnPrimarioInline}>
                Guardar
              </button>
              <button
                type="button"
                onClick={() => sincronizarTasa(true)}
                style={styles.btnSecundario}
          >
                Auto
              </button>
            </form>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Planes y tarifas</h2>
            <div style={{ marginTop: 8 }}>
              {planes.map((pl, idx) => (
                <div
                  key={pl.id}
                  style={{
                    padding: '12px 0',
                    borderBottom:
                      idx === planes.length - 1 ? 'none' : '1px solid #262f40',
                  }}
                >
                  {editandoPlan?.id === pl.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input
                        value={editandoPlan.nombre}
                        onChange={(e) =>
                          setEditandoPlan({
                            ...editandoPlan,
                            nombre: e.target.value,
                          })
                        }
                        style={styles.input}
                      />
                      <div style={styles.formGrid}>
                        <input
                          type="number"
                          step="0.01"
                          value={editandoPlan.precio_usd}
                          onChange={(e) =>
                            setEditandoPlan({
                              ...editandoPlan,
                              precio_usd: e.target.value,
                            })
                          }
                          style={styles.input}
                        />
                        <input
                          type="number"
                          value={editandoPlan.duracion_dias}
                          onChange={(e) =>
                            setEditandoPlan({
                              ...editandoPlan,
                              duracion_dias: e.target.value,
                            })
                          }
                          style={styles.input}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => guardarPlan(editandoPlan)}
                          style={styles.btnPrimarioInline}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditandoPlan(null)}
                          style={styles.btnSecundario}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={styles.rowPrimary}>
                          {pl.nombre}{' '}
                          <span style={styles.rowSecondary}>
                            ({pl.duracion_dias} días)
                          </span>
                        </div>
                        <div style={styles.rowSecondary}>
                          ${Number(pl.precio_usd).toFixed(2)} ·{' '}
                          {formatBs(pl.precio_usd)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditandoPlan(pl)}
                        style={styles.btnSecundario}
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* MODAL DE COBRO / RENOVACIÓN */}
      {cobroModal && (
        <div style={styles.modalOverlay}>
          <form onSubmit={procesarCobro} style={styles.modalCard}>
            <div style={styles.sectionTitleRow}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Cobrar a {cobroModal.nombre_completo}
              </h3>
              <button
                type="button"
                onClick={() => setCobroModal(null)}
                style={styles.iconBtn}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Plan a aplicar</label>
                <select
                  value={datosCobro.plan_id}
                  onChange={(e) =>
                    setDatosCobro({ ...datosCobro, plan_id: e.target.value })
                  }
                  style={styles.select}
                >
                  {planes.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.nombre} — ${Number(pl.precio_usd).toFixed(2)} (
                      {formatBs(pl.precio_usd)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Método de pago</label>
                <select
                  value={datosCobro.metodo_pago}
                  onChange={(e) =>
                    setDatosCobro({
                      ...datosCobro,
                      metodo_pago: e.target.value,
                    })
                  }
                  style={styles.select}
                >
                  <option>Pago Móvil</option>
                  <option>Efectivo USD</option>
                  <option>Efectivo Bs</option>
                  <option>Punto de Venta</option>
                  <option>Zelle</option>
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Referencia (opcional)</label>
                <input
                  placeholder="Últimos dígitos o nota"
                  value={datosCobro.referencia}
                  onChange={(e) =>
                    setDatosCobro({ ...datosCobro, referencia: e.target.value })
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setCobroModal(null)}
                style={{ ...styles.btnSecundario, flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ ...styles.btnPrimarioInline, flex: 1 }}
              >
                Confirmar cobro
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BARRA INFERIOR */}
      <nav style={styles.bottomNav}>
        <button
          type="button"
          onClick={() => setTab('resumen')}
          style={navItemStyle(tab === 'resumen')}
        >
          <Wallet size={18} />
          <span>Resumen</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('socios')}
          style={navItemStyle(tab === 'socios')}
        >
          <Users size={18} />
          <span>Socios</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('gastos')}
          style={navItemStyle(tab === 'gastos')}
        >
          <TrendingDown size={18} />
          <span>Gastos</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('ajustes')}
          style={navItemStyle(tab === 'ajustes')}
        >
          <Settings size={18} />
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  );
                }
const navItemStyle = (active) => ({
  background: active ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
  border: 'none',
  borderRadius: 10,
  color: active ? '#93c5fd' : '#8b95a7',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  padding: '6px 14px',
  fontSize: 11,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
});

const styles = {
  appShell: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '16px 14px 92px',
    backgroundColor: '#12161f',
    color: '#e6ecf5',
    minHeight: '100vh',
  },
  pantallaCarga: {
    minHeight: '100vh',
    backgroundColor: '#12161f',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  spinnerDot: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#60a5fa',
  },
  toast: {
    position: 'fixed',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1e2636',
    border: '1px solid',
    padding: '9px 14px',
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 500,
    zIndex: 80,
    maxWidth: '92%',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#181e2b',
    border: '1px solid #262f40',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: '0.07em',
    color: '#7c879c',
    fontWeight: 600,
  },
  brandTitle: {
    margin: '2px 0 0',
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.01em',
  },
  tasaBox: {
    backgroundColor: '#1e2636',
    border: '1px solid #2c374c',
    borderRadius: 11,
    padding: '8px 11px',
    minWidth: 126,
  },
  tasaTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tasaLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#94a3b8',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    padding: 2,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  tasaValueRow: {
    marginTop: 3,
    cursor: 'pointer',
  },
  tasaValue: {
    fontSize: 15,
    fontWeight: 700,
    color: '#34d399',
    fontVariantNumeric: 'tabular-nums',
  },
  tasaUnit: {
    fontSize: 11,
    fontWeight: 500,
    color: '#94a3b8',
  },
  tasaMissing: {
    fontSize: 12,
    fontWeight: 600,
    color: '#fbbf24',
  },
  tasaEditForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  tasaMiniInput: {
    width: 72,
    padding: '4px 6px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #3c4b66',
    backgroundColor: '#12161f',
    color: '#f8fafc',
  },
  tasaSaveBtn: {
    backgroundColor: '#10b981',
    color: '#06281e',
    border: 'none',
    borderRadius: 6,
    padding: '4px 6px',
    cursor: 'pointer',
    display: 'inline-flex',
  },
  tasaCancelBtn: {
    backgroundColor: '#2c374c',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: 6,
    padding: '4px 6px',
    cursor: 'pointer',
    display: 'inline-flex',
  },
  alertaTasa: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    border: '1px solid rgba(251, 191, 36, 0.25)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 12,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardPrincipal: {
    backgroundColor: '#192130',
    border: '1px solid #2b374d',
    borderRadius: 14,
    padding: 18,
  },
  card: {
    backgroundColor: '#181e2b',
    border: '1px solid #262f40',
    borderRadius: 14,
    padding: 16,
  },
  cardCompacto: {
    backgroundColor: '#181e2b',
    border: '1px solid #262f40',
    borderRadius: 14,
    padding: '13px 16px',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: '#8b95a7',
  },
  pillNeutral: {
    fontSize: 11.5,
    color: '#cbd5e1',
    backgroundColor: '#232c3e',
    border: '1px solid #303c54',
    padding: '3px 9px',
    borderRadius: 999,
  },
  bigNumberRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  bigUsd: {
    fontSize: 32,
    fontWeight: 800,
    color: '#f8fafc',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
  subBs: {
    fontSize: 15,
    fontWeight: 600,
    color: '#93c5fd',
    fontVariantNumeric: 'tabular-nums',
  },
  helperText: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#7c879c',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  metricUsd: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 6,
    fontVariantNumeric: 'tabular-nums',
  },
  metricBs: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  netoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 6,
  },
  sectionTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  countBadge: {
    fontSize: 11.5,
    color: '#94a3b8',
    backgroundColor: '#222b3d',
    padding: '2px 8px',
    borderRadius: 999,
    fontVariantNumeric: 'tabular-nums',
  },
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '11px 0',
  },
  socioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
  },
  rowPrimary: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e6ecf5',
  },
  rowSecondary: {
    fontSize: 12,
    color: '#8b95a7',
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  montoVerde: {
    fontSize: 14,
    fontWeight: 700,
    color: '#34d399',
    fontVariantNumeric: 'tabular-nums',
  },
  montoRojo: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f87171',
    fontVariantNumeric: 'tabular-nums',
  },
  semBadge: {
    display: 'inline-block',
    marginTop: 6,
    padding: '2px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#9aa5b8',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #2b3548',
    backgroundColor: '#12161f',
    color: '#f1f5f9',
    fontSize: 13.5,
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #2b3548',
    backgroundColor: '#12161f',
    color: '#f1f5f9',
    fontSize: 13.5,
    boxSizing: 'border-box',
    outline: 'none',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#12161f',
    border: '1px solid #2b3548',
    borderRadius: 10,
    padding: '0 12px',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#f1f5f9',
    padding: '10px 0',
    fontSize: 13.5,
    outline: 'none',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  filterChip: {
    fontSize: 11.5,
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: 8,
    border: '1px solid',
    cursor: 'pointer',
  },
  btnPrimario: {
    width: '100%',
    marginTop: 12,
    backgroundColor: '#2563eb',
    color: '#f8fafc',
    border: 'none',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimarioInline: {
    backgroundColor: '#2563eb',
    color: '#f8fafc',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecundario: {
    backgroundColor: '#232c3e',
    color: '#e2e8f0',
    border: '1px solid #33415c',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnCobrar: {
    backgroundColor: '#1f2d46',
    color: '#93c5fd',
    border: '1px solid #31476e',
    borderRadius: 9,
    padding: '8px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  btnGasto: {
    width: '100%',
    marginTop: 12,
    backgroundColor: '#991b1b',
    color: '#fef2f2',
    border: '1px solid #b91c1c',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  inlineRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  emptyState: {
    padding: '22px 10px',
    textAlign: 'center',
    color: '#7c879c',
    fontSize: 13,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(8, 11, 18, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 70,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#181e2b',
    border: '1px solid #2b374d',
    borderRadius: 14,
    padding: 18,
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161b26',
    borderTop: '1px solid #262f40',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 8px 10px',
    zIndex: 40,
  },
};
                    
