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
   No guardamos nombres ni datos personales. */

const CLAVE = "ecoquest-v1";
const estadoInicial = () => ({ perfil: "alumno", hechos: {}, puntajes: {}, registros: {}, retos: {} });
let estado = estadoInicial();

function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado) estado = Object.assign(estadoInicial(), guardado);
  } catch (e) { /* si falla, se usa el estado inicial */ }
}
function guardarEstado() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* navegador en modo privado, etc. */ }
}
/** Marca una actividad como hecha. clave = "aprende:u1", "juego:j1", "experimento:e1", "reto:r1" */
function marcarHecho(clave) {
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
let datos = null;  // datos/primero.json

async function cargarDatos() {
  // "no-cache": el navegador siempre revisa si el contenido cambió (así se ven al instante las ediciones de datos/).
  const lista = await fetch("datos/grados.json", { cache: "no-cache" }).then(r => r.json());
  grados = lista.grados;
  const listo = grados.find(g => g.estado === "listo");
  datos = await fetch("datos/" + listo.archivo, { cache: "no-cache" }).then(r => r.json());
}

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

/* Perrito schnauzer gris con cejas y barba claras, orejas caídas y
   paliacate verde con una hoja (como en la ilustración del banner de Inicio). */
function mascota(mensaje = "", tam = 120) {
  const id = "m" + Math.random().toString(36).slice(2, 7);   // ids únicos por si hay varias mascotas
  return `<div class="mascota">
    <svg viewBox="0 0 200 230" width="${tam}" height="${Math.round(tam * 230 / 200)}" role="img" aria-label="${NOMBRE_MASCOTA}, el perrito mascota de EcoQuest">
      <defs>
        <radialGradient id="${id}g" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#8a8480"/><stop offset="1" stop-color="#5c5653"/></radialGradient>
        <linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b6461"/><stop offset="1" stop-color="#4a4442"/></linearGradient>
        <radialGradient id="${id}b" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#fbf6ee"/><stop offset="1" stop-color="#e3d8c8"/></radialGradient>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21924f"/><stop offset="1" stop-color="#14693a"/></linearGradient>
      </defs>
      <!-- cuerpo y pecho -->
      <path d="M58 168 Q100 150 142 168 L150 226 H50Z" fill="url(#${id}g)"/>
      <path d="M78 176 Q100 168 122 176 L120 226 H80Z" fill="url(#${id}b)"/>
      <!-- orejas caídas -->
      <path d="M62 54 Q30 40 20 70 Q18 96 40 108 Q50 92 58 82Z" fill="url(#${id}o)"/>
      <path d="M56 66 Q36 60 32 78 Q34 92 44 98 Q50 86 54 78Z" fill="#9b5d5a" opacity=".55"/>
      <path d="M138 54 Q170 40 180 70 Q182 96 160 108 Q150 92 142 82Z" fill="url(#${id}o)"/>
      <path d="M144 66 Q164 60 168 78 Q166 92 156 98 Q150 86 146 78Z" fill="#9b5d5a" opacity=".55"/>
      <!-- cabeza -->
      <path d="M100 40 Q142 40 148 86 Q152 120 132 140 L68 140 Q48 120 52 86 Q58 40 100 40Z" fill="url(#${id}g)"/>
      <path d="M86 46 Q100 42 114 46 Q110 60 100 62 Q90 60 86 46Z" fill="#9a9490" opacity=".5"/>
      <!-- cejas pobladas -->
      <path d="M60 80 Q70 62 92 70 Q86 74 90 80 Q78 76 72 84 Q68 78 60 80Z" fill="url(#${id}b)"/>
      <path d="M140 80 Q130 62 108 70 Q114 74 110 80 Q122 76 128 84 Q132 78 140 80Z" fill="url(#${id}b)"/>
      <!-- ojos con brillo -->
      <ellipse cx="80" cy="94" rx="10" ry="11" fill="#1d1a19"/><ellipse cx="120" cy="94" rx="10" ry="11" fill="#1d1a19"/>
      <circle cx="84" cy="89" r="4" fill="#fff"/><circle cx="124" cy="89" r="4" fill="#fff"/>
      <circle cx="77" cy="98" r="1.6" fill="#fff" opacity=".8"/><circle cx="117" cy="98" r="1.6" fill="#fff" opacity=".8"/>
      <!-- barba y bigote del schnauzer -->
      <path d="M62 112 Q60 96 76 98 Q90 100 100 108 Q110 100 124 98 Q140 96 138 112 Q146 130 134 150 Q120 168 100 170 Q80 168 66 150 Q54 130 62 112Z" fill="url(#${id}b)"/>
      <path d="M70 140 l-4 10 M80 150 l-2 10 M120 150 l2 10 M130 140 l4 10 M92 158 l-1 8 M108 158 l1 8" stroke="#d9cdbc" stroke-width="3" stroke-linecap="round"/>
      <!-- nariz y boca feliz con lengua -->
      <ellipse cx="100" cy="110" rx="13" ry="9" fill="#1d1a19"/><ellipse cx="96" cy="107" rx="4.5" ry="2.4" fill="#fff" opacity=".5"/>
      <path d="M86 126 Q100 140 114 126 Q110 146 100 148 Q90 146 86 126Z" fill="#7a2d2d"/>
      <path d="M92 136 Q100 132 108 136 Q106 148 100 148 Q94 148 92 136Z" fill="#f2808a"/>
      <!-- paliacate verde con hoja -->
      <path d="M58 150 Q100 172 142 150 L140 168 Q100 188 60 168Z" fill="url(#${id}s)"/>
      <path d="M78 172 L100 214 L122 172 Q100 184 78 172Z" fill="url(#${id}s)"/>
      <path d="M136 152 L156 140 L150 160Z" fill="#1a7c43"/>
      <circle cx="100" cy="190" r="11" fill="#fff"/>
      <path d="M100 198 C100 192 99 188 95 184" stroke="#3d8c4a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M98 190 C91 191 89 185 90 181 C96 181 99 185 98 190Z" fill="#6cc04a"/>
      <path d="M101 192 C102 186 107 183 111 184 C111 190 106 193 101 192Z" fill="#4fae3f"/>
    </svg>
    ${mensaje ? `<p class="globo">${mensaje}</p>` : ""}
  </div>`;
}

/* ---------- 5. Pantallas ---------- */

const perfil = () => estado.perfil;

/** Etiquetas para distinguir contenido oficial de la propuesta EcoQuest. */
const ETQ_PROPUESTA = `<span class="etiqueta propuesta">Propuesta didáctica EcoQuest</span>`;
const ETQ_OFICIAL = `<span class="etiqueta oficial">Oficial · SEP</span>`;

function pantallaInicio() {
  const total = contarProgreso();
  const saludo = { alumno: "¡Hola, explorador o exploradora!", docente: "Bienvenida, bienvenido, docente", familia: "¡Bienvenida, familia!" }[perfil()];
  const texto = {
    alumno: "Juntos por un planeta más limpio, justo y saludable. ¡Vamos a cuidarlo desde Sonora!",
    docente: "Aquí encontrará actividades de 1.º grado vinculadas con el Programa Sintético de la Fase 3.",
    familia: "Acompañen a sus hijas e hijos con actividades sencillas para hacer en casa."
  }[perfil()];

  const pct = total.total ? Math.round(total.hechas / total.total * 100) : 0;
  const ganadas = insigniasGanadas().map(i => i.id);
  const sig = siguientePaso();
  const idSig = sig.split("/")[1];
  const sigUnidad = unidad(idSig) || datos.unidades.find(u => juegosDe(u.id).some(j => j.id === idSig) || experimentoDe(u.id)?.id === idSig || retoDe(u.id)?.id === idSig) || datos.unidades[0];
  const sigTipo = sig.startsWith("#aprende") ? "Lección" : sig.startsWith("#juega") ? "Juego" : sig.startsWith("#experimenta") ? "Experimento" : sig.startsWith("#actua") ? "Reto" : "Progreso";
  const dato = azar(DATOS_CURIOSOS);
  app.innerHTML = `
    <section class="banner con-imagen banner-perrito">
      <div class="banner-texto">
        <h1>${saludo.replace("¡Hola, explorador o exploradora!", "¡Bienvenido(a) a EcoQuest!")}</h1>
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

    ${perfil() === "docente" ? `<section class="panel"><h2>Para docentes</h2><p>Consulte la vinculación curricular oficial de cada unidad (contenidos y PDA textuales del Programa Sintético de la Fase 3).</p><a class="boton" href="#docente">Ver vinculación curricular →</a></section>` : ""}
    ${perfil() === "familia" ? `<section class="panel"><h2>Para familias</h2><p>Ideas breves para aprender en casa y cómo se guarda el progreso.</p><a class="boton" href="#familia">Ver guía para familias →</a></section>` : ""}

    <section class="panel">
      <h2>Elige el grado</h2>
      <div class="grados">
        ${grados.map(g => g.estado === "listo"
          ? `<span class="grado activo">${esc(g.nombre)}</span>`
          : `<a class="grado" href="#grado/${g.grado}">${esc(g.nombre)}<small>en construcción</small></a>`).join("")}
      </div>
    </section>

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

const hayPiezas = () => typeof svgSaguaro === "function";

/** Paisaje de día del banner: cerros, lago, árboles y saguaros de Sonora. */
function paisaje() {
  const hay = hayPiezas();
  return `<svg class="paisaje" viewBox="0 0 1600 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="bnCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ed8f2"/><stop offset="1" stop-color="#e8f6fb"/></linearGradient>
      <linearGradient id="bnLago" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ec3e6"/><stop offset="1" stop-color="#3f9fcf"/></linearGradient>
      <linearGradient id="bnVeladura" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".3" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".7" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1600" height="520" fill="url(#bnCielo)"/>
    ${hay ? svgNube(560, 70, .7, "nube-a") + svgNube(1120, 60, .55, "nube-b") : ""}
    <path d="M0 300 L120 210 L250 280 L400 170 L560 270 L700 200 L860 280 L1010 190 L1180 270 L1340 180 L1600 260 V380 H0Z" fill="#b9a7c9"/>
    <path d="M400 170 L440 205 L420 200 L400 215 L380 200 L362 205Z M1340 180 L1378 212 L1358 208 L1340 222 L1322 208 L1304 212Z" fill="#efe9f4"/>
    <path d="M0 330 L180 260 L360 320 L560 250 L760 320 L980 260 L1200 320 L1400 270 L1600 310 V400 H0Z" fill="#c9b08e"/>
    <path d="M0 380 Q300 340 620 372 T1200 360 T1600 370 V520 H0Z" fill="#9cc56e"/>
    <path d="M430 395 Q800 365 1180 395 Q800 430 430 395Z" fill="url(#bnLago)"/>
    <path class="ola" d="M620 392 q30 -8 60 0 t60 0 M900 400 q30 -8 60 0" stroke="#d9f2fb" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M0 430 Q400 405 800 432 T1600 425 V520 H0Z" fill="#7fb35a"/>
    ${hay ? svgMezquite(120, 430, 1.1) + svgPaloVerde(330, 420, .8) + svgSaguaro(1300, 470, 1) + svgSaguaro(1470, 490, .7) + svgSaguaro(1180, 420, .5) + svgArbusto(1060, 470, 1, "#6aa24a") + svgArbusto(560, 470, .9, "#6aa24a") + svgMezquite(1560, 430, .9) : ""}
    <rect width="1600" height="520" fill="url(#bnVeladura)"/>
  </svg>`;
}

/** Franja de paisaje al pie de la página de inicio. */
function franjaPaisaje() {
  const hay = hayPiezas();
  return `<svg class="franja-svg" viewBox="0 0 1600 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="frCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdeaf7"/><stop offset="1" stop-color="#f6ecd8"/></linearGradient></defs>
    <rect width="1600" height="220" fill="url(#frCielo)"/>
    <path d="M0 120 L160 70 L320 110 L520 60 L720 115 L940 70 L1160 115 L1380 75 L1600 110 V220 H0Z" fill="#d7b9a2" opacity=".8"/>
    <path d="M0 160 Q400 130 800 158 T1600 150 V220 H0Z" fill="#e3c99a"/>
    ${hay ? svgSaguaro(60, 200, .8) + svgSaguaro(1520, 205, .75) + svgSaguaro(1380, 175, .45) + svgArbusto(240, 200, .9, "#8aa85a") + svgArbusto(1200, 205, .7, "#8aa85a") + svgPaloVerde(1080, 190, .5) : ""}
    <path d="M0 200 Q400 188 800 202 T1600 198 V220 H0Z" fill="#c9a874"/>
  </svg>`;
}

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
      <p class="pequeno">Grado: ${esc(datos.nombreGrado)} · Fase ${datos.fase}. Redacción textual del Programa Sintético de la Fase 3 (SEP, 2024).</p>
      ${u.curriculo.map(c => `
        <div class="curriculo-item">
          <p><b>Campo formativo:</b> ${esc(c.campo)}</p>
          <p><b>Contenido:</b> ${esc(c.contenido)}</p>
          <p><b>PDA (primer grado):</b></p>
          <ul>${c.pda.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
          <p class="pequeno">Fuente: Programa Sintético de la Fase 3, p. ${c.pagina}.</p>
        </div>`).join("")}
      <h4>Para consultar en los libros de texto de 1.º ${ETQ_PROPUESTA}</h4>
      <p class="pequeno">Relación sugerida por EcoQuest a partir de los índices de los libros.</p>
      <ul>${u.libros.map(l => `<li><i>${esc(l.libro)}</i>: «${esc(l.tema)}», p. ${l.pagina}</li>`).join("")}</ul>
    </div>`;
  if (perfil() === "docente") {
    return oficial + `<div class="nota-perfil docente"><h3>Sugerencia didáctica ${ETQ_PROPUESTA}</h3><p>${esc(u.docente)}</p></div>`;
  }
  if (perfil() === "familia") {
    return `<div class="nota-perfil familia"><h3>👪 En casa ${ETQ_PROPUESTA}</h3><p>${esc(u.familia)}</p></div>
      <details class="para-adultos"><summary>Ver vinculación con el programa oficial</summary>${oficial}</details>`;
  }
  return `<details class="para-adultos"><summary>Para maestras, maestros y familias</summary>${oficial}</details>`;
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

        <div class="franja-tema">
          ${paisaje()}
          <p class="nota-franja">${esc(sonora)}</p>
        </div>

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
  detective: "Detective ambiental", gotas: "Atrapa las gotas", planta: "Cuida tu planta", colonia: "Colonia verde"
};
const ICONO_JUEGO = { loteria: "🎴", sombras: "🌑", ordenar: "🔢", buraDice: "🎵", detective: "🔍", gotas: "💧", planta: "🌱", colonia: "🏘️" };

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
            <p>${esc(j.instrucciones.split(". ")[0].replace(/\.$/, ""))}.</p>
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
    detective: `<svg x="0" y="0" width="300" height="190" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${typeof ESCENAS_SVG === "object" ? ESCENAS_SVG.parque.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, "") : ""}</svg>` + `<g transform="translate(200 110)"><circle r="34" fill="#ffffff55" stroke="#6b4a2f" stroke-width="8"/><rect x="22" y="22" width="12" height="40" rx="5" fill="#6b4a2f" transform="rotate(-45 28 28)"/></g>`,
    gotas: dibujo("llaveAbierta", 30, 20, 110) + `<g fill="#3f9fcf">${[[180, 50], [220, 90], [170, 120], [250, 40]].map(([x, y]) => `<path d="M${x} ${y} q12 18 0 26 q-12 -8 0 -26Z"/>`).join("")}</g>`,
    planta: dibujo("maceta", 100, 26, 100) + `<circle cx="240" cy="50" r="24" fill="#ffd45e"/><g fill="#3f9fcf"><path d="M60 60 q10 16 0 22 q-10 -6 0 -22Z"/><path d="M50 100 q10 16 0 22 q-10 -6 0 -22Z"/></g>`,
    colonia: dibujo("arbolBanqueta", 30, 30, 90) + dibujo("banca", 120, 110, 90) + dibujo("boteReciclaje", 220, 80, 50)
  };
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
        <div class="bura-juego" id="buraJuego">${mascota("¡Vamos a jugar!", 70)}</div>
      </header>
      <p class="texto-grande">${esc(j.instrucciones)} ${botonVoz(j.instrucciones)}</p>
      <div id="zonaJuego" class="zona-juego"></div>
    </article>`;
  racha = 0;
  const zona = document.getElementById("zonaJuego");
  const motores = {
    opcion: juegoPreguntas, vf: juegoPreguntas, sombras: juegoPreguntas, completar: juegoCompletar, memorama: juegoMemorama,
    clasificar: juegoClasificar, loteria: juegoLoteria, ordenar: juegoOrdenar, buraDice: juegoBuraDice,
    detective: juegoDetective, gotas: juegoGotas, planta: juegoPlanta, colonia: juegoColonia
  };
  (motores[j.tipo] || pantallaNoEncontrada)(j, zona);
}

/** Pantalla final de cualquier juego: guarda el mejor resultado y marca el juego como hecho. */
function finDeJuego(j, zona, aciertos, total, detalle = "") {
  const previo = estado.puntajes[j.id];
  if (!previo || aciertos > previo.aciertos) estado.puntajes[j.id] = { aciertos, total };
  guardarEstado();
  marcarHecho(`juego:${j.id}`);
  const excelente = aciertos === total;
  sonidoVictoria();
  if (aciertos >= total / 2) confeti();
  zona.innerHTML = `
    <div class="fin-juego">
      ${mascota(excelente ? "¡Excelente! Lo hiciste perfecto." : "¡Buen trabajo! Puedes jugar otra vez para mejorar.", 110)}
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
    Los fondos están en escenas.js; los objetos y sus textos, en datos/primero.json.
    Cada objeto puede tener un "efecto" animado: chorro, humo, ondas, brillo, moscas,
    vuela, mece o flota. */
function juegoDetective(j, zona) {
  const totalProblemas = j.escenas.reduce((n, e) => n + e.elementos.filter(x => x.problema).length, 0);
  const fondos = typeof ESCENAS_SVG === "object" ? ESCENAS_SVG : {};
  let s = 0, encontrados = 0, errores = 0, pistas = 0;

  // Elige una escena para empezar (menú con miniaturas)
  function menu() {
    zona.innerHTML = `
      <p class="texto-grande">Elige dónde investigar. ¡Hay ${totalProblemas} problemas escondidos en total!</p>
      <div class="menu-escenas">${j.escenas.map((e, k) => `
        <button class="mini-escena" data-k="${k}">
          <span class="mini-fondo">${fondos[e.fondo] || ""}</span>
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
      <div class="escena" id="escena">
        <div class="escena-fondo">${fondos[es.fondo] || ""}</div>
        ${es.elementos.map((e, k) => {
          // Si hay ilustración (ilustraciones.js) se dibuja; si no, se usa el emoji.
          const il = e.ilus && typeof ILUS === "object" ? ILUS[e.ilus] : null;
          const ancho = il ? (e.ancho || il.ancho) * 1.4 : 0;   // 1.4 = escala general de los objetos
          return `
          <button class="elemento ${il ? "ilus" : ""} ${e.efecto ? "con-" + esc(e.efecto) : ""}" data-k="${k}"
            style="left:${e.x}%;top:${e.y}%;--prof:${(0.72 + e.y / 170).toFixed(2)};${il ? `width:${ancho}%` : ""}" aria-label="${esc(e.nombre)}">
            <span class="ico">${il ? `<svg viewBox="${il.vb}" aria-hidden="true">${il.svg}</svg>` : e.icono}</span>${!il && e.efecto ? `<i class="efecto efecto-${esc(e.efecto)}"></i>` : ""}
          </button>`;
        }).join("")}
        <div class="lupa" id="lupa" aria-hidden="true"></div>
      </div>
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
      b.classList.add("pista"); setTimeout(() => b.classList.remove("pista"), 2600);
      retro.className = "retro"; retro.textContent = "💡 Mira lo que se está moviendo…";
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
    <div class="marcador"><span>💧 Gotas: <b id="atrapadas">0</b></span><span>🚰 Fugas cerradas: <b id="fugas">0</b></span><span>⏱️ <b id="tiempo">${segundos}</b> s</span></div>
    <div class="area-gotas" id="area"><div class="cubeta" id="cubeta">🪣</div></div>
    <div class="controles-gotas">
      <button class="boton secundario" id="izq" aria-label="Mover a la izquierda">◀</button>
      <button class="boton" id="empezar">▶️ Empezar</button>
      <button class="boton secundario" id="der" aria-label="Mover a la derecha">▶</button>
    </div>
    <p class="retro" aria-live="polite">Mueve la cubeta con el dedo, el ratón o las flechas. Si aparece una llave 🚰, ¡tócala para cerrarla!</p>`;
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
    b.className = "fuga"; b.textContent = "🚰💦"; b.setAttribute("aria-label", "Fuga de agua: tócala para cerrarla");
    b.style.left = (10 + Math.random() * 75) + "%"; b.style.top = (10 + Math.random() * 35) + "%";
    b.addEventListener("pointerdown", ev => {
      ev.stopPropagation();
      if (b.dataset.cerrada) return;
      b.dataset.cerrada = "1"; fugasCerradas++; b.textContent = "🚰✅";
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
      area.querySelectorAll(".fuga").forEach(f => f.remove());
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

/** Ícono de línea genérico para los materiales (sin emojis). */
const ICONO_MATERIAL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/></svg>`;

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
          <b>${e.supervision ? "⚠️ Requiere supervisión de un adulto" : "✓ Puedes hacerlo con la guía de tu maestra, maestro o familia"}</b>
          <p>${esc(e.aviso)}</p>
        </div>

        <h3>Materiales</h3>
        <div class="materiales-tiles">${e.materiales.map(m => `<div class="material">${ICONO_MATERIAL}<span>${esc(m)}</span></div>`).join("")}</div>

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

/** Cartel lateral de Actúa: planeta sonriente en manos. */
const CARTEL_PLANETA = `<aside class="cartel-planeta">
  <p class="cartel-titulo">Tus acciones también cuentan</p>
  <svg viewBox="0 0 200 190" aria-hidden="true">
    <path d="M100 44 C100 30 98 22 92 14" stroke="#3d8c4a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M96 30 C80 32 74 20 76 10 C90 10 98 18 96 30Z" fill="#7cc46a"/><path d="M101 34 C102 22 112 16 122 18 C122 30 112 36 101 34Z" fill="#4fae5f"/>
    <circle cx="100" cy="100" r="56" fill="#5bb3e6"/>
    <path d="M62 78 Q80 66 96 76 Q100 92 84 98 Q70 104 66 118 Q50 104 62 78Z M110 60 Q132 62 146 82 Q138 96 122 92 Q112 80 110 60Z M114 116 Q130 108 148 118 Q140 140 120 150 Q110 134 114 116Z" fill="#7cc46a"/>
    <circle cx="84" cy="102" r="5" fill="#1d2b33"/><circle cx="116" cy="102" r="5" fill="#1d2b33"/>
    <path d="M86 118 Q100 128 114 118" stroke="#1d2b33" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="74" cy="114" rx="7" ry="4" fill="#f08a7a" opacity=".55"/><ellipse cx="126" cy="114" rx="7" ry="4" fill="#f08a7a" opacity=".55"/>
    <path d="M30 150 Q40 120 62 130 L82 150 Q90 160 80 168 L44 178 Q28 176 30 150Z" fill="#f2c9a5"/>
    <path d="M170 150 Q160 120 138 130 L118 150 Q110 160 120 168 L156 178 Q172 176 170 150Z" fill="#f2c9a5"/>
  </svg>
  <p class="cartel-pie">Juntos por un planeta más limpio, justo y saludable.</p>
</aside>`;

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
   El código guarda SOLO qué actividades están completas, como una lista de sí/no:
   lecciones, juegos, experimentos y retos, en el orden de datos/primero.json.
   Formato: EQ1-XXX-XXX-XXX-X  (EQ = EcoQuest, 1 = versión, la última letra es de control).
   IMPORTANTE: para que los códigos viejos sigan sirviendo, el contenido nuevo
   (temas, juegos, etc.) siempre se agrega AL FINAL de cada lista en primero.json. */

const ALFABETO_32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";   // sin I, L, O, U para evitar confusiones

/** Lista fija de todas las actividades, en orden. */
function actividadesCodigo() {
  return [
    ...datos.unidades.map(u => `aprende:${u.id}`),
    ...datos.juegos.map(j => `juego:${j.id}`),
    ...datos.experimentos.map(e => `experimento:${e.id}`),
    ...datos.retos.map(r => `reto:${r.id}`)
  ];
}

/** Letra de control: detecta si alguien se equivocó al escribir el código. */
function letraControl(cuerpo) {
  let s = 7;
  for (let i = 0; i < cuerpo.length; i++) s = (s * 31 + ALFABETO_32.indexOf(cuerpo[i]) * (i + 3)) % 32;
  return ALFABETO_32[s];
}

/** Crea el código a partir del progreso actual. */
function codigoProgreso() {
  const bits = actividadesCodigo().map(c => estado.hechos[c] ? 1 : 0);
  while (bits.length % 5) bits.push(0);
  let cuerpo = "";
  for (let i = 0; i < bits.length; i += 5) cuerpo += ALFABETO_32[bits.slice(i, i + 5).reduce((n, b) => n * 2 + b, 0)];
  const grupos = cuerpo.match(/.{1,3}/g).join("-");   // grupos de 3, fáciles de dictar
  return `EQ1-${grupos}-${letraControl(cuerpo)}`;
}

/** Dirección web que abre EcoQuest y carga este progreso (se usa en el QR). */
function enlaceProgreso() {
  return location.href.split("#")[0] + "#cargar/" + codigoProgreso();
}

/** Lee un código y SUMA sus actividades al progreso de este dispositivo. */
function aplicarCodigo(texto, soloRevisar = false) {
  const limpio = String(texto).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!limpio.startsWith("EQ1") || limpio.length < 5) return { ok: false, mensaje: "Ese código no es de EcoQuest. Revisa que empiece con EQ1." };
  const cuerpo = limpio.slice(3, -1), control = limpio.slice(-1);
  if ([...cuerpo].some(c => !ALFABETO_32.includes(c)) || letraControl(cuerpo) !== control) {
    return { ok: false, mensaje: "El código tiene un error. Revisa letra por letra y vuelve a intentarlo." };
  }
  const bits = [...cuerpo].flatMap(c => { const v = ALFABETO_32.indexOf(c); return [16, 8, 4, 2, 1].map(p => (v & p) ? 1 : 0); });
  const lista = actividadesCodigo();
  const nuevas = lista.filter((c, i) => bits[i] && !estado.hechos[c]);
  const enCodigo = lista.filter((c, i) => bits[i]).length;
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
      <p class="pequeno">No se borra nada de lo que ya tengas aquí.</p>
      <div class="acciones" style="justify-content:center">
        <button class="boton" id="confirmarCarga">Sí, cargar mi progreso</button>
        <a class="boton secundario" href="#inicio">No, gracias</a>
      </div>
    </section>`;
  document.getElementById("confirmarCarga").addEventListener("click", () => {
    const res = aplicarCodigo(codigo);
    avisar(res.mensaje);
    location.hash = "progreso";
  });
}

/* ----- Progreso e insignias ----- */

function pantallaProgreso() {
  const total = contarProgreso();
  const ganadas = insigniasGanadas().map(i => i.id);
  app.innerHTML = `
    ${encabezadoSeccion("⭐", "Mi progreso", "Completa las 4 actividades de un tema para ganar su insignia.")}
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
    <section class="panel codigo-progreso" id="guardarProgreso">
      <h2>💾 Guardar mi progreso</h2>
      <p>Con este código o este QR puedes continuar en otra computadora, tableta o celular. No guarda nombres ni datos personales: solo qué actividades completaste.</p>
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
    </section>

    <section class="panel codigo-progreso">
      <h2>📥 Cargar un progreso</h2>
      <p>¿Ya tienes un código? Escríbelo aquí. Se sumará a lo que ya tengas en este dispositivo; no se borra nada.</p>
      <form class="cargar-codigo" id="formCargar">
        <input id="entradaCodigo" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="EQ1-XXX-XXX-XXX-X" aria-label="Código de progreso">
        <button class="boton" type="submit">Cargar</button>
      </form>
      <p class="retro" id="retroCargar" aria-live="polite"></p>
    </section>

    <section class="panel">
      <h2>¿Dónde se guarda mi progreso?</h2>
      <p>Se guarda solo en este navegador y en este dispositivo. No se envía a internet y no pide nombres. Si cambias de dispositivo, usa tu <a href="#guardarProgreso">código de progreso</a>. Si se borran los datos de navegación sin haber guardado el código, el progreso empieza de cero.</p>
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

/* ----- Vistas para docentes y familias ----- */

function pantallaDocente() {
  app.innerHTML = `
    ${encabezadoSeccion("👩‍🏫", "Vinculación curricular", "Contenidos y PDA de primer grado usados en EcoQuest.")}
    <section class="panel">
      <p>${ETQ_OFICIAL} Los contenidos y Procesos de Desarrollo de Aprendizaje (PDA) se transcriben textualmente de: <i>${esc(datos.fuenteOficial)}</i></p>
      <p>${ETQ_PROPUESTA} Las explicaciones, juegos, experimentos, retos y la relación con los libros de texto son propuesta de EcoQuest.</p>
    </section>
    <div class="tabla-envoltura">
      <table class="tabla">
        <thead><tr><th>Tema EcoQuest</th><th>Campo formativo</th><th>Contenido</th><th>PDA (primer grado)</th><th>Pág.</th></tr></thead>
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

function pantallaFamilia() {
  app.innerHTML = `
    ${encabezadoSeccion("👪", "Guía para familias", "Ideas breves para aprender juntos en casa.")}
    <div class="lista-unidades">
      ${datos.unidades.map(u => `<div class="tarjeta-actividad color-${u.color}"><span class="tarjeta-icono" aria-hidden="true">${u.icono}</span>
        <span class="tarjeta-cuerpo"><b>${esc(u.titulo)}</b><small>${esc(u.familia)}</small></span></div>`).join("")}
    </div>
    <section class="panel">
      <h2>Seguridad primero</h2>
      <ul>
        <li>Los experimentos marcados con ⚠️ necesitan a un adulto presente.</li>
        <li>Ningún experimento usa fuego, electricidad, sustancias tóxicas ni agua hirviendo.</li>
        <li>En Sonora, al observar la naturaleza, no metan las manos en huecos ni bajo piedras (alacranes).</li>
      </ul>
      <h2>Privacidad</h2>
      <p>EcoQuest no pide nombres, correos ni contraseñas. El progreso se guarda solo en este dispositivo.</p>
    </section>`;
}

function pantallaAcerca() {
  app.innerHTML = `
    ${encabezadoSeccion("ℹ️", "Acerca de EcoQuest", "Plataforma de educación ambiental para primaria, hecha en Hermosillo, Sonora.")}
    <section class="panel">
      <h2>Fuentes oficiales consultadas</h2>
      <ul><li>${esc(datos.fuenteOficial)}</li>${datos.librosDeTexto.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
      <h2>¿Qué es oficial y qué no?</h2>
      <p>${ETQ_OFICIAL} Solo los contenidos y PDA que aparecen en los cuadros de «Vinculación curricular», copiados textualmente del Programa Sintético.</p>
      <p>${ETQ_PROPUESTA} Todo lo demás: explicaciones, juegos, experimentos, retos, insignias y la relación sugerida con los libros de texto.</p>
      <h2>Grados</h2>
      <p>1.º grado está completo. Los demás grados están en construcción.</p>
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

function enrutar() {
  if (hayVoz) speechSynthesis.cancel();
  if (salidaActual && ctxAudio) { salidaActual.gain.setTargetAtTime(0, ctxAudio.currentTime, 0.03); salidaActual = null; } // apaga sonidos al cambiar de pantalla
  const [ruta, id] = (location.hash.slice(1) || "inicio").split("/");
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
    acerca: pantallaAcerca,
    buscar: () => pantallaBuscar(decodeURIComponent(id || "")),
    cargar: () => pantallaCargar(decodeURIComponent(id || "")),
    grado: () => pantallaGrado(id)
  };
  (pantallas[ruta] || pantallaNoEncontrada)();
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
  docente: { saludo: "¡Hola, maestra o maestro!", nombre: "Docente" },
  familia: { saludo: "¡Hola, familia!", nombre: "Familia" }
};
function pintarPerfil() {
  const p = estado.perfil;
  document.body.dataset.perfil = p;
  document.getElementById("avatarCabeza").innerHTML = avatarSVG(p);
  document.getElementById("avatarLateral").innerHTML = avatarSVG(p);
  document.getElementById("saludoCabeza").textContent = TEXTO_PERFIL[p].saludo;
  document.getElementById("nombrePerfil").textContent = TEXTO_PERFIL[p].nombre;
  document.querySelectorAll(".cambiar-perfil button").forEach(b => {
    b.classList.toggle("activo", b.dataset.perfil === p);
    b.setAttribute("aria-pressed", String(b.dataset.perfil === p));
  });
}
document.querySelectorAll(".cambiar-perfil button").forEach(b => b.addEventListener("click", () => {
  estado.perfil = b.dataset.perfil;
  guardarEstado();
  pintarPerfil();
  avisar({ alumno: "Vista para alumnos", docente: "Vista para docentes: verás la vinculación curricular", familia: "Vista para familias: verás ideas para casa" }[estado.perfil]);
  enrutar();
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
