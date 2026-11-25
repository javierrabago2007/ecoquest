/* ==========================================================================
   EcoQuest · juegos-retadores.js
   Juegos de mayor exigencia para 3.º a 6.º. Tienen intentos limitados,
   pistas que cuestan puntos y respuestas que hay que razonar.
   Tipos: criterios, sopa, cadena, caso, gestion, ruta, escape.
   El contenido de cada juego está en datos/<grado>.json.
   Usa funciones de app.js: esc, mezclar, azar, reaccion, finDeJuego, botonVoz, notas.
   ========================================================================== */

const TIPOS_RETADORES = {
  criterios: "Clasificación experta", sopa: "Sopa de letras con pistas", cadena: "Cadena de la vida", caso: "Investiga el caso",
  gestion: "Juego de decisiones", ruta: "Programa la ruta", escape: "Sala de escape",
  misterio: "Deducción con datos", debate: "Asamblea de argumentos",
  datos: "Análisis de gráficas", presupuesto: "Reto de optimización",
  noticias: "Verifica la noticia", red: "Simulador estratégico"
};
const ICONO_RETADOR = { criterios: "🧬", sopa: "🔠", cadena: "🔗", caso: "🗂️", gestion: "🏛️", ruta: "🧭", escape: "🔐", misterio: "🕵️", debate: "🎙️", datos: "📊", presupuesto: "🧮", noticias: "📰", red: "⚡" };

/** Mensaje de retroalimentación. ok = true, false o null (neutro). */
function decirReto(zona, ok, html) {
  const r = zona.querySelector(".retro");
  r.className = "retro " + (ok === null ? "" : ok ? "bien" : "mal");
  r.innerHTML = html;
}
/** Muestra un botón para continuar y lo enfoca. */
function botonSeguir(zona, texto, accion) {
  const b = zona.querySelector("#seguir");
  b.hidden = false; b.textContent = texto; b.onclick = accion;
}
const PIE_RETO = `<p class="retro" aria-live="polite"></p><div class="acciones"><button class="boton" id="seguir" hidden>Siguiente →</button></div>`;
const intentosTexto = n => `${"❤️".repeat(n)}${"🤍".repeat(Math.max(0, 2 - n))}`;

/* ---------- 🧬 Clasificación experta: elegir TODAS las tarjetas que cumplen las condiciones ---------- */
function juegoCriterios(j, zona) {
  let n = 0, puntos = 0;
  const cumple = (c, nivel) => (nivel.si || []).every(x => c.es.includes(x)) && !(nivel.no || []).some(x => c.es.includes(x));
  function mostrar() {
    if (n >= j.niveles.length) return finDeJuego(j, zona, puntos, j.niveles.length * 2, "<p>2 puntos si aciertas a la primera; 1 punto al segundo intento.</p>");
    const nivel = j.niveles[n];
    // Se mezclan tarjetas que sí cumplen con otras que no, para que no baste con tocar todas.
    const si = mezclar(j.cartas.filter(c => cumple(c, nivel))).slice(0, 5);
    const no = mezclar(j.cartas.filter(c => !cumple(c, nivel))).slice(0, 9 - si.length);
    const cartas = mezclar([...si, ...no]);
    const elegidas = new Set();
    let intentos = 2;
    zona.innerHTML = `
      <p class="contador">Nivel ${n + 1} de ${j.niveles.length} · Intentos: <span id="vidas">${intentosTexto(2)}</span></p>
      <h2>${esc(nivel.consigna)} ${botonVoz(nivel.consigna)}</h2>
      <p class="pequeno">Elige todas las que cumplen. Puede haber más o menos de las que imaginas.</p>
      <div class="rejilla-criterios">${cartas.map((c, k) => `<button class="carta-criterio" data-k="${k}" aria-pressed="false"><span>${c.icono}</span>${esc(c.nombre)}</button>`).join("")}</div>
      <div class="acciones"><button class="boton grande" id="comprobar">Comprobar</button></div>${PIE_RETO}`;
    const botones = [...zona.querySelectorAll(".carta-criterio")];
    const comprobar = zona.querySelector("#comprobar");
    botones.forEach((b, k) => b.addEventListener("click", () => {
      elegidas.has(k) ? elegidas.delete(k) : elegidas.add(k);
      b.classList.toggle("elegida", elegidas.has(k)); b.setAttribute("aria-pressed", String(elegidas.has(k)));
    }));
    comprobar.addEventListener("click", () => {
      if (!elegidas.size) return decirReto(zona, null, "Elige al menos una tarjeta.");
      const sobran = [...elegidas].filter(k => !cumple(cartas[k], nivel)).length;
      const faltan = cartas.filter((c, k) => cumple(c, nivel) && !elegidas.has(k)).length;
      if (!sobran && !faltan) { puntos += intentos; reaccion(true); return cerrar(true); }
      intentos--;
      zona.querySelector("#vidas").textContent = intentosTexto(intentos);
      reaccion(false, "Revisa otra vez");
      if (intentos) return decirReto(zona, false, `Todavía no: te ${sobran === 1 ? "sobra 1" : `sobran ${sobran}`} y te ${faltan === 1 ? "falta 1" : `faltan ${faltan}`}. Te queda un intento.`);
      cerrar(false);
    });
    function cerrar(bien) {
      comprobar.disabled = true;
      botones.forEach((b, k) => { b.disabled = true; b.classList.add(cumple(cartas[k], nivel) ? "si" : "no"); });
      decirReto(zona, bien, `<b>${bien ? "¡Correcto!" : "Estas eran las correctas (en verde)."}</b> ${esc(nivel.explicacion)}`);
      botonSeguir(zona, n + 1 < j.niveles.length ? "Siguiente nivel →" : "Ver resultado →", () => { n++; mostrar(); });
    }
  }
  mostrar();
}

