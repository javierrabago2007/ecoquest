/* ==========================================================================
   EcoQuest · app.js
   --------------------------------------------------------------------------
   Cómo está organizado este archivo:
     1. Utilidades (escapar texto, voz, avisos)
     2. Progreso guardado en el navegador (localStorage)
     3. Carga de contenidos desde datos/*.json
     4. Mascota (SVG)
     5. Pantallas: inicio, aprende, juega, experimenta, actúa, progreso,
        docente, familia, acerca, grado en construcción
     6. Juegos: opción múltiple, verdadero/falso, completar palabras,
        memorama, clasificar residuos
     7. Navegación (rutas con #) y arranque
   El contenido (textos, preguntas, retos…) NO está aquí: está en datos/.
   ========================================================================== */

"use strict";

/* ---------- 1. Utilidades ---------- */

const app = document.getElementById("app");

/** Escapa texto para insertarlo en HTML sin riesgos. */
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Mezcla un arreglo (para juegos). Devuelve una copia. */
function mezclar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lee un texto en voz alta con la voz del navegador (útil para 1.º grado). */
const hayVoz = "speechSynthesis" in window;
function hablar(texto) {
  if (!hayVoz) return;
  speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(texto);
  voz.lang = "es-MX";
  voz.rate = 0.9;
  speechSynthesis.speak(voz);
}
/** Botón 🔊 que lee el texto indicado. */
function botonVoz(texto) {
  if (!hayVoz) return "";
  return `<button class="boton-voz" data-voz="${esc(texto)}" aria-label="Escuchar">🔊</button>`;
}

/* ---------- Sonidos sintetizados (juego «¿Fuerte o suave?») ----------
   Los sonidos se crean con el sintetizador del navegador (Web Audio API):
   no hay archivos de audio, no se descarga nada y funciona sin internet.
   Para agregar un sonido nuevo: crea una función en SONIDOS y escribe su
   nombre en el campo "sonido" del juego en datos/primero.json.
   Volumen máximo limitado (VOL_FUERTE) para cuidar los oídos. */

const VOL_FUERTE = 0.28, VOL_SUAVE = 0.12;
let ctxAudio = null, salidaActual = null;

function audio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctxAudio = ctxAudio || new Ctx();
  if (ctxAudio.state === "suspended") ctxAudio.resume();
  return ctxAudio;
}
/** Crea la salida de un sonido nuevo y apaga el anterior. */
function nuevaSalida(c, volumen) {
  if (salidaActual) {
    const vieja = salidaActual;
    vieja.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(() => vieja.disconnect(), 300);
  }
  const g = c.createGain();
  g.gain.value = volumen;
  g.connect(c.destination);
  salidaActual = g;
  return g;
}
/** Ruido blanco (base para viento, lluvia, taladro y ronroneo). */
function ruido(c, segundos) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * segundos), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}
/** Envolvente: sube y baja el volumen suavemente entre t0 y t0+dur. */
function envolvente(c, destino, t0, dur, ataque = 0.02, caida = 0.08) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(1, t0 + ataque);
  g.gain.setValueAtTime(1, Math.max(t0 + ataque, t0 + dur - caida));
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  g.connect(destino);
  return g;
}
/** Filtro de frecuencias (lowpass, highpass o bandpass). */
function filtro(c, tipo, frecuencia, destino, q = 1) {
  const f = c.createBiquadFilter();
  f.type = tipo; f.frequency.value = frecuencia; f.Q.value = q;
  f.connect(destino);
  return f;
}
/** Oscilador que hace "temblar" el volumen (para taladro y ronroneo). */
function temblor(c, ganancia, frecuencia, profundidad, t0, t1) {
  const lfo = c.createOscillator(), prof = c.createGain();
  lfo.frequency.value = frecuencia; prof.gain.value = profundidad;
  lfo.connect(prof); prof.connect(ganancia.gain);
  lfo.start(t0); lfo.stop(t1);
}

const SONIDOS = {
  sirena(c) {
    const sal = nuevaSalida(c, VOL_FUERTE), t = c.currentTime, dur = 2.4;
    const o = c.createOscillator(); o.type = "triangle";
    for (let k = 0; k < 3; k++) {
      o.frequency.setValueAtTime(650, t + k * 0.8);
      o.frequency.linearRampToValueAtTime(1050, t + k * 0.8 + 0.4);
      o.frequency.linearRampToValueAtTime(650, t + k * 0.8 + 0.8);
    }
    o.connect(envolvente(c, sal, t, dur)); o.start(t); o.stop(t + dur);
  },
  claxon(c) {
    const sal = nuevaSalida(c, VOL_FUERTE * 0.6), t = c.currentTime;
    [[0, 0.35], [0.5, 1.1]].forEach(([a, b]) => {
      const env = envolvente(c, filtro(c, "lowpass", 1800, sal), t + a, b - a, 0.01, 0.03);
      [392, 494].forEach(f => { const o = c.createOscillator(); o.type = "square"; o.frequency.value = f; o.connect(env); o.start(t + a); o.stop(t + b); });
    });
  },
  taladro(c) {
    const sal = nuevaSalida(c, VOL_FUERTE), t = c.currentTime, dur = 1.8;
    const env = envolvente(c, sal, t, dur, 0.1, 0.15);
    const vib = c.createGain(); vib.gain.value = 0.6; vib.connect(env);
    temblor(c, vib, 28, 0.4, t, t + dur);
    const o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(170, t + 0.4);
    o.connect(filtro(c, "lowpass", 1200, vib)); o.start(t); o.stop(t + dur);
    const r = ruido(c, dur); r.connect(filtro(c, "bandpass", 900, vib, 2)); r.start(t);
  },
  musica(c) {
    const sal = nuevaSalida(c, VOL_FUERTE), t = c.currentTime;
    const notas = [523, 659, 784, 1047, 784, 659, 523, 659];
    notas.forEach((f, k) => {
      const a = t + k * 0.22;
      const o = c.createOscillator(); o.type = "square"; o.frequency.value = f;
      o.connect(envolvente(c, filtro(c, "lowpass", 2500, sal), a, 0.2, 0.01, 0.05)); o.start(a); o.stop(a + 0.2);
      if (k % 2 === 0) { // tambor
        const b = c.createOscillator(); b.frequency.setValueAtTime(150, a); b.frequency.exponentialRampToValueAtTime(50, a + 0.15);
        b.connect(envolvente(c, sal, a, 0.16, 0.005, 0.1)); b.start(a); b.stop(a + 0.16);
      }
    });
  },
  pajaro(c) {
    const sal = nuevaSalida(c, VOL_SUAVE), t = c.currentTime;
    [0, 0.15, 0.3, 0.7, 0.85, 1.3, 1.45, 1.6].forEach(a => {
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(2600, t + a); o.frequency.exponentialRampToValueAtTime(4200, t + a + 0.09);
      o.connect(envolvente(c, sal, t + a, 0.1, 0.01, 0.04)); o.start(t + a); o.stop(t + a + 0.1);
    });
  },
  hojas(c) {
    const sal = nuevaSalida(c, VOL_SUAVE * 1.8), t = c.currentTime, dur = 2.4;
    const g = c.createGain(); g.connect(sal);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.7); g.gain.linearRampToValueAtTime(0.3, t + 1.3);
    g.gain.linearRampToValueAtTime(0.8, t + 1.9); g.gain.linearRampToValueAtTime(0, t + dur);
    const r = ruido(c, dur); r.connect(filtro(c, "bandpass", 2800, g, 0.6)); r.start(t);
  },
  ronroneo(c) {
    const sal = nuevaSalida(c, VOL_SUAVE * 4), t = c.currentTime, dur = 2.4;
    const env = envolvente(c, sal, t, dur, 0.2, 0.3);
    const vib = c.createGain(); vib.gain.value = 0.5; vib.connect(env);
    temblor(c, vib, 24, 0.5, t, t + dur);
    const r = ruido(c, dur); r.connect(filtro(c, "lowpass", 260, vib)); r.start(t);
  },
  llovizna(c) {
    const sal = nuevaSalida(c, VOL_SUAVE * 0.7), t = c.currentTime;
    for (let k = 0; k < 90; k++) {
      const a = t + Math.random() * 2.2;
      const r = ruido(c, 0.03);
      r.connect(envolvente(c, filtro(c, "highpass", 2500 + Math.random() * 2500, sal), a, 0.03, 0.002, 0.02));
      r.start(a);
    }
  }
};
/* ---------- Efectos para todos los juegos: sonidos cortos, confeti, la mascota y rachas ---------- */

/** Notas cortas y suaves (no cortan otros sonidos). */
function notas(lista, tipo = "sine", volumen = 0.08) {
  const c = audio(); if (!c) return;
  const g = c.createGain(); g.gain.value = volumen; g.connect(c.destination);
  const t = c.currentTime;
  lista.forEach(([frec, inicio, dur]) => {
    const o = c.createOscillator(); o.type = tipo; o.frequency.value = frec;
    o.connect(envolvente(c, g, t + inicio, dur, 0.01, dur / 2)); o.start(t + inicio); o.stop(t + inicio + dur);
  });
  setTimeout(() => g.disconnect(), 2000);
}
const sonidoAcierto = () => notas([[660, 0, 0.12], [880, 0.1, 0.18]]);
const sonidoError = () => notas([[300, 0, 0.15], [220, 0.13, 0.25]], "triangle", 0.07);
const sonidoVictoria = () => notas([[523, 0, 0.15], [659, 0.13, 0.15], [784, 0.26, 0.15], [1047, 0.39, 0.4]], "triangle", 0.09);

/** Lluvia de confeti (se borra sola). */
function confeti() {
  const caja = document.createElement("div");
  caja.className = "confeti";
  const colores = ["#f3a047", "#29a66a", "#1c98d0", "#f0c94b", "#8055c9", "#e46a6a"];
  caja.innerHTML = Array.from({ length: 48 }, () =>
    `<i style="left:${Math.random() * 100}%;background:${colores[Math.floor(Math.random() * colores.length)]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join("");
  document.body.appendChild(caja);
  setTimeout(() => caja.remove(), 3000);
}

const azar = lista => lista[Math.floor(Math.random() * lista.length)];
let racha = 0;
/** Reacción a una respuesta: sonido, la mascota salta o anima, y aviso de racha. */
function reaccion(ok, mensaje) {
  ok ? sonidoAcierto() : sonidoError();
  racha = ok ? racha + 1 : 0;
  if (ok && racha >= 3 && racha % 3 === 0) avisar(`🔥 ¡${racha} seguidas! ¡Vas muy bien!`);
  const bura = document.getElementById("buraJuego");
  if (!bura) return;
  bura.classList.remove("feliz", "animo");
  void bura.offsetWidth; // reinicia la animación
  bura.classList.add(ok ? "feliz" : "animo");
  const globo = bura.querySelector(".globo");
  if (globo) globo.textContent = mensaje || (ok ? azar(["¡Bien hecho!", "¡Eso es!", "¡Genial!", "¡Muy bien!"]) : azar(["¡Tú puedes!", "Casi, ¡ánimo!", "Inténtalo otra vez"]));
}

/** Reproduce un sonido por su nombre. Devuelve false si no se pudo. */
function reproducirSonido(nombre) {
  const c = audio();
  if (!c || !SONIDOS[nombre]) return false;
  if (hayVoz) speechSynthesis.cancel();
  SONIDOS[nombre](c);
  return true;
}

/** Muestra un mensaje flotante unos segundos. */
function avisar(mensaje) {
  const caja = document.getElementById("aviso");
  caja.textContent = mensaje;
  caja.classList.add("visible");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => caja.classList.remove("visible"), 3200);
}

/* ---------- 2. Progreso en el navegador ----------
   Se guarda solo en ESTE navegador y ESTE dispositivo. No se envía a ningún
   lado. Si se borran los datos del navegador, el progreso se pierde.
   No guardamos nombres ni datos personales.

   Varios EXPLORADORES pueden compartir un dispositivo (p. ej. la tableta del salón).
   Cada uno tiene un apodo hecho de personaje + color («Cachora Azul») y su propio progreso.
   «almacen» guarda todo; «estado» es el progreso del explorador activo + el perfil de vista. */

const CLAVE = "ecoquest-v2";
const CLAVE_V1 = "ecoquest-v1";   // versión anterior (un solo progreso): se migra automáticamente
const progresoVacio = () => ({ hechos: {}, puntajes: {}, registros: {}, retos: {} });
const estadoInicial = () => ({ perfil: "alumno", ...progresoVacio() });
let estado = estadoInicial();
let almacen = { perfil: "alumno", activo: null, exploradores: [], grupo: [] };

/** Personajes y colores para formar apodos (sin datos personales). Colores con nombre que no cambia de género. */
const PERSONAJES = [
  { id: "cardenal", nombre: "Cardenal" }, { id: "pato", nombre: "Pato" }, { id: "perro", nombre: "Perrito" },
  { id: "gato", nombre: "Gatito" }, { id: "cachora", nombre: "Cachora" }, { id: "paloma", nombre: "Paloma" }
];
const COLORES = [
  { id: "verde", nombre: "Verde", fondo: "#cdeccf" }, { id: "azul", nombre: "Azul", fondo: "#cfe6f7" },
  { id: "naranja", nombre: "Naranja", fondo: "#ffdcbd" }, { id: "rosa", nombre: "Rosa", fondo: "#fbd6e1" },
  { id: "lila", nombre: "Lila", fondo: "#e3d8fb" }, { id: "turquesa", nombre: "Turquesa", fondo: "#c8efe9" }
];
const apodoDe = ex => `${(PERSONAJES.find(p => p.id === ex.personaje) || PERSONAJES[2]).nombre} ${(COLORES.find(c => c.id === ex.color) || COLORES[0]).nombre}`;
const exploradorActivo = () => almacen.exploradores.find(x => x.id === almacen.activo) || almacen.exploradores[0];

function crearExplorador(personaje, color, progreso = progresoVacio()) {
  const ex = { id: "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), personaje, color, grado: gradoActual(), progreso };
  almacen.exploradores.push(ex);
  return ex;
}

function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado && Array.isArray(guardado.exploradores)) {
      almacen = Object.assign({ perfil: "alumno", activo: null, exploradores: [], grupo: [] }, guardado);
    } else {
      // Migración: el progreso de la versión anterior pasa al primer explorador.
      const v1 = JSON.parse(localStorage.getItem(CLAVE_V1));
      if (v1) {
        almacen.perfil = v1.perfil || "alumno";
        crearExplorador("perro", "verde", { hechos: v1.hechos || {}, puntajes: v1.puntajes || {}, registros: v1.registros || {}, retos: v1.retos || {} });
      }
    }
  } catch (e) { /* si falla, se empieza de cero */ }
  if (!almacen.exploradores.length) crearExplorador("perro", "verde");
  if (!almacen.exploradores.some(x => x.id === almacen.activo)) almacen.activo = almacen.exploradores[0].id;
  estado = { perfil: almacen.perfil, ...progresoVacio(), ...exploradorActivo().progreso };
  guardarEstado();
}
function guardarEstado() {
  const ex = exploradorActivo();
  if (ex) ex.progreso = { hechos: estado.hechos, puntajes: estado.puntajes, registros: estado.registros, retos: estado.retos };
  almacen.perfil = estado.perfil;
  try { localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch (e) { /* navegador en modo privado, etc. */ }
}
/** Cambia al explorador indicado (guarda antes el progreso del actual). */
function cambiarExplorador(id) {
  guardarEstado();
  almacen.activo = id;
  estado = { perfil: almacen.perfil, ...progresoVacio(), ...exploradorActivo().progreso };
  guardarEstado();
  if (typeof pintarPerfil === "function") pintarPerfil();
}
/** Marca una actividad como hecha. clave = "aprende:u1", "juego:j1", "experimento:e1", "reto:r1" */
function marcarHecho(clave) {
  if (perfil() !== "alumno") return avisar("👀 Vista de adulto: no se guarda en el progreso del alumno");
  if (estado.hechos[clave]) return;
  const antes = insigniasGanadas().length;
  estado.hechos[clave] = true;
  guardarEstado();
  const despues = insigniasGanadas();
  if (despues.length > antes) avisar(`🏅 ¡Ganaste la insignia «${despues[despues.length - 1].nombre}»!`);
  else avisar("✅ ¡Guardado en tu progreso!");
}
/** ¿Ya se hizo esta actividad? "juegos:u1" cuenta como hecha si se terminó CUALQUIER juego del tema. */
function hecho(clave) {
  if (clave.startsWith("juegos:")) return juegosDe(clave.slice(7)).some(j => estado.hechos[`juego:${j.id}`]);
  return !!estado.hechos[clave];
}

/* ---------- 3. Contenidos ---------- */

let grados = [];   // datos/grados.json
let datos = null;  // contenido del grado que se está viendo
const datosGrado = {};   // { 1: contenido de 1.º, 2: contenido de 2.º, ... } solo los grados listos

async function cargarDatos() {
  // "no-cache": el navegador siempre revisa si el contenido cambió (así se ven al instante las ediciones de datos/).
  const lista = await fetch("datos/grados.json", { cache: "no-cache" }).then(r => r.json());
  grados = lista.grados;
  await Promise.all(grados.filter(g => g.estado === "listo").map(async g => {
    datosGrado[g.grado] = await fetch("datos/" + g.archivo, { cache: "no-cache" }).then(r => r.json());
  }));
  sincronizarGrado();
}

/** Grado en uso: el del explorador (alumno) o el elegido por el adulto. */
const gradoActual = () => (estado.perfil === "alumno" ? exploradorActivo()?.grado : almacen.grado) || 1;
function sincronizarGrado() { datos = datosGrado[gradoActual()] || datosGrado[1]; }
function ponerGrado(g) {
  if (!datosGrado[g]) return;
  if (estado.perfil === "alumno") exploradorActivo().grado = g; else almacen.grado = g;
  sincronizarGrado(); guardarEstado(); pintarPerfil();
}
/** Ejecuta fn con el contenido de otro grado (p. ej. para ver el avance de un explorador de 2.º). */
function conGrado(g, fn) {
  const antes = datos;
  datos = datosGrado[g] || datosGrado[1];
  try { return fn(); } finally { datos = antes; }
}
/** Los identificadores de 2.º a 6.º empiezan con el número del grado (2u1, 2j1…); los de 1.º no. */
const gradoDeId = id => { const m = /^([2-6])?[ujer]\d+$/.exec(id || ""); return m ? Number(m[1] || 1) : null; };
const GRADO_EN_LETRAS = ["", "primer", "segundo", "tercer", "cuarto", "quinto", "sexto"];
const gradoTexto = () => `${GRADO_EN_LETRAS[datos.grado]} grado`;
/** Botones para elegir el grado. */
const selectorGrado = () => `<section class="panel"><h2>Elige el grado</h2><div class="grados">${grados.map(g => g.estado === "listo"
  ? `<button class="grado ${g.grado === datos.grado ? "activo" : ""}" data-grado="${g.grado}" aria-pressed="${g.grado === datos.grado}">${esc(g.nombre)}</button>`
  : `<a class="grado" href="#grado/${g.grado}">${esc(g.nombre)}<small>en construcción</small></a>`).join("")}</div></section>`;
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-grado]");
  if (!b) return;
  ponerGrado(Number(b.dataset.grado));
  avisar(`Ahora estás en ${datos.nombreGrado}`);
  if (location.hash === "#inicio" || !location.hash) enrutar(); else location.hash = "inicio";
});

const unidad = id => datos.unidades.find(u => u.id === id);
const juegoDe = idUnidad => datos.juegos.find(j => j.unidad === idUnidad);      // primer juego del tema
const juegosDe = idUnidad => datos.juegos.filter(j => j.unidad === idUnidad);   // todos los juegos del tema
const experimentoDe = idUnidad => datos.experimentos.find(e => e.unidad === idUnidad);
const retoDe = idUnidad => datos.retos.find(r => r.unidad === idUnidad);

/** Insignias: se gana la de una unidad al completar sus 4 actividades.
    El nombre de cada insignia está en datos/primero.json ("insignia"). */
const nombreInsignia = u => u.insignia || u.titulo;
function actividadesDe(u) {
  return [`aprende:${u.id}`, `juegos:${u.id}`, `experimento:${experimentoDe(u.id)?.id}`, `reto:${retoDe(u.id)?.id}`];
}
function insigniasGanadas() {
  if (!datos) return [];
  return datos.unidades.filter(u => actividadesDe(u).every(hecho)).map(u => ({ id: u.id, icono: u.icono, nombre: nombreInsignia(u) }));
}

/* ---------- 4. Mascota: perrito schnauzer explorador ---------- */

/** Nombre de la mascota. Cámbialo aquí y se actualiza en toda la plataforma. */
const NOMBRE_MASCOTA = "Jack";

/* Ilustración: imagenes/jack-sonriente.webp (de referencias/JACK SONRIENTE.png). */
function mascota(mensaje = "", tam = 120) {
  return `<div class="mascota">
    <img src="imagenes/jack-sonriente.webp" width="${tam}" height="${Math.round(tam * 512 / 480)}" alt="${NOMBRE_MASCOTA}, el perrito mascota de EcoQuest">
    ${mensaje ? `<p class="globo">${mensaje}</p>` : ""}
  </div>`;
}

/* ---------- 5. Pantallas ---------- */

const perfil = () => estado.perfil;

/** Etiquetas para distinguir contenido oficial de la propuesta EcoQuest. */
const ETQ_PROPUESTA = `<span class="etiqueta propuesta">Propuesta didáctica EcoQuest</span>`;
const ETQ_OFICIAL = `<span class="etiqueta oficial">Oficial · SEP</span>`;

function pantallaInicio() {
  if (perfil() === "docente") return pantallaInicioDocente();
  if (perfil() === "familia") return pantallaFamilia();
  const total = contarProgreso();
  const texto = "Juntos por un planeta más limpio, justo y saludable. ¡Vamos a cuidarlo desde Sonora!";

  const pct = total.total ? Math.round(total.hechas / total.total * 100) : 0;
  const ganadas = insigniasGanadas().map(i => i.id);
  const sig = siguientePaso();
  const idSig = sig.split("/")[1];
  const sigUnidad = unidad(idSig) || datos.unidades.find(u => juegosDe(u.id).some(j => j.id === idSig) || experimentoDe(u.id)?.id === idSig || retoDe(u.id)?.id === idSig) || datos.unidades[0];
  const sigTipo = sig.startsWith("#aprende") ? "Lección" : sig.startsWith("#juega") ? "Juego" : sig.startsWith("#experimenta") ? "Experimento" : sig.startsWith("#actua") ? "Reto" : "Progreso";
  const dato = azar(DATOS_CURIOSOS);
  app.innerHTML = `
    ${(() => { const ex = exploradorActivo(); return `
    <div class="barra-explorador">
      ${avatarExplorador(ex)}
      <span>Explorando como <b>${esc(apodoDe(ex))}</b></span>
      <a class="boton chico secundario" href="#exploradores">${almacen.exploradores.length > 1 ? "Cambiar de explorador" : "¿Eres otro explorador?"}</a>
    </div>`; })()}
    <section class="banner con-imagen banner-perrito">
      <div class="banner-texto">
        <h1>¡Bienvenido(a) a EcoQuest!</h1>
        <p class="banner-lema">Explora. Aprende. Experimenta. Actúa.</p>
        <p class="banner-intro">${texto} ${botonVoz(texto)}</p>
        <a class="boton" href="${sig}">${total.hechas ? "Continúa tu próxima misión" : "Comienza tu primera misión"} <span aria-hidden="true">→</span></a>
      </div>
      <div class="sello-sonora"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg><span>Desde Sonora<br><small>para un mejor mañana</small></span></div>
    </section>

    <section class="tarjetas-secciones" aria-label="Secciones">
      ${tarjetaSeccion("aprende", "📖", "Aprende", "Descubre conceptos, explora ejemplos y conoce cómo cuidar nuestro planeta.", "Explorar contenidos")}
      ${tarjetaSeccion("juega", "🎮", "Juega", "Diviértete con juegos que pondrán a prueba lo que sabes.", "Ir a los juegos")}
      ${tarjetaSeccion("experimenta", "🧪", "Experimenta", "Realiza actividades sencillas, registra tus datos y observa los resultados.", "Ver experimentos")}
      ${tarjetaSeccion("actua", "🌱", "Actúa", "Completa retos y lleva lo aprendido a tu escuela, casa y comunidad.", "Mis retos")}
    </section>

    <section class="tablero">
      <article class="tarjeta-tablero">
        <header><span class="ico-tablero verde"><svg viewBox="0 0 24 24"><path d="M5 20V14M10 20V9M15 20v-7M20 20V5"/></svg></span><h2>Mi progreso</h2><a href="#progreso">Ver todo</a></header>
        <div class="progreso-anillo">
          <div class="anillo" style="--pct:${pct}"><span><b>${pct}%</b></span></div>
          <div><h3>${pct === 0 ? "¡Empieza hoy!" : pct < 50 ? "¡Vas muy bien!" : pct < 100 ? "¡Excelente avance!" : "¡Lo completaste!"}</h3>
            <p>Has completado ${total.hechas} de ${total.total} actividades.</p></div>
        </div>
      </article>
      <article class="tarjeta-tablero">
        <header><span class="ico-tablero dorado"><svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"/></svg></span><h2>Mis insignias</h2><a href="#insignias">Ver todas</a></header>
        <div class="insignias-mini">${datos.unidades.slice(0, 4).map(u => `
          <a class="insignia-mini ${ganadas.includes(u.id) ? "ganada" : ""} color-${u.color}" href="#insignias"><span class="hex">${u.icono}</span><small>${esc(nombreInsignia(u))}</small></a>`).join("")}</div>
      </article>
      <article class="tarjeta-tablero">
        <header><span class="ico-tablero azul"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg></span><h2>Misión recomendada</h2></header>
        <div class="mision">
          <div class="mision-imagen color-${sigUnidad.color}"><span>${sigUnidad.icono}</span></div>
          <div><small>${sigTipo} · ${esc(sigUnidad.titulo)}</small><h3>${esc(sigUnidad.resumen)}</h3><a class="boton chico" href="${sig}">Comenzar <span aria-hidden="true">→</span></a></div>
        </div>
      </article>
    </section>

    ${selectorGrado()}

    <section class="franja-pie con-imagen">
      <p class="cita">“Un planeta mejor también se construye desde tu escuela.”</p>
      <div class="sabias"><span class="foco" aria-hidden="true">💡</span><div><b>¿Sabías que…?</b><p>${esc(dato)}</p></div></div>
    </section>`;
}

/** Íconos ilustrados de cada sección (imagenes/iconos/). Si falta alguno, se usa el emoji. */
const ICONO_SECCION = {
  aprende: "imagenes/iconos/icono-aprende.png",
  juega: "imagenes/iconos/icono-juega.png",
  experimenta: "imagenes/iconos/icono-experimenta.png",
  actua: "imagenes/iconos/icono-actua.png"
};
const iconoSeccion = (seccion, emoji) => ICONO_SECCION[seccion]
  ? `<img class="icono-img" src="${ICONO_SECCION[seccion]}" alt="" width="256" height="256">`
  : emoji;

function tarjetaSeccion(ruta, icono, titulo, texto, boton) {
  return `<a class="tarjeta-seccion sec-${ruta}" href="#${ruta}">
    <span class="tarjeta-icono" aria-hidden="true">${iconoSeccion(ruta, icono)}</span>
    <h2>${titulo}</h2><p>${texto}</p><span class="tarjeta-boton">${boton} <span aria-hidden="true">→</span></span></a>`;
}

/** Datos curiosos para «¿Sabías que…?» (Propuesta didáctica EcoQuest). */
const DATOS_CURIOSOS = [
  "Sonora tiene una gran biodiversidad. Cuidarla también está en tus manos.",
  "El saguaro puede vivir más de cien años y guarda agua en su tronco.",
  "Una llave que gotea puede llenar muchas cubetas de agua en un solo día.",
  "El venado bura se llama así por sus orejas grandes, parecidas a las de un burro.",
  "Los árboles dan sombra y hacen que la colonia se sienta más fresca en verano."
];

/** Sugiere la siguiente actividad pendiente. */
function siguientePaso() {
  for (const u of datos.unidades) {
    if (!hecho(`aprende:${u.id}`)) return `#aprende/${u.id}`;
    const j = juegoDe(u.id); if (j && !hecho(`juegos:${u.id}`)) return `#juega/${j.id}`;
    const e = experimentoDe(u.id); if (e && !hecho(`experimento:${e.id}`)) return `#experimenta/${e.id}`;
    const r = retoDe(u.id); if (r && !hecho(`reto:${r.id}`)) return `#actua/${r.id}`;
  }
  return "#progreso";
}

