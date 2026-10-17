"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [torneos, setTorneos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroRitmo, setFiltroRitmo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);

  // Estados para Editar Torneo
  const [torneoAEditar, setTorneoAEditar] = useState(null);

  // Estados para el CSV de jugadores y selector "¿Quién eres?"
  const [listaJugadoresCSV, setListaJugadoresCSV] = useState([]);
  const [mostrarSelectorJugador, setMostrarSelectorJugador] = useState(false);
  const [busquedaJugadorCSV, setBusquedaJugadorCSV] = useState("");

  const [inscritosPorTorneo, setInscritosPorTorneo] = useState({});
  const [torneoExpandido, setTorneoExpandido] = useState(null);

  const [nuevoTorneo, setNuevoTorneo] = useState({
    nombre: "",
    provincia: "",
    fecha_inicio: "",
    ritmo: "Clásico",
    control_tiempo: "90m + 30s",
    cupo: 100,
    cuota: "20€",
    url_origen: ""
  });

  const [jugador, setJugador] = useState({
    nombre: "Selecciona tu jugador",
    fideId: "000000",
    email: "jugador@ajedrez.es",
    eloPortugalujo: 1500,
  });

  const [misInscripciones, setMisInscripciones] = useState([]);

  // 1. Al arrancar: Cargar jugador guardado y leer el archivo /jugadores.csv
  useEffect(() => {
    cargarCSVJugadores();

    const guardado = localStorage.getItem("chess_plus_jugador");
    if (guardado) {
      const parsed = JSON.parse(guardado);
      setJugador({
        ...parsed,
        eloPortugalujo: parsed.eloPortugalujo || parsed.eloRapid || parsed.eloStd || 1500,
      });
    } else {
      // Si no hay jugador guardado en el navegador, abrimos el selector "¿Quién eres?"
      setMostrarSelectorJugador(true);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [jugador.fideId]);

  // Función que lee y procesa el archivo public/jugadores.csv automáticamente
  async function cargarCSVJugadores() {
    try {
      const res = await fetch("/jugadores.csv", { cache: "no-store" });
      if (!res.ok) return;
      const texto = await res.text();
      const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lineas.length < 2) return;

      const separador = lineas[0].includes(";") ? ";" : ",";
      const cabeceras = lineas[0]
        .split(separador)
        .map((h) => h.replace(/"/g, "").trim().toLowerCase());

      let idxNombre = cabeceras.findIndex((h) =>
        h.includes("nombre") || h.includes("jugador") || h.includes("name") || h.includes("apellido")
      );
      let idxElo = cabeceras.findIndex((h) =>
        h.includes("elo") || h.includes("actual") || h.includes("nuevo") || h.includes("rat") || h.includes("ptos")
      );
      let idxFide = cabeceras.findIndex((h) =>
        h.includes("fide") || h.includes("id") || h.includes("cod") || h.includes("licencia")
      );

      const jugadoresExtraidos = [];

      for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i]
          .split(new RegExp(`${separador}(?=(?:(?:[^"]*"){2})*[^"]*$)`))
          .map((c) => c.replace(/^"|"$/g, "").trim());

        if (cols.length < 2) continue;

        let nombre = idxNombre !== -1 ? cols[idxNombre] : "";
        let elo = idxElo !== -1 ? parseInt(cols[idxElo], 10) : NaN;
        let fide = idxFide !== -1 ? cols[idxFide] : "";

        if (!nombre) {
          const colTexto = cols.find((c) => /[a-zA-ZÁÉÍÓÚáéíóúñÑ]{3,}/.test(c));
          nombre = colTexto || cols[1] || cols[0];
        }

        if (isNaN(elo)) {
          const colNum = cols.find((c) => /^\d{3,4}$/.test(c) && parseInt(c, 10) >= 800 && parseInt(c, 10) <= 3000);
          elo = colNum ? parseInt(colNum, 10) : 1500;
        }

        if (!fide || fide === nombre) {
          fide = cols[0] && /^\d+$/.test(cols[0]) ? `PORTU-${cols[0]}` : `CLUB-${i}`;
        }

        if (nombre && !nombre.toLowerCase().includes("jugador") && !nombre.toLowerCase().includes("nombre")) {
          jugadoresExtraidos.push({
            nombre,
            fideId: fide,
            eloPortugalujo: elo,
          });
        }
      }

      setListaJugadoresCSV(jugadoresExtraidos);
    } catch (err) {
      console.error("No se pudo cargar /jugadores.csv:", err);
    }
  }

  // Seleccionar un jugador de la lista del CSV
  function elegirJugadorDeLista(jug) {
    const nuevoPerfil = {
      nombre: jug.nombre,
      fideId: String(jug.fideId),
      email: jugador.email || "jugador@ajedrez.es",
      eloPortugalujo: jug.eloPortugalujo,
    };
    setJugador(nuevoPerfil);
    localStorage.setItem("chess_plus_jugador", JSON.stringify(nuevoPerfil));
    setMostrarSelectorJugador(false);
  }

  async function cargarDatos() {
    setCargando(true);
    const { data: listaTorneos } = await supabase
      .from("tournaments")
      .select("*")
      .order("fecha_inicio", { ascending: true });

    const { data: inscripciones } = await supabase
      .from("registrations")
      .select("tournament_id, fide_id, jugador_nombre, elo");

    if (listaTorneos) setTorneos(listaTorneos);

    if (inscripciones) {
      const misIds = inscripciones
        .filter((i) => i.fide_id === jugador.fideId)
        .map((i) => i.tournament_id);
      setMisInscripciones(misIds);

      const agrupados = {};
      inscripciones.forEach((ins) => {
        if (!agrupados[ins.tournament_id]) {
          agrupados[ins.tournament_id] = [];
        }
        agrupados[ins.tournament_id].push(ins);
      });
      setInscritosPorTorneo(agrupados);
    }

    setCargando(false);
  }

  async function crearTorneoManual(e) {
    e.preventDefault();
    const { error } = await supabase.from("tournaments").insert([{
      ...nuevoTorneo,
      comunidad: "España",
      fecha_fin: nuevoTorneo.fecha_inicio,
      inscritos: 0,
      fuente: "Manual Oficial"
    }]);

    if (!error) {
      alert("¡Torneo publicado con éxito!");
      setMostrarModalNuevo(false);
      setNuevoTorneo({ nombre: "", provincia: "", fecha_inicio: "", ritmo: "Clásico", control_tiempo: "90m + 30s", cupo: 100, cuota: "20€", url_origen: "" });
      cargarDatos();
    } else {
      alert("Error al crear torneo: " + error.message);
    }
  }

  async function actualizarTorneo(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("tournaments")
      .update({
        nombre: torneoAEditar.nombre,
        provincia: torneoAEditar.provincia,
        fecha_inicio: torneoAEditar.fecha_inicio,
        ritmo: torneoAEditar.ritmo,
        control_tiempo: torneoAEditar.control_tiempo,
        url_origen: torneoAEditar.url_origen
      })
      .eq("id", torneoAEditar.id);

    if (!error) {
      alert("¡Torneo actualizado con éxito!");
      setTorneoAEditar(null);
      cargarDatos();
    } else {
      alert("Error al actualizar: " + error.message);
    }
  }

  async function borrarTorneo(id) {
    if (confirm("¿Estás seguro de que quieres eliminar este torneo? Se borrarán también las inscripciones asociadas.")) {
      const { error } = await supabase.from("tournaments").delete().eq("id", id);
      if (!error) {
        alert("Torneo eliminado.");
        cargarDatos();
      } else {
        alert("Error al borrar: " + error.message);
      }
    }
  }

  async function toggleInscripcion(torneo) {
    if (jugador.nombre === "Selecciona tu jugador") {
      setMostrarSelectorJugador(true);
      return;
    }

    const estaInscrito = misInscripciones.includes(torneo.id);

    if (estaInscrito) {
      await supabase
        .from("registrations")
        .delete()
        .eq("tournament_id", torneo.id)
        .eq("fide_id", jugador.fideId);

      await supabase
        .from("tournaments")
        .update({ inscritos: Math.max(0, torneo.inscritos - 1) })
        .eq("id", torneo.id);

      cargarDatos();
    } else {
      const { error } = await supabase.from("registrations").insert([
        {
          tournament_id: torneo.id,
          jugador_nombre: jugador.nombre,
          fide_id: jugador.fideId,
          email: jugador.email,
          elo: jugador.eloPortugalujo,
        },
      ]);

      if (!error) {
        await supabase
          .from("tournaments")
          .update({ inscritos: torneo.inscritos + 1 })
          .eq("id", torneo.id);
        cargarDatos();
      } else {
        alert("Error al inscribirse: " + error.message);
      }
    }
  }

  const torneosFiltrados = torneos.filter((t) => {
    const coincideRitmo = filtroRitmo === "Todos" || t.ritmo === filtroRitmo;
    const coincideTexto =
      t.provincia.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideRitmo && coincideTexto;
  });

  const jugadoresCSVFiltrados = listaJugadoresCSV.filter((j) =>
    j.nombre.toLowerCase().includes(busquedaJugadorCSV.toLowerCase()) ||
    String(j.fideId).toLowerCase().includes(busquedaJugadorCSV.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* CABECERA CARNET */}
      <header className="bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 p-5 border-b border-amber-500/20 sticky top-0 z-10 shadow-2xl">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white p-0.5 border-2 border-amber-400 shadow-lg shadow-amber-500/20 flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.jpg"
                  alt="Escudo FEDA Ajedrez"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-wider text-amber-400 leading-tight">
                  CHESS+ ESPAÑA
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">Plataforma Oficial de Torneos</p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => setMostrarSelectorJugador(true)}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition shadow-md"
              >
                👤 ¿Quién eres?
              </button>
              <button
                onClick={() => setMostrarModalNuevo(true)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-md"
              >
                + Publicar Torneo
              </button>
            </div>
          </div>

          {/* TARJETA CON ÚNICAMENTE EL ELO PORTUGALUJO */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                ● Jugador Activo
              </span>
              <p className="font-bold text-lg text-white">{jugador.nombre}</p>
              <p className="text-xs text-slate-400 font-mono">ID: {jugador.fideId}</p>
            </div>
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-amber-500/30 text-center shadow-inner">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                ELO Portugalujo
              </p>
              <p className="font-black text-xl text-amber-400">
                {jugador.eloPortugalujo || 0}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MODAL SELECTOR "¿QUIÉN ERES?" DESDE EL CSV */}
      {mostrarSelectorJugador && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-amber-400">👤 ¿Quién eres?</h2>
              <button
                onClick={() => setMostrarSelectorJugador(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Cerrar
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Busca tu nombre en el listado oficial para cargar tu ELO Portugalujo automáticamente y poder anotarte a los torneos:
            </p>

            <input
              type="text"
              placeholder="🔍 Escribe tu nombre o apellido..."
              value={busquedaJugadorCSV}
              onChange={(e) => setBusquedaJugadorCSV(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              autoFocus
            />

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {listaJugadoresCSV.length === 0 ? (
                <p className="text-xs text-amber-400/80 py-4 text-center">
                  No se encontró el archivo <b>public/jugadores.csv</b> o está vacío. Asegúrate de guardarlo en la carpeta <b>public</b> con el nombre <b>jugadores.csv</b>.
                </p>
              ) : jugadoresCSVFiltrados.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No hay jugadores que coincidan con tu búsqueda.
                </p>
              ) : (
                jugadoresCSVFiltrados.map((jug, i) => (
                  <button
                    key={i}
                    onClick={() => elegirJugadorDeLista(jug)}
                    className="w-full text-left bg-slate-950 hover:bg-indigo-950/60 border border-slate-800 hover:border-amber-500/40 p-3 rounded-xl flex justify-between items-center transition"
                  >
                    <div>
                      <p className="font-bold text-sm text-white">{jug.nombre}</p>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {jug.fideId}</p>
                    </div>
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                      ELO {jug.eloPortugalujo}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO TORNEO */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-amber-400">Publicar Torneo en España</h2>
            <form onSubmit={crearTorneoManual} className="space-y-3">
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                placeholder="Nombre del Torneo"
                value={nuevoTorneo.nombre}
                onChange={(e) => setNuevoTorneo({ ...nuevoTorneo, nombre: e.target.value })}
                required
              />
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                placeholder="Provincia"
                value={nuevoTorneo.provincia}
                onChange={(e) => setNuevoTorneo({ ...nuevoTorneo, provincia: e.target.value })}
                required
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700 text-slate-300"
                  value={nuevoTorneo.fecha_inicio}
                  onChange={(e) => setNuevoTorneo({ ...nuevoTorneo, fecha_inicio: e.target.value })}
                  required
                />
                <select
                  className="bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700 text-slate-300 font-bold"
                  value={nuevoTorneo.ritmo}
                  onChange={(e) => setNuevoTorneo({ ...nuevoTorneo, ritmo: e.target.value })}
                >
                  <option value="Clásico">Clásico</option>
                  <option value="Rápido">Rápido</option>
                  <option value="Blitz">Blitz</option>
                </select>
              </div>
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                placeholder="Control de tiempo (ej. 90m + 30s)"
                value={nuevoTorneo.control_tiempo}
                onChange={(e) => setNuevoTorneo({ ...nuevoTorneo, control_tiempo: e.target.value })}
                required
              />
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                placeholder="Enlace a Bases Oficiales"
                value={nuevoTorneo.url_origen}
                onChange={(e) => setNuevoTorneo({ ...nuevoTorneo, url_origen: e.target.value })}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-bold text-sm text-white"
                >
                  Guardar Torneo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TORNEO */}
      {torneoAEditar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-sky-400">Editar Torneo</h2>
            <form onSubmit={actualizarTorneo} className="space-y-3">
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                value={torneoAEditar.nombre}
                onChange={(e) => setTorneoAEditar({ ...torneoAEditar, nombre: e.target.value })}
                required
              />
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                value={torneoAEditar.provincia}
                onChange={(e) => setTorneoAEditar({ ...torneoAEditar, provincia: e.target.value })}
                required
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700 text-slate-300"
                  value={torneoAEditar.fecha_inicio}
                  onChange={(e) => setTorneoAEditar({ ...torneoAEditar, fecha_inicio: e.target.value })}
                  required
                />
                <select
                  className="bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700 text-slate-300 font-bold"
                  value={torneoAEditar.ritmo}
                  onChange={(e) => setTorneoAEditar({ ...torneoAEditar, ritmo: e.target.value })}
                >
                  <option value="Clásico">Clásico</option>
                  <option value="Rápido">Rápido</option>
                  <option value="Blitz">Blitz</option>
                </select>
              </div>
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                value={torneoAEditar.control_tiempo || ""}
                onChange={(e) => setTorneoAEditar({ ...torneoAEditar, control_tiempo: e.target.value })}
                placeholder="Control de tiempo"
              />
              <input
                className="w-full bg-slate-800 p-2.5 rounded-lg text-sm border border-slate-700"
                value={torneoAEditar.url_origen || ""}
                onChange={(e) => setTorneoAEditar({ ...torneoAEditar, url_origen: e.target.value })}
                placeholder="Enlace Bases"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTorneoAEditar(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-500 py-2.5 rounded-xl font-bold text-sm text-white"
                >
                  Actualizar Torneo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LISTADO DE TORNEOS */}
      <main className="max-w-xl mx-auto p-4 mt-2">
        <div className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="🔍 Buscar por provincia o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400"
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            {["Todos", "Clásico", "Rápido", "Blitz"].map((ritmo) => (
              <button
                key={ritmo}
                onClick={() => setFiltroRitmo(ritmo)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                  filtroRitmo === ritmo
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-900 text-slate-400 border border-slate-800"
                }`}
              >
                {ritmo}
              </button>
            ))}
          </div>
        </div>

        {cargando ? (
          <p className="text-center text-slate-400 py-10">Cargando torneos...</p>
        ) : (
          <div className="space-y-4">
            {torneosFiltrados.map((torneo) => {
              const estaInscrito = misInscripciones.includes(torneo.id);
              const listaInscritosTorneo = inscritosPorTorneo[torneo.id] || [];
              const estaExpandido = torneoExpandido === torneo.id;

              return (
                <div key={torneo.id} className="bg-slate-900 rounded-xl p-5 border border-slate-800 relative">
                  {/* Botones de Editar y Borrar Torneo */}
                  <div className="absolute top-4 right-4 flex gap-1.5">
                    <button
                      onClick={() => setTorneoAEditar(torneo)}
                      className="bg-slate-800 hover:bg-sky-600/30 text-sky-400 text-xs px-2 py-1 rounded border border-slate-700 transition"
                      title="Editar Torneo"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => borrarTorneo(torneo.id)}
                      className="bg-slate-800 hover:bg-rose-600/30 text-rose-400 text-xs px-2 py-1 rounded border border-slate-700 transition"
                      title="Borrar Torneo"
                    >
                      🗑️ Borrar
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-2 pr-28">
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {torneo.ritmo} • {torneo.control_tiempo}
                    </span>
                    <span className="text-xs text-slate-400">📍 {torneo.provincia}</span>
                  </div>

                  <h2 className="font-bold text-lg text-white mb-1">{torneo.nombre}</h2>
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
                    <span>📅 Fecha: {torneo.fecha_inicio}</span>
                    {torneo.url_origen && (
                      <a href={torneo.url_origen} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                        Ver bases oficiales ↗
                      </a>
                    )}
                  </div>

                  <div className="mb-4">
                    <button
                      onClick={() => setTorneoExpandido(estaExpandido ? null : torneo.id)}
                      className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 font-medium transition"
                    >
                      👥 Ver jugadores inscritos ({listaInscritosTorneo.length}) {estaExpandido ? "▲" : "▼"}
                    </button>

                    {estaExpandido && (
                      <div className="mt-2 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                        {listaInscritosTorneo.length === 0 ? (
                          <p className="text-xs text-slate-500">Aún no hay ningún jugador inscrito.</p>
                        ) : (
                          listaInscritosTorneo.map((ins, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-900 pb-1">
                              <div>
                                <span className="font-bold text-slate-200">{ins.jugador_nombre}</span>
                                <span className="text-slate-500 ml-2 font-mono">ID: {ins.fide_id}</span>
                              </div>
                              <span className="text-amber-400 font-mono">ELO: {ins.elo}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleInscripcion(torneo)}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition ${
                      estaInscrito
                        ? "bg-emerald-500/20 hover:bg-rose-500/20 text-emerald-300 hover:text-rose-300 border border-emerald-500/30"
                        : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                    }`}
                  >
                    {estaInscrito ? "✓ Inscrito (Haz clic para cancelar)" : `Anótate en 1-Clic como ${jugador.nombre.split(" ")[0]}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}