/* ---------- 🔠 Sopa de letras: se buscan las palabras a partir de su definición ---------- */
function juegoSopa(j, zona) {
  const limpia = p => p.toUpperCase().replace(/[ÁÀ]/g, "A").replace(/É/g, "E").replace(/Í/g, "I").replace(/Ó/g, "O").replace(/[ÚÜ]/g, "U");
  const palabras = j.palabras.map(p => ({ ...p, letras: limpia(p.palabra), hallada: false, pista: false }));
  const N = j.tamano || 10, DIR = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, 1]];
  let celdas;
  function acomodar() {
    celdas = Array(N * N).fill("");
    for (const p of [...palabras].sort((a, b) => b.letras.length - a.letras.length)) {
      let puesto = false;
      for (let t = 0; t < 400 && !puesto; t++) {
        const [df, dc] = azar(DIR), L = p.letras.length;
        const f = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
        const ff = f + df * (L - 1), cc = c + dc * (L - 1);
        if (ff < 0 || cc < 0 || ff >= N || cc >= N) continue;
        const pos = [...p.letras].map((_, k) => (f + df * k) * N + c + dc * k);
        if (pos.some((q, k) => celdas[q] && celdas[q] !== p.letras[k])) continue;
        pos.forEach((q, k) => { celdas[q] = p.letras[k]; });
        p.pos = pos; puesto = true;
      }
      if (!puesto) return false;
    }
    return true;
  }
  let vueltas = 0;
  while (!acomodar() && vueltas++ < 60);
  celdas = celdas.map(l => l || azar([..."ABCDEFGHILMNOPRSTUV"]));
  let inicio = null, pistas = 0;
  zona.innerHTML = `
    <p class="contador">Encontradas: <b id="halladas">0</b> de ${palabras.length}</p>
    <p class="pequeno">Lee cada definición, piensa la palabra y búscala. Toca su <b>primera</b> letra y luego la <b>última</b>. Puede ir hacia cualquier lado. No lleva acentos.</p>
    <div class="sopa-juego">
      <div class="sopa-desliza"><div class="sopa" style="--n:${N}">${celdas.map((l, k) => `<button data-k="${k}" aria-label="${l}, fila ${Math.floor(k / N) + 1}, columna ${k % N + 1}">${l}</button>`).join("")}</div></div>
      <ol class="pistas-sopa">${palabras.map((p, k) => `<li data-k="${k}"><span>${esc(p.definicion)}</span> <b class="resp">${p.letras.length} letras</b><button class="boton chico secundario ayuda-sopa" data-k="${k}">💡 Pista (−1)</button></li>`).join("")}</ol>
    </div>
    <div class="acciones"><button class="boton secundario" id="rendirse">Terminar aquí</button></div>${PIE_RETO}`;
  const bs = [...zona.querySelectorAll(".sopa button")];
  const total = palabras.length;
  const terminar = () => finDeJuego(j, zona, Math.max(0, palabras.filter(p => p.hallada).length - pistas), total, `<p>Pistas usadas: ${pistas}. Cada pista resta un punto.</p>`);
  bs.forEach((b, k) => b.addEventListener("click", () => {
    if (inicio === null) { inicio = k; b.classList.add("marcada"); return; }
    bs[inicio].classList.remove("marcada");
    const a = inicio; inicio = null;
    if (a === k) return;
    const p = palabras.find(x => !x.hallada && ((x.pos[0] === a && x.pos[x.pos.length - 1] === k) || (x.pos[0] === k && x.pos[x.pos.length - 1] === a)));
    if (!p) { reaccion(false, "Ahí no está"); return decirReto(zona, false, "Ahí no hay ninguna de las palabras que buscas."); }
    p.hallada = true;
    p.pos.forEach(q => bs[q].classList.add("hallada"));
    const li = zona.querySelector(`.pistas-sopa li[data-k="${palabras.indexOf(p)}"]`);
    li.classList.add("hecha"); li.querySelector(".resp").textContent = p.palabra.toUpperCase(); li.querySelector("button").remove();
    zona.querySelector("#halladas").textContent = palabras.filter(x => x.hallada).length;
    reaccion(true); decirReto(zona, true, `<b>${esc(p.palabra)}:</b> ${esc(p.definicion)}`);
    if (palabras.every(x => x.hallada)) setTimeout(terminar, 1200);
  }));
  zona.querySelectorAll(".ayuda-sopa").forEach(b => b.addEventListener("click", () => {
    const p = palabras[Number(b.dataset.k)];
    pistas++; b.disabled = true;
    bs[p.pos[0]].classList.add("pista-sopa");
    decirReto(zona, null, `Empieza con «${p.letras[0]}». Su lugar está marcado en naranja.`);
  }));
  zona.querySelector("#rendirse").addEventListener("click", terminar);
}

/* ---------- 🔗 Cadena de la vida: armar la cadena entre intrusos y predecir qué pasa si algo falta ---------- */
function juegoCadena(j, zona) {
  let n = 0, puntos = 0;
  function mostrar() {
    if (n >= j.rondas.length) return finDeJuego(j, zona, puntos, j.rondas.length * 3, "<p>Cada cadena vale 2 puntos a la primera o 1 al segundo intento, y la predicción vale 1.</p>");
    const r = j.rondas[n], L = r.cadena.length;
    const cartas = mezclar([...r.cadena, ...r.intrusos]);
    let orden = [], intentos = 2;
    zona.innerHTML = `
      <p class="contador">Cadena ${n + 1} de ${j.rondas.length} · Intentos: <span id="vidas">${intentosTexto(2)}</span></p>
      <h2>${esc(r.titulo)} ${botonVoz(r.titulo + ". " + r.texto)}</h2><p>${esc(r.texto)}</p>
      <div class="cadena-huecos" id="huecos"></div>
      <div class="rejilla-criterios">${cartas.map((c, k) => `<button class="carta-criterio" data-k="${k}"><span>${c.icono}</span>${esc(c.nombre)}</button>`).join("")}</div>
      <div class="acciones"><button class="boton grande" id="comprobar">Comprobar cadena</button></div><div id="prediccion"></div>${PIE_RETO}`;
    const huecos = zona.querySelector("#huecos"), botones = [...zona.querySelectorAll(".carta-criterio")], comprobar = zona.querySelector("#comprobar");
    let cerrado = false;
    const pintar = () => {
      huecos.innerHTML = Array.from({ length: L }, (_, i) => `${i ? `<i aria-hidden="true">→</i>` : ""}<button class="hueco-cadena ${orden[i] !== undefined ? "lleno" : ""}" data-i="${i}" ${cerrado ? "disabled" : ""}>${orden[i] !== undefined ? `<span>${cartas[orden[i]].icono}</span>${esc(cartas[orden[i]].nombre)}` : i + 1}</button>`).join("");
      botones.forEach((b, k) => { b.disabled = cerrado || orden.includes(k); });
      huecos.querySelectorAll(".hueco-cadena").forEach(b => b.addEventListener("click", () => { orden.splice(Number(b.dataset.i), 1); pintar(); }));
    };
    pintar();
    botones.forEach((b, k) => b.addEventListener("click", () => { if (orden.length < L) { orden.push(k); pintar(); } }));
    comprobar.addEventListener("click", () => {
      if (orden.length < L) return decirReto(zona, null, `Completa los ${L} lugares. Toca un lugar lleno para quitarlo.`);
      const bien = orden.filter((k, i) => cartas[k].nombre === r.cadena[i].nombre).length;
      if (bien === L) { puntos += intentos; reaccion(true); return cerrar(true); }
      intentos--; zona.querySelector("#vidas").textContent = intentosTexto(intentos);
      reaccion(false, "Algo no encaja");
      if (intentos) return decirReto(zona, false, `${bien} de ${L} están en su lugar. Revisa quién necesita a quién.`);
      cerrar(false);
    });
    function cerrar(ok) {
      cerrado = true; comprobar.disabled = true;
      orden = r.cadena.map(c => cartas.findIndex(x => x.nombre === c.nombre)); pintar();
      decirReto(zona, ok, `<b>${ok ? "¡Cadena correcta!" : "Así queda la cadena."}</b> ${esc(r.explicacion)}`);
      const q = r.prediccion, ops = mezclar(q.opciones.map((t, k) => ({ t, ok: k === q.correcta })));
      zona.querySelector("#prediccion").innerHTML = `<div class="pregunta"><p><b>🔮 Predice: ${esc(q.pregunta)}</b></p><div class="opciones">${ops.map((o, k) => `<button class="opcion" data-k="${k}">${esc(o.t)}</button>`).join("")}</div></div>`;
      const obs = [...zona.querySelectorAll("#prediccion .opcion")];
      obs.forEach((b, k) => b.addEventListener("click", () => {
        obs.forEach((x, i) => { x.disabled = true; if (ops[i].ok) x.classList.add("correcta"); });
        if (ops[k].ok) puntos++; else b.classList.add("incorrecta");
        reaccion(ops[k].ok); decirReto(zona, ops[k].ok, esc(q.explicacion));
        botonSeguir(zona, n + 1 < j.rondas.length ? "Siguiente cadena →" : "Ver resultado →", () => { n++; mostrar(); });
      }));
    }
  }
  mostrar();
}