function contarProgreso() {
  const claves = datos.unidades.flatMap(actividadesDe);
  return { total: claves.length, hechas: claves.filter(hecho).length };
}
function barraProgreso({ total, hechas }) {
  const pct = total ? Math.round(hechas / total * 100) : 0;
  return `<div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><p class="barra-texto">${pct}%</p>`;
}

/* ----- Aprende ----- */

function pantallaListaAprende() {
  // Muestra directamente el primer tema pendiente (o el primero), con la lista a un lado.
  const u = datos.unidades.find(x => !hecho(`aprende:${x.id}`)) || datos.unidades[0];
  pantallaAprende(u.id);
}

/** Encabezado de sección como en el diseño de referencia: ícono grande, título de color y texto.
    seccion = aprende | juega | experimenta | actua (define el color). extra = contenido a la derecha. */
function encabezadoSeccion(icono, titulo, texto, seccion = "", extra = "") {
  return `<header class="encabezado-seccion sec-${seccion}">
    <span class="icono-seccion" aria-hidden="true">${iconoSeccion(seccion, icono)}</span>
    <div class="titulos-seccion"><h1>${titulo}</h1><p>${texto} ${botonVoz(texto)}</p></div>
    ${extra}
  </header>`;
}
const CARTEL_ACCIONES = `<div class="cartel-mini"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36C20 26 19 19 13 12" stroke="#3d8c4a" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M18 24C8 25 5 17 6 10C15 10 20 16 18 24Z" fill="#7cc46a"/><path d="M21 28C22 19 29 15 35 16C35 25 29 29 21 28Z" fill="#4fae5f"/></svg><b>Pequeñas acciones,<br>grandes cambios.</b></div>`;

function tarjetaActividad(enlace, icono, titulo, texto, completa, color = "verde", extra = "") {
  return `<a class="tarjeta-actividad color-${color}" href="${enlace}">
    <span class="tarjeta-icono" aria-hidden="true">${icono}</span>
    <span class="tarjeta-cuerpo"><b>${esc(titulo)}</b><small>${esc(texto)}</small>${extra}</span>
    <span class="estado ${completa ? "completo" : ""}">${completa ? "✅ Hecho" : "Por hacer"}</span>
  </a>`;
}

/** Cuadro de vinculación curricular oficial + libros + nota docente/familia, según perfil. */
function bloqueCurricular(u) {
  const oficial = `
    <div class="curriculo">
      <h3>Vinculación curricular ${ETQ_OFICIAL}</h3>
      <p class="pequeno">Grado: ${esc(datos.nombreGrado)} · Fase ${datos.fase}. Redacción textual del Programa Sintético de la Fase ${datos.fase} (SEP, 2024).</p>
      ${u.curriculo.map(c => `
        <div class="curriculo-item">
          <p><b>Campo formativo:</b> ${esc(c.campo)}</p>
          <p><b>Contenido:</b> ${esc(c.contenido)}</p>
          <p><b>PDA (${gradoTexto()}):</b></p>
          <ul>${c.pda.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
          <p class="pequeno">Fuente: Programa Sintético de la Fase ${datos.fase}, p. ${c.pagina}.</p>
        </div>`).join("")}
      ${u.libros.length ? `<h4>Para consultar en los libros de texto de ${esc(datos.nombreGrado)} ${ETQ_PROPUESTA}</h4>
      <p class="pequeno">Relación sugerida por EcoQuest a partir de los índices de los libros.</p>
      <ul>${u.libros.map(l => `<li><i>${esc(l.libro)}</i>: «${esc(l.tema)}», p. ${l.pagina}</li>`).join("")}</ul>` : ""}
    </div>`;
  if (perfil() === "docente") {
    return oficial + `<div class="nota-perfil docente"><h3>Sugerencia didáctica ${ETQ_PROPUESTA}</h3><p>${esc(u.docente)}</p></div>`;
  }
  if (perfil() === "familia") {
    return `<div class="nota-perfil familia"><h3>👪 En casa ${ETQ_PROPUESTA}</h3><p>${esc(u.familia)}</p></div>
      <details class="para-adultos"><summary>Ver vinculación con el programa oficial</summary>${oficial}</details>`;
  }
  return `<details class="para-adultos"><summary>Para maestras, maestros y tutores</summary>${oficial}</details>`;
}

function pantallaAprende(idUnidad) {
  const u = unidad(idUnidad);
  if (!u) return pantallaNoEncontrada();
  const a = u.aprende;
  const textoCompleto = a.explicacion.join(" ");
  const hechoU = hecho(`aprende:${u.id}`);
  const sonora = a.explicacion.find(p => /sonora/i.test(p)) || u.resumen;
  const pestanas = [
    ["entender", "Para entender mejor"], ["vida", "En mi vida"], ["palabras", "Palabras clave"], ["preguntas", "¿Lo entendí?"], ["actividad", "Actividad"]
  ];
  app.innerHTML = `
    ${encabezadoSeccion("📖", "Aprende", "Descubre conceptos, explora ejemplos y conoce cómo cuidar nuestro planeta.", "aprende",
      `<label class="buscar-seccion"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="filtroTemas" type="search" placeholder="Buscar un tema…" aria-label="Buscar un tema"></label>`)}
    <div class="dos-columnas">
      <nav class="lista-temas" aria-label="Temas">
        ${datos.unidades.map(x => `<a class="${x.id === u.id ? "activo" : ""} color-${x.color}" href="#aprende/${x.id}" data-texto="${esc(normal(x.titulo + " " + x.resumen))}">
          <span class="ico-tema" aria-hidden="true">${x.icono}</span><span>${esc(x.titulo)}</span>${hecho(`aprende:${x.id}`) ? `<span class="hecho-tema" aria-label="terminado">✓</span>` : ""}</a>`).join("")}
      </nav>

      <article class="panel-tema color-${u.color}">
        <div class="tema-cabeza">
          <div class="tema-texto">
            <div class="tema-titulo"><h2>${esc(u.titulo)}</h2>${botonVoz(textoCompleto)}</div>
            <p class="tema-intro">${esc(a.explicacion[0])}</p>
            ${ETQ_PROPUESTA}
          </div>
          <div class="tema-ilustracion">
            <span class="ilustracion-tema" aria-hidden="true">${a.ilustracion}</span>
            <div class="letrero chico" aria-hidden="true"><span>${esc(u.insignia || u.titulo)}</span></div>
          </div>
        </div>

        <div class="pestanas" role="tablist">
          ${pestanas.map(([id, t], k) => `<button role="tab" class="pestana ${k === 0 ? "activa" : ""}" data-p="${id}" aria-selected="${k === 0}">${t}</button>`).join("")}
        </div>

        <section class="panel-pestana" data-p="entender">
          ${a.explicacion.slice(1).map(p => `<p class="texto-grande">${esc(p)}</p>`).join("")}
        </section>
        <section class="panel-pestana" data-p="vida" hidden>
          <ul class="ejemplos">${a.ejemplos.map(e => `<li>${esc(e)} ${botonVoz(e)}</li>`).join("")}</ul>
        </section>
        <section class="panel-pestana" data-p="palabras" hidden>
          <div class="conceptos">${a.conceptos.map(c => `<div class="concepto"><b>${esc(c.termino)}</b><p>${esc(c.definicion)}</p>${botonVoz(c.termino + ". " + c.definicion)}</div>`).join("")}</div>
        </section>
        <section class="panel-pestana" data-p="preguntas" hidden>
          <div class="preguntas">${a.preguntas.map((p, i) => preguntaHtml(p, i)).join("")}</div>
        </section>
        <section class="panel-pestana" data-p="actividad" hidden>
          <div class="actividad"><h3>✏️ ${esc(a.actividad.titulo)}</h3><p class="texto-grande">${esc(a.actividad.instrucciones)} ${botonVoz(a.actividad.instrucciones)}</p></div>
        </section>

        <div class="franja-cartel"><div class="cartel-tema"><p>${esc(sonora)}</p></div></div>

        ${bloqueCurricular(u)}

        <div class="acciones">
          <button class="boton" id="terminarLeccion" ${hechoU ? "disabled" : ""}>${hechoU ? "✓ Lección terminada" : "Terminé esta lección"}</button>
          <a class="boton secundario" href="#juega/${juegoDe(u.id)?.id}">Ir al juego del tema →</a>
        </div>
      </article>
    </div>`;

  // Pestañas
  app.querySelectorAll(".pestana").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll(".pestana").forEach(x => { x.classList.toggle("activa", x === b); x.setAttribute("aria-selected", String(x === b)); });
    app.querySelectorAll(".panel-pestana").forEach(p => p.hidden = p.dataset.p !== b.dataset.p);
  }));
  // Filtro de temas
  document.getElementById("filtroTemas").addEventListener("input", ev => {
    const q = normal(ev.target.value);
    app.querySelectorAll(".lista-temas a").forEach(x => x.hidden = q && !x.dataset.texto.includes(q));
  });
  activarPreguntas(app.querySelector(".preguntas"));
  const btn = document.getElementById("terminarLeccion");
  btn.addEventListener("click", () => {
    marcarHecho(`aprende:${u.id}`);
    btn.disabled = true;
    btn.textContent = "✓ Lección terminada";
  });
}

/** HTML de una pregunta de opción múltiple (se usa en Aprende). */
function preguntaHtml(p, i) {
  return `<div class="pregunta" data-correcta="${p.correcta}" data-explicacion="${esc(p.explicacion)}">
    <p><b>${i + 1}. ${esc(p.pregunta)}</b> ${botonVoz(p.pregunta + " " + p.opciones.join(", "))}</p>
    <div class="opciones">${p.opciones.map((o, j) => `<button class="opcion" data-op="${j}">${esc(o)}</button>`).join("")}</div>
    <p class="retro" aria-live="polite"></p>
  </div>`;
}
/** Da retroalimentación a las preguntas de comprensión. */
function activarPreguntas(contenedor) {
  contenedor.querySelectorAll(".pregunta").forEach(div => {
    div.querySelectorAll(".opcion").forEach(b => b.addEventListener("click", () => {
      const correcta = Number(div.dataset.correcta);
      const elegida = Number(b.dataset.op);
      div.querySelectorAll(".opcion").forEach(x => { x.disabled = true; if (Number(x.dataset.op) === correcta) x.classList.add("correcta"); });
      if (elegida !== correcta) b.classList.add("incorrecta");
      const retro = div.querySelector(".retro");
      retro.innerHTML = `${elegida === correcta ? "🎉 <b>¡Muy bien!</b>" : "💡 <b>Casi.</b>"} ${esc(div.dataset.explicacion)}`;
      retro.className = "retro " + (elegida === correcta ? "bien" : "mal");
    }));
  });
}

/* ----- Juega ----- */

const TIPOS_JUEGO = {
  opcion: "Opción múltiple", vf: "Verdadero o falso", completar: "Completa la palabra", memorama: "Memorama", clasificar: "Clasifica",
  loteria: "Lotería", sombras: "Sombras misteriosas", ordenar: "Ordena la historia", buraDice: `${NOMBRE_MASCOTA} dice`,
  detective: "Detective ambiental", gotas: "Atrapa las gotas", planta: "Cuida tu planta", colonia: "Colonia verde",
  ...TIPOS_RETADORES   // juegos de 3.º a 6.º (juegos-retadores.js)
};
const ICONO_JUEGO = { loteria: "🎴", sombras: "🌑", ordenar: "🔢", buraDice: "🎵", detective: "🔍", gotas: "💧", planta: "🌱", colonia: "🏘️", ...ICONO_RETADOR };

function pantallaListaJuegos() {
  // Ordena los juegos por tema, en el orden de las unidades.
  const orden = id => datos.unidades.findIndex(u => u.id === id);
  const juegos = [...datos.juegos].sort((a, b) => orden(a.unidad) - orden(b.unidad));
  app.innerHTML = `
    ${encabezadoSeccion("🎮", "Juega", "Diviértete con juegos interactivos que te ayudarán a poner a prueba tus conocimientos.", "juega", CARTEL_ACCIONES)}
    <div class="filtros-juego" role="group" aria-label="Filtrar por tema">
      <button class="filtro activo" data-u="">Todos</button>
      ${datos.unidades.map(u => `<button class="filtro" data-u="${u.id}">${u.icono} ${esc(u.titulo)}</button>`).join("")}
    </div>
    <div class="rejilla-juegos">
      ${juegos.map(j => {
        const u = unidad(j.unidad);
        const p = estado.puntajes[j.id];
        return `<article class="tarjeta-juego color-${u.color}" data-u="${u.id}">
          <a class="mini-juego" href="#juega/${j.id}" tabindex="-1" aria-hidden="true">${miniaturaJuego(j)}</a>
          <div class="cuerpo-juego">
            <small class="tipo-juego">${TIPOS_JUEGO[j.tipo]}${hecho(`juego:${j.id}`) ? ` · <span class="hecho-chip">✓ Jugado</span>` : ""}</small>
            <h3>${esc(j.titulo)}</h3>
            <p>${esc(j.instrucciones.split(". ")[0].replace(/([^.?!])$/, "$1."))}</p>
            ${p ? `<small class="mejor">Mejor resultado: ${p.aciertos} de ${p.total}</small>` : ""}
            <a class="boton chico" href="#juega/${j.id}">Jugar ahora <span aria-hidden="true">→</span></a>
          </div>
        </article>`;
      }).join("")}
    </div>`;
  app.querySelectorAll(".filtro").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll(".filtro").forEach(x => x.classList.toggle("activo", x === b));
    app.querySelectorAll(".tarjeta-juego").forEach(t => t.hidden = b.dataset.u && t.dataset.u !== b.dataset.u);
  }));
}

