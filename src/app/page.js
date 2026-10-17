"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [torneos, setTorneos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [buscandoFide, setBuscandoFide] = useState(false);
  const [filtroRitmo, setFiltroRitmo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);

  // Estados para Editar Torneo
  const [torneoAEditar, setTorneoAEditar] = useState(null);

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
    nombre: "Erlantz Caballero Acosta",
    fideId: "24536954",
    email: "erlantz@ajedrez.es",
    eloStd: 1950,
    eloRapid: 1950,
    eloBlitz: 1950,
  });

  const [inputFideId, setInputFideId] = useState("24536954");
  const [misInscripciones, setMisInscripciones] = useState([]);
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem("chess_plus_jugador");
    if (guardado) {
      const parsed = JSON.parse(guardado);
      setJugador(parsed);
      setInputFideId(parsed.fideId);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [jugador.fideId]);

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

  async function vincularFideId() {
    if (!inputFideId.trim()) return;
    setBuscandoFide(true);
    try {
      const res = await fetch("/api/fide?id=" + inputFideId.trim());
      const data = await res.json();

      if (data.ok) {
        const nuevoPerfil = {
          ...jugador,
          fideId: data.jugador.fideId,
          nombre: data.jugador.nombre,
          eloStd: data.jugador.eloStd || jugador.eloStd,
          eloRapid: data.jugador.eloRapid || jugador.eloRapid,
          eloBlitz: data.jugador.eloBlitz || jugador.eloBlitz,
        };
        setJugador(nuevoPerfil);
        localStorage.setItem("chess_plus_jugador", JSON.stringify(nuevoPerfil));
        setEditandoPerfil(false);
      } else {
        alert("No se encontró ese código en la FIDE.");
      }
    } catch (e) {
      alert("Error al conectar con la FIDE.");
    }
    setBuscandoFide(false);
  }

  function guardarElosManuales(e) {
    e.preventDefault();
    localStorage.setItem("chess_plus_jugador", JSON.stringify(jugador));
    setEditandoPerfil(false);
    alert("¡Datos y ELOs guardados correctamente!");
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

  // FUNCIÓN PARA ACTUALIZAR TORNEO EXISTENTE
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

  // FUNCIÓN PARA BORRAR TORNEO
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
      const eloAUsar = torneo.ritmo === 'Blitz' ? jugador.eloBlitz : torneo.ritmo === 'Rápido' ? jugador.eloRapid : jugador.eloStd;
      
      const { error } = await supabase.from("registrations").insert([
        {
          tournament_id: torneo.id,
          jugador_nombre: jugador.nombre,
          fide_id: jugador.fideId,
          email: jugador.email,
          elo: eloAUsar,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* CABECERA CARNET FIDE */}
      <header className="bg-gradient-to-b from-indigo-950 to-slate-900 p-5 border-b border-slate-800 sticky top-0 z-10 shadow-xl">
        <div className="max-w-xl mx-auto">
         <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.jpg" 
                alt="Logo Ajedrez" 
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-md bg-white p-0.5" 
              />
              <h1 className="text-xl font-black tracking-wider text-amber-400">
                ♟️ TORNEOS AJEDREZ
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMostrarModalNuevo(true)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition"
              >
                + Publicar Torneo
              </button>
              <button
                onClick={() => setEditandoPerfil(!editandoPerfil)}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700"
              >
                {editandoPerfil ? "Cerrar" : "Editar mi Carnet / ELO"}
              </button>
            </div>
          </div>

          {editandoPerfil ? (
            <form onSubmit={guardarElosManuales} className="bg-slate-900 p-4 rounded-xl border border-amber-500/40 space-y-3 mb-2">
              <p className="text-xs text-amber-400 font-bold">Verificar FIDE o ajustar tus ELOs manualmente:</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-800 p-2 rounded text-sm border border-slate-700"
                  placeholder="Código FIDE"
                  value={inputFideId}
                  onChange={(e) => setInputFideId(e.target.value)}
                />
                <button
                  type="button"
                  onClick={vincularFideId}
                  disabled={buscandoFide}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded text-xs"
                >
                  {buscandoFide ? "Buscando..." : "Buscar FIDE"}
                </button>
              </div>

              <input
                className="w-full bg-slate-800 p-2 rounded text-sm border border-slate-700"
                placeholder="Nombre completo"
                value={jugador.nombre}
                onChange={(e) => setJugador({ ...jugador, nombre: e.target.value })}
                required
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">ELO Standard</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 p-2 rounded text-sm border border-slate-700 font-bold text-amber-400"
                    value={jugador.eloStd}
                    onChange={(e) => setJugador({ ...jugador, eloStd: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">ELO Rapid</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 p-2 rounded text-sm border border-slate-700 font-bold text-sky-400"
                    value={jugador.eloRapid}
                    onChange={(e) => setJugador({ ...jugador, eloRapid: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">ELO Blitz</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 p-2 rounded text-sm border border-slate-700 font-bold text-rose-400"
                    value={jugador.eloBlitz}
                    onChange={(e) => setJugador({ ...jugador, eloBlitz: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-xs"
              >
                Guardar Carnet FIDE
              </button>
            </form>
          ) : (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                  ● FIDE Oficial Verificado
                </span>
                <p className="font-bold text-lg text-white">{jugador.nombre}</p>
                <p className="text-xs text-slate-400 font-mono">FIDE ID: {jugador.fideId}</p>
              </div>
              <div className="flex gap-2 text-center">
                <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-400">STD</p>
                  <p className="font-bold text-amber-400">{jugador.eloStd || 0}</p>
                </div>
                <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-400">RAPID</p>
                  <p className="font-bold text-sky-400">{jugador.eloRapid || 0}</p>
                </div>
                <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-400">BLITZ</p>
                  <p className="font-bold text-rose-400">{jugador.eloBlitz || 0}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

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
                                <span className="text-slate-500 ml-2 font-mono">FIDE ID: {ins.fide_id}</span>
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
                    {estaInscrito ? "✓ Inscrito (Haz clic para cancelar)" : "Anótate en 1-Clic"}
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