/* ---------- 🗂️ Investiga el caso: separar evidencias útiles y concluir ---------- */
function juegoCaso(j, zona) {
  let n = 0, puntos = 0;
  const total = j.casos.reduce((s, c) => s + c.pistas.filter(p => p.util).length + c.preguntas.length, 0);
  function mostrar() {
    if (n >= j.casos.length) return finDeJuego(j, zona, puntos, total, "<p>Cuentan las evidencias útiles que elegiste y cada conclusión correcta.</p>");
    const c = j.casos[n], pistas = mezclar(c.pistas), max = c.pistas.filter(p => p.util).length, elegidas = new Set();
    zona.innerHTML = `
      <p class="contador">Caso ${n + 1} de ${j.casos.length}</p>
      <article class="expediente"><h2>📁 ${esc(c.titulo)} ${botonVoz(c.relato)}</h2><p>${esc(c.relato)}</p></article>
      <h3>1. Elige las ${max} evidencias que ayudan a resolverlo</h3>
      <p class="pequeno">Hay datos que son ciertos, pero no explican el problema.</p>
      <div class="evidencias">${pistas.map((p, k) => `<button class="evidencia" data-k="${k}" aria-pressed="false">${esc(p.texto)}</button>`).join("")}</div>
      <div class="acciones"><button class="boton grande" id="comprobar">Entregar evidencias</button></div><div id="conclusiones"></div>${PIE_RETO}`;
    const bs = [...zona.querySelectorAll(".evidencia")], comprobar = zona.querySelector("#comprobar");
    bs.forEach((b, k) => b.addEventListener("click", () => {
      if (elegidas.has(k)) elegidas.delete(k);
      else if (elegidas.size < max) elegidas.add(k);
      else return decirReto(zona, null, `Solo puedes elegir ${max}. Quita una para cambiarla.`);
      b.classList.toggle("elegida", elegidas.has(k)); b.setAttribute("aria-pressed", String(elegidas.has(k)));
    }));
    comprobar.addEventListener("click", () => {
      if (elegidas.size < max) return decirReto(zona, null, `Elige ${max} evidencias.`);
      comprobar.disabled = true;
      const bien = [...elegidas].filter(k => pistas[k].util).length; puntos += bien;
      bs.forEach((b, k) => { b.disabled = true; b.classList.add(pistas[k].util ? "si" : "no"); b.insertAdjacentHTML("beforeend", `<small>${pistas[k].util ? "✅" : "➖"} ${esc(pistas[k].porque)}</small>`); });
      reaccion(bien === max); decirReto(zona, bien === max, `Elegiste ${bien} de ${max} evidencias útiles. Ahora concluye.`);
      concluir(0);
    });
    function concluir(i) {
      if (i >= c.preguntas.length) return botonSeguir(zona, n + 1 < j.casos.length ? "Siguiente caso →" : "Ver resultado →", () => { n++; mostrar(); });
      const q = c.preguntas[i], ops = mezclar(q.opciones.map((t, k) => ({ t, ok: k === q.correcta })));
      const caja = document.createElement("div"); caja.className = "pregunta";
      caja.innerHTML = `<p><b>${i + 2}. ${esc(q.pregunta)}</b></p><div class="opciones">${ops.map(o => `<button class="opcion">${esc(o.t)}</button>`).join("")}</div><p class="pequeno expl"></p>`;
      zona.querySelector("#conclusiones").append(caja);
      const obs = [...caja.querySelectorAll(".opcion")];
      obs.forEach((b, k) => b.addEventListener("click", () => {
        obs.forEach((x, m) => { x.disabled = true; if (ops[m].ok) x.classList.add("correcta"); });
        if (ops[k].ok) puntos++; else b.classList.add("incorrecta");
        reaccion(ops[k].ok); caja.querySelector(".expl").textContent = (ops[k].ok ? "✅ " : "💡 ") + q.explicacion;
        decirReto(zona, null, ""); concluir(i + 1);
      }));
    }
  }
  mostrar();
}

/* ---------- 🏛️ Decisiones: cuidar varios indicadores con dinero limitado ---------- */
function juegoGestion(j, zona) {
  const est = Object.fromEntries(j.indicadores.map(i => [i.id, i.inicio]));
  const eventos = mezclar(j.eventos);
  let n = 0, dinero = j.dinero;
  const barras = () => `<div class="indicadores">${j.indicadores.map(i => `<div class="indicador ${est[i.id] < 30 ? "bajo" : est[i.id] >= j.meta ? "alto" : ""}"><b>${i.icono} ${esc(i.nombre)}</b><div class="barra-ind"><span style="width:${est[i.id]}%"></span><i style="left:${j.meta}%"></i></div><small>${est[i.id]}</small></div>`).join("")}<div class="indicador dinero"><b>💰 Fondo</b><strong>${dinero}</strong></div></div>`;
  const logradas = () => j.indicadores.filter(i => est[i.id] >= j.meta).length;
  const fin = motivo => finDeJuego(j, zona, motivo ? 0 : logradas(), j.indicadores.length, `${barras()}<p>${esc(motivo || `Metas cumplidas: ${logradas()} de ${j.indicadores.length}.`)}</p><p>${esc(j.mensajeFinal || "")}</p>`);
  function mostrar() {
    if (n >= eventos.length) return fin();
    const e = eventos[n];
    // Si el fondo no alcanza para ninguna opción, se puede aplazar (para que el juego nunca se trabe).
    const aplazar = e.opciones.every(o => (o.costo || 0) > dinero) ? [{ texto: "No alcanza el fondo: aplazar la decisión", efectos: Object.fromEntries(j.indicadores.map(i => [i.id, -4])), consecuencia: "Sin dinero no se pudo actuar y el problema creció. Conviene administrar mejor el fondo." }] : [];
    const ops = mezclar([...e.opciones, ...aplazar]);
    zona.innerHTML = `
      <p class="contador">Decisión ${n + 1} de ${eventos.length}</p>${barras()}
      <p class="pequeno">Meta: terminar con cada barra en ${j.meta} o más (rayita). Si una llega a 0, se acaba el juego.</p>
      <article class="expediente"><h2>${e.icono} ${esc(e.titulo)} ${botonVoz(e.texto)}</h2><p>${esc(e.texto)}</p></article>
      <div class="decisiones">${ops.map((o, k) => `<button class="decision" data-k="${k}" ${(o.costo || 0) > dinero ? "disabled" : ""}><span>${esc(o.texto)}</span><b>${o.costo ? `💰 −${o.costo}` : o.gana ? `💰 +${o.gana}` : "💰 0"}</b></button>`).join("")}</div>${PIE_RETO}`;
    zona.querySelectorAll(".decision").forEach((b, k) => b.addEventListener("click", () => {
      const o = ops[k];
      dinero += (o.gana || 0) - (o.costo || 0);
      let suma = 0;
      for (const id in o.efectos) { est[id] = Math.max(0, Math.min(100, est[id] + o.efectos[id])); suma += o.efectos[id]; }
      zona.querySelector(".indicadores").outerHTML = barras();
      zona.querySelectorAll(".decision").forEach((x, m) => { x.disabled = true; x.classList.toggle("elegida", m === k); });
      reaccion(suma > 0);
      const cambios = j.indicadores.filter(i => o.efectos[i.id]).map(i => `${i.icono} ${o.efectos[i.id] > 0 ? "+" : "−"}${Math.abs(o.efectos[i.id])}`).join(" · ");
      decirReto(zona, suma > 0, `<b>${cambios || "Sin cambios"}</b> · ${esc(o.consecuencia)}`);
      const caido = j.indicadores.find(i => est[i.id] <= 0);
      n++;
      botonSeguir(zona, caido || n >= eventos.length ? "Ver resultado →" : "Siguiente decisión →", () => caido ? fin(`${caido.nombre} llegó a 0. Intenta otra estrategia.`) : mostrar());
    }));
  }
  mostrar();
}