/** Miniatura ilustrada de cada juego (sin emojis): fondo de color + ilustraciones de ilustraciones.js. */
function miniaturaJuego(j) {
  const il = n => (typeof ILUS === "object" && ILUS[n]) ? ILUS[n] : null;
  const dibujo = (n, x, y, w, extra = "") => {
    const i = il(n); if (!i) return "";
    const [, , vw, vh] = i.vb.split(" ").map(Number);
    return `<svg x="${x}" y="${y}" width="${w}" height="${w * vh / vw}" viewBox="${i.vb}" ${extra}>${i.svg}</svg>`;
  };
  const fondos = {
    clasificar: ["#fff3dc", "#ffe1b3"], memorama: ["#e6f4e2", "#c9e7c0"], completar: ["#e0f3fb", "#bfe5f5"], vf: ["#eaf6e6", "#cdeac4"],
    opcion: ["#fff4cf", "#ffe49a"], loteria: ["#fde6e9", "#f9c7cf"], sombras: ["#fff1d6", "#ffd99c"], ordenar: ["#efe8fb", "#dccdf5"],
    buraDice: ["#e8f0ff", "#cddcff"], detective: ["#e3f4fb", "#c5e6f3"], gotas: ["#dff2fc", "#b5e0f6"], planta: ["#eaf6e2", "#cfe9bf"], colonia: ["#f4ecdf", "#e5d4b8"]
  };
  const [c1, c2] = fondos[j.tipo] || ["#eef4ec", "#d8e8d2"];
  const tarjeta = (x, y, r, contenido) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-38" y="-48" width="76" height="96" rx="12" fill="#fffdf6" stroke="#e2d8c3" stroke-width="3"/>${contenido}</g>`;
  const arte = {
    clasificar: dibujo("botesSeparados", 30, 40, 240),
    memorama: tarjeta(110, 100, -10, dibujo("cardenal", -30, -24, 60)) + tarjeta(190, 96, 8, `<rect x="-26" y="-34" width="52" height="68" rx="8" fill="#4fae5f"/><path d="M0 -18 L10 0 L0 18 L-10 0Z" fill="#bde8c6"/>`),
    completar: dibujo("llaveAbierta", 40, 20, 110) + `<g font-family="Fredoka, sans-serif" font-weight="700" font-size="42" fill="#1c7fb0"><text x="160" y="110">AG</text><text x="222" y="110" fill="#f3a047">_</text><text x="246" y="110">A</text></g>`,
    vf: dibujo("cardenal", 30, 50, 110) + `<g font-family="Fredoka, sans-serif" font-weight="700" font-size="40"><circle cx="190" cy="80" r="30" fill="#29a66a"/><text x="190" y="94" text-anchor="middle" fill="#fff">V</text><circle cx="250" cy="130" r="30" fill="#e4572e"/><text x="250" y="144" text-anchor="middle" fill="#fff">F</text></g>`,
    opcion: dibujo("lamparaDia", 30, 30, 120) + `<g><rect x="160" y="50" width="110" height="26" rx="13" fill="#fff"/><rect x="160" y="86" width="110" height="26" rx="13" fill="#29a66a"/><rect x="160" y="122" width="110" height="26" rx="13" fill="#fff"/></g>`,
    loteria: tarjeta(100, 100, -8, dibujo("cardenal", -30, -24, 60)) + tarjeta(170, 96, 3, dibujo("maceta", -22, -38, 44)) + tarjeta(236, 104, 12, dibujo("boteReciclaje", -18, -36, 36)),
    sombras: `<g opacity=".95" style="filter:brightness(0)">${dibujo("cardenal", 60, 40, 130)}</g>` + `<circle cx="230" cy="60" r="28" fill="#ffd45e"/>`,
    ordenar: [0, 1, 2].map(k => `<g transform="translate(${70 + k * 80} 100)"><rect x="-32" y="-40" width="64" height="80" rx="10" fill="#fff" stroke="#c7b6ea" stroke-width="3"/><text y="-12" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="20" fill="#6b45b5">${k + 1}</text></g>`).join("") + dibujo("maceta", 58, 98, 26) + dibujo("maceta", 136, 88, 36) + dibujo("arbolBanqueta", 210, 70, 44),
    buraDice: dibujo("bocina", 40, 30, 120) + dibujo("cardenal", 180, 60, 90),
    gotas: dibujo("llaveAbierta", 30, 20, 110) + `<g fill="#3f9fcf">${[[180, 50], [220, 90], [170, 120], [250, 40]].map(([x, y]) => `<path d="M${x} ${y} q12 18 0 26 q-12 -8 0 -26Z"/>`).join("")}</g>`,
    planta: dibujo("maceta", 100, 26, 100) + `<circle cx="240" cy="50" r="24" fill="#ffd45e"/><g fill="#3f9fcf"><path d="M60 60 q10 16 0 22 q-10 -6 0 -22Z"/><path d="M50 100 q10 16 0 22 q-10 -6 0 -22Z"/></g>`,
    colonia: dibujo("arbolBanqueta", 30, 30, 90) + dibujo("banca", 120, 110, 90) + dibujo("boteReciclaje", 220, 80, 50)
  };
  const ret = PORTADAS_RETADORES[j.tipo];
  if (ret) return `<svg viewBox="0 0 300 190" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="mj${j.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ret[0]}"/><stop offset="1" stop-color="${ret[1]}"/></linearGradient></defs><rect width="300" height="190" fill="url(#mj${j.id})"/>${ret[2]}</svg>`;
  const portada = { j4: "portada-residuos", j16: "detective-parque" }[j.id];   // portadas con imagen propia
  if (portada) return `<img src="imagenes/${portada}.webp" alt="" loading="lazy">`;
  if (j.id === "j6") arte.clasificar = dibujo("bocina", 40, 25, 110) + dibujo("cardenal", 180, 55, 95);   // «¿Fuerte o suave?» no es de basura
  return `<svg viewBox="0 0 300 190" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="mj${j.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="300" height="190" fill="url(#mj${j.id})"/>
    <circle cx="260" cy="20" r="60" fill="#fff" opacity=".35"/><circle cx="20" cy="180" r="50" fill="#fff" opacity=".3"/>
    ${arte[j.tipo] || ""}
  </svg>`;
}

function pantallaJuego(id) {
  const j = datos.juegos.find(x => x.id === id);
  if (!j) return pantallaNoEncontrada();
  const u = unidad(j.unidad);
  app.innerHTML = `
    <a class="volver" href="#juega">← Todos los juegos</a>
    <article class="ficha color-${u.color}">
      <header class="ficha-encabezado">
        <span class="ilustracion" aria-hidden="true">${u.icono}</span>
        <div><p class="pequeno">JUEGA · ${TIPOS_JUEGO[j.tipo].toUpperCase()}</p><h1>${esc(j.titulo)}</h1>${ETQ_PROPUESTA}</div>
        <div class="bura-juego" id="buraJuego">${mascota("¡Vamos a jugar!", 96)}</div>
      </header>
      <p class="texto-grande">${esc(j.instrucciones)} ${botonVoz(j.instrucciones)}</p>
      <div id="zonaJuego" class="zona-juego"></div>
    </article>`;
  racha = 0;
  const zona = document.getElementById("zonaJuego");
  const motores = {
    opcion: juegoPreguntas, vf: juegoPreguntas, sombras: juegoPreguntas, completar: juegoCompletar, memorama: juegoMemorama,
    clasificar: juegoClasificar, loteria: juegoLoteria, ordenar: juegoOrdenar, buraDice: juegoBuraDice,
    detective: juegoDetective, gotas: juegoGotas, planta: juegoPlanta, colonia: juegoColonia, ...MOTORES_RETADORES
  };
  (motores[j.tipo] || pantallaNoEncontrada)(j, zona);
}

/** Pantalla final de cualquier juego: guarda el mejor resultado y marca el juego como hecho. */
function finDeJuego(j, zona, aciertos, total, detalle = "") {
  if (!zona.isConnected) return;   // ya se salió del juego
  const previo = estado.puntajes[j.id];
  if (perfil() === "alumno" && (!previo || aciertos > previo.aciertos)) estado.puntajes[j.id] = { aciertos, total };
  guardarEstado();
  // Los juegos retadores (3.º a 6.º) se dan por completados con 60 % o más.
  const aprobado = !MOTORES_RETADORES[j.tipo] || aciertos >= total * 0.6;
  if (aprobado) marcarHecho(`juego:${j.id}`);
  const excelente = aciertos === total;
  if (aprobado) sonidoVictoria();
  if (aprobado && aciertos >= total / 2) confeti();
  zona.innerHTML = `
    <div class="fin-juego">
      ${mascota(excelente ? "¡Excelente! Lo hiciste perfecto." : !aprobado ? "¡Casi! Necesitas 60 % o más para completarlo. Revisa las explicaciones e inténtalo otra vez." : "¡Buen trabajo! Puedes jugar otra vez para mejorar.", 110)}
      <p class="puntaje">${aciertos} de ${total} ${excelente ? "⭐⭐⭐" : aciertos >= total / 2 ? "⭐⭐" : "⭐"}</p>
      ${detalle}
      <div class="acciones">
        <button class="boton" id="otraVez">🔁 Jugar otra vez</button>
        <a class="boton secundario" href="#experimenta/${experimentoDe(j.unidad)?.id}">Ir al experimento del tema →</a>
      </div>
    </div>`;
  zona.querySelector("#otraVez").addEventListener("click", () => pantallaJuego(j.id));
}

/** Opción múltiple y verdadero/falso: una pregunta a la vez. */
function juegoPreguntas(j, zona) {
  const esVF = j.tipo === "vf";
  // "sombras": la pregunta muestra la silueta de un dibujo y al responder se revela.
  const items = esVF
    ? j.items.map(it => ({ pregunta: it.frase, opciones: ["✔️ Verdadero", "✖️ Falso"], correcta: it.respuesta ? 0 : 1, explicacion: it.explicacion }))
    : j.tipo === "sombras"
      ? j.items.map(it => ({ pregunta: j.pregunta || "¿De quién es esta sombra?", imagen: it.icono, opciones: it.opciones, correcta: it.correcta, explicacion: it.explicacion }))
      : j.items;
  let i = 0, aciertos = 0;

  function mostrar() {
    if (i >= items.length) return finDeJuego(j, zona, aciertos, items.length);
    const p = items[i];
    zona.innerHTML = `
      <p class="contador">Pregunta ${i + 1} de ${items.length}</p>
      ${p.imagen ? `<div class="silueta" id="silueta" aria-hidden="true">${p.imagen}</div>` : ""}
      <h2 class="pregunta-juego">${esc(p.pregunta)} ${botonVoz(p.pregunta)}</h2>
      <div class="opciones grandes ${esVF ? "vf" : ""}">${p.opciones.map((o, k) => `<button class="opcion" data-op="${k}">${esc(o)}</button>`).join("")}</div>
      <p class="retro" aria-live="polite"></p>
      <button class="boton" id="siguiente" hidden>Siguiente →</button>`;
    zona.querySelectorAll(".opcion").forEach(b => b.addEventListener("click", () => {
      const k = Number(b.dataset.op);
      const ok = k === p.correcta;
      if (ok) aciertos++;
      zona.querySelectorAll(".opcion").forEach(x => { x.disabled = true; if (Number(x.dataset.op) === p.correcta) x.classList.add("correcta"); });
      if (!ok) b.classList.add("incorrecta");
      reaccion(ok);
      zona.querySelector("#silueta")?.classList.add("revelada");
      const retro = zona.querySelector(".retro");
      retro.className = "retro " + (ok ? "bien" : "mal");
      retro.innerHTML = `${ok ? "🎉 <b>¡Correcto!</b>" : "💡 <b>No es así.</b>"} ${esc(p.explicacion)}`;
      const sig = zona.querySelector("#siguiente");
      sig.hidden = false;
      sig.textContent = i + 1 < items.length ? "Siguiente →" : "Ver resultado →";
      sig.focus();
      sig.onclick = () => { i++; mostrar(); };
    }));
  }
  mostrar();
}

/** Completar palabras: falta una letra. */
function juegoCompletar(j, zona) {
  let i = 0, aciertos = 0;
  function mostrar() {
    if (i >= j.items.length) return finDeJuego(j, zona, aciertos, j.items.length);
    const it = j.items[i];
    const letras = [...it.palabra];
    const correcta = letras[it.falta];
    const conHueco = letras.map((l, k) => k === it.falta ? `<span class="hueco">_</span>` : `<span>${esc(l)}</span>`).join("");
    zona.innerHTML = `
      <p class="contador">Palabra ${i + 1} de ${j.items.length}</p>
      <div class="pista" aria-hidden="true">${it.pista}</div>
      <p class="palabra" aria-label="Palabra con una letra faltante">${conHueco}</p>
      <div class="opciones grandes letras">${mezclar(it.opciones).map(o => `<button class="opcion" data-letra="${esc(o)}">${esc(o)}</button>`).join("")}</div>
      <p class="retro" aria-live="polite"></p>
      <button class="boton" id="siguiente" hidden>Siguiente →</button>`;
    zona.querySelectorAll(".opcion").forEach(b => b.addEventListener("click", () => {
      const ok = b.dataset.letra === correcta;
      if (ok) aciertos++;
      zona.querySelectorAll(".opcion").forEach(x => { x.disabled = true; if (x.dataset.letra === correcta) x.classList.add("correcta"); });
      if (!ok) b.classList.add("incorrecta");
      reaccion(ok);
      zona.querySelector(".hueco").textContent = correcta;
      zona.querySelector(".hueco").classList.add("lleno");
      const retro = zona.querySelector(".retro");
      retro.className = "retro " + (ok ? "bien" : "mal");
      retro.innerHTML = ok ? `🎉 <b>¡Correcto!</b> Se escribe ${esc(it.palabra)}.` : `💡 Faltaba la letra <b>${esc(correcta)}</b>: ${esc(it.palabra)}.`;
      hablar(it.palabra);
      const sig = zona.querySelector("#siguiente");
      sig.hidden = false; sig.focus();
      sig.onclick = () => { i++; mostrar(); };
    }));
  }
  mostrar();
}

/** Memorama: encontrar parejas iguales. */
function juegoMemorama(j, zona) {
  const cartas = mezclar([...j.pares, ...j.pares].map((p, k) => ({ ...p, clave: k })));
  let volteadas = [], pares = 0, intentos = 0, bloqueado = false;
  zona.innerHTML = `
    <p class="contador" id="memoInfo">Pares: 0 de ${j.pares.length} · Intentos: 0</p>
    <div class="memorama">${cartas.map((c, k) => `
      <button class="carta" data-k="${k}" aria-label="Tarjeta boca abajo">
        <span class="cara frente">❓</span>
        <span class="cara reverso"><span class="carta-icono">${c.icono}</span><small>${esc(c.nombre)}</small></span>
      </button>`).join("")}
    </div>
    <p class="retro" aria-live="polite"></p>`;
  const info = zona.querySelector("#memoInfo");
  const retro = zona.querySelector(".retro");
  zona.querySelectorAll(".carta").forEach(btn => btn.addEventListener("click", () => {
    if (bloqueado || btn.classList.contains("volteada")) return;
    const c = cartas[Number(btn.dataset.k)];
    btn.classList.add("volteada");
    btn.setAttribute("aria-label", c.nombre);
    volteadas.push({ btn, c });
    if (volteadas.length < 2) return;
    intentos++;
    const [a, b] = volteadas;
    if (a.c.nombre === b.c.nombre) {
      pares++;
      a.btn.classList.add("par"); b.btn.classList.add("par");
      a.btn.disabled = b.btn.disabled = true;
      reaccion(true);
      retro.className = "retro bien";
      retro.textContent = `🎉 ¡Encontraste: ${a.c.nombre}!`;
      hablar(a.c.nombre);
      volteadas = [];
      if (pares === j.pares.length) {
        // Puntaje: perfecto con pocos intentos; baja una estrella cada 2 intentos de más.
        const n = j.pares.length;
        const aciertos = Math.max(1, Math.min(n, n - Math.floor((intentos - n) / 2)));
        setTimeout(() => finDeJuego(j, zona, aciertos, n, `<p>Lo resolviste en ${intentos} intentos.</p>`), 900);
      }
    } else {
      bloqueado = true;
      reaccion(false, "¡Recuerda dónde están!");
      retro.className = "retro mal";
      retro.textContent = "No son iguales. ¡Intenta recordar dónde están!";
      setTimeout(() => {
        [a, b].forEach(x => { x.btn.classList.remove("volteada"); x.btn.setAttribute("aria-label", "Tarjeta boca abajo"); });
        volteadas = []; bloqueado = false;
      }, 1100);
    }
    info.textContent = `Pares: ${pares} de ${j.pares.length} · Intentos: ${intentos}`;
  }));
}

/** Clasificar residuos: tocar un residuo y luego el bote. */
function juegoClasificar(j, zona) {
  const pendientes = mezclar(j.items);
  let elegido = null, errores = 0, primerIntentoBien = 0;
  const fallados = new Set();
  zona.innerHTML = `
    <div class="residuos" id="residuos"></div>
    <div class="botes">${j.botes.map(b => `<button class="bote" data-bote="${b.id}"><span class="bote-icono">${b.icono}</span>${esc(b.nombre)}<small class="bote-cuenta">0</small></button>`).join("")}</div>
    <p class="retro" aria-live="polite">Primero toca un residuo.</p>
    ${j.nota ? `<p class="pequeno">ℹ️ ${esc(j.nota)}</p>` : ""}`;
  const caja = zona.querySelector("#residuos");
  const retro = zona.querySelector(".retro");

  function dibujarResiduos() {
    caja.innerHTML = pendientes.map((it, k) => `<button class="residuo ${elegido === k ? "elegido" : ""}" data-k="${k}">${it.sonido ? `<small class="con-sonido" aria-hidden="true">🔊</small>` : ""}<span>${it.icono}</span>${esc(it.nombre)}</button>`).join("");
    caja.querySelectorAll(".residuo").forEach(b => b.addEventListener("click", () => {
      elegido = Number(b.dataset.k);
      const it = pendientes[elegido];
      retro.className = "retro";
      // Si la tarjeta tiene sonido, se escucha el sonido; si no, se lee su nombre.
      const sono = it.sonido && reproducirSonido(it.sonido);
      if (!sono) hablar(it.nombre);
      retro.textContent = sono
        ? `🔊 Escuchaste: ${it.nombre}. Tócalo otra vez para repetir, o elige su lugar.`
        : `Elegiste: ${it.nombre}. Ahora toca el bote.`;
      dibujarResiduos();
    }));
  }
  zona.querySelectorAll(".bote").forEach(b => b.addEventListener("click", () => {
    if (elegido === null) { retro.className = "retro mal"; retro.textContent = "Primero toca un residuo."; return; }
    const it = pendientes[elegido];
    if (b.dataset.bote === it.bote) {
      if (!fallados.has(it.nombre)) primerIntentoBien++;
      const cuenta = b.querySelector(".bote-cuenta");
      cuenta.textContent = Number(cuenta.textContent) + 1;
      b.classList.add("brinco"); setTimeout(() => b.classList.remove("brinco"), 400);
      reaccion(true);
      retro.className = "retro bien";
      retro.innerHTML = `🎉 <b>¡Correcto!</b> ${esc(it.explicacion)}`;
      pendientes.splice(elegido, 1);
      elegido = null;
      dibujarResiduos();
      if (!pendientes.length) setTimeout(() => finDeJuego(j, zona, primerIntentoBien, j.items.length, `<p>Errores: ${errores}</p>`), 1200);
    } else {
      errores++;
      fallados.add(it.nombre);
      reaccion(false);
      retro.className = "retro mal";
      retro.innerHTML = `💡 <b>Ahí no va.</b> ${esc(j.pista || "")} Inténtalo de nuevo.`;
      b.classList.add("sacudir"); setTimeout(() => b.classList.remove("sacudir"), 400);
    }
  }));
  dibujarResiduos();
}

/* ----- Juegos nuevos ----- */

/** 🎴 Lotería: la mascota "canta" cartas; el niño marca en su tabla las que ya salieron. */
function juegoLoteria(j, zona) {
  const tabla = mezclar(j.cartas).slice(0, 9);
  const baraja = mezclar(j.cartas);
  const cantadas = new Set(), marcadas = new Set();
  let idx = -1, errores = 0;
  zona.innerHTML = `
    <div class="loteria">
      <div class="carta-cantada">
        <p class="pequeno">CARTA DE ${NOMBRE_MASCOTA.toUpperCase()}</p>
        <div class="carta-lot" id="cartaActual">🎴</div>
        <p class="nombre-carta" id="nombreActual">Toca «Sacar carta»</p>
        <button class="boton" id="sacar">🎴 Sacar carta</button>
        <p class="pequeno" id="quedan">Quedan ${baraja.length} cartas</p>
      </div>
      <div class="tabla-loteria">${tabla.map((c, k) => `<button class="celda" data-k="${k}" aria-label="${esc(c.nombre)}"><span>${c.icono}</span><small>${esc(c.nombre)}</small></button>`).join("")}</div>
    </div>
    <p class="retro" aria-live="polite">Cuando salga una carta que tengas en tu tabla, ¡márcala!</p>`;
  const retro = zona.querySelector(".retro");
  const sacar = zona.querySelector("#sacar");
  sacar.addEventListener("click", () => {
    idx++;
    if (idx >= baraja.length) return;
    const c = baraja[idx];
    cantadas.add(c.nombre);
    const carta = zona.querySelector("#cartaActual");
    carta.textContent = c.icono;
    carta.classList.remove("brinco"); void carta.offsetWidth; carta.classList.add("brinco");
    zona.querySelector("#nombreActual").innerHTML = `<b>${esc(c.nombre)}</b><br><small>${esc(c.frase || "")}</small>`;
    zona.querySelector("#quedan").textContent = `Quedan ${baraja.length - idx - 1} cartas`;
    hablar(`${c.frase ? c.frase + ". " : ""}¡${c.nombre}!`);
    if (idx === baraja.length - 1) { sacar.disabled = true; sacar.textContent = "Ya salieron todas"; }
  });
  zona.querySelectorAll(".celda").forEach(b => b.addEventListener("click", () => {
    const k = Number(b.dataset.k), c = tabla[k];
    if (marcadas.has(k)) return;
    if (cantadas.has(c.nombre)) {
      marcadas.add(k); b.classList.add("marcada");
      reaccion(true);
      retro.className = "retro bien"; retro.textContent = `🫘 ¡Marcaste ${c.nombre}!`;
      if (marcadas.size === tabla.length) {
        reaccion(true, "¡LOTERÍA!"); hablar("¡Lotería!");
        setTimeout(() => finDeJuego(j, zona, Math.max(1, tabla.length - errores), tabla.length, `<p>¡Llenaste tu tabla! Marcas equivocadas: ${errores}</p>`), 1200);
      }
    } else {
      errores++;
      reaccion(false, "Esa carta no ha salido");
      b.classList.add("sacudir"); setTimeout(() => b.classList.remove("sacudir"), 400);
      retro.className = "retro mal"; retro.textContent = `💡 «${c.nombre}» todavía no sale. Espera a que ${NOMBRE_MASCOTA} la cante.`;
    }
  }));
}

/** 🔢 Ordena la historia: tocar las tarjetas en el orden correcto. */
function juegoOrdenar(j, zona) {
  let s = 0, aciertos = 0;
  function mostrar() {
    if (s >= j.secuencias.length) return finDeJuego(j, zona, aciertos, j.secuencias.length);
    const sec = j.secuencias[s];
    let siguiente = 0, errores = 0;
    const mezcla = mezclar(sec.pasos.map((p, i) => ({ ...p, i })));
    zona.innerHTML = `
      <p class="contador">Historia ${s + 1} de ${j.secuencias.length}</p>
      <h2>${esc(sec.titulo)} ${botonVoz(sec.titulo)}</h2>
      <div class="linea-orden">${sec.pasos.map((_, k) => `<div class="hueco-orden" data-k="${k}"><b>${k + 1}</b></div>`).join("")}</div>
      <p class="pequeno">Toca las tarjetas en orden: ¿qué pasa primero?</p>
      <div class="tarjetas-orden">${mezcla.map(p => `<button class="tarjeta-orden" data-i="${p.i}"><span>${p.icono}</span>${esc(p.texto)}</button>`).join("")}</div>
      <p class="retro" aria-live="polite"></p>
      <button class="boton" id="siguiente" hidden>Siguiente →</button>`;
    const retro = zona.querySelector(".retro");
    zona.querySelectorAll(".tarjeta-orden").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.i), paso = sec.pasos[i];
      if (i === siguiente) {
        const hueco = zona.querySelector(`.hueco-orden[data-k="${siguiente}"]`);
        hueco.innerHTML = `<b>${siguiente + 1}</b><span>${paso.icono}</span><small>${esc(paso.texto)}</small>`;
        hueco.classList.add("lleno");
        b.remove();
        siguiente++;
        hablar(paso.texto);
        if (siguiente === sec.pasos.length) {
          if (errores <= 1) aciertos++;   // se permite un error por historia (1.º grado)
          reaccion(true, "¡Historia completa!");
          retro.className = "retro bien"; retro.innerHTML = `🎉 <b>¡Muy bien!</b> ${esc(sec.explicacion || "")}`;
          const sig = zona.querySelector("#siguiente");
          sig.hidden = false; sig.textContent = s + 1 < j.secuencias.length ? "Siguiente historia →" : "Ver resultado →";
          sig.onclick = () => { s++; mostrar(); };
        } else {
          reaccion(true);
          retro.className = "retro"; retro.textContent = "¡Bien! ¿Y después?";
        }
      } else {
        errores++;
        reaccion(false, "¿Qué pasa antes?");
        b.classList.add("sacudir"); setTimeout(() => b.classList.remove("sacudir"), 400);
        retro.className = "retro mal"; retro.textContent = "💡 Eso pasa después. Piensa qué sigue.";
      }
    }));
  }
  mostrar();
}

/** 🎵 «Jack dice» (tipo buraDice): escuchar una secuencia de sonidos y repetirla. */
function juegoBuraDice(j, zona) {
  const rondas = j.rondas || [2, 3, 4, 5];
  let ronda = 0, entrada = 0, aciertos = 0, fallo = false, bloqueado = true;
  const secuencia = [];
  zona.innerHTML = `
    <p class="contador" id="infoRonda">${rondas.length} rondas. ¡Escucha con atención!</p>
    <div class="botones-sonido">${j.sonidos.map((s, k) => `<button class="boton-sonido" data-k="${k}" disabled><span>${s.icono}</span>${esc(s.nombre)}</button>`).join("")}</div>
    <p class="retro" aria-live="polite">Toca «Empezar». ${NOMBRE_MASCOTA} tocará unos sonidos y tú los repites en el mismo orden.</p>
    <div class="acciones"><button class="boton" id="empezar">▶️ Empezar</button><button class="boton secundario" id="repetir" hidden>🔁 Escuchar otra vez</button></div>`;
  const botones = [...zona.querySelectorAll(".boton-sonido")];
  const retro = zona.querySelector(".retro");
  const brillar = k => { botones[k].classList.add("brilla"); setTimeout(() => botones[k].classList.remove("brilla"), 700); };
  function tocarSecuencia() {
    bloqueado = true; botones.forEach(b => b.disabled = true);
    retro.className = "retro"; retro.textContent = "🎧 Escucha…";
    secuencia.forEach((k, n) => setTimeout(() => {
      if (!zona.isConnected) return;
      brillar(k); reproducirSonido(j.sonidos[k].sonido);
    }, 400 + n * 1300));
    setTimeout(() => {
      if (!zona.isConnected) return;
      bloqueado = false; botones.forEach(b => b.disabled = false);
      retro.textContent = "👆 Ahora tú: repite los sonidos en orden.";
    }, 400 + secuencia.length * 1300);
  }
  function nuevaRonda() {
    if (!zona.isConnected) return;
    if (ronda >= rondas.length) return finDeJuego(j, zona, aciertos, rondas.length);
    while (secuencia.length < rondas[ronda]) secuencia.push(Math.floor(Math.random() * j.sonidos.length));
    entrada = 0; fallo = false;
    zona.querySelector("#infoRonda").textContent = `Ronda ${ronda + 1} de ${rondas.length} · ${secuencia.length} sonidos`;
    tocarSecuencia();
  }
  zona.querySelector("#empezar").addEventListener("click", ev => {
    ev.target.hidden = true; zona.querySelector("#repetir").hidden = false;
    audio(); nuevaRonda();
  });
  zona.querySelector("#repetir").addEventListener("click", () => { if (!bloqueado) { entrada = 0; tocarSecuencia(); } });
  botones.forEach((b, k) => b.addEventListener("click", () => {
    if (bloqueado) return;
    brillar(k); reproducirSonido(j.sonidos[k].sonido);
    if (k === secuencia[entrada]) {
      entrada++;
      if (entrada === secuencia.length) {
        bloqueado = true;
        if (!fallo) aciertos++;
        reaccion(true, "¡Lo repetiste!");
        retro.className = "retro bien"; retro.textContent = "🎉 ¡Muy bien! Viene una ronda más larga.";
        ronda++;
        setTimeout(nuevaRonda, 2200);
      }
    } else {
      bloqueado = true; fallo = true; entrada = 0;
      reaccion(false, "¡Escucha otra vez!");
      retro.className = "retro mal"; retro.textContent = "💡 Ese no era. Escucha otra vez la secuencia.";
      setTimeout(tocarSecuencia, 1800);
    }
  }));
}

/** 🔍 Detective ambiental: encontrar los problemas escondidos en escenas ilustradas.
    Las escenas son imágenes (imagenes/detective-*.webp). Los objetos ya están dibujados en ellas;
    datos/primero.json dice qué zona ocupa cada uno, en % de la imagen: x, y (centro), w, h (tamaño). */
function juegoDetective(j, zona) {
  const totalProblemas = j.escenas.reduce((n, e) => n + e.elementos.filter(x => x.problema).length, 0);
  const fondo = e => `<img src="imagenes/detective-${e.fondo}.webp" alt="" draggable="false">`;
  let s = 0, encontrados = 0, errores = 0, pistas = 0;

  // Elige una escena para empezar (menú con miniaturas)
  function menu() {
    zona.innerHTML = `
      <p class="texto-grande">Elige dónde investigar. ¡Hay ${totalProblemas} problemas escondidos en total!</p>
      <div class="menu-escenas">${j.escenas.map((e, k) => `
        <button class="mini-escena" data-k="${k}">
          <span class="mini-fondo">${fondo(e)}</span>
          <b>${e.icono || "🔍"} ${esc(e.titulo)}</b><small>${e.elementos.filter(x => x.problema).length} problemas</small>
        </button>`).join("")}</div>
      <div class="acciones"><button class="boton grande" id="todas">🔍 Investigar las ${j.escenas.length} escenas</button></div>`;
    zona.querySelector("#todas").addEventListener("click", () => { s = 0; mostrar(); });
    zona.querySelectorAll(".mini-escena").forEach(b => b.addEventListener("click", () => { s = Number(b.dataset.k); mostrar(); }));
  }
  const vistas = new Set();

  function mostrar() {
    if (vistas.size === j.escenas.length) {
      return finDeJuego(j, zona, Math.max(1, totalProblemas - errores), totalProblemas,
        `<p>🔍 Encontraste ${encontrados} problemas. Toques equivocados: ${errores}. Pistas usadas: ${pistas}.</p>`);
    }
    while (vistas.has(s)) s = (s + 1) % j.escenas.length;   // siguiente escena no vista
    vistas.add(s);
    const es = j.escenas[s];
    const probs = es.elementos.filter(x => x.problema).length;
    let enEscena = 0;
    zona.innerHTML = `
      <div class="cabeza-escena">
        <h2>${es.icono || "🔍"} ${esc(es.titulo)}</h2>
        <div class="progreso-escena" aria-label="Problemas encontrados">${"<span>🔍</span>".repeat(probs)}</div>
        <button class="boton secundario" id="pista">💡 Pista</button>
      </div>
      <p class="pequeno solo-celular">👉 Desliza la imagen hacia los lados para verla completa.</p>
      <div class="escena-desliza"><div class="escena" id="escena">
        <div class="escena-fondo">${fondo(es)}</div>
        ${es.elementos.map((e, k) => `<button class="elemento zona" data-k="${k}" style="left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%" aria-label="${esc(e.nombre)}"></button>`).join("")}
        <div class="lupa" id="lupa" aria-hidden="true"></div>
      </div></div>
      <p class="retro" aria-live="polite">🔍 Mueve tu lupa y toca lo que daña al ambiente.</p>
      <button class="boton" id="siguiente" hidden>Siguiente →</button>`;

    const retro = zona.querySelector(".retro");
    const escena = zona.querySelector("#escena");
    const lupa = zona.querySelector("#lupa");
    escena.addEventListener("pointermove", ev => {
      const r = escena.getBoundingClientRect();
      lupa.style.transform = `translate(${ev.clientX - r.left}px, ${ev.clientY - r.top}px)`;
      lupa.classList.add("visible");
    });
    escena.addEventListener("pointerleave", () => lupa.classList.remove("visible"));

    /** Texto flotante sobre la escena (+1, 👍…). */
    const flotar = (b, texto, clase) => {
      const f = document.createElement("span");
      f.className = "flotante " + clase; f.textContent = texto;
      f.style.left = b.style.left; f.style.top = b.style.top;
      escena.appendChild(f); setTimeout(() => f.remove(), 1200);
    };

    zona.querySelector("#pista").addEventListener("click", () => {
      const pendientes = [...zona.querySelectorAll(".elemento")].filter(b => es.elementos[Number(b.dataset.k)].problema && !b.classList.contains("encontrado"));
      if (!pendientes.length) return;
      pistas++;
      const b = azar(pendientes);
      b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      b.classList.add("pista"); setTimeout(() => b.classList.remove("pista"), 2600);
      retro.className = "retro"; retro.textContent = "💡 Mira el círculo que brilla…";
    });

    zona.querySelectorAll(".elemento").forEach(b => b.addEventListener("click", () => {
      const e = es.elementos[Number(b.dataset.k)];
      if (b.classList.contains("encontrado")) return;
      if (e.problema) {
        b.classList.add("encontrado"); b.classList.remove("pista");
        b.insertAdjacentHTML("beforeend", `<b class="nombre-hallazgo">${esc(e.nombre)}</b>`);
        zona.querySelectorAll(".progreso-escena span")[enEscena].textContent = "✅";
        enEscena++; encontrados++;
        flotar(b, "+1 ⭐", "mas");
        reaccion(true, "¡Lo encontraste!");
        retro.className = "retro bien"; retro.innerHTML = `✅ <b>${esc(e.nombre)}.</b> ${esc(e.texto)} ${botonVoz(e.nombre + ". " + e.texto)}`;
        if (enEscena === probs) {
          confeti();
          const ultima = vistas.size === j.escenas.length;
          const sig = zona.querySelector("#siguiente");
          sig.hidden = false; sig.textContent = ultima ? "Ver resultado →" : "Siguiente escena →";
          sig.onclick = () => { s++; mostrar(); };
          retro.innerHTML += " <br><b>🎉 ¡Encontraste todos los problemas de esta escena!</b>";
        }
      } else {
        if (!b.classList.contains("revisado")) errores++;
        b.classList.add("revisado");
        b.classList.remove("sacudir"); void b.offsetWidth; b.classList.add("sacudir");
        flotar(b, "👍", "bien-hecho");
        reaccion(false, "Eso está bien");
        retro.className = "retro mal"; retro.innerHTML = `👍 <b>${esc(e.nombre)}:</b> ${esc(e.texto)} Busca otra cosa.`;
      }
    }));
  }
  menu();
}

/** 💧 Atrapa las gotas: mover la cubeta para atrapar gotas y cerrar fugas. */
function juegoGotas(j, zona) {
  const segundos = j.segundos || 30;
  zona.innerHTML = `
    <div class="marcador"><span>💧 Gotas: <b id="atrapadas">0</b></span><span><img class="ico-grifo" src="imagenes/icono-grifo.webp" alt=""> Fugas cerradas: <b id="fugas">0</b></span><span>⏱️ <b id="tiempo">${segundos}</b> s</span></div>
    <div class="area-gotas" id="area"><div class="cubeta" id="cubeta">🪣</div></div>
    <div class="controles-gotas">
      <button class="boton secundario" id="izq" aria-label="Mover a la izquierda">◀</button>
      <button class="boton" id="empezar">▶️ Empezar</button>
      <button class="boton secundario" id="der" aria-label="Mover a la derecha">▶</button>
    </div>
    <p class="retro" aria-live="polite">Mueve la cubeta con el dedo, el ratón o las flechas. Si aparece una llave <img class="ico-grifo" src="imagenes/icono-grifo.webp" alt="">, ¡tócala para cerrarla!</p>`;
  const area = zona.querySelector("#area"), cubeta = zona.querySelector("#cubeta"), retro = zona.querySelector(".retro");
  let x = 50, gotas = [], atrapadas = 0, total = 0, fugasCerradas = 0, fugasTotal = 0, jugando = false, ultimo = 0, sigGota = 0, sigFuga = 4000, fin = 0;
  const ponerX = v => { x = Math.max(6, Math.min(94, v)); cubeta.style.left = x + "%"; };
  ponerX(50);
  area.addEventListener("pointermove", ev => { if (jugando) { const r = area.getBoundingClientRect(); ponerX((ev.clientX - r.left) / r.width * 100); } });
  area.addEventListener("pointerdown", ev => { if (jugando) { const r = area.getBoundingClientRect(); ponerX((ev.clientX - r.left) / r.width * 100); } });
  zona.querySelector("#izq").addEventListener("click", () => ponerX(x - 12));
  zona.querySelector("#der").addEventListener("click", () => ponerX(x + 12));
  const teclas = ev => {
    if (!zona.isConnected) return document.removeEventListener("keydown", teclas);
    if (!jugando) return;
    if (ev.key === "ArrowLeft") { ponerX(x - 8); ev.preventDefault(); }
    if (ev.key === "ArrowRight") { ponerX(x + 8); ev.preventDefault(); }
  };
  document.addEventListener("keydown", teclas);

  function crearFuga() {
    fugasTotal++;
    const b = document.createElement("button");
    b.className = "fuga"; b.innerHTML = `<img class="ico-grifo" src="imagenes/icono-grifo.webp" alt="">`; b.setAttribute("aria-label", "Fuga de agua: tócala para cerrarla");
    b.style.left = (10 + Math.random() * 75) + "%"; b.style.top = (10 + Math.random() * 35) + "%";
    b.addEventListener("pointerdown", ev => {
      ev.stopPropagation();
      if (b.dataset.cerrada) return;
      b.dataset.cerrada = "1"; fugasCerradas++; b.insertAdjacentHTML("beforeend", "<b>✅</b>");
      zona.querySelector("#fugas").textContent = fugasCerradas;
      reaccion(true, "¡Cerraste la fuga!");
      setTimeout(() => b.remove(), 500);
    });
    area.appendChild(b);
    setTimeout(() => { if (!b.dataset.cerrada && b.isConnected) { b.remove(); retro.textContent = "💦 Se escapó el agua de una fuga. ¡Ciérralas más rápido!"; } }, 3000);
  }
  function cuadro(t) {
    if (!zona.isConnected || !jugando) return;
    const dt = ultimo ? Math.min(0.05, (t - ultimo) / 1000) : 0; ultimo = t;
    const restante = Math.max(0, Math.ceil((fin - t) / 1000));
    zona.querySelector("#tiempo").textContent = restante;
    if (t >= sigGota) {
      const el = document.createElement("span"); el.className = "gota"; el.textContent = "💧";
      const g = { el, x: 6 + Math.random() * 88, y: -30, v: 110 + Math.random() * 80 };
      el.style.left = g.x + "%"; area.appendChild(el); gotas.push(g);
      sigGota = t + 650 + Math.random() * 350;
    }
    if (t >= sigFuga) { crearFuga(); sigFuga = t + 5500 + Math.random() * 3000; }
    const alto = area.clientHeight;
    gotas = gotas.filter(g => {
      g.y += g.v * dt;
      g.el.style.transform = `translate(-50%, ${g.y}px)`;
      if (g.y > alto - 70 && g.y < alto - 20 && Math.abs(g.x - x) < 10) {
        atrapadas++; total++; zona.querySelector("#atrapadas").textContent = atrapadas;
        cubeta.classList.remove("brinco"); void cubeta.offsetWidth; cubeta.classList.add("brinco");
        notas([[900, 0, 0.06]], "sine", 0.05);
        g.el.remove(); return false;
      }
      if (g.y > alto) { total++; g.el.remove(); return false; }
      return true;
    });
    if (t >= fin) {
      jugando = false;
      gotas.forEach(g => g.el.remove());
      // Las fugas que aún estaban abiertas al terminar el tiempo no cuentan en contra.
      area.querySelectorAll(".fuga").forEach(f => { if (!f.dataset.cerrada) fugasTotal--; f.remove(); });
      document.removeEventListener("keydown", teclas);
      return finDeJuego(j, zona, atrapadas + fugasCerradas, Math.max(1, total + fugasTotal),
        `<p>Atrapaste ${atrapadas} de ${total} gotas y cerraste ${fugasCerradas} de ${fugasTotal} fugas.</p><p>${esc(j.mensajeFinal || "")}</p>`);
    }
    requestAnimationFrame(cuadro);
  }
  zona.querySelector("#empezar").addEventListener("click", ev => {
    ev.target.disabled = true; ev.target.textContent = "¡A jugar!";
    audio();
    jugando = true;
    const ahora = performance.now();
    fin = ahora + segundos * 1000; sigGota = ahora; sigFuga = ahora + 4000; ultimo = 0;
    requestAnimationFrame(cuadro);
  });
}

/** 🌱 Cuida tu planta: decidir agua y sol durante varios días. */
function juegoPlanta(j, zona) {
  const dias = j.dias || 5, etapas = j.etapas || ["🌰", "🌱", "🌿", "🪴", "🌻"], m = j.mensajes;
  let dia = 1, agua = 40, lugar = null, etapa = 0, buenos = 0;
  zona.innerHTML = `
    <p class="contador">Día <b id="dia">1</b> de ${dias}</p>
    <div class="planta-juego">
      <div class="maceta-zona" id="maceta"><span class="planta" id="planta">${etapas[0]}</span><div class="maceta">🪴</div><span class="lugar-icono" id="lugarIcono"></span></div>
      <div class="medidores">
        <p><b>💧 Agua en la tierra</b></p>
        <div class="barra-agua"><span id="nivelAgua"></span><i class="marca-min"></i><i class="marca-max"></i></div>
        <p class="pequeno">Lo ideal es que quede entre las dos rayitas.</p>
        <p id="estadoLugar"><b>📍 Lugar:</b> elige dónde ponerla hoy</p>
      </div>
    </div>
    <div class="acciones">
      <button class="boton" id="regar">💧 Regar</button>
      <button class="boton secundario" id="alSol">☀️ Poner al sol</button>
      <button class="boton secundario" id="sombra">🌥️ Dejar en la sombra</button>
    </div>
    <div class="acciones"><button class="boton grande" id="dormir">🌙 Pasar al día siguiente</button></div>
    <p class="retro" aria-live="polite">Cuida tu planta: dale agua y luz, ¡pero no demasiada agua!</p>`;
  const retro = zona.querySelector(".retro");
  const pintar = () => {
    const barra = zona.querySelector("#nivelAgua");
    barra.style.width = Math.min(100, agua / 130 * 100) + "%";
    barra.className = agua > 100 ? "mucha" : agua < 30 ? "poca" : "bien";
    zona.querySelector("#estadoLugar").innerHTML = `<b>📍 Lugar:</b> ${lugar === "sol" ? "☀️ al sol" : lugar === "sombra" ? "🌥️ en la sombra" : "elige dónde ponerla hoy"}`;
    zona.querySelector("#lugarIcono").textContent = lugar === "sol" ? "☀️" : lugar === "sombra" ? "🌥️" : "";
  };
  pintar();
  zona.querySelector("#regar").addEventListener("click", () => {
    agua = Math.min(130, agua + 30);
    notas([[700, 0, 0.08], [500, 0.08, 0.1]], "sine", 0.05);
    retro.className = "retro"; retro.textContent = agua > 100 ? "⚠️ ¡Cuidado! La tierra está empapada." : "💧 Regaste tu planta.";
    pintar();
  });
  zona.querySelector("#alSol").addEventListener("click", () => { lugar = "sol"; pintar(); });
  zona.querySelector("#sombra").addEventListener("click", () => { lugar = "sombra"; pintar(); });
  zona.querySelector("#dormir").addEventListener("click", () => {
    if (!lugar) { retro.className = "retro mal"; retro.textContent = "📍 Primero elige si la pones al sol o en la sombra."; return; }
    let ok = false, msg;
    if (agua > 100) msg = m.mucha;
    else if (agua < 30) msg = m.poca;
    else if (lugar !== "sol") msg = m.sinSol;
    else { ok = true; msg = m.bien; }
    const planta = zona.querySelector("#planta");
    if (ok) { buenos++; etapa = Math.min(etapas.length - 1, etapa + 1); planta.textContent = etapas[etapa]; planta.classList.remove("triste"); }
    else planta.classList.add("triste");
    reaccion(ok, ok ? "¡Creció!" : "¡Cuídala mejor!");
    retro.className = "retro " + (ok ? "bien" : "mal"); retro.textContent = (ok ? "🌱 " : "💡 ") + msg;
    agua = Math.max(0, agua - 35);   // el calor seca la tierra cada día
    lugar = null; dia++;
    if (dia > dias) zona.querySelectorAll("button").forEach(b => { b.disabled = true; });   // evita terminar dos veces
    if (dia > dias) return setTimeout(() => finDeJuego(j, zona, buenos, dias, `<p class="pista">${etapas[etapa]}</p><p>${esc(m.final || "")}</p>`), 1400);
    zona.querySelector("#dia").textContent = dia;
    pintar();
  });
}