/* ---------- 🧭 Programa la ruta: instrucciones con puntos cardinales ---------- */
const PASO_RUTA = { N: [-1, 0, "↑ Norte"], S: [1, 0, "↓ Sur"], E: [0, 1, "→ Este"], O: [0, -1, "← Oeste"] };
/** Número mínimo de pasos para juntar todo y llegar a la meta (búsqueda en anchura). */
function pasosMinimos(mapa) {
  const items = [], F = mapa.length, C = mapa[0].length; let ini, meta;
  mapa.forEach((f, y) => [...f].forEach((c, x) => { if (c === "J") ini = [y, x]; if (c === "M") meta = `${y},${x}`; if (c === "*") items.push(`${y},${x}`); }));
  const todo = (1 << items.length) - 1, vistos = new Set([`${ini},0`]);
  let cola = [[...ini, 0]];
  for (let d = 0; cola.length; d++) {
    const sig = [];
    for (const [y, x, m] of cola) {
      if (m === todo && `${y},${x}` === meta) return d;
      for (const k in PASO_RUTA) {
        const a = y + PASO_RUTA[k][0], b = x + PASO_RUTA[k][1];
        if (a < 0 || b < 0 || a >= F || b >= C || mapa[a][b] === "#") continue;
        const i = items.indexOf(`${a},${b}`), mm = i >= 0 ? m | (1 << i) : m, cl = `${a},${b},${mm}`;
        if (!vistos.has(cl)) { vistos.add(cl); sig.push([a, b, mm]); }
      }
    }
    cola = sig;
  }
  return null;
}
function juegoRuta(j, zona) {
  let n = 0, puntos = 0;
  function mostrar() {
    if (n >= j.niveles.length) return finDeJuego(j, zona, puntos, j.niveles.length * 3, "<p>3 puntos a la primera, 2 al segundo intento y 1 al tercero.</p>");
    const nv = j.niveles[n], mapa = nv.mapa, max = pasosMinimos(mapa) + (nv.margen ?? 2);
    let prog = [], intentos = 3, corriendo = false;
    zona.innerHTML = `
      <p class="contador">Nivel ${n + 1} de ${j.niveles.length} · Intentos: <span id="vidas">❤️❤️❤️</span></p>
      <h2>${esc(nv.titulo)}</h2><p>${esc(nv.texto)} Máximo <b>${max}</b> instrucciones.</p>
      <div class="ruta-juego">
        <div class="mapa-ruta" style="--c:${mapa[0].length}">${mapa.flatMap((f, y) => [...f].map((c, x) => `<div class="casilla ${c === "#" ? "muro" : ""}" data-p="${y},${x}">${c === "#" ? nv.obstaculo : c === "*" ? nv.objeto : c === "M" ? "🏁" : ""}</div>`)).join("")}<div class="ficha-jack" id="jack"><img src="imagenes/jack-sonriente.webp" alt="Jack"></div></div>
        <div class="control-ruta">
          <div class="rosa" aria-label="Puntos cardinales">${["N", "O", "E", "S"].map(k => `<button class="paso-${k}" data-d="${k}">${PASO_RUTA[k][2]}</button>`).join("")}</div>
          <p class="pequeno">Programa (<span id="cuenta">0</span> de ${max}):</p><div class="programa" id="programa"></div>
          <div class="acciones"><button class="boton secundario" id="borrarPaso">⌫ Borrar</button><button class="boton secundario" id="vaciar">Vaciar</button><button class="boton" id="correr">▶ Ejecutar</button></div>
        </div>
      </div>${PIE_RETO}`;
    let ini; mapa.forEach((f, y) => { const x = f.indexOf("J"); if (x >= 0) ini = [y, x]; });
    const jack = zona.querySelector("#jack");
    const poner = ([y, x]) => { const c = zona.querySelector(`[data-p="${y},${x}"]`); jack.style.left = c.offsetLeft + "px"; jack.style.top = c.offsetTop + "px"; jack.style.width = c.offsetWidth + "px"; jack.style.height = c.offsetHeight + "px"; };
    poner(ini);
    const pintar = () => { zona.querySelector("#programa").textContent = prog.map(k => PASO_RUTA[k][2][0]).join(" ") || "—"; zona.querySelector("#cuenta").textContent = prog.length; };
    pintar();
    zona.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
      if (corriendo) return;
      if (prog.length >= max) return decirReto(zona, null, `Ya usaste las ${max} instrucciones. Borra alguna.`);
      prog.push(b.dataset.d); pintar();
    }));
    zona.querySelector("#borrarPaso").addEventListener("click", () => { if (!corriendo) { prog.pop(); pintar(); } });
    zona.querySelector("#vaciar").addEventListener("click", () => { if (!corriendo) { prog = []; pintar(); } });
    zona.querySelector("#correr").addEventListener("click", () => {
      if (corriendo || !prog.length) return;
      corriendo = true; zona.querySelector("#correr").disabled = true;
      let pos = [...ini]; const faltan = new Set(); mapa.forEach((f, y) => [...f].forEach((c, x) => { if (c === "*") faltan.add(`${y},${x}`); }));
      let i = 0;
      const paso = () => {
        if (!zona.isConnected || !jack.isConnected) return;
        if (i >= prog.length) {
          const enMeta = mapa[pos[0]][pos[1]] === "M";
          return acabar(enMeta && !faltan.size, !enMeta ? "Jack no llegó a la meta." : "Llegaste a la meta, pero faltó recoger algo.");
        }
        const [dy, dx] = PASO_RUTA[prog[i++]], a = pos[0] + dy, b = pos[1] + dx;
        if (a < 0 || b < 0 || a >= mapa.length || b >= mapa[0].length) return acabar(false, `En el paso ${i}, Jack se salió del mapa.`);
        if (mapa[a][b] === "#") return acabar(false, `En el paso ${i}, Jack encontró un obstáculo.`);
        pos = [a, b]; poner(pos);
        const cl = `${a},${b}`;
        if (faltan.delete(cl)) { zona.querySelector(`[data-p="${cl}"]`).textContent = ""; notas([[880, 0, 0.08]], "sine", 0.06); }
        setTimeout(paso, 330);
      };
      setTimeout(paso, 200);
    });
    function acabar(ok, motivo) {
      if (ok) { puntos += intentos; reaccion(true); }
      else { intentos--; reaccion(false, "Revisa tu programa"); }
      zona.querySelector("#vidas").textContent = "❤️".repeat(intentos) + "🤍".repeat(3 - intentos);
      if (ok || !intentos) {
        decirReto(zona, ok, ok ? `<b>¡Ruta correcta!</b> ${esc(nv.explicacion)}` : `${esc(motivo)} Se acabaron los intentos de este nivel. ${esc(nv.explicacion)}`);
        return botonSeguir(zona, n + 1 < j.niveles.length ? "Siguiente nivel →" : "Ver resultado →", () => { n++; mostrar(); });
      }
      decirReto(zona, false, `${esc(motivo)} Corrige tu programa: te quedan ${intentos} intento(s).`);
      setTimeout(() => {
        if (!jack.isConnected) return;
        mapa.forEach((f, y) => [...f].forEach((c, x) => { if (c === "*") zona.querySelector(`[data-p="${y},${x}"]`).textContent = nv.objeto; }));
        poner(ini); corriendo = false; zona.querySelector("#correr").disabled = false;
      }, 900);
    }
  }
  mostrar();
}

/* ---------- 🔐 Sala de escape: acertijos encadenados y un código final ---------- */
function juegoEscape(j, zona) {
  const norm = t => String(t).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const locks = [...j.candados, { ...j.final, esFinal: true }];
  const clave = [];
  let n = 0, puntos = 0;
  function mostrar() {
    if (n >= locks.length) return finDeJuego(j, zona, puntos, locks.length * 2, `<p>🔓 ${esc(j.mensajeFinal || "")}</p>`);
    const c = locks[n]; let intentos = 3, ayuda = false;
    zona.innerHTML = `
      <p class="contador">${c.esFinal ? "Código final" : `Candado ${n + 1} de ${j.candados.length}`} · Intentos: <span id="vidas">❤️❤️❤️</span></p>
      <div class="candados">${j.candados.map((_, k) => `<span class="${k < n ? "abierto" : ""}">${k < n ? clave[k] : "🔒"}</span>`).join("")}</div>
      <article class="expediente"><h2>${esc(c.titulo)} ${botonVoz(c.texto)}</h2><p>${esc(c.texto)}</p></article>
      <form class="respuesta-escape" id="formEscape"><label for="respEscape"><b>${esc(c.etiqueta || "Tu respuesta")}</b></label><input id="respEscape" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="24"><button class="boton" type="submit">Abrir</button><button class="boton secundario" type="button" id="ayudaEscape">💡 Pista (−1)</button></form>${PIE_RETO}`;
    const form = zona.querySelector("#formEscape"), entrada = zona.querySelector("#respEscape");
    zona.querySelector("#ayudaEscape").addEventListener("click", ev => { ayuda = true; ev.target.disabled = true; decirReto(zona, null, "💡 " + esc(c.ayuda)); });
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      if (!entrada.value.trim()) return;
      if ([].concat(c.respuesta).some(r => norm(r) === norm(entrada.value))) { puntos += ayuda || intentos < 3 ? 1 : 2; reaccion(true, "¡Se abrió!"); return cerrar(true); }
      intentos--; zona.querySelector("#vidas").textContent = "❤️".repeat(intentos) + "🤍".repeat(3 - intentos);
      reaccion(false, "Sigue cerrado");
      if (!intentos) return cerrar(false);
      decirReto(zona, false, `Esa no es. Te quedan ${intentos} intento(s).`); entrada.select();
    });
    function cerrar(ok) {
      form.querySelectorAll("input, button").forEach(x => { x.disabled = true; });
      clave.push(c.digito ?? "");
      decirReto(zona, ok, `<b>${ok ? "¡Candado abierto!" : `La respuesta era: ${esc([].concat(c.respuesta)[0])}.`}</b> ${esc(c.explicacion)}${c.digito !== undefined ? ` Guarda el número <b>${c.digito}</b>.` : ""}`);
      botonSeguir(zona, n + 1 < locks.length ? "Continuar →" : "Ver resultado →", () => { n++; mostrar(); });
    }
  }
  mostrar();
}

/* ---------- 🕵️ Deducción: descubrir el lugar con la menor cantidad de datos ---------- */
function juegoMisterio(j, zona) {
  const rondas = mezclar(j.rondas);
  let n = 0, puntos = 0;
  function mostrar() {
    if (n >= rondas.length) return finDeJuego(j, zona, puntos, rondas.length * 4, "<p>Con un solo dato ganas 4 puntos; cada dato extra o error resta 1.</p>");
    const r = rondas[n];
    let vistos = 1, valor = 4, cerrado = false;
    zona.innerHTML = `
      <p class="contador">Expedición ${n + 1} de ${rondas.length} · Puntos en juego: <b id="valor">4</b></p>
      <h2>${esc(j.pregunta)}</h2>
      <ol class="datos-misterio" id="datos"></ol>
      <div class="acciones"><button class="boton secundario" id="otroDato">🔎 Pedir otro dato (−1)</button></div>
      <div class="rejilla-criterios">${j.lugares.map(l => `<button class="carta-criterio" data-id="${l.id}"><span>${l.icono}</span>${esc(l.nombre)}</button>`).join("")}</div>${PIE_RETO}`;
    const pintar = () => {
      zona.querySelector("#datos").innerHTML = r.datos.slice(0, vistos).map(d => `<li>${esc(d)} ${botonVoz(d)}</li>`).join("");
      zona.querySelector("#valor").textContent = valor;
      zona.querySelector("#otroDato").disabled = cerrado || vistos >= r.datos.length || valor <= 1;
    };
    pintar();
    zona.querySelector("#otroDato").addEventListener("click", () => { vistos++; valor = Math.max(1, valor - 1); pintar(); });
    const bs = [...zona.querySelectorAll(".carta-criterio")];
    const cerrar = ok => {
      cerrado = true; vistos = r.datos.length;
      bs.forEach(b => { b.disabled = true; b.classList.add(b.dataset.id === r.lugar ? "si" : "no"); });
      pintar();
      decirReto(zona, ok, `<b>${ok ? `¡Correcto! +${valor}` : `Era: ${esc(j.lugares.find(l => l.id === r.lugar).nombre)}.`}</b> ${esc(r.explicacion)}`);
      botonSeguir(zona, n + 1 < rondas.length ? "Siguiente expedición →" : "Ver resultado →", () => { n++; mostrar(); });
    };
    bs.forEach(b => b.addEventListener("click", () => {
      if (b.dataset.id === r.lugar) { puntos += valor; reaccion(true); return cerrar(true); }
      b.disabled = true; b.classList.add("no"); valor--;
      reaccion(false, "Los datos no coinciden");
      if (valor <= 0) return cerrar(false);
      pintar(); decirReto(zona, false, "Ese lugar no coincide con todos los datos. Perdiste 1 punto: compara antes de elegir.");
    }));
  }
  mostrar();
}

/* ---------- 🎙️ Asamblea: responder a cada persona con la evidencia que atiende su duda ---------- */
function juegoDebate(j, zona) {
  let a = 0, puntos = 0;
  const total = j.asambleas.reduce((s, x) => s + x.personas.length * 2, 0);
  function asamblea() {
    if (a >= j.asambleas.length) return finDeJuego(j, zona, puntos, total, "<p>2 puntos por una razón con evidencia que responde la duda; 1 por una idea relacionada sin evidencia.</p>");
    const as = j.asambleas[a], personas = mezclar(as.personas), mano = mezclar(as.argumentos), usados = new Set(), votos = [];
    let p = 0;
    function turno() {
      const per = personas[p];
      zona.innerHTML = `
        <p class="contador">Asamblea ${a + 1} de ${j.asambleas.length} · Persona ${p + 1} de ${personas.length}</p>
        <article class="expediente"><h2>📋 ${esc(as.titulo)}</h2><p>${esc(as.propuesta)}</p></article>
        <div class="votos">${personas.map((x, k) => `<span class="${k === p ? "hablando" : ""}">${x.icono}<b>${votos[k] === undefined ? "…" : ["✖️", "➖", "✔️"][votos[k]]}</b></span>`).join("")}</div>
        <blockquote class="duda"><b>${per.icono} ${esc(per.nombre)}:</b> «${esc(per.duda)}» ${botonVoz(per.duda)}</blockquote>
        <p class="pequeno">Elige el argumento que responde mejor a <b>esta</b> duda. Cada argumento se usa una sola vez.</p>
        <div class="evidencias">${mano.map((m, k) => `<button class="evidencia" data-k="${k}" ${usados.has(k) ? "disabled" : ""}>${esc(m.texto)}</button>`).join("")}</div>${PIE_RETO}`;
      const bs = [...zona.querySelectorAll(".evidencia")];
      bs.forEach((b, k) => b.addEventListener("click", () => {
        const m = mano[k];
        const pts = m.para === per.id ? m.fuerza : 0;
        puntos += pts; votos[p] = pts; usados.add(k);
        bs.forEach(x => { x.disabled = true; });
        b.classList.add(pts ? "si" : "no", "elegida");
        zona.querySelectorAll(".votos b")[p].textContent = ["✖️", "➖", "✔️"][pts];
        reaccion(pts === 2, pts ? "" : "No la convenció");
        const mejor = as.argumentos.find(x => x.para === per.id && x.fuerza === 2);
        decirReto(zona, pts === 2, pts === 2 ? `<b>Convenciste.</b> ${esc(mejor.porque)}`
          : `<b>${pts ? "Va por buen camino, pero faltó evidencia." : m.falla ? esc(m.falla) : "Ese argumento no responde su duda."}</b> Lo más sólido era: «${esc(mejor.texto)}» ${esc(mejor.porque)}`);
        const ultima = p + 1 >= personas.length;
        botonSeguir(zona, !ultima ? "Siguiente persona →" : a + 1 < j.asambleas.length ? "Siguiente asamblea →" : "Ver resultado →", () => { if (ultima) { a++; asamblea(); } else { p++; turno(); } });
      }));
    }
    turno();
  }
  asamblea();
}

/* ---------- 📊 Análisis de gráficas: leer la escala, calcular y concluir con cuidado ---------- */
function graficaReto(g) {
  const W = 560, H = 270, x0 = 54, y0 = 222, alto = 190, n = g.etiquetas.length, dos = !!g.valores2, paso = (W - x0 - 14) / n;
  const y = v => y0 - v / g.maximo * alto, barra = (x, v, c, w) => `<rect x="${x}" y="${y(v)}" width="${w}" height="${y0 - y(v)}" rx="5" fill="${c}"/>`;
  let s = "";
  for (let v = 0; v <= g.maximo; v += g.paso) s += `<path d="M${x0} ${y(v)}H${W - 8}" stroke="#d5dfe6" stroke-width="1.5"/><text x="${x0 - 8}" y="${y(v) + 5}" text-anchor="end">${v}</text>`;
  g.etiquetas.forEach((e, k) => {
    const cx = x0 + paso * (k + .5), w = Math.min(56, paso * (dos ? .34 : .5));
    s += dos ? barra(cx - w - 2, g.valores[k], "#8fb7d6", w) + barra(cx + 2, g.valores2[k], "#23834e", w) : barra(cx - w / 2, g.valores[k], "#1c7fb0", w);
    s += `<text x="${cx}" y="${y0 + 22}" text-anchor="middle">${esc(e)}</text>`;
  });
  return `<figure class="grafica-reto"><figcaption><b>${esc(g.titulo)}</b>${dos ? ` <span class="ley"><i style="background:#8fb7d6"></i>${esc(g.nombre1)}</span> <span class="ley"><i style="background:#23834e"></i>${esc(g.nombre2)}</span>` : ""}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.titulo)}. ${esc(g.etiquetas.map((e, k) => `${e}: ${g.valores[k]}${dos ? ` y ${g.valores2[k]}` : ""}`).join("; "))}" font-family="Lexend, sans-serif" font-size="14" fill="#33473c">${s}<text x="${x0}" y="18" font-size="13">${esc(g.unidad)}</text></svg></figure>`;
}
function juegoDatos(j, zona) {
  let g = 0, q = 0, puntos = 0;
  const total = j.graficas.reduce((s, x) => s + x.preguntas.length, 0);
  function mostrar() {
    if (g >= j.graficas.length) return finDeJuego(j, zona, puntos, total, "<p>Cada pregunta tenía un solo intento.</p>");
    const gr = j.graficas[g], p = gr.preguntas[q], ops = mezclar(p.opciones.map((t, k) => ({ t, ok: k === p.correcta })));
    zona.innerHTML = `
      <p class="contador">Gráfica ${g + 1} de ${j.graficas.length} · Pregunta ${q + 1} de ${gr.preguntas.length}</p>${graficaReto(gr)}
      <div class="pregunta"><p><b>${esc(p.pregunta)}</b> ${botonVoz(p.pregunta)}</p><div class="opciones">${ops.map(o => `<button class="opcion">${esc(o.t)}</button>`).join("")}</div></div>${PIE_RETO}`;
    const bs = [...zona.querySelectorAll(".opcion")];
    bs.forEach((b, k) => b.addEventListener("click", () => {
      bs.forEach((x, m) => { x.disabled = true; if (ops[m].ok) x.classList.add("correcta"); });
      if (ops[k].ok) puntos++; else b.classList.add("incorrecta");
      reaccion(ops[k].ok); decirReto(zona, ops[k].ok, esc(p.explicacion));
      const finG = q + 1 >= gr.preguntas.length;
      botonSeguir(zona, !finG ? "Siguiente pregunta →" : g + 1 < j.graficas.length ? "Siguiente gráfica →" : "Ver resultado →", () => { if (finG) { g++; q = 0; } else q++; mostrar(); });
    }));
  }
  mostrar();
}