/** 🏘️ Colonia verde: colocar árboles, plantas y objetos para bajar la temperatura. */
function juegoColonia(j, zona) {
  const { columnas, filas } = j.cuadricula;
  const celdas = Array(columnas * filas).fill(null);
  j.fijos.forEach(f => { celdas[f.celda] = { fijo: true, icono: f.icono, nombre: f.nombre }; });
  let elegida = j.piezas[0].id;
  zona.innerHTML = `
    <div class="colonia-juego">
      <div>
        <div class="paleta">${j.piezas.map(p => `<button class="pieza ${p.id === elegida ? "elegida" : ""}" data-id="${p.id}"><span>${p.icono}</span>${esc(p.nombre)}</button>`).join("")}</div>
        <div class="mapa-colonia" style="grid-template-columns:repeat(${columnas},1fr)">${celdas.map((c, k) => `<button class="celda-colonia ${c?.fijo ? "fija" : ""}" data-k="${k}" aria-label="${c?.fijo ? esc(c.nombre) : "Espacio libre"}">${c ? c.icono : ""}</button>`).join("")}</div>
        <p class="pequeno">Toca un espacio vacío para colocar. Toca algo que pusiste para quitarlo.</p>
      </div>
      <div class="panel-colonia">
        <div class="termometro"><div class="termo-tubo"><span id="termoNivel"></span></div><b id="temp"></b></div>
        <ul class="metas" id="metas"></ul>
        <button class="boton grande" id="terminar">🏁 ¡Terminé mi colonia!</button>
      </div>
    </div>
    <p class="retro" aria-live="polite">${esc(j.nota || "")}</p>`;
  const pieza = id => j.piezas.find(p => p.id === id);
  const cuenta = id => celdas.filter(c => c && !c.fijo && c.id === id).length;
  const temperatura = () => +(j.tempInicial + celdas.reduce((t, c) => t + (c && !c.fijo ? pieza(c.id).temp : 0), 0)).toFixed(1);
  const metaCumplida = me => me.tipo === "temp" ? temperatura() <= me.valor : cuenta(me.pieza) >= me.min;
  function pintar() {
    const t = temperatura();
    zona.querySelector("#temp").textContent = `${t} °C`;
    const nivel = zona.querySelector("#termoNivel");
    nivel.style.height = Math.max(8, Math.min(100, (t - 25) / 22 * 100)) + "%";
    nivel.className = t > 40 ? "caliente" : t > 36 ? "tibio" : "fresco";
    zona.querySelector("#metas").innerHTML = j.metas.map(me => `<li class="${metaCumplida(me) ? "cumplida" : ""}">${metaCumplida(me) ? "✅" : "⬜"} ${esc(me.texto)}</li>`).join("");
  }
  pintar();
  zona.querySelectorAll(".pieza").forEach(b => b.addEventListener("click", () => {
    elegida = b.dataset.id;
    zona.querySelectorAll(".pieza").forEach(x => x.classList.toggle("elegida", x === b));
  }));
  zona.querySelectorAll(".celda-colonia").forEach(b => b.addEventListener("click", () => {
    const k = Number(b.dataset.k), c = celdas[k];
    if (c?.fijo) return;
    const antes = j.metas.filter(metaCumplida).length;
    if (c) { celdas[k] = null; b.textContent = ""; b.setAttribute("aria-label", "Espacio libre"); }
    else {
      const p = pieza(elegida);
      celdas[k] = { id: p.id }; b.textContent = p.icono; b.setAttribute("aria-label", p.nombre);
      b.classList.remove("brinco"); void b.offsetWidth; b.classList.add("brinco");
      notas([[520, 0, 0.08]], "sine", 0.05);
    }
    pintar();
    if (j.metas.filter(metaCumplida).length > antes) reaccion(true, "¡Meta cumplida!");
  }));
  zona.querySelector("#terminar").addEventListener("click", () => {
    const cumplidas = j.metas.filter(metaCumplida).length;
    finDeJuego(j, zona, cumplidas, j.metas.length, `<p>Temperatura final: <b>${temperatura()} °C</b>.</p><p>${esc(j.mensajeFinal || "")}</p>`);
  });
}

/* ----- Experimenta ----- */

function pantallaListaExperimentos() {
  // Muestra directamente el primer experimento pendiente, con la lista a un lado.
  const e = datos.experimentos.find(x => !hecho(`experimento:${x.id}`)) || datos.experimentos[0];
  pantallaExperimento(e.id);
}

function pantallaExperimento(id) {
  const e = datos.experimentos.find(x => x.id === id);
  if (!e) return pantallaNoEncontrada();
  const u = unidad(e.unidad);
  const reg = estado.registros[e.id] || {};
  const hechoE = hecho(`experimento:${e.id}`);
  app.innerHTML = `
    ${encabezadoSeccion("🧪", "Experimenta", "Realiza actividades sencillas, registra tus datos y observa los resultados.", "experimenta")}
    <div class="tres-columnas">
      <nav class="lista-temas" aria-label="Experimentos">
        ${datos.experimentos.map(x => { const ux = unidad(x.unidad); return `<a class="${x.id === e.id ? "activo" : ""} color-${ux.color}" href="#experimenta/${x.id}">
          <span class="ico-tema" aria-hidden="true">${ux.icono}</span><span>${esc(x.nombre)}</span>${hecho(`experimento:${x.id}`) ? `<span class="hecho-tema" aria-label="realizado">✓</span>` : ""}</a>`; }).join("")}
      </nav>

      <article class="panel-tema centro color-${u.color}">
        <div class="tema-titulo"><h2>${esc(e.nombre)}</h2>${botonVoz(e.proposito)}</div>
        <p class="tema-intro">${esc(e.proposito)}</p>
        ${ETQ_PROPUESTA}
        <div class="supervision ${e.supervision ? "si" : "no"}">
          <b>${e.supervision ? "⚠️ Requiere supervisión de un adulto" : "✓ Puedes hacerlo con la guía de tu maestra, maestro o tutor"}</b>
          <p>${esc(e.aviso)}</p>
        </div>

        <h3>Materiales</h3>
        <div class="materiales-tiles">${e.materiales.map(m => `<div class="material">${iconoMaterial(m)}<span>${esc(m)}</span></div>`).join("")}</div>

        <h3>Pasos ${botonVoz(e.procedimiento.join(". "))}</h3>
        <ol class="pasos-numerados">${e.procedimiento.map((p, k) => `<li><label><input type="checkbox" class="paso" data-k="${k}" ${reg.pasos?.[k] ? "checked" : ""}><span class="num">${k + 1}</span><span>${esc(p)}</span></label></li>`).join("")}</ol>

        <div class="bloque"><h3>💡 ¿Qué pasó?</h3><p>${esc(e.explicacion)} ${botonVoz(e.explicacion)}</p></div>
        <div class="bloque relacion"><h3>🌎 ¿Y el ambiente?</h3><p>${esc(e.relacion)}</p></div>
        ${bloqueCurricular(u)}
      </article>

      <aside class="panel-registro">
        <h3>Registra tus datos</h3>
        <p class="pequeno">${esc(e.registro.pregunta)}</p>
        ${e.registro.tipo === "grafica" ? `
          <table class="tabla-registro"><thead><tr><th>Dato</th><th>${esc(e.registro.unidad)}</th></tr></thead>
          <tbody>${e.registro.etiquetas.map((et, k) => `<tr><td>${esc(et)}</td><td><input type="number" step="0.1" min="0" max="999" class="dato" data-k="${k}" value="${esc(reg.datos?.[k] ?? "")}" aria-label="${esc(et)}"></td></tr>`).join("")}</tbody></table>
          <div id="grafica"></div>` : ""}
        <textarea id="notaRegistro" rows="4" maxlength="300" placeholder="Escribe o dicta a un adulto lo que observaste (sin nombres)">${esc(reg.nota || "")}</textarea>
        <p class="pequeno">Se guarda solo en este dispositivo.</p>
        <div class="piensa"><b>💭 Piensa:</b> ${e.reflexion.map(r => esc(r)).join(" ")}</div>
        <button class="boton" id="terminarExp" ${hechoE ? "disabled" : ""}>${hechoE ? "✓ Experimento realizado" : "Ya lo realicé"}</button>
        <a class="boton secundario" href="#actua/${retoDe(e.unidad)?.id}">Ir al reto del tema →</a>
      </aside>
    </div>`;

  // Guardado automático del registro
  const guardarRegistro = () => {
    estado.registros[e.id] = {
      pasos: [...app.querySelectorAll(".paso")].map(c => c.checked),
      datos: [...app.querySelectorAll(".dato")].map(i => i.value),
      nota: document.getElementById("notaRegistro").value
    };
    guardarEstado();
  };
  app.querySelectorAll(".paso, #notaRegistro").forEach(el => el.addEventListener("change", guardarRegistro));
  app.querySelectorAll(".dato").forEach(el => el.addEventListener("input", () => { guardarRegistro(); dibujarGrafica(e); }));
  if (e.registro.tipo === "grafica") dibujarGrafica(e);

  const btn = document.getElementById("terminarExp");
  btn.addEventListener("click", () => { guardarRegistro(); marcarHecho(`experimento:${e.id}`); btn.disabled = true; btn.textContent = "✓ Experimento realizado"; });
}

/** Gráfica de barras sencilla con los datos del registro (reaprovechada del prototipo). */
function dibujarGrafica(e) {
  const caja = document.getElementById("grafica");
  if (!caja) return;
  const valores = [...app.querySelectorAll(".dato")].map(i => i.value === "" ? null : Number(i.value));
  if (valores.some(v => v === null || !Number.isFinite(v))) { caja.innerHTML = `<p class="pequeno">Escribe todos los valores para ver la gráfica.</p>`; return; }
  const max = Math.max(...valores, 1);
  const mayor = Math.max(...valores), menor = Math.min(...valores);
  const unidadTxt = esc(e.registro.unidad);
  // Texto de conclusión: "textoMayor" viene de datos (p. ej. "Más caliente"); si no, uno general.
  const conclusion = mayor === menor
    ? "Todos los valores son iguales."
    : `${esc(e.registro.textoMayor || "El valor más alto")}: <b>${esc(e.registro.etiquetas[valores.indexOf(mayor)])}</b>. Diferencia entre el mayor y el menor: ${+(mayor - menor).toFixed(1)} ${unidadTxt}.`;
  caja.innerHTML = `<div class="grafica">${valores.map((v, k) => `
    <div class="columna"><b>${v} ${unidadTxt}</b><div class="barra-g" style="height:${Math.max(4, v / max * 100)}%"></div><small>${esc(e.registro.etiquetas[k])}</small></div>`).join("")}</div>
    <p>${conclusion}</p>`;
}

/* ----- Actúa ----- */

const CARITAS = ["😀", "🙂", "😐", "🤔"];

/** Cartel lateral de Actúa. */
const CARTEL_PLANETA = `<aside class="cartel-planeta"><img src="imagenes/acciones-planeta.webp" width="620" height="868" alt="Tus acciones también cuentan. Juntos por un planeta más limpio, justo y saludable."></aside>`;

function pantallaListaRetos() {
  const fila = (r, k) => {
    const u = unidad(r.unidad);
    return `<li class="fila-reto color-${u.color}">
      <span class="ico-reto" aria-hidden="true">${u.icono}</span>
      <div><b>Reto ${k + 1}: ${esc(r.titulo)}</b><p>${esc(r.explicacion)}</p></div>
      ${hecho(`reto:${r.id}`) ? `<span class="hecho-chip">✓ Cumplido</span>` : ""}
      <a class="boton chico morado" href="#actua/${r.id}">Ver detalles <span aria-hidden="true">→</span></a>
    </li>`;
  };
  const cumplidos = datos.retos.filter(r => hecho(`reto:${r.id}`));
  app.innerHTML = `
    ${encabezadoSeccion("🌱", "Actúa", "Completa retos, propone ideas y lleva lo aprendido a tu escuela, casa y comunidad.", "actua")}
    <div class="columna-con-cartel">
      <section class="panel-retos">
        <div class="pestanas" role="tablist">
          <button role="tab" class="pestana activa" data-p="todos" aria-selected="true">Retos disponibles</button>
          <button role="tab" class="pestana" data-p="mios" aria-selected="false">Mis retos cumplidos (${cumplidos.length})</button>
        </div>
        <ul class="lista-retos panel-pestana" data-p="todos">${datos.retos.map(fila).join("")}</ul>
        <ul class="lista-retos panel-pestana" data-p="mios" hidden>${cumplidos.length ? cumplidos.map(r => fila(r, datos.retos.indexOf(r))).join("") : `<li class="vacio">Aún no cumples retos. ¡Elige uno y empieza hoy!</li>`}</ul>
      </section>
      ${CARTEL_PLANETA}
    </div>`;
  app.querySelectorAll(".pestana").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll(".pestana").forEach(x => { x.classList.toggle("activa", x === b); x.setAttribute("aria-selected", String(x === b)); });
    app.querySelectorAll(".panel-pestana").forEach(p => p.hidden = p.dataset.p !== b.dataset.p);
  }));
}

function pantallaReto(id) {
  const r = datos.retos.find(x => x.id === id);
  if (!r) return pantallaNoEncontrada();
  const u = unidad(r.unidad);
  const prog = estado.retos[r.id] || { dias: [], carita: "", nota: "" };
  app.innerHTML = `
    ${encabezadoSeccion("🌱", "Actúa", "Completa retos, propone ideas y lleva lo aprendido a tu escuela, casa y comunidad.", "actua")}
    <a class="volver" href="#actua">← Todos los retos</a>
    <article class="ficha color-${u.color}">
      <header class="ficha-encabezado">
        <span class="ilustracion" aria-hidden="true">🌱</span>
        <div><p class="pequeno">ACTÚA · ${esc(u.titulo)}</p><h1>${esc(r.titulo)}</h1>${ETQ_PROPUESTA}</div>
      </header>
      <section class="bloque"><h2>¿Por qué importa?</h2><p class="texto-grande">${esc(r.explicacion)} ${botonVoz(r.explicacion)}</p></section>
      <section class="bloque"><h2>¿Qué hago? ${botonVoz(r.instrucciones.join(". "))}</h2>
        <ol class="pasos">${r.instrucciones.map(t => `<li>${esc(t)}</li>`).join("")}</ol>
      </section>
      ${r.dias ? `<section class="bloque"><h2>📅 Mis días</h2>
        <div class="dias">${Array.from({ length: r.dias }, (_, k) => `<label class="dia"><input type="checkbox" data-k="${k}" ${prog.dias[k] ? "checked" : ""}><span>Día ${k + 1}</span></label>`).join("")}</div>
      </section>` : ""}
      <section class="bloque"><h2>💬 Mi reflexión</h2>
        <p>${esc(r.evidencia)} ${botonVoz(r.evidencia)}</p>
        <div class="caritas" role="radiogroup" aria-label="¿Cómo te sentiste?">${CARITAS.map(c => `<button class="carita ${prog.carita === c ? "elegida" : ""}" data-c="${c}" role="radio" aria-checked="${prog.carita === c}">${c}</button>`).join("")}</div>
        <textarea id="notaReto" rows="3" maxlength="300" placeholder="Escribe o dibuja en tu cuaderno y anota aquí una frase (sin nombres)">${esc(prog.nota)}</textarea>
      </section>
      ${bloqueCurricular(u)}
      <p class="retro" id="retroReto" aria-live="polite"></p>
      <div class="acciones">
        <button class="boton grande" id="terminarReto" ${hecho(`reto:${r.id}`) ? "disabled" : ""}>${hecho(`reto:${r.id}`) ? "🏁 Reto cumplido" : "🏁 Cumplí el reto"}</button>
        <a class="boton secundario" href="#progreso">Ver mis insignias →</a>
      </div>
    </article>`;

  const guardar = () => {
    estado.retos[r.id] = {
      dias: [...app.querySelectorAll(".dia input")].map(c => c.checked),
      carita: app.querySelector(".carita.elegida")?.dataset.c || "",
      nota: document.getElementById("notaReto").value
    };
    guardarEstado();
  };
  app.querySelectorAll(".dia input, #notaReto").forEach(el => el.addEventListener("change", guardar));
  app.querySelectorAll(".carita").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll(".carita").forEach(x => { x.classList.remove("elegida"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("elegida"); b.setAttribute("aria-checked", "true");
    guardar();
  }));
  const btn = document.getElementById("terminarReto");
  btn.addEventListener("click", () => {
    guardar();
    const p = estado.retos[r.id];
    const retro = document.getElementById("retroReto");
    if (r.dias && p.dias.filter(Boolean).length < r.dias) { retro.className = "retro mal"; retro.textContent = `Marca los ${r.dias} días para completar el reto.`; return; }
    if (!p.carita) { retro.className = "retro mal"; retro.textContent = "Elige una carita para contar cómo te sentiste."; return; }
    retro.className = "retro bien"; retro.textContent = "🎉 ¡Reto cumplido! Gracias por cuidar el planeta.";
    marcarHecho(`reto:${r.id}`);
    btn.disabled = true; btn.textContent = "🏁 Reto cumplido";
  });
}

/* ----- Código de progreso (sin cuentas ni datos personales) -----
   El código guarda SOLO qué actividades están completas, como una lista de sí/no,
   en el orden de "ordenCodigo" (datos/primero.json).
   Formato: EQ2-XXX-XXX-XXX-X  (EQ = EcoQuest, 2 = versión, la última letra es de control).
   Los códigos EQ1 (primera versión) también se aceptan.
   IMPORTANTE: al agregar contenido, sus claves se añaden AL FINAL de "ordenCodigo"
   y nunca se cambia lo anterior; así los códigos viejos siguen sirviendo. */

const ALFABETO_32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";   // sin I, L, O, U para evitar confusiones

/** Lista fija de todas las actividades, en orden. */
const actividadesCodigo = () => datos.ordenCodigo;

/** Letra de control: detecta cualquier error de UNA letra (los multiplicadores impares lo garantizan). */
function letraControl(cuerpo, version = 2) {
  let s = 7;
  for (let i = 0; i < cuerpo.length; i++) {
    const v = ALFABETO_32.indexOf(cuerpo[i]);
    s = version === 1 ? (s * 31 + v * (i + 3)) % 32 : (s + v * (2 * i + 1)) % 32;
  }
  return ALFABETO_32[s];
}

/** Crea el código a partir del progreso actual. */
function codigoProgreso(hechos = estado.hechos) {
  const bits = actividadesCodigo().map(c => hechos[c] ? 1 : 0);
  while (bits.length % 5) bits.push(0);
  let cuerpo = "";
  for (let i = 0; i < bits.length; i += 5) cuerpo += ALFABETO_32[bits.slice(i, i + 5).reduce((n, b) => n * 2 + b, 0)];
  // 1.º: EQ2-…   ·   2.º a 6.º: EQ3- y el primer número es el grado.
  if (datos.grado > 1) cuerpo = datos.grado + cuerpo;
  const grupos = cuerpo.match(/.{1,3}/g).join("-");   // grupos de 3, fáciles de dictar
  return `EQ${datos.grado > 1 ? 3 : 2}-${grupos}-${letraControl(cuerpo)}`;
}

const DIRECCION_PUBLICA = "https://javierrabago2007.github.io/ecoquest/";

/** Dirección web que abre EcoQuest y carga este progreso (se usa en el QR). */
function enlaceProgreso() {
  // En la computadora de prueba (localhost) el QR usa la dirección pública; si no, otro celular no podría abrirlo.
  const base = /^(localhost|127\.)/.test(location.hostname) ? DIRECCION_PUBLICA : location.origin + location.pathname;
  return base + "#cargar/" + codigoProgreso();   // sin ?…, siempre la dirección principal
}

/** Lee un código y devuelve las actividades que contiene: { ok, hechos: {"aprende:u1": true, ...} } */
function leerCodigo(texto) {
  const limpio = String(texto).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const version = Number((limpio.match(/^EQ([123])/) || [])[1]);
  if (!version || limpio.length < 5) return { ok: false, mensaje: "Ese código no es de EcoQuest. Revisa que empiece con EQ2 o EQ3." };
  const cuerpo = limpio.slice(3, -1), control = limpio.slice(-1);
  if ([...cuerpo].some(c => !ALFABETO_32.includes(c)) || letraControl(cuerpo, version) !== control) {
    return { ok: false, mensaje: "El código tiene un error. Revisa letra por letra y vuelve a intentarlo." };
  }
  const grado = version === 3 ? Number(cuerpo[0]) : 1;
  if (!datosGrado[grado]) return { ok: false, mensaje: "Ese código es de un grado que todavía no está disponible." };
  const bits = [...cuerpo.slice(version === 3 ? 1 : 0)].flatMap(c => { const v = ALFABETO_32.indexOf(c); return [16, 8, 4, 2, 1].map(p => (v & p) ? 1 : 0); });
  const hechos = {};
  datosGrado[grado].ordenCodigo.forEach((c, i) => { if (bits[i]) hechos[c] = true; });
  return { ok: true, hechos, grado };
}

/** ¿Está completa esta actividad dentro de un conjunto de hechos? (igual que hecho(), pero para cualquier explorador o código) */
function completoEn(h, clave) {
  if (clave.startsWith("juegos:")) return juegosDe(clave.slice(7)).some(j => h[`juego:${j.id}`]);
  return !!h[clave];
}
/** Avance de un conjunto de hechos: actividades, insignias y cuántas de 4 tiene cada tema. */
function avanceDe(h) {
  const porTema = datos.unidades.map(u => actividadesDe(u).filter(c => completoEn(h, c)).length);
  const total = datos.unidades.length * 4;
  const hechas = porTema.reduce((a, b) => a + b, 0);
  return { hechas, total, pct: Math.round(hechas / total * 100), insignias: porTema.filter(n => n === 4).length, porTema };
}

/** Lee un código y SUMA sus actividades al progreso del explorador activo. */
function aplicarCodigo(texto, soloRevisar = false) {
  const leido = leerCodigo(texto);
  if (!leido.ok) return leido;
  const lista = Object.keys(leido.hechos);
  const nuevas = lista.filter(c => !estado.hechos[c]);
  const enCodigo = lista.length;
  if (soloRevisar) return { ok: true, enCodigo, nuevas: nuevas.length };
  nuevas.forEach(c => { estado.hechos[c] = true; });
  guardarEstado();
  return {
    ok: true, enCodigo, nuevas: nuevas.length,
    mensaje: nuevas.length
      ? `🎉 ¡Listo! Se agregaron ${nuevas.length} actividad(es). El código tenía ${enCodigo} en total.`
      : `✓ El código es correcto. Ya tenías todas sus actividades (${enCodigo}).`
  };
}

/** Dibuja un QR con la librería qrcode-generator (lib/qrcode.min.js). */
function dibujarQR(caja, texto) {
  if (!caja) return;
  if (typeof qrcode !== "function") { caja.innerHTML = `<p class="pequeno">No se pudo dibujar el QR. Usa el código de letras.</p>`; return; }
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  caja.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

/** Pantalla que se abre al escanear el QR: pide confirmación antes de cargar. */
function pantallaCargar(codigo) {
  const revision = aplicarCodigo(codigo, true);
  if (!revision.ok) {
    app.innerHTML = `<section class="panel en-construccion">${mascota("Hmm, ese código no funcionó.", 120)}<p>${esc(revision.mensaje)}</p><a class="boton" href="#progreso">Ir a Mi progreso</a></section>`;
    return;
  }
  app.innerHTML = `
    <section class="panel en-construccion">
      ${mascota("¡Encontré un progreso guardado!", 130)}
      <h1>¿Cargar este progreso?</h1>
      <p>El código <b>${esc(codigo)}</b> tiene <b>${revision.enCodigo}</b> actividad(es) completadas.
        ${revision.nuevas ? `Se agregarán <b>${revision.nuevas}</b> que aún no tienes en este dispositivo.` : "Ya tienes todas en este dispositivo."}</p>
      <p>Se cargará en el explorador <b>${esc(apodoDe(exploradorActivo()))}</b>. ¿No eres tú? <a href="#exploradores">Elige o crea tu explorador</a> y vuelve a escanear el código.</p>
      <p class="pequeno">No se borra nada de lo que ya tengas aquí.</p>
      <div class="acciones" style="justify-content:center">
        <button class="boton" id="confirmarCarga">Sí, cargar mi progreso</button>
        <a class="boton secundario" href="#inicio">No, gracias</a>
      </div>
    </section>`;
  document.getElementById("confirmarCarga").addEventListener("click", () => {
    const res = aplicarCodigo(codigo);
    ponerGrado(leerCodigo(codigo).grado);
    avisar(res.mensaje);
    location.hash = "progreso";
  });
}

/* ----- Exploradores (varios niños en un mismo dispositivo) ----- */

/** Avatar de un explorador: su personaje ilustrado sobre un círculo de su color. */
function avatarExplorador(ex) {
  const il = typeof ILUS === "object" ? ILUS[ex.personaje] : null;
  const fondo = (COLORES.find(c => c.id === ex.color) || COLORES[0]).fondo;
  return `<span class="avatar-ex" style="background:${fondo}">${il ? `<svg viewBox="${il.vb}" aria-hidden="true">${il.svg}</svg>` : ""}</span>`;
}

function pantallaExploradores() {
  let personaje = PERSONAJES[0].id, color = COLORES[0].id;
  const existe = (p, c) => almacen.exploradores.some(x => x.personaje === p && x.color === c);
  app.innerHTML = `
    ${encabezadoSeccion("🧭", "¿Quién está explorando?", "Elige tu personaje. Cada explorador guarda su propio progreso en este dispositivo.")}
    <div class="rejilla-exploradores">
      ${almacen.exploradores.map(ex => {
        const g = ex.grado || 1, a = conGrado(g, () => avanceDe(ex.id === almacen.activo ? estado.hechos : ex.progreso.hechos));
        return `<div class="tarjeta-explorador ${ex.id === almacen.activo ? "activo" : ""}">
          <button class="elegir-explorador" data-id="${ex.id}" aria-label="Explorar como ${esc(apodoDe(ex))}">
            ${avatarExplorador(ex)}
            <b>${esc(apodoDe(ex))}</b>
            <small>${g}.º grado · ${a.hechas} de ${a.total} actividades · ${a.insignias} insignia(s)</small>
            ${ex.id === almacen.activo ? `<span class="hecho-chip">Explorando ahora</span>` : ""}
          </button>
          ${almacen.exploradores.length > 1 ? `<button class="quitar-explorador" data-id="${ex.id}" aria-label="Quitar a ${esc(apodoDe(ex))}">✕</button>` : ""}
        </div>`;
      }).join("")}
    </div>

    <section class="panel nuevo-explorador">
      <h2>➕ Nuevo explorador</h2>
      <p>Elige un personaje y un color. Así formas tu apodo; no hace falta escribir tu nombre.</p>
      <h3>Personaje</h3>
      <div class="opciones-personaje">${PERSONAJES.map((p, k) => `<button class="opcion-personaje ${k === 0 ? "elegida" : ""}" data-p="${p.id}">${avatarExplorador({ personaje: p.id, color: "verde" })}<span>${p.nombre}</span></button>`).join("")}</div>
      <h3>Color</h3>
      <div class="opciones-color">${COLORES.map((c, k) => `<button class="opcion-color ${k === 0 ? "elegida" : ""}" data-c="${c.id}" style="--muestra:${c.fondo}"><span></span>${c.nombre}</button>`).join("")}</div>
      <div class="vista-apodo"><span id="vistaAvatar"></span><div><small>Tu apodo será</small><b id="vistaApodo"></b></div></div>
      <p class="retro" id="retroExplorador" aria-live="polite"></p>
      <button class="boton" id="crearExplorador">Crear y empezar a explorar →</button>
    </section>`;

  const vista = () => {
    const ex = { personaje, color };
    document.getElementById("vistaAvatar").innerHTML = avatarExplorador(ex);
    document.getElementById("vistaApodo").textContent = apodoDe(ex);
    const retro = document.getElementById("retroExplorador");
    if (existe(personaje, color)) { retro.className = "retro mal"; retro.textContent = "Ya hay un explorador con ese apodo en este dispositivo. Elige otro personaje o color."; }
    else { retro.className = "retro"; retro.textContent = ""; }
  };
  vista();
  app.querySelectorAll(".opcion-personaje").forEach(b => b.addEventListener("click", () => {
    personaje = b.dataset.p; app.querySelectorAll(".opcion-personaje").forEach(x => x.classList.toggle("elegida", x === b)); vista();
  }));
  app.querySelectorAll(".opcion-color").forEach(b => b.addEventListener("click", () => {
    color = b.dataset.c; app.querySelectorAll(".opcion-color").forEach(x => x.classList.toggle("elegida", x === b)); vista();
  }));
  document.getElementById("crearExplorador").addEventListener("click", () => {
    if (existe(personaje, color)) return vista();
    const ex = crearExplorador(personaje, color);
    cambiarExplorador(ex.id);
    avisar(`¡Hola, ${apodoDe(ex)}! Empieza tu aventura.`);
    location.hash = "inicio";
  });
  app.querySelectorAll(".elegir-explorador").forEach(b => b.addEventListener("click", () => {
    cambiarExplorador(b.dataset.id);
    avisar(`Explorando como ${apodoDe(exploradorActivo())}`);
    location.hash = "inicio";
  }));
  app.querySelectorAll(".quitar-explorador").forEach(b => b.addEventListener("click", () => {
    const ex = almacen.exploradores.find(x => x.id === b.dataset.id);
    if (!confirm(`¿Quitar a «${apodoDe(ex)}» y borrar su progreso en este dispositivo? Si quieres conservarlo, primero guarda su código de progreso.`)) return;
    guardarEstado();
    almacen.exploradores = almacen.exploradores.filter(x => x.id !== ex.id);
    if (almacen.activo === ex.id) { almacen.activo = almacen.exploradores[0].id; }
    estado = { perfil: almacen.perfil, ...progresoVacio(), ...exploradorActivo().progreso };
    guardarEstado(); pintarPerfil(); pantallaExploradores();
  }));
}

/* ----- Panel del grupo (perfil Docente) -----
   La maestra reúne los códigos de progreso de su grupo (escaneando el QR con la cámara
   o escribiéndolos) y ve el avance de cada niño, tema por tema.
   Todo se guarda SOLO en este dispositivo. Se recomienda usar número de lista o apodo. */

let ordenGrupo = "lista";      // lista | mayor | menor
let abiertoGrupo = null;       // etiqueta del alumno con el detalle abierto
const UMBRAL_APOYO = 25;       // % de avance por debajo del cual se sugiere apoyo

/** Lista del grupo del grado en uso (los registros antiguos son de 1.º). */
const grupoActual = () => (almacen.grupo || []).filter(f => (f.grado || 1) === datos.grado);

/** Agrega o actualiza un alumno en la lista del grupo. Devuelve "nuevo" o "actualizado". */
function guardarEnGrupo(etiqueta, codigo) {
  almacen.grupo = almacen.grupo || [];
  const fecha = new Date().toISOString();
  const grado = leerCodigo(codigo).grado || datos.grado;   // cada código se guarda en la lista de su grado
  const existente = almacen.grupo.find(f => f.etiqueta === etiqueta && (f.grado || 1) === grado);
  if (existente) { existente.codigo = codigo; existente.fecha = fecha; guardarEstado(); return "actualizado"; }
  almacen.grupo.push({ etiqueta, codigo, fecha, grado });
  guardarEstado();
  return "nuevo";
}
/** Siguiente etiqueta libre «Alumno N». */
function etiquetaLibre() {
  let n = grupoActual().length + 1;
  while (grupoActual().some(f => f.etiqueta === `Alumno ${n}`)) n++;
  return `Alumno ${n}`;
}
/** Ordena «2» antes que «10» y «Alumno 3» antes que «Alumno 12». */
const compararEtiquetas = (a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
const fechaCorta = iso => iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Primera actividad pendiente de un tema, con su enlace. */
function pendientesDe(h, u) {
  const nombres = ["Aprende", "Juega", "Experimenta", "Actúa"];
  const enlaces = [`#aprende/${u.id}`, `#juega/${juegoDe(u.id)?.id}`, `#experimenta/${experimentoDe(u.id)?.id}`, `#actua/${retoDe(u.id)?.id}`];
  return actividadesDe(u).map((c, k) => ({ clave: c, nombre: nombres[k], enlace: enlaces[k], hecha: completoEn(h, c) }));
}

function pantallaGrupo() {
  const filas = grupoActual().map(f => {
    const leido = leerCodigo(f.codigo);
    return { ...f, leido, a: leido.ok ? avanceDe(leido.hechos) : null };
  });
  const validas = filas.filter(f => f.a);
  const orden = {
    lista: (x, y) => compararEtiquetas(x.etiqueta, y.etiqueta),
    mayor: (x, y) => (y.a?.pct ?? -1) - (x.a?.pct ?? -1) || compararEtiquetas(x.etiqueta, y.etiqueta),
    menor: (x, y) => (x.a?.pct ?? 999) - (y.a?.pct ?? 999) || compararEtiquetas(x.etiqueta, y.etiqueta)
  }[ordenGrupo];
  filas.sort(orden);
  const promedio = validas.length ? Math.round(validas.reduce((s, f) => s + f.a.pct, 0) / validas.length) : 0;
  const apoyo = validas.filter(f => f.a.pct < UMBRAL_APOYO);

  // Avance por tema: % de alumnos con el tema completo y promedio de actividades (de 4)
  const temas = datos.unidades.map((u, k) => {
    const completos = validas.filter(f => f.a.porTema[k] === 4).length;
    const prom = validas.length ? validas.reduce((s, f) => s + f.a.porTema[k], 0) / validas.length : 0;
    const campos = [...new Set(u.curriculo.map(c => c.campo))];
    return { u, completos, pct: validas.length ? Math.round(completos / validas.length * 100) : 0, prom, campos };
  });
  // «Reforzar»: el tema (o los 2) con menor promedio. Si empatan muchos (p. ej. todos en cero al inicio), no se marca ninguno.
  const minProm = temas.length ? Math.min(...temas.map(t => t.prom)) : 0;
  const empatados = temas.filter(t => t.prom === minProm).length;
  temas.forEach(t => { t.reforzar = validas.length > 1 && empatados <= 2 && t.prom === minProm; });

  app.innerHTML = `
    ${encabezadoSeccion("👩‍🏫", `Avance del grupo de ${datos.nombreGrado}`, "Registre a mano o con códigos lo que hace su grupo y vea su avance tema por tema.")}

    <section class="panel agregar-grupo">
      <h2>Agregar alumnos</h2>
      <div class="formas-agregar">
        <form class="forma" id="formLista">
          <h3>📝 Sin dispositivos (por número de lista)</h3>
          <p>Cree la lista y marque en ella lo que cada quien hizo en papel o en clase. No necesita QR ni internet en casa.</p>
          <label>¿Cuántos alumnos son? <input id="cuantosLista" type="number" min="1" max="60" value="30"></label>
          <button class="boton" type="submit">Crear lista</button>
        </form>
        <div class="forma">
          <h3>📷 Escanear su QR</h3>
          <p>Cada alumno abre <b>Mi progreso</b> y usted escanea el QR con la cámara de este dispositivo.</p>
          <button class="boton" id="abrirEscaner">Abrir la cámara</button>
        </div>
        <form class="forma" id="formGrupo">
          <h3>⌨️ Escribir los códigos</h3>
          <label for="codigosGrupo" class="pequeno">Uno por renglón. Puede anteponer número de lista o apodo y dos puntos.</label>
          <textarea id="codigosGrupo" rows="3" spellcheck="false" placeholder="1: EQ2-XXX-XXX-XXX-X&#10;2: EQ2-XXX-XXX-XXX-X"></textarea>
          <button class="boton secundario" type="submit">Agregar</button>
        </form>
      </div>
      <div id="escaner" class="escaner" hidden>
        <div class="escaner-video"><video id="videoEscaner" playsinline muted></video><div class="marco-escaner" aria-hidden="true"></div></div>
        <div class="escaner-lado">
          <p id="estadoEscaner" class="retro" aria-live="polite">Apunte la cámara al QR del alumno…</p>
          <form id="formEtiqueta" hidden>
            <label for="etiquetaEscaneo"><b>Número de lista o apodo</b></label>
            <input id="etiquetaEscaneo" type="text" maxlength="40" autocomplete="off">
            <div class="acciones"><button class="boton" type="submit">Guardar y escanear otro</button><button class="boton secundario" type="button" id="descartarEscaneo">Descartar</button></div>
          </form>
          <ul id="escaneados" class="escaneados"></ul>
          <button class="boton secundario" id="cerrarEscaner">Terminar de escanear</button>
        </div>
      </div>
      <p class="retro" id="retroGrupo" aria-live="polite"></p>
      <p class="pequeno">🔒 La lista se guarda solo en este dispositivo; no se envía a ningún lado. Use número de lista o apodo en lugar del nombre completo.</p>
    </section>

    ${filas.length ? `
    <section class="resumen-grupo">
      <div class="dato-grupo"><b>${validas.length}</b><span>alumnos</span></div>
      <div class="dato-grupo"><b>${promedio}%</b><span>avance promedio</span></div>
      <div class="dato-grupo"><b>${validas.reduce((s, f) => s + f.a.insignias, 0)}</b><span>insignias en total</span></div>
      <div class="dato-grupo ${apoyo.length ? "alerta" : ""}"><b>${apoyo.length}</b><span>necesitan apoyo (menos de ${UMBRAL_APOYO}%)</span></div>
    </section>

    <section class="panel">
      <div class="cabeza-tabla">
        <h2>Alumnos</h2>
        <label class="ordenar">Ordenar por
          <select id="ordenGrupo">
            <option value="lista" ${ordenGrupo === "lista" ? "selected" : ""}>Número de lista</option>
            <option value="menor" ${ordenGrupo === "menor" ? "selected" : ""}>Menor avance primero</option>
            <option value="mayor" ${ordenGrupo === "mayor" ? "selected" : ""}>Mayor avance primero</option>
          </select>
        </label>
        <button class="boton chico secundario" id="descargarGrupo">📥 Descargar Excel (CSV)</button>
        <button class="boton chico secundario" id="imprimirGrupo">🖨️ Imprimir</button>
        <button class="boton chico secundario" id="vaciarGrupo">Vaciar lista</button>
      </div>
      <p class="pequeno">Toque un nombre o número para ver qué le falta y marcar lo que hizo.</p>
      <div class="tabla-envoltura">
        <table class="tabla tabla-grupo">
          <thead><tr><th>Alumno</th><th>Avance</th>${datos.unidades.map(u => `<th class="col-tema" title="${esc(u.titulo)}"><span aria-hidden="true">${u.icono}</span><span class="solo-lector">${esc(u.titulo)}</span></th>`).join("")}<th>Insignias</th><th>Actualizado</th><th></th></tr></thead>
          <tbody>
            ${filas.map(f => {
              const i = almacen.grupo.findIndex(g => g.etiqueta === f.etiqueta && (g.grado || 1) === datos.grado);
              if (!f.a) return `<tr class="fila-error"><td>${esc(f.etiqueta)}</td><td colspan="${datos.unidades.length + 3}">⚠️ Código con error: ${esc(f.codigo)}</td><td><button class="quitar-fila" data-i="${i}" aria-label="Quitar">✕</button></td></tr>`;
              const abierto = abiertoGrupo === f.etiqueta;
              const fila = `<tr class="${f.a.pct < UMBRAL_APOYO ? "fila-apoyo" : ""}">
                <td><button class="nombre-alumno" data-e="${esc(f.etiqueta)}" aria-expanded="${abierto}">${abierto ? "▾" : "▸"} ${esc(f.etiqueta)}</button>${f.a.pct < UMBRAL_APOYO ? ` <span class="chip-apoyo" title="Avance menor a ${UMBRAL_APOYO}%">🚩 apoyo</span>` : ""}</td>
                <td><div class="mini-barra"><span style="width:${f.a.pct}%"></span></div><small>${f.a.hechas}/${f.a.total} · ${f.a.pct}%</small></td>
                ${f.a.porTema.map(n => `<td class="celda-tema n${n}" title="${n} de 4">${n === 4 ? "🏅" : n ? `${n}/4` : "·"}</td>`).join("")}
                <td>${f.a.insignias}</td>
                <td><small>${fechaCorta(f.fecha)}</small></td>
                <td><button class="quitar-fila" data-i="${i}" aria-label="Quitar a ${esc(f.etiqueta)}">✕</button></td>
              </tr>`;
              if (!abierto) return fila;
              const pend = datos.unidades.map(u => ({ u, lista: pendientesDe(f.leido.hechos, u) }));
              const siguiente = pend.map(p => ({ u: p.u, act: p.lista.find(x => !x.hecha) })).find(p => p.act);
              return fila + `<tr class="fila-detalle"><td colspan="${datos.unidades.length + 5}">
                <div class="detalle-alumno">
                  ${siguiente ? `<p class="sugerencia">💡 <b>Siguiente paso sugerido:</b> ${esc(siguiente.u.titulo)} → <a href="${siguiente.act.enlace}">${siguiente.act.nombre}</a></p>` : `<p class="sugerencia">🎉 ¡Completó todas las actividades!</p>`}
                  <div class="detalle-temas">${pend.map(p => `
                    <div class="detalle-tema ${p.lista.every(x => x.hecha) ? "completo" : ""}">
                      <b>${p.u.icono} ${esc(p.u.titulo)}</b>
                      <ul>${p.lista.map(x => `<li class="${x.hecha ? "hecha" : ""}"><label><input type="checkbox" class="marca-grupo" data-c="${x.clave}" ${x.hecha ? "checked" : ""}> ${x.nombre}</label></li>`).join("")}</ul>
                    </div>`).join("")}</div>
                </div></td></tr>`;
            }).join("")}
          </tbody>
          <tfoot><tr><td><b>Temas completos</b></td><td></td>${temas.map(t => `<td>${t.completos}</td>`).join("")}<td></td><td></td><td></td></tr></tfoot>
        </table>
      </div>
      <p class="pequeno">🏅 = tema completo (Aprende, Juega, Experimenta y Actúa). n/4 = actividades hechas del tema. 🚩 = avance menor a ${UMBRAL_APOYO}%.</p>
    </section>

    <section class="panel">
      <h2>Avance por tema</h2>
      <p>Porcentaje de alumnos que completaron cada tema, con su campo formativo del Programa Sintético de la Fase ${datos.fase}. ${temas.some(t => t.reforzar) ? "El tema con menor avance aparece marcado para reforzar." : ""}</p>
      <div class="temas-grupo">${temas.map(t => `
        <div class="tema-grupo ${t.reforzar ? "reforzar" : ""}">
          <div class="tema-grupo-cabeza"><span class="ico-tema" aria-hidden="true">${t.u.icono}</span><b><a href="#aprende/${t.u.id}">${esc(t.u.titulo)}</a></b>${t.reforzar ? `<span class="chip-apoyo">Reforzar</span>` : ""}</div>
          <div class="campos-tema">${t.campos.map(c => `<span class="campo-chip">${esc(c)}</span>`).join("")}</div>
          <div class="barra-tema"><span style="width:${t.pct}%"></span></div>
          <small>${t.completos} de ${validas.length} completaron el tema (${t.pct}%) · promedio ${t.prom.toFixed(1)} de 4 actividades</small>
        </div>`).join("")}</div>
      <a class="boton secundario" href="#docente">Ver contenidos y PDA de cada tema →</a>
    </section>` : `
    <section class="panel en-construccion">${mascota("Aún no hay alumnos. Cree su lista por número o agregue códigos.", 110)}</section>`}`;

  /* --- Lista por número, sin dispositivos --- */
  document.getElementById("formLista").addEventListener("submit", ev => {
    ev.preventDefault();
    const n = Math.max(1, Math.min(60, Math.floor(Number(document.getElementById("cuantosLista").value)) || 1));
    let nuevos = 0;
    for (let i = 1; i <= n; i++) if (!grupoActual().some(f => f.etiqueta === String(i))) { guardarEnGrupo(String(i), codigoProgreso({})); nuevos++; }
    pantallaGrupo();
    avisar(`📝 ${nuevos} número(s) de lista agregados. Los que ya existían no cambiaron.`);
  });
  /* --- Marcar o desmarcar actividades a mano --- */
  app.querySelectorAll(".marca-grupo").forEach(c => c.addEventListener("change", () => {
    const f = grupoActual().find(g => g.etiqueta === abiertoGrupo);
    const hechos = leerCodigo(f.codigo).hechos;
    const claves = c.dataset.c.startsWith("juegos:") ? juegosDe(c.dataset.c.slice(7)).map(j => `juego:${j.id}`) : [c.dataset.c];
    if (c.checked) hechos[claves[0]] = true; else claves.forEach(k => delete hechos[k]);
    guardarEnGrupo(f.etiqueta, codigoProgreso(hechos));
    const y = window.scrollY; pantallaGrupo(); window.scrollTo(0, y);
  }));

  /* --- Agregar escribiendo --- */
  document.getElementById("formGrupo").addEventListener("submit", ev => {
    ev.preventDefault();
    const lineas = document.getElementById("codigosGrupo").value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let nuevos = 0, actualizados = 0, errores = 0;
    lineas.forEach(l => {
      const m = l.match(/^(.*?)[:\t]\s*(EQ[123].*)$/i);
      const etiqueta = m && m[1].trim() ? m[1].trim().slice(0, 40) : etiquetaLibre();
      const codigo = (m ? m[2] : l).trim();
      if (!leerCodigo(codigo).ok) errores++;
      guardarEnGrupo(etiqueta, codigo) === "nuevo" ? nuevos++ : actualizados++;
    });
    pantallaGrupo();
    const retro = document.getElementById("retroGrupo");
    retro.className = "retro " + (errores ? "mal" : "bien");
    retro.textContent = `${nuevos} alumno(s) nuevo(s), ${actualizados} actualizado(s)${errores ? `; ${errores} código(s) con error (revíselos en la tabla)` : ""}.`;
  });

  /* --- Tabla: detalle, ordenar, quitar, descargar, imprimir, vaciar --- */
  app.querySelectorAll(".nombre-alumno").forEach(b => b.addEventListener("click", () => {
    abiertoGrupo = abiertoGrupo === b.dataset.e ? null : b.dataset.e; pantallaGrupo();
  }));
  document.getElementById("ordenGrupo")?.addEventListener("change", ev => { ordenGrupo = ev.target.value; pantallaGrupo(); });
  app.querySelectorAll(".quitar-fila").forEach(b => b.addEventListener("click", () => {
    const f = almacen.grupo[Number(b.dataset.i)];
    if (!confirm(`¿Quitar a «${f.etiqueta}» de la lista?`)) return;
    almacen.grupo.splice(Number(b.dataset.i), 1); guardarEstado(); pantallaGrupo();
  }));
  document.getElementById("vaciarGrupo")?.addEventListener("click", () => {
    if (!confirm(`¿Vaciar la lista de ${datos.nombreGrado} en este dispositivo?`)) return;
    almacen.grupo = almacen.grupo.filter(f => (f.grado || 1) !== datos.grado); guardarEstado(); pantallaGrupo();
  });
  document.getElementById("imprimirGrupo")?.addEventListener("click", () => window.print());
  document.getElementById("descargarGrupo")?.addEventListener("click", () => descargarCSVGrupo(filas));

  /* --- Escáner de QR con la cámara --- */
  document.getElementById("abrirEscaner").addEventListener("click", abrirEscaner);
}

/** Descarga la tabla como CSV (se abre en Excel o en Hojas de cálculo de Google). */
function descargarCSVGrupo(filas) {
  const celda = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabeza = ["Alumno", "Código", "Actualizado", "Actividades", "Total", "Avance %", "Insignias", "Necesita apoyo", ...datos.unidades.map(u => u.titulo)];
  const lineas = [cabeza.map(celda).join(",")];
  filas.forEach(f => {
    if (!f.a) { lineas.push([f.etiqueta, f.codigo, fechaCorta(f.fecha), "", "", "", "", "Código con error"].map(celda).join(",")); return; }
    lineas.push([f.etiqueta, f.codigo, fechaCorta(f.fecha), f.a.hechas, f.a.total, f.a.pct, f.a.insignias, f.a.pct < UMBRAL_APOYO ? "Sí" : "No", ...f.a.porTema.map(n => `${n}/4`)].map(celda).join(","));
  });
  // "﻿" hace que Excel reconozca los acentos
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `avance-grupo-ecoquest-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  avisar("📥 Archivo descargado. Ábralo con Excel.");
}

/** Carga jsQR (lib/jsQR.js) solo cuando se necesita, para no hacer lenta la página. */
function cargarLectorQR() {
  if (typeof jsQR === "function") return Promise.resolve();
  return new Promise((ok, error) => {
    const s = document.createElement("script");
    s.src = "lib/jsQR.js"; s.onload = ok; s.onerror = error;
    document.head.appendChild(s);
  });
}

let flujoCamara = null;
function cerrarCamara() {
  if (flujoCamara) { flujoCamara.getTracks().forEach(t => t.stop()); flujoCamara = null; }
}

async function abrirEscaner() {
  const caja = document.getElementById("escaner");
  const estadoEl = document.getElementById("estadoEscaner");
  const video = document.getElementById("videoEscaner");
  const formEt = document.getElementById("formEtiqueta");
  const entrada = document.getElementById("etiquetaEscaneo");
  const lista = document.getElementById("escaneados");
  caja.hidden = false;
  caja.scrollIntoView({ behavior: "smooth", block: "start" });
  estadoEl.className = "retro"; estadoEl.textContent = "Abriendo la cámara…";
  try {
    await cargarLectorQR();
    flujoCamara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch (e) {
    estadoEl.className = "retro mal";
    estadoEl.textContent = "No se pudo usar la cámara. Revise que el navegador tenga permiso de usarla (o escriba los códigos a mano).";
    return;
  }
  video.srcObject = flujoCamara;
  await video.play().catch(() => {});
  estadoEl.textContent = "Apunte la cámara al QR del alumno…";
  const lienzo = document.createElement("canvas");
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  let pausado = false, codigoLeido = null;

  function cuadro() {
    if (!flujoCamara || !document.body.contains(video)) return cerrarCamara();
    if (!pausado && video.readyState >= 2 && video.videoWidth) {
      lienzo.width = video.videoWidth; lienzo.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
      const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      const m = qr && qr.data.match(/EQ[123][-0-9A-Z]+/i);
      if (m) {
        const leido = leerCodigo(m[0]);
        if (leido.ok) {
          pausado = true; codigoLeido = m[0].toUpperCase();
          const a = avanceDe(leido.hechos);
          notas([[880, 0, 0.1], [1175, 0.08, 0.15]], "sine", 0.08);
          estadoEl.className = "retro bien";
          estadoEl.textContent = `✓ Código leído: ${a.hechas} actividades, ${a.insignias} insignia(s).`;
          formEt.hidden = false; entrada.value = etiquetaLibre(); entrada.focus(); entrada.select();
        }
      }
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  formEt.onsubmit = ev => {
    ev.preventDefault();
    const etiqueta = entrada.value.trim().slice(0, 40) || etiquetaLibre();
    const r = guardarEnGrupo(etiqueta, codigoLeido);
    lista.insertAdjacentHTML("afterbegin", `<li>✓ <b>${esc(etiqueta)}</b> ${r === "nuevo" ? "agregado" : "actualizado"}</li>`);
    formEt.hidden = true; pausado = false;
    estadoEl.className = "retro"; estadoEl.textContent = "Listo. Apunte al QR del siguiente alumno…";
  };
  document.getElementById("descartarEscaneo").onclick = () => {
    formEt.hidden = true; pausado = false;
    estadoEl.className = "retro"; estadoEl.textContent = "Apunte la cámara al QR del alumno…";
  };
  document.getElementById("cerrarEscaner").onclick = () => { cerrarCamara(); pantallaGrupo(); };
}

/* ----- Progreso e insignias ----- */

function pantallaProgreso() {
  const total = contarProgreso();
  const ganadas = insigniasGanadas().map(i => i.id);
  app.innerHTML = `
    ${encabezadoSeccion("⭐", "Mi progreso", `Progreso de ${esc(apodoDe(exploradorActivo()))}. Completa las 4 actividades de un tema para ganar su insignia.`)}
    <section class="panel">${barraProgreso(total)}<p>${total.hechas} de ${total.total} actividades completadas.</p></section>
    <div class="insignias">
      ${datos.unidades.map(u => {
        const lista = actividadesDe(u);
        const nombres = ["📖 Aprende", "🎮 Juega", "🧪 Experimenta", "🌱 Actúa"];
        const enlaces = [`#aprende/${u.id}`, `#juega/${juegoDe(u.id)?.id}`, `#experimenta/${experimentoDe(u.id)?.id}`, `#actua/${retoDe(u.id)?.id}`];
        const gano = ganadas.includes(u.id);
        return `<div class="insignia ${gano ? "ganada" : ""}">
          <span class="insignia-icono" aria-hidden="true">${u.icono}</span>
          <b>${esc(nombreInsignia(u))}</b>
          <small>${esc(u.titulo)}</small>
          <ul>${lista.map((c, k) => `<li><a href="${enlaces[k]}">${hecho(c) ? "✅" : "⬜"} ${nombres[k]}</a></li>`).join("")}</ul>
          ${gano ? `<span class="sello">¡Ganada!</span>` : ""}
        </div>`;
      }).join("")}
    </div>
    <section class="panel"><h2>✅ Tu progreso ya está guardado</h2><p>Se guarda solo, en este dispositivo. No tienes que hacer nada más.</p></section>
    <details class="panel codigo-progreso" id="guardarProgreso">
      <summary>📲 ¿Vas a usar otro dispositivo? Mostrar mi código y mi QR</summary>
      <p>Esto es opcional. Pide ayuda a un adulto. Con este código o este QR puedes continuar en otra computadora, tableta o celular. No guarda nombres ni datos personales: solo qué actividades completaste.</p>
      <div class="caja-codigo">
        <div class="qr" id="qrProgreso" aria-label="Código QR de tu progreso"></div>
        <div>
          <p class="pequeno">Tu código de progreso</p>
          <p class="codigo" id="textoCodigo">${esc(codigoProgreso())}</p>
          <div class="acciones">
            <button class="boton" id="copiarCodigo">📋 Copiar código</button>
            <button class="boton secundario" id="imprimirCodigo">🖨️ Imprimir</button>
          </div>
          <p class="pequeno">Escanea el QR con la cámara de otro celular para abrir EcoQuest con tu progreso.</p>
        </div>
      </div>
    </details>

    <details class="panel codigo-progreso">
      <summary>📥 Ya tengo un código</summary>
      <p>¿Ya tienes un código? Escríbelo aquí. Se sumará a lo que ya tengas en este dispositivo; no se borra nada.</p>
      <form class="cargar-codigo" id="formCargar">
        <input id="entradaCodigo" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="EQ2-XXX-XXX-XXX-X" aria-label="Código de progreso">
        <button class="boton" type="submit">Cargar</button>
      </form>
      <p class="retro" id="retroCargar" aria-live="polite"></p>
    </details>

    <section class="panel">
      <h2>¿Dónde se guarda mi progreso?</h2>
      <p>Se guarda solo en este navegador y en este dispositivo. No se envía a internet y no pide nombres. Si cambias de dispositivo, usa tu código de progreso (arriba). Si se borran los datos de navegación sin haber guardado el código, el progreso empieza de cero.</p>
      <button class="boton secundario" id="borrar">🗑️ Borrar mi progreso</button>
    </section>`;

  // QR que abre EcoQuest con este progreso (#cargar/CÓDIGO)
  dibujarQR(document.getElementById("qrProgreso"), enlaceProgreso());
  document.getElementById("copiarCodigo").addEventListener("click", async () => {
    const codigo = codigoProgreso();
    try { await navigator.clipboard.writeText(codigo); avisar("📋 Código copiado: " + codigo); }
    catch (e) { avisar("Escribe el código en un papel: " + codigo); }
  });
  document.getElementById("imprimirCodigo").addEventListener("click", () => {
    document.body.classList.add("imprimir-codigo");
    window.print();
    setTimeout(() => document.body.classList.remove("imprimir-codigo"), 500);
  });
  document.getElementById("formCargar").addEventListener("submit", ev => {
    ev.preventDefault();
    const res = aplicarCodigo(document.getElementById("entradaCodigo").value);
    const retro = document.getElementById("retroCargar");
    retro.className = "retro " + (res.ok ? "bien" : "mal");
    retro.textContent = res.mensaje;
    if (res.ok) setTimeout(pantallaProgreso, 1800);
  });
  document.getElementById("borrar").addEventListener("click", () => {
    if (!confirm("¿Seguro que quieres borrar todo tu progreso en este dispositivo?")) return;
    const p = estado.perfil;
    estado = estadoInicial(); estado.perfil = p;
    guardarEstado();
    avisar("Progreso borrado.");
    pantallaProgreso();
  });
}

/* ----- Vistas para docentes y para madres, padres o tutores -----
   Cada perfil tiene su propio inicio y su propio menú lateral:
     Alumna(o): aventura, juegos, insignias.
     Docente: grupo, plan de estudios, hojas para imprimir.
     Madre, padre o tutor: actividad de hoy, avance de su hija o hijo, trabajo sin internet. */

const tarjetaAdulto = (enlace, icono, titulo, texto, boton) => `<a class="tarjeta-adulto" href="${enlace}">
  <span class="icono-adulto" aria-hidden="true">${icono}</span><h2>${titulo}</h2><p>${texto}</p><span class="tarjeta-boton">${boton} <span aria-hidden="true">→</span></span></a>`;

const ICONO_ADULTO = {
  casa: `<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5"/></svg>`,
  avance: `<svg viewBox="0 0 24 24"><path d="M5 20V14M10 20V9M15 20v-7M20 20V5"/></svg>`,
  hoja: `<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/></svg>`,
  libro: `<svg viewBox="0 0 24 24"><path d="M3 5.5c3-1.3 6-1.3 9 .5v13c-3-1.8-6-1.8-9-.5zM21 5.5c-3-1.3-6-1.3-9 .5v13c3-1.8 6-1.8 9-.5z"/></svg>`,
  grupo: `<svg viewBox="0 0 24 24"><circle cx="8.5" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M2.5 20a6 6 0 0 1 12 0M13.5 20a4.5 4.5 0 0 1 8 -2.8"/></svg>`,
  insignia: `<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"/></svg>`,
  escudo: `<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6zM9 12l2 2 4-4"/></svg>`
};

/* --- Docente --- */

function pantallaInicioDocente() {
  const filas = grupoActual().map(f => leerCodigo(f.codigo)).filter(l => l.ok).map(l => avanceDe(l.hechos));
  const prom = filas.length ? Math.round(filas.reduce((s, a) => s + a.pct, 0) / filas.length) : 0;
  app.innerHTML = `
    <section class="portada-adulto docente">
      <div><p class="pequeno">PERFIL DOCENTE · ${esc(datos.nombreGrado.toUpperCase())} · FASE ${datos.fase}</p><h1>Maestra, maestro: este es su espacio</h1>
      <p>Planee con los contenidos oficiales, trabaje con o sin dispositivos y dé seguimiento a su grupo.</p></div>
      ${mascota("", 150)}
    </section>
    <section class="rejilla-adulto">
      ${tarjetaAdulto("#grupo", ICONO_ADULTO.grupo, "Avance del grupo", filas.length ? `${filas.length} alumnas y alumnos · ${prom}% de avance promedio.` : "Registre a su grupo por número de lista, sin QR ni dispositivos si no los hay.", "Ver mi grupo")}
      ${tarjetaAdulto("#docente", ICONO_ADULTO.libro, "Vinculación curricular", "Contenidos y PDA textuales del Programa Sintético y sugerencias para el aula.", "Consultar")}
      ${tarjetaAdulto("#hojas", ICONO_ADULTO.hoja, "Hojas para imprimir", "Una hoja por tema para trabajar en papel, en la escuela o en casa.", "Ver las hojas")}
    </section>
    ${selectorGrado()}
    <section class="panel">
      <h2>¿Con qué cuenta su escuela? ${ETQ_PROPUESTA}</h2>
      <div class="rejilla-adulto">
        <div class="caso"><h3>Solo un dispositivo o proyector</h3><p>Proyecte la lección y el juego; el grupo responde en voz alta o con tarjetas. El experimento y el reto se hacen sin pantalla.</p></div>
        <div class="caso"><h3>Pocas tabletas o computadoras</h3><p>Trabajen por equipos en turnos. Cada niña o niño puede tener su <a href="#exploradores">explorador</a> en el mismo equipo.</p></div>
        <div class="caso"><h3>Sin internet o sin dispositivos</h3><p>Imprima o copie en el pizarrón las <a href="#hojas">hojas de trabajo</a> y después marque el avance en <a href="#grupo">su grupo</a>.</p></div>
      </div>
    </section>
    <section class="panel"><h2>Explorar los temas</h2><p>Aquí puede revisar y probar todo. En este perfil nada se guarda en el progreso de los alumnos.</p>
      <div class="acciones">${datos.unidades.map(u => `<a class="boton secundario chico" href="#aprende/${u.id}">${u.icono} ${esc(u.titulo)}</a>`).join("")}</div></section>`;
}

function pantallaDocente() {
  app.innerHTML = `
    ${encabezadoSeccion("👩‍🏫", "Vinculación curricular", "Contenidos y PDA de " + gradoTexto() + " usados en EcoQuest.")}
    <section class="panel">
      <p>${ETQ_OFICIAL} Los contenidos y Procesos de Desarrollo de Aprendizaje (PDA) se transcriben textualmente de: <i>${esc(datos.fuenteOficial)}</i></p>
      <p>${ETQ_PROPUESTA} Las explicaciones, juegos, experimentos, retos y la relación con los libros de texto son propuesta de EcoQuest.</p>
      <a class="boton" href="#grupo">👩‍🏫 Ver avance del grupo →</a>
    </section>
    <div class="tabla-envoltura">
      <table class="tabla">
        <thead><tr><th>Tema EcoQuest</th><th>Campo formativo</th><th>Contenido</th><th>PDA (${gradoTexto()})</th><th>Pág.</th></tr></thead>
        <tbody>
          ${datos.unidades.flatMap(u => u.curriculo.map((c, k) => `<tr>
            ${k === 0 ? `<td rowspan="${u.curriculo.length}"><a href="#aprende/${u.id}">${u.icono} ${esc(u.titulo)}</a></td>` : ""}
            <td>${esc(c.campo)}</td><td>${esc(c.contenido)}</td>
            <td><ul>${c.pda.map(p => `<li>${esc(p)}</li>`).join("")}</ul></td><td>${c.pagina}</td></tr>`)).join("")}
        </tbody>
      </table>
    </div>
    <section class="panel">
      <h2>Sugerencias para el aula ${ETQ_PROPUESTA}</h2>
      <ul>${datos.unidades.map(u => `<li><b>${u.icono} ${esc(u.titulo)}:</b> ${esc(u.docente)}</li>`).join("")}</ul>
      <button class="boton secundario" onclick="window.print()">🖨️ Imprimir esta página</button>
    </section>`;
}

/* --- Madre, padre o tutor --- */

/** Las tres actividades en casa de cada tema (no necesitan pantalla). Se marcan aparte del progreso de la niña o el niño. */
const PASOS_CASA = ["platicar", "experimentar", "actuar"];
const marcasCasa = id => (almacen.casa || {})[id] || {};
const hechasCasa = id => PASOS_CASA.filter(p => marcasCasa(id)[p]).length;

/** Tarjeta con las tres actividades de un tema para hacer en familia. */
function actividadCasa(u) {
  const e = experimentoDe(u.id), r = retoDe(u.id), m = marcasCasa(u.id);
  const paso = (id, titulo, texto, extra) => `<li class="${m[id] ? "hecha" : ""}"><label><input type="checkbox" class="marca-casa" data-u="${u.id}" data-p="${id}" ${m[id] ? "checked" : ""}><span><b>${titulo}</b>${texto}</span></label>${extra}</li>`;
  return `<ol class="pasos-casa">
    ${paso("platicar", "1. Platiquen", esc(u.familia), `<p class="pequeno">Pregunta para empezar: «${esc(u.aprende.preguntas[0].pregunta)}»</p>`)}
    ${e ? paso("experimentar", `2. Experimenten: ${esc(e.nombre)}`, `${e.supervision ? "⚠️ Necesita a un adulto presente. " : ""}${esc(e.aviso)}`, `<p class="pequeno">Necesitan: ${esc(e.materiales.join(", "))}. <a href="#experimenta/${e.id}">Ver los pasos</a></p>`) : ""}
    ${r ? paso("actuar", `3. Actúen: ${esc(r.titulo)}`, esc(r.instrucciones.join(" ")), `<p class="pequeno"><a href="#actua/${r.id}">Ver el reto</a></p>`) : ""}
  </ol>`;
}
function activarCasa(repintar) {
  app.querySelectorAll(".marca-casa").forEach(c => c.addEventListener("change", () => {
    almacen.casa = almacen.casa || {};
    almacen.casa[c.dataset.u] = { ...marcasCasa(c.dataset.u), [c.dataset.p]: c.checked };
    guardarEstado();
    const terminado = hechasCasa(c.dataset.u) === PASOS_CASA.length;
    if (terminado) avisar("🏡 ¡Terminaron este tema en familia!");
    repintar();
  }));
}

function pantallaFamilia() {
  const u = datos.unidades.find(x => hechasCasa(x.id) < PASOS_CASA.length) || datos.unidades[0];
  app.innerHTML = `
    <section class="portada-adulto familia">
      <div><p class="pequeno">PERFIL MADRE, PADRE O TUTOR</p><h1>Aprendan juntos en casa</h1>
      <p>Actividades cortas con cosas que ya tienen. La mayoría no necesita pantalla ni internet.</p></div>
      ${mascota("", 150)}
    </section>
    <section class="rejilla-adulto">
      ${tarjetaAdulto("#casa", ICONO_ADULTO.casa, "Plan en casa", `${datos.unidades.filter(x => hechasCasa(x.id) === PASOS_CASA.length).length} de ${datos.unidades.length} temas terminados en familia.`, "Ver el plan")}
      ${tarjetaAdulto("#hijos", ICONO_ADULTO.avance, "Avance de mi hija o hijo", "Qué ya hizo, qué le falta y cómo ayudarle.", "Ver avance")}
      ${tarjetaAdulto("#hojas", ICONO_ADULTO.hoja, "Sin internet", "Hojas para imprimir o copiar en el cuaderno.", "Ver las hojas")}
    </section>
    <section class="panel">
      <h2>Para hoy: ${u.icono} ${esc(u.titulo)} ${ETQ_PROPUESTA}</h2>
      <p>${esc(u.resumen)} Marquen cada actividad cuando la terminen; no tienen que hacerlas todas el mismo día.</p>
      ${actividadCasa(u)}
    </section>
    ${selectorGrado()}
    <section class="panel" id="acompanar">
      <h2>Cómo acompañar a su hija o hijo ${ETQ_PROPUESTA}</h2>
      <ul>
        <li><b>Escuche antes de corregir.</b> Pregunte «¿por qué crees que pasa?» y deje que lo explique.</li>
        <li><b>Todavía está aprendiendo a leer.</b> Lean juntos o use el botón de voz 🔊.</li>
        <li><b>Poco tiempo basta.</b> Una actividad corta, sin prisa, vale más que muchas seguidas.</li>
        <li><b>Dé el ejemplo.</b> Cerrar la llave o separar la basura juntos enseña más que decirlo.</li>
      </ul>
      <h2>Seguridad primero</h2>
      <ul>
        <li>Los experimentos marcados con ⚠️ necesitan a un adulto presente.</li>
        <li>Ningún experimento usa fuego, electricidad, sustancias tóxicas ni agua hirviendo.</li>
        <li>En Sonora, al observar la naturaleza, no metan las manos en huecos ni bajo piedras (alacranes).</li>
        <li>Con mucho calor, salgan temprano o al atardecer y lleven agua.</li>
      </ul>
      <h2>Privacidad</h2>
      <p>EcoQuest no pide nombres, correos ni contraseñas. Todo se guarda solo en este dispositivo.</p>
    </section>`;
  activarCasa(pantallaFamilia);
}

function pantallaCasa(id) {
  const abierta = unidad(id) ? id : null;
  app.innerHTML = `
    ${encabezadoSeccion("🏡", "Plan en casa", "Tres actividades por tema para hacer en familia, en el orden que prefieran.")}
    ${datos.unidades.map(u => `<details class="panel tema-casa" data-u="${u.id}" ${abierta === u.id ? "open" : ""}><summary><span class="ico-tema" aria-hidden="true">${u.icono}</span><b>${esc(u.titulo)}</b><span class="estado ${hechasCasa(u.id) === PASOS_CASA.length ? "completo" : ""}">${hechasCasa(u.id)} de ${PASOS_CASA.length}</span></summary>${actividadCasa(u)}</details>`).join("")}`;
  activarCasa(() => {
    const u = app.querySelector("details[open]")?.dataset.u;
    const abiertos = [...app.querySelectorAll("details[open]")].map(d => d.dataset.u);
    const y = window.scrollY;
    pantallaCasa(u);
    app.querySelectorAll(".tema-casa").forEach(d => { d.open = abiertos.includes(d.dataset.u); });
    window.scrollTo(0, y);
  });
}

function pantallaHijos() {
  guardarEstado();
  app.innerHTML = `
    ${encabezadoSeccion("📊", "Avance de mi hija o hijo", "Lo que se ha hecho en este dispositivo, por explorador.")}
    ${almacen.exploradores.map(ex => conGrado(ex.grado || 1, () => {
      const h = ex.progreso.hechos, a = avanceDe(h);
      const pend = datos.unidades.map(u => ({ u, lista: pendientesDe(h, u) }));
      const sig = pend.map(p => ({ u: p.u, act: p.lista.find(x => !x.hecha) })).find(p => p.act);
      return `<section class="panel hijo">
        <div class="hijo-cabeza">${avatarExplorador(ex)}<div><h2>${esc(apodoDe(ex))}</h2><p>${datos.nombreGrado} · ${a.hechas} de ${a.total} actividades · ${a.insignias} insignia(s)</p></div></div>
        ${barraProgreso({ total: a.total, hechas: a.hechas })}
        ${sig ? `<p class="sugerencia">💡 <b>Cómo ayudarle ahora:</b> en «${esc(sig.u.titulo)}» le falta ${sig.act.nombre}. ${esc(sig.u.familia)}</p>` : `<p class="sugerencia">🎉 ¡Completó todas las actividades! Pídale que le explique su tema favorito.</p>`}
        <details><summary>Ver tema por tema</summary><div class="detalle-temas">${pend.map(p => `<div class="detalle-tema ${p.lista.every(x => x.hecha) ? "completo" : ""}"><b>${p.u.icono} ${esc(p.u.titulo)}</b><ul>${p.lista.map(x => `<li class="${x.hecha ? "hecha" : ""}">${x.hecha ? "✅" : "⬜"} ${x.nombre}</li>`).join("")}</ul></div>`).join("")}</div></details>
      </section>`;
    })).join("")}
    <section class="panel"><h2>¿Trabajó en otro dispositivo o en papel?</h2>
      <p>Aquí solo aparece lo hecho en este dispositivo. Si tiene un código de progreso, puede <a href="#progreso">cargarlo aquí</a>. Lo hecho en papel lo registra su maestra o maestro en el grupo.</p></section>`;
}

/* --- Hojas para imprimir (trabajo sin internet ni dispositivos) --- */

function pantallaHojas(id) {
  const u = unidad(id);
  if (!u) {
    app.innerHTML = `
      ${encabezadoSeccion("🖨️", "Hojas para trabajar sin internet", "Una hoja por tema. Se puede imprimir, fotocopiar o copiar en el cuaderno.")}
      <div class="lista-unidades">${datos.unidades.map(x => tarjetaHoja(x)).join("")}</div>`;
    return;
  }
  const e = experimentoDe(u.id), r = retoDe(u.id);
  app.innerHTML = `
    <div class="acciones no-imprimir"><a class="boton secundario" href="#hojas">← Todas las hojas</a><button class="boton" id="imprimirHoja">🖨️ Imprimir</button></div>
    <article class="hoja">
      <header><div><h1>${esc(u.titulo)}</h1><p>EcoQuest · ${esc(datos.nombreGrado)} · Propuesta didáctica EcoQuest</p></div><p>Número de lista: ______<br>Fecha: ____________</p></header>
      <h2><span class="cuadro"></span> Aprende</h2><p>${esc(u.aprende.explicacion.join(" "))}</p>
      <h2><span class="cuadro"></span> Juega: encierra la respuesta</h2>
      <ol>${u.aprende.preguntas.slice(0, 3).map(p => `<li>${esc(p.pregunta)}<br>${p.opciones.map(o => `○ ${esc(o)}`).join(" &nbsp; ")}</li>`).join("")}</ol>
      ${e ? `<h2><span class="cuadro"></span> Experimenta: ${esc(e.nombre)}</h2>
      <p><b>${e.supervision ? "⚠️ Requiere supervisión de un adulto. " : ""}</b>${esc(e.aviso)}</p>
      <p><b>Materiales:</b> ${esc(e.materiales.join(", "))}.</p><ol>${e.procedimiento.map(p => `<li>${esc(p)}</li>`).join("")}</ol>
      <p>${esc(e.registro.pregunta)}</p><div class="renglones"></div>` : ""}
      ${r ? `<h2><span class="cuadro"></span> Actúa: ${esc(r.titulo)}</h2><ol>${r.instrucciones.map(p => `<li>${esc(p)}</li>`).join("")}</ol>
      ${r.dias ? `<p>${Array.from({ length: r.dias }, (_, k) => `<span class="cuadro"></span> Día ${k + 1}`).join(" &nbsp; ")}</p>` : ""}` : ""}
      ${perfil() === "docente" ? `<p class="no-imprimir pequeno"><b>Respuestas (no se imprimen):</b> ${u.aprende.preguntas.slice(0, 3).map((p, k) => `${k + 1}. ${esc(p.opciones[p.correcta])}`).join(" · ")}</p>` : ""}
    </article>`;
  document.getElementById("imprimirHoja").addEventListener("click", () => window.print());
}
const tarjetaHoja = u => `<a class="tarjeta-actividad color-${u.color}" href="#hojas/${u.id}"><span class="tarjeta-icono" aria-hidden="true">${u.icono}</span><span class="tarjeta-cuerpo"><b>${esc(u.titulo)}</b><small>Lectura, preguntas, experimento y reto</small></span><span class="estado">Ver hoja</span></a>`;

function pantallaAcerca() {
  app.innerHTML = `
    ${encabezadoSeccion("ℹ️", "Acerca de EcoQuest", "Plataforma de educación ambiental para primaria, hecha en Hermosillo, Sonora.")}
    <section class="panel">
      <h2>Fuentes oficiales consultadas</h2>
      <ul><li>${esc(datos.fuenteOficial)}</li>${[...new Set(Object.values(datosGrado).flatMap(d => [d.fuenteOficial, ...d.librosDeTexto]))].filter(l => l !== datos.fuenteOficial).map(l => `<li>${esc(l)}</li>`).join("")}</ul>
      <h2>¿Qué es oficial y qué no?</h2>
      <p>${ETQ_OFICIAL} Solo los contenidos y PDA que aparecen en los cuadros de «Vinculación curricular», copiados textualmente del Programa Sintético.</p>
      <p>${ETQ_PROPUESTA} Todo lo demás: explicaciones, juegos, experimentos, retos, insignias y la relación sugerida con los libros de texto.</p>
      <h2>Grados</h2>
      <p>Disponibles: ${grados.filter(g => g.estado === "listo").map(g => esc(g.nombre)).join(", ")}.${grados.some(g => g.estado !== "listo") ? " Los demás grados están en construcción." : ""} De 2.º a 6.º es una versión breve, de 4 temas por grado.</p>
    </section>`;
}

function pantallaGrado(n) {
  const g = grados.find(x => x.grado === Number(n));
  if (!g) return pantallaNoEncontrada();
  app.innerHTML = `
    <a class="volver" href="#inicio">← Inicio</a>
    <section class="panel en-construccion">
      ${mascota("¡Estamos preparando este grado!", 120)}
      <h1>${esc(g.nombre)} · Fase ${g.fase}</h1>
      <p class="etiqueta propuesta">En construcción</p>
      <p>${esc(g.resumen)}</p>
      <p>Mientras tanto, puedes explorar el contenido de <a href="#aprende">1.º grado</a>.</p>
    </section>`;
}

function pantallaNoEncontrada() {
  app.innerHTML = `<section class="panel">${mascota("Ups, no encontré esa página.", 110)}<a class="boton" href="#inicio">Volver al inicio</a></section>`;
}

/* ---------- 7. Navegación y arranque ---------- */

/** En los perfiles de adulto se puede ver todo, pero no marcar actividades del alumno. */
function vistaDeAdulto() {
  if (perfil() === "alumno") return;
  app.querySelectorAll("#terminarLeccion, #terminarExp, #terminarReto").forEach(b => { b.disabled = true; b.textContent = "👀 Vista de adulto"; });
  app.querySelectorAll(".paso, .dato, #notaRegistro, .dia input, .carita, #notaReto").forEach(x => { x.disabled = true; });
}

/** Convierte %20 y similares sin fallar si el enlace está mal escrito. */
const decodificar = t => { try { return decodeURIComponent(t || ""); } catch (e) { return t || ""; } };

function enrutar() {
  if (hayVoz) speechSynthesis.cancel();
  if (salidaActual && ctxAudio) { salidaActual.gain.setTargetAtTime(0, ctxAudio.currentTime, 0.03); salidaActual = null; } // apaga sonidos al cambiar de pantalla
  cerrarCamara();   // apaga la cámara del escáner de QR si estaba encendida
  const [ruta, ...resto] = (location.hash.slice(1) || "inicio").split("/");
  const id = resto.join("/") || undefined;
  const pantallas = {
    inicio: pantallaInicio,
    aprende: () => id ? pantallaAprende(id) : pantallaListaAprende(),
    juega: () => id ? pantallaJuego(id) : pantallaListaJuegos(),
    experimenta: () => id ? pantallaExperimento(id) : pantallaListaExperimentos(),
    actua: () => id ? pantallaReto(id) : pantallaListaRetos(),
    progreso: pantallaProgreso,
    insignias: pantallaProgreso,
    docente: pantallaDocente,
    familia: pantallaFamilia,
    casa: () => pantallaCasa(id),
    hijos: pantallaHijos,
    hojas: () => pantallaHojas(id),
    acerca: pantallaAcerca,
    buscar: () => pantallaBuscar(decodificar(id)),
    cargar: () => pantallaCargar(decodificar(id)),
    exploradores: pantallaExploradores,
    grupo: pantallaGrupo,
    grado: () => pantallaGrado(id)
  };
  // Si el enlace es de otro grado (p. ej. #aprende/2u1), cambia a ese grado.
  const gId = ["aprende", "juega", "experimenta", "actua", "casa", "hojas"].includes(ruta) ? gradoDeId(id) : null;
  sincronizarGrado();
  if (gId && gId !== datos.grado) ponerGrado(gId);
  pintarPerfil();
  (Object.hasOwn(pantallas, ruta) ? pantallas[ruta] : pantallaNoEncontrada)();
  vistaDeAdulto();
  document.body.dataset.ruta = ruta;

  // Resalta la sección actual en el menú superior y en el lateral; cierra el menú en celular
  document.querySelectorAll("#menuPrincipal a, .menu-lateral a").forEach(a => a.classList.toggle("actual", a.dataset.ruta === ruta));
  document.getElementById("menuPrincipal").classList.remove("abierto");
  document.getElementById("botonMenu").setAttribute("aria-expanded", "false");
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

// Botones 🔊 (un solo escuchador para toda la página)
document.addEventListener("click", ev => {
  const b = ev.target.closest(".boton-voz");
  if (b) { ev.preventDefault(); hablar(b.dataset.voz); }
});

// Menú en celular
document.getElementById("botonMenu").addEventListener("click", () => {
  const menu = document.getElementById("menuPrincipal");
  const abierto = menu.classList.toggle("abierto");
  document.getElementById("botonMenu").setAttribute("aria-expanded", String(abierto));
});

/* ---------- Perfil: Alumno, Docente o Familia (sin contraseñas ni datos personales) ---------- */

/** Avatar ilustrado (no es una foto ni pide datos). Cambia según el perfil. */
function avatarSVG(p) {
  const pelo = { alumno: "#4a2f22", docente: "#2b1d16", familia: "#6b4a2f" }[p] || "#4a2f22";
  const ropa = { alumno: "#2fa266", docente: "#2f7fc1", familia: "#e07a3f" }[p] || "#2fa266";
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="#e9f5ec"/>
    <path d="M10 64c2-14 12-20 22-20s20 6 22 20Z" fill="${ropa}"/>
    <path d="M26 44h12l-2 6h-8z" fill="#f2c9a5"/>
    <circle cx="32" cy="30" r="14" fill="#f2c9a5"/>
    <path d="M17 30c0-11 7-17 15-17s15 6 15 17c-3-6-8-9-15-9s-12 3-15 9z" fill="${pelo}"/>
    ${p === "docente" ? `<g fill="none" stroke="#2b2f36" stroke-width="1.8"><circle cx="26" cy="31" r="4"/><circle cx="38" cy="31" r="4"/><path d="M30 31h4"/></g>` : ""}
    <circle cx="26.5" cy="31" r="1.8" fill="#2b1d16"/><circle cx="37.5" cy="31" r="1.8" fill="#2b1d16"/>
    <path d="M27.5 37q4.5 3.5 9 0" stroke="#b5543d" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="22.5" cy="35.5" rx="2.6" ry="1.6" fill="#f08a7a" opacity=".5"/><ellipse cx="41.5" cy="35.5" rx="2.6" ry="1.6" fill="#f08a7a" opacity=".5"/>
  </svg>`;
}
const TEXTO_PERFIL = {
  alumno: { saludo: "¡Hola, explorador(a)!", nombre: "Explorador(a)" },
  docente: { saludo: "Maestra o maestro", nombre: "Docente" },
  familia: { saludo: "Madre, padre o tutor", nombre: "Madre, padre o tutor" }
};
/** Menú lateral de cada perfil: [enlace, ícono, texto]. */
const MENU_PERFIL = {
  alumno: [["inicio", "casa", "Inicio"], ["actua", "insignia", "Mis misiones"], ["progreso", "avance", "Mi progreso"], ["insignias", "insignia", "Mis insignias"]],
  docente: [["inicio", "casa", "Inicio"], ["grupo", "grupo", "Avance del grupo"], ["docente", "libro", "Vinculación curricular"], ["hojas", "hoja", "Hojas para imprimir"]],
  familia: [["inicio", "casa", "Inicio"], ["casa", "escudo", "Plan en casa"], ["hijos", "avance", "Avance de mi hija o hijo"], ["hojas", "hoja", "Sin internet"]]
};
function pintarPerfil() {
  document.querySelector(".menu-lateral").innerHTML = MENU_PERFIL[estado.perfil].map(([r, i, t]) => `<a href="#${r}" data-ruta="${r}">${ICONO_ADULTO[i].replace("<svg", '<svg aria-hidden="true"')}${t}</a>`).join("") + `<a class="enlace-acerca" href="#acerca" data-ruta="acerca">Acerca de EcoQuest y fuentes</a>`;
  const p = estado.perfil;
  document.body.dataset.perfil = p;
  // Alumno: se muestra el explorador activo (personaje + apodo). Docente y Familia: avatar genérico.
  const ex = exploradorActivo();
  const esAlumno = p === "alumno" && ex;
  const nombreG = datos?.nombreGrado || "1.º grado";
  document.getElementById("gradoCabeza").textContent = nombreG;
  document.querySelector(".tarjeta-perfil small").textContent = nombreG;
  document.getElementById("avatarCabeza").innerHTML = esAlumno ? avatarExplorador(ex) : avatarSVG(p);
  document.getElementById("avatarLateral").innerHTML = esAlumno ? avatarExplorador(ex) : avatarSVG(p);
  document.getElementById("saludoCabeza").textContent = esAlumno ? `¡Hola, ${apodoDe(ex)}!` : TEXTO_PERFIL[p].saludo;
  document.getElementById("nombrePerfil").textContent = esAlumno ? apodoDe(ex) : TEXTO_PERFIL[p].nombre;
  document.querySelector(".tarjeta-perfil a[href='#progreso']").hidden = !esAlumno;
  const enlace = document.getElementById("enlaceExplorador");
  if (enlace) enlace.hidden = !esAlumno;
  const pastilla = document.querySelector(".pastilla-perfil");
  if (pastilla) pastilla.setAttribute("href", esAlumno ? "#exploradores" : "#inicio");
  document.querySelectorAll(".cambiar-perfil button").forEach(b => {
    b.classList.toggle("activo", b.dataset.perfil === p);
    b.setAttribute("aria-pressed", String(b.dataset.perfil === p));
  });
}
document.querySelectorAll(".cambiar-perfil button").forEach(b => b.addEventListener("click", () => {
  estado.perfil = b.dataset.perfil;
  guardarEstado();
  pintarPerfil();
  avisar({ alumno: "Vista para alumnos", docente: "Vista para docentes: verás la vinculación curricular", familia: "Vista para madres, padres o tutores" }[estado.perfil]);
  if (location.hash === "#inicio" || !location.hash) enrutar(); else location.hash = "inicio";
}));

/* ---------- Buscador del encabezado ---------- */
document.getElementById("buscador").addEventListener("submit", ev => {
  ev.preventDefault();
  const q = document.getElementById("textoBuscar").value.trim();
  if (q) location.hash = "buscar/" + encodeURIComponent(q);
});
/** Quita acentos y mayúsculas para comparar ("energía" = "ENERGIA"). */
const normal = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function pantallaBuscar(q) {
  const n = normal(q);
  const coincide = (...textos) => textos.some(t => normal(t).includes(n));
  const res = [
    ...datos.unidades.filter(u => coincide(u.titulo, u.resumen, ...u.aprende.explicacion)).map(u => ({ e: `#aprende/${u.id}`, i: u.icono, t: u.titulo, d: "Aprende · " + u.resumen })),
    ...datos.juegos.filter(j => coincide(j.titulo, j.instrucciones)).map(j => ({ e: `#juega/${j.id}`, i: ICONO_JUEGO[j.tipo] || "🎮", t: j.titulo, d: "Juega · " + TIPOS_JUEGO[j.tipo] })),
    ...datos.experimentos.filter(x => coincide(x.nombre, x.proposito)).map(x => ({ e: `#experimenta/${x.id}`, i: "🧪", t: x.nombre, d: "Experimenta · " + x.proposito })),
    ...datos.retos.filter(r => coincide(r.titulo, r.explicacion)).map(r => ({ e: `#actua/${r.id}`, i: "🌱", t: r.titulo, d: "Actúa · " + r.explicacion }))
  ];
  app.innerHTML = `
    ${encabezadoSeccion("🔍", "Buscar", `${res.length} resultado(s) para «${esc(q)}»`, "buscar")}
    <div class="lista-unidades">${res.map(r => `<a class="tarjeta-actividad" href="${r.e}"><span class="tarjeta-icono" aria-hidden="true">${r.i}</span><span class="tarjeta-cuerpo"><b>${esc(r.t)}</b><small>${esc(r.d)}</small></span></a>`).join("") || `<div class="panel">${mascota("No encontré nada. Prueba con: agua, basura, desierto, calor…", 110)}</div>`}</div>`;
}

async function iniciar() {
  cargarEstado();
  pintarPerfil();
  try {
    await cargarDatos();
  } catch (e) {
    app.innerHTML = `<section class="panel">${mascota("No pude cargar los contenidos.", 110)}
      <p>Si abriste <b>index.html</b> con doble clic, el navegador no deja leer los archivos de contenido.</p>
      <p>Abre EcoQuest con el archivo <b>abrir-ecoquest.bat</b> (doble clic) o desde su dirección en internet.</p></section>`;
    console.error(e);
    return;
  }
  window.addEventListener("hashchange", enrutar);
  enrutar();
}

iniciar();