/* ---------- 🧮 Optimización: cubrir un mínimo de bienestar sin pasar el límite de recursos ---------- */
function juegoPresupuesto(j, zona) {
  let n = 0, puntos = 0;
  const num = v => v.toLocaleString("es-MX");
  function mostrar() {
    if (n >= j.niveles.length) return finDeJuego(j, zona, puntos, j.niveles.length * 3, "<p>3 puntos a la primera, 2 al segundo intento y 1 al tercero.</p>");
    const nv = j.niveles[n], cats = nv.categorias.map(c => ({ ...c, opciones: mezclar(c.opciones) })), el = cats.map(() => null);
    let intentos = 3;
    zona.innerHTML = `
      <p class="contador">Nivel ${n + 1} de ${j.niveles.length} · Intentos: <span id="vidas">❤️❤️❤️</span></p>
      <h2>${esc(nv.titulo)}</h2><p>${esc(nv.texto)}</p>
      <div class="metas-pres"><span>📏 Máximo: <b>${num(nv.limite)} ${esc(j.medida)}</b></span><span>⭐ Mínimo: <b>${nv.minimo} de ${esc(j.nombrePuntos)}</b></span></div>
      ${cats.map((c, k) => `<fieldset class="cat-pres"><legend>${c.icono} ${esc(c.nombre)}</legend><div class="evidencias">${c.opciones.map((o, m) => `<button class="evidencia" data-c="${k}" data-o="${m}" aria-pressed="false">${esc(o.texto)}<small>${j.ocultaValor ? "" : `${num(o.valor)} ${esc(j.medida)} · `}⭐ ${o.puntos}</small></button>`).join("")}</div></fieldset>`).join("")}
      <div class="acciones"><button class="boton grande" id="comprobar">Comprobar</button></div>${PIE_RETO}`;
    const comprobar = zona.querySelector("#comprobar"), bs = [...zona.querySelectorAll(".cat-pres .evidencia")];
    bs.forEach(b => b.addEventListener("click", () => {
      const k = Number(b.dataset.c); el[k] = Number(b.dataset.o);
      bs.filter(x => Number(x.dataset.c) === k).forEach(x => { x.classList.toggle("elegida", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    }));
    comprobar.addEventListener("click", () => {
      if (el.includes(null)) return decirReto(zona, null, "Elige una opción en cada actividad.");
      const valor = el.reduce((s, o, k) => s + cats[k].opciones[o].valor, 0), bien = el.reduce((s, o, k) => s + cats[k].opciones[o].puntos, 0);
      const ok = valor <= nv.limite && bien >= nv.minimo;
      const cuenta = `Usaste ${num(valor)} ${esc(j.medida)} y lograste ${bien} de ${esc(j.nombrePuntos)}.`;
      if (ok) { puntos += intentos; reaccion(true); } else { intentos--; reaccion(false, "Revisa tus cuentas"); }
      zona.querySelector("#vidas").textContent = "❤️".repeat(intentos) + "🤍".repeat(3 - intentos);
      if (!ok && intentos) return decirReto(zona, false, `${cuenta} ${valor > nv.limite ? `Te pasaste por ${num(valor - nv.limite)}. ` : ""}${bien < nv.minimo ? `Faltan ${nv.minimo - bien} de ${esc(j.nombrePuntos)}. ` : ""}Te quedan ${intentos} intento(s).`);
      comprobar.disabled = true; bs.forEach(b => { b.disabled = true; });
      decirReto(zona, ok, `<b>${ok ? "¡Lo lograste!" : "Se acabaron los intentos."}</b> ${cuenta} ${esc(nv.explicacion)}`);
      botonSeguir(zona, n + 1 < j.niveles.length ? "Siguiente nivel →" : "Ver resultado →", () => { n++; mostrar(); });
    });
  }
  mostrar();
}

/* ---------- 📰 Verifica la noticia: ubicar el fragmento engañoso y reconocer el truco ---------- */
function juegoNoticias(j, zona) {
  const items = mezclar(j.items);
  let n = 0, puntos = 0;
  function mostrar() {
    if (n >= items.length) return finDeJuego(j, zona, puntos, items.length * 2, "<p>1 punto por ubicar el fragmento y 1 por reconocer el truco.</p>");
    const it = items[n], ops = mezclar(it.opciones.map((t, k) => ({ t, ok: k === it.correcta })));
    zona.innerHTML = `
      <p class="contador">Publicación ${n + 1} de ${items.length}</p>
      <article class="publicacion"><h2>📰 ${esc(it.titulo)}</h2>${it.fragmentos.map((f, k) => `<button class="fragmento" data-k="${k}">${esc(f.texto)}</button>`).join("")}</article>
      <p class="pequeno">1. Toca la parte que engaña o concluye mal.</p><div id="paso2"></div>${PIE_RETO}`;
    const fs = [...zona.querySelectorAll(".fragmento")];
    fs.forEach((b, k) => b.addEventListener("click", () => {
      const ok = !!it.fragmentos[k].malo;
      if (ok) puntos++;
      fs.forEach((x, m) => { x.disabled = true; if (it.fragmentos[m].malo) x.classList.add("malo"); });
      if (!ok) b.classList.add("error");
      reaccion(ok); decirReto(zona, ok, ok ? "Bien visto. ¿Qué truco usa?" : "El fragmento engañoso está marcado en rojo. ¿Qué truco usa?");
      zona.querySelector("#paso2").innerHTML = `<div class="pregunta"><p><b>2. ${esc(it.pregunta)}</b></p><div class="opciones">${ops.map(o => `<button class="opcion">${esc(o.t)}</button>`).join("")}</div></div>`;
      const bs = [...zona.querySelectorAll("#paso2 .opcion")];
      bs.forEach((x, m) => x.addEventListener("click", () => {
        bs.forEach((y, q) => { y.disabled = true; if (ops[q].ok) y.classList.add("correcta"); });
        if (ops[m].ok) puntos++; else x.classList.add("incorrecta");
        reaccion(ops[m].ok); decirReto(zona, ops[m].ok, esc(it.explicacion));
        botonSeguir(zona, n + 1 < items.length ? "Siguiente publicación →" : "Ver resultado →", () => { n++; mostrar(); });
      }));
    }));
  }
  mostrar();
}

/* ---------- ⚡ Red eléctrica: cubrir la demanda por horario con costo y emisiones limitados ---------- */
function juegoRed(j, zona) {
  let n = 0, puntos = 0;
  function mostrar() {
    if (n >= j.niveles.length) return finDeJuego(j, zona, puntos, j.niveles.length * 3, "<p>3 puntos a la primera, 2 al segundo intento y 1 al tercero.</p>");
    const nv = j.niveles[n], F = nv.fuentes, P = nv.periodos, u = F.map(() => P.map(() => 0));
    let intentos = 3, cerrado = false;
    zona.innerHTML = `
      <p class="contador">Nivel ${n + 1} de ${j.niveles.length} · Intentos: <span id="vidas">❤️❤️❤️</span></p>
      <h2>${esc(nv.titulo)}</h2><p>${esc(nv.texto)}</p>
      <div class="metas-pres"><span>💰 Costo: <b id="cCosto"></b> de ${nv.costo}</span><span>🌫️ Emisiones: <b id="cEmi"></b> de ${nv.emision}</span></div>
      ${P.map((p, k) => `<fieldset class="cat-pres periodo-red" data-p="${k}"><legend>${esc(p.nombre)} · necesita <b>${p.demanda}</b> · llevas <b class="llevas">0</b></legend>
        <div class="fuentes-red">${F.map((f, i) => `<div class="fuente-red"><span>${f.icono} ${esc(f.nombre)}<small>costo ${f.costo} · emite ${f.emision} · máx. ${f.disponible[k]}</small></span>
          <div class="paso-red"><button data-i="${i}" data-k="${k}" data-d="-1" aria-label="Quitar ${esc(f.nombre)} en ${esc(p.nombre)}">−</button><b id="u${i}_${k}">0</b><button data-i="${i}" data-k="${k}" data-d="1" aria-label="Agregar ${esc(f.nombre)} en ${esc(p.nombre)}">+</button></div></div>`).join("")}</div></fieldset>`).join("")}
      <div class="acciones"><button class="boton grande" id="comprobar">Operar la red</button></div>${PIE_RETO}`;
    const suma = c => u.reduce((s, f, i) => s + f.reduce((a, b) => a + b, 0) * F[i][c], 0);
    const pintar = () => {
      zona.querySelector("#cCosto").textContent = suma("costo"); zona.querySelector("#cEmi").textContent = suma("emision");
      P.forEach((p, k) => { const t = u.reduce((s, f) => s + f[k], 0), el = zona.querySelector(`.periodo-red[data-p="${k}"]`); el.querySelector(".llevas").textContent = t; el.classList.toggle("cubierto", t >= p.demanda); });
      F.forEach((f, i) => P.forEach((p, k) => { zona.querySelector(`#u${i}_${k}`).textContent = u[i][k]; }));
      zona.querySelectorAll(".paso-red button").forEach(b => { const i = +b.dataset.i, k = +b.dataset.k; b.disabled = cerrado || (b.dataset.d === "1" ? u[i][k] >= F[i].disponible[k] : u[i][k] <= 0); });
    };
    pintar();
    zona.querySelectorAll(".paso-red button").forEach(b => b.addEventListener("click", () => { u[+b.dataset.i][+b.dataset.k] += +b.dataset.d; pintar(); }));
    zona.querySelector("#comprobar").addEventListener("click", () => {
      const faltan = P.filter((p, k) => u.reduce((s, f) => s + f[k], 0) < p.demanda).map(p => p.nombre);
      const costo = suma("costo"), emi = suma("emision"), ok = !faltan.length && costo <= nv.costo && emi <= nv.emision;
      if (ok) { puntos += intentos; reaccion(true); } else { intentos--; reaccion(false, "La red falló"); }
      zona.querySelector("#vidas").textContent = "❤️".repeat(intentos) + "🤍".repeat(3 - intentos);
      const motivo = [faltan.length ? `Faltó energía en: ${faltan.map(esc).join(", ")}.` : "", costo > nv.costo ? `Te pasaste ${costo - nv.costo} de costo.` : "", emi > nv.emision ? `Te pasaste ${emi - nv.emision} de emisiones.` : ""].join(" ");
      if (!ok && intentos) return decirReto(zona, false, `${motivo} Te quedan ${intentos} intento(s).`);
      cerrado = true; pintar(); zona.querySelector("#comprobar").disabled = true;
      decirReto(zona, ok, `<b>${ok ? "¡La red funcionó!" : "Se acabaron los intentos."}</b> ${motivo} ${esc(nv.explicacion)}`);
      botonSeguir(zona, n + 1 < j.niveles.length ? "Siguiente nivel →" : "Ver resultado →", () => { n++; mostrar(); });
    });
  }
  mostrar();
}

const MOTORES_RETADORES = { criterios: juegoCriterios, sopa: juegoSopa, cadena: juegoCadena, caso: juegoCaso, gestion: juegoGestion, ruta: juegoRuta, escape: juegoEscape, misterio: juegoMisterio, debate: juegoDebate, datos: juegoDatos, presupuesto: juegoPresupuesto, noticias: juegoNoticias, red: juegoRed };

/** Dibujos de portada (300 × 190) de cada tipo. Devuelve [color1, color2, contenido]. */
const PORTADAS_RETADORES = {
  criterios: ["#fff0dc", "#ffd9ad", [0, 1, 2, 3, 4, 5].map(k => `<g transform="translate(${80 + k % 3 * 70} ${62 + (k > 2) * 68})"><rect x="-28" y="-28" width="56" height="56" rx="12" fill="#fff" stroke="${[0, 4, 5].includes(k) ? "#29a66a" : "#e2d3bd"}" stroke-width="5"/>${[0, 4, 5].includes(k) ? `<path d="M-12 1 -3 11 14 -10" stroke="#29a66a" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : `<circle r="9" fill="#e9dcc8"/>`}</g>`).join("")],
  sopa: ["#e3f2fd", "#bcdcf7", `<g font-family="Fredoka, sans-serif" font-weight="700" font-size="24" text-anchor="middle">${["BOSRAL", "VIDAEU", "ANTSOZ", "PLUOMR"].map((f, y) => [...f].map((l, x) => `<rect x="${63 + x * 30}" y="${28 + y * 34}" width="26" height="30" rx="6" fill="${y === 1 && x < 4 ? "#29a66a" : "#fff"}"/><text x="${76 + x * 30}" y="${51 + y * 34}" fill="${y === 1 && x < 4 ? "#fff" : "#1c5f94"}">${l}</text>`).join("")).join("")}</g>`],
  cadena: ["#eaf7e2", "#cbe9b8", `<g fill="none" stroke="#3d8c4a" stroke-width="6" stroke-linecap="round"><path d="M102 95h22M112 86l12 9-12 9M186 95h22M196 86l12 9-12 9"/></g>${[["#ffd84d", 65], ["#7cc46a", 152], ["#e58a4b", 240]].map(([c, x]) => `<circle cx="${x}" cy="95" r="31" fill="#fff" stroke="${c}" stroke-width="7"/>`).join("")}<circle cx="65" cy="95" r="14" fill="#ffd84d"/><path d="M152 112V92Q136 92 136 78q16 0 16 14 0-16 18-16 0 16-18 16" fill="#5cb85a" stroke="#2c7c44" stroke-width="3"/><path d="M226 104q2-16 14-16t14 16zM229 88l3-12 7 9M251 88l-3-12-7 9" fill="#e58a4b" stroke="#8a4a1d" stroke-width="3"/>`],
  caso: ["#f3ecfb", "#dccbf2", `<path d="M62 48h62l14 16h100v88H62z" fill="#f0c862" stroke="#b17a16" stroke-width="4"/><path d="M84 34h120v92H84z" fill="#fff" stroke="#cdbfdd" stroke-width="4" transform="rotate(-4 144 80)"/><path d="M100 58h80M100 76h60M100 94h72" stroke="#b7a6cc" stroke-width="6" stroke-linecap="round"/><circle cx="206" cy="104" r="30" fill="#d8f1fbcc" stroke="#5b3fa0" stroke-width="8"/><path d="M228 127l26 26" stroke="#5b3fa0" stroke-width="12" stroke-linecap="round"/>`],
  gestion: ["#e2f3ef", "#b9e0d6", `<path d="M60 70 150 28l90 42z" fill="#fff" stroke="#1d7a68" stroke-width="5" stroke-linejoin="round"/><path d="M70 80h160M62 152h176" stroke="#1d7a68" stroke-width="9"/>${[86, 128, 172, 214].map((x, k) => `<rect x="${x - 12}" y="88" width="24" height="58" rx="5" fill="#fff" stroke="#1d7a68" stroke-width="4"/><rect x="${x - 7}" y="${[112, 98, 120, 104][k]}" width="14" height="${[30, 44, 22, 38][k]}" rx="4" fill="${["#3fa7d6", "#8bb85c", "#e4572e", "#f3a047"][k]}"/>`).join("")}`],
  ruta: ["#fdf1da", "#f7d9a0", `${Array.from({ length: 12 }, (_, k) => `<rect x="${58 + k % 4 * 46}" y="${26 + Math.floor(k / 4) * 46}" width="42" height="42" rx="8" fill="${[2, 4, 9].includes(k) ? "#8bb85c" : "#fffaf0"}"/>`).join("")}<path d="M79 47h46v46h92v46" fill="none" stroke="#e4572e" stroke-width="6" stroke-dasharray="10 8" stroke-linecap="round"/><circle cx="79" cy="47" r="11" fill="#1c7fb0"/><path d="M210 124v30M210 124l20 8-20 8" fill="#e4572e" stroke="#8a2d18" stroke-width="4"/>`],
  escape: ["#e6ebf7", "#c0cbe8", `<path d="M118 84V66a32 32 0 0 1 64 0v18" fill="none" stroke="#5b6b8c" stroke-width="13"/><rect x="96" y="82" width="108" height="78" rx="16" fill="#ffc94d" stroke="#b17a16" stroke-width="5"/><g font-family="Fredoka, sans-serif" font-weight="700" font-size="24" text-anchor="middle">${["2", "?", "7"].map((t, k) => `<rect x="${109 + k * 29}" y="104" width="25" height="34" rx="6" fill="#fff"/><text x="${121.5 + k * 29}" y="129" fill="#3a4a6b">${t}</text>`).join("")}</g>`],
  misterio: ["#fdeee0", "#f5cfa6", `<path d="M60 40h130l20 20v100H60z" fill="#fffaf0" stroke="#b9813f" stroke-width="5" stroke-linejoin="round"/><path d="M82 140V104M112 140V82M142 140V118M172 140V92" stroke="#3fa7d6" stroke-width="16" stroke-linecap="round"/><path d="M80 70l34-8 30 10 34-14" fill="none" stroke="#e4572e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="222" cy="104" r="30" fill="#e6f5fdcc" stroke="#6b4a2f" stroke-width="8"/><text x="222" y="118" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="40" fill="#e4572e">?</text><path d="M244 127l24 24" stroke="#6b4a2f" stroke-width="12" stroke-linecap="round"/>`],
  debate: ["#eee6fb", "#d3c0f0", `<path d="M44 34h104a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H92l-26 20v-20H44a14 14 0 0 1-14-14V48a14 14 0 0 1 14-14z" fill="#fff" stroke="#6b45b5" stroke-width="5"/><path d="M256 74H160v46a14 14 0 0 0 14 14h44l26 20v-20h12a14 14 0 0 0 14-14V88a14 14 0 0 0-14-14z" fill="#8bb85c" stroke="#3d7a32" stroke-width="5"/><path d="M54 58h84M54 76h56" stroke="#b7a6cc" stroke-width="7" stroke-linecap="round"/><path d="M190 104l14 14 28-28" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`],
  datos: ["#e2eefb", "#b9d4f0", `<path d="M62 30v124h184" fill="none" stroke="#1c5f94" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${[[84, 70, "#8fb7d6"], [124, 100, "#23834e"], [164, 46, "#f3a047"], [204, 84, "#e4572e"]].map(([x, h, c]) => `<rect x="${x}" y="${148 - h}" width="28" height="${h}" rx="5" fill="${c}"/>`).join("")}<path d="M98 66l40-28 40 46 40-40" fill="none" stroke="#33473c" stroke-width="4" stroke-dasharray="6 6"/>`],
  presupuesto: ["#e0f5f7", "#aadde4", `<path d="M150 40v104M112 150h76M72 66h156" stroke="#1d6f7a" stroke-width="7" stroke-linecap="round"/><path d="M72 66 48 112h48zM228 66l-24 46h48z" fill="#fff" stroke="#1d6f7a" stroke-width="4" stroke-linejoin="round"/><path d="M72 78q-11 14-11 21a11 11 0 0 0 22 0q0-7-11-21z" fill="#3fa7d6"/><path d="m228 82 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#f3a047"/>`],
  noticias: ["#fdeaea", "#f3c3c3", `<path d="M62 34h150v118H62z" fill="#fff" stroke="#8a4a4a" stroke-width="5" stroke-linejoin="round"/><path d="M78 56h118" stroke="#33473c" stroke-width="10"/><path d="M78 80h60M78 98h60M78 116h60M78 134h40" stroke="#c9b3b3" stroke-width="6" stroke-linecap="round"/><rect x="150" y="76" width="46" height="36" fill="#f3c3c3"/><circle cx="222" cy="126" r="32" fill="#29a66a"/><path d="M207 126l11 12 20-24" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`],
  red: ["#e4ecfb", "#b5c9f0", `<path d="M92 152 116 40l24 112M100 112h32M106 84h20" fill="none" stroke="#3a4a6b" stroke-width="6" stroke-linejoin="round"/><path d="M84 62h64M116 62q60 44 122 6" fill="none" stroke="#3a4a6b" stroke-width="5"/><circle cx="222" cy="44" r="20" fill="#ffd84d"/><path d="m218 84-24 40h20l-8 34 34-46h-20l12-28z" fill="#f3a047" stroke="#a85f12" stroke-width="4" stroke-linejoin="round"/>`]
};
