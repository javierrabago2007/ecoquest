/* ==========================================================================
   EcoQuest · ilustraciones.js
   Biblioteca de ilustraciones vectoriales (SVG) propias, dibujadas con código.
   Sustituyen a los emojis en los juegos. Cada ilustración tiene:
     vb    → tamaño interno del dibujo (viewBox)
     ancho → ancho sugerido, en % del ancho de la escena
     svg   → el dibujo
   Uso en datos/primero.json:  "ilus": "manguera"
   Las partes animadas usan clases a-… (definidas en styles.css).
   ========================================================================== */

"use strict";

/* ---------- Ayudantes ---------- */
const sombra = (cx, cy, rx, ry = rx / 5) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".16"/>`;
const charco = (cx, cy, rx, ry, color = "#7cc6ea") => `
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity=".75"/>
  <ellipse cx="${cx - rx * .3}" cy="${cy - ry * .25}" rx="${rx * .35}" ry="${ry * .25}" fill="#fff" opacity=".45"/>`;
const mosca = (x, y, d = 0) => `
  <g class="a-mosca" style="animation-delay:${d}s"><g transform="translate(${x} ${y})">
    <ellipse cx="-4" cy="-3" rx="4" ry="2.5" fill="#d9eef7" opacity=".8"/><ellipse cx="4" cy="-3" rx="4" ry="2.5" fill="#d9eef7" opacity=".8"/>
    <ellipse rx="3.5" ry="2.6" fill="#222"/></g></g>`;
const ruedas = (x1, x2, y, r) => [x1, x2].map(x => `
  <circle cx="${x}" cy="${y}" r="${r}" fill="#1f2428"/><circle cx="${x}" cy="${y}" r="${r * .55}" fill="#b9c2c9"/>
  <circle cx="${x}" cy="${y}" r="${r * .2}" fill="#6c757d"/>
  ${[0, 72, 144, 216, 288].map(a => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - r * .5}" stroke="#8a949c" stroke-width="3" transform="rotate(${a} ${x} ${y})"/>`).join("")}`).join("");
const pajaro = (cuerpo, ala, pecho, cresta) => ({
  vb: "0 0 120 90", ancho: 5,
  svg: `<path d="M18 52 L2 44 L10 60 Z" fill="${ala}"/>
    <ellipse cx="55" cy="55" rx="36" ry="24" fill="${cuerpo}"/>
    <ellipse cx="60" cy="64" rx="22" ry="13" fill="${pecho}"/>
    <path d="M30 50 Q55 30 72 52 Q52 62 30 50Z" fill="${ala}"/>
    <circle cx="84" cy="38" r="18" fill="${cuerpo}"/>
    ${cresta ? `<path d="M78 24 L84 4 L92 24Z" fill="${cuerpo}"/>` : ""}
    <path d="M98 38 L112 42 L98 47Z" fill="#f2a33a"/>
    ${cresta ? `<path d="M90 30 Q100 38 92 48 Q84 44 86 36Z" fill="#222"/>` : ""}
    <circle cx="90" cy="35" r="3.4" fill="#111"/><circle cx="91" cy="34" r="1.1" fill="#fff"/>
    <path d="M48 78 v8 M62 78 v8" stroke="#7a5a3a" stroke-width="3" stroke-linecap="round"/>`
});
const bote = (color, osc, simbolo) => `
  <path d="M14 30 H106 L98 132 Q97 138 90 138 H30 Q23 138 22 132 Z" fill="${color}"/>
  <path d="M14 30 H40 L36 138 H30 Q23 138 22 132Z" fill="#fff" opacity=".18"/>
  <rect x="8" y="18" width="104" height="16" rx="7" fill="${osc}"/>
  <rect x="46" y="10" width="28" height="10" rx="4" fill="${osc}"/>
  ${simbolo}`;
const simboloReciclaje = (cx, cy, s = 1) => `
  <g transform="translate(${cx} ${cy}) scale(${s})" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-4 -20 L-16 0"/><path d="M-22 -6 L-16 0 L-8 -4"/>
    <path d="M18 6 L-2 18"/><path d="M4 22 L-2 18 L2 10"/>
    <path d="M-10 18 L14 -16"/><path d="M14 -6 L14 -16 L4 -18"/></g>`;
const carro = (color, claro, extra = "") => `
  ${sombra(210, 158, 190, 10)}
  <path d="M20 120 Q18 96 40 90 L110 82 Q140 44 190 40 L280 40 Q320 42 350 80 L392 88 Q410 92 410 112 L410 128 Q410 138 398 138 L32 138 Q20 138 20 126 Z" fill="${color}"/>
  <path d="M20 112 L410 112 L410 128 Q410 138 398 138 L32 138 Q20 138 20 126Z" fill="#000" opacity=".12"/>
  <path d="M122 84 Q148 52 190 50 L232 50 L232 84 Z" fill="#cfe6f3"/>
  <path d="M244 50 L280 50 Q312 52 336 84 L244 84 Z" fill="#cfe6f3"/>
  <path d="M130 80 Q150 58 180 56" stroke="#fff" stroke-width="5" opacity=".7" fill="none" stroke-linecap="round"/>
  <path d="M60 90 Q200 76 390 92" stroke="${claro}" stroke-width="6" fill="none" opacity=".6"/>
  <rect x="228" y="96" width="22" height="5" rx="2.5" fill="#00000055"/><rect x="150" y="96" width="22" height="5" rx="2.5" fill="#00000055"/>
  <rect x="392" y="96" width="16" height="12" rx="4" fill="#ffe9a8"/>
  <rect x="20" y="100" width="12" height="12" rx="3" fill="#e03b3b"/>
  ${ruedas(96, 330, 136, 30)}
  ${extra}`;
const bocanadas = (x, y, color) => [0, .7, 1.4].map((d, k) =>
  `<circle class="a-humo" style="animation-delay:${d}s" cx="${x - k * 6}" cy="${y}" r="${12 + k * 3}" fill="${color}"/>`).join("");

/* ---------- Biblioteca ---------- */
const ILUS = {
  cardenal: pajaro("#d7263d", "#a51d30", "#e84a5c", true),
  paloma: pajaro("#9aa3ad", "#7c858f", "#b9c0c7", false),

  banca: { vb: "0 0 200 110", ancho: 10, svg: `
    ${sombra(100, 104, 90, 6)}
    <rect x="30" y="60" width="8" height="44" fill="#4a4f55"/><rect x="162" y="60" width="8" height="44" fill="#4a4f55"/>
    <rect x="12" y="14" width="176" height="14" rx="5" fill="#b07a4a"/><rect x="12" y="32" width="176" height="14" rx="5" fill="#9c6a3e"/>
    <rect x="6" y="58" width="188" height="14" rx="5" fill="#c08853"/>
    <rect x="30" y="20" width="8" height="40" fill="#4a4f55"/><rect x="162" y="20" width="8" height="40" fill="#4a4f55"/>` },

  boteReciclaje: { vb: "0 0 120 150", ancho: 5, svg: `${sombra(60, 140, 50, 8)}${bote("#2f9e5a", "#22784a", simboloReciclaje(60, 85, 1.2))}` },

  botesSeparados: { vb: "0 0 300 150", ancho: 12, svg: `
    ${sombra(150, 140, 140, 8)}
    <g>${bote("#3d9a5b", "#2b7445", `<text x="60" y="95" font-size="34" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">O</text>`)}</g>
    <g transform="translate(90 0)">${bote("#2f7fc1", "#225f92", simboloReciclaje(60, 85, 1))}</g>
    <g transform="translate(180 0)">${bote("#7d858c", "#5f666c", `<rect x="44" y="70" width="32" height="32" rx="4" fill="none" stroke="#fff" stroke-width="5"/>`)}</g>` },

  pato: { vb: "0 0 150 100", ancho: 6, svg: `
    <ellipse cx="75" cy="88" rx="70" ry="9" fill="#d6f2fb" opacity=".8"/>
    <path d="M18 70 Q20 44 64 46 L110 50 Q130 56 126 76 Q100 92 48 88 Q22 86 18 70Z" fill="#8a6a4a"/>
    <path d="M40 60 Q70 46 104 60 Q80 72 40 60Z" fill="#6b4f36"/>
    <rect x="96" y="40" width="16" height="16" fill="#fff"/>
    <circle cx="112" cy="30" r="18" fill="#1f7a4d"/>
    <path d="M126 30 L146 34 L126 40Z" fill="#f2c230"/>
    <circle cx="116" cy="26" r="3" fill="#111"/>` },

  cachora: { vb: "0 0 180 80", ancho: 8, svg: `
    <ellipse cx="90" cy="66" rx="80" ry="14" fill="#a8977c"/><ellipse cx="80" cy="60" rx="70" ry="12" fill="#bcab8f"/>
    <path d="M14 46 Q40 36 60 44 L120 42 Q150 38 166 46 Q150 54 120 52 L60 54 Q30 60 14 46Z" fill="#c9b27a"/>
    <path d="M60 46 Q90 38 120 44" stroke="#8a7650" stroke-width="3" fill="none" stroke-dasharray="4 6"/>
    <path d="M72 52 l-8 10 M108 52 l8 10 M80 42 l-6 -8 M104 42 l6 -8" stroke="#a89060" stroke-width="5" stroke-linecap="round"/>
    <circle cx="156" cy="44" r="3" fill="#222"/>` },

  botellaTirada: { vb: "0 0 170 80", ancho: 7, svg: `
    ${charco(90, 62, 70, 12)}
    <g transform="rotate(-8 85 45)">
      <path d="M20 34 Q20 26 30 26 H112 L124 32 H140 V50 H124 L112 56 H30 Q20 56 20 48Z" fill="#a8dcf0" opacity=".9"/>
      <rect x="44" y="30" width="44" height="22" fill="#2f7fc1"/>
      <rect x="140" y="34" width="12" height="14" rx="3" fill="#1f5f99"/>
      <path d="M30 32 H104" stroke="#fff" stroke-width="4" opacity=".7" stroke-linecap="round"/></g>` },

  lataTirada: { vb: "0 0 170 80", ancho: 7, svg: `
    ${charco(80, 64, 66, 12, "#8a5a2b")}
    <circle cx="60" cy="62" r="3" fill="#fff" opacity=".6"/><circle cx="96" cy="66" r="2.5" fill="#fff" opacity=".6"/>
    <g transform="rotate(12 110 40)">
      <path d="M70 26 H140 Q146 26 146 32 L144 40 L148 48 Q146 56 140 56 H70 Q64 56 64 50 L66 41 L64 32 Q64 26 70 26Z" fill="#d63b3b"/>
      <path d="M92 26 L98 40 L92 56" stroke="#a52828" stroke-width="4" fill="none"/>
      <rect x="64" y="30" width="8" height="22" rx="3" fill="#c9ced3"/>
      <path d="M104 32 H136" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>` },

  llaveAbierta: { vb: "0 0 160 180", ancho: 8, svg: `
    ${charco(92, 162, 66, 14)}
    <rect x="18" y="40" width="18" height="128" rx="4" fill="#8d959c"/><rect x="18" y="40" width="6" height="128" fill="#fff" opacity=".25"/>
    <rect x="30" y="54" width="56" height="18" rx="6" fill="#a9b1b8"/>
    <rect x="76" y="54" width="18" height="34" rx="5" fill="#a9b1b8"/>
    <rect x="44" y="40" width="20" height="14" rx="3" fill="#d23c3c"/><rect x="38" y="34" width="32" height="8" rx="4" fill="#d23c3c"/>
    <path class="a-chorro" d="M85 90 Q86 125 90 158" stroke="#5fb7e5" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path class="a-chorro lento" d="M85 90 Q84 125 80 158" stroke="#a9dcf3" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle class="a-salpica" cx="72" cy="152" r="4" fill="#7cc6ea"/><circle class="a-salpica" style="animation-delay:.3s" cx="108" cy="150" r="4" fill="#7cc6ea"/>` },

  lamparaDia: { vb: "0 0 120 120", ancho: 6, svg: `
    <circle class="a-brillo" cx="60" cy="66" r="52" fill="#fff6a8"/>
    <path d="M30 40 H90 L80 62 H40Z" fill="#3e4a44"/>
    <circle cx="60" cy="72" r="16" fill="#ffe46b"/><circle cx="55" cy="68" r="5" fill="#fff"/>
    ${[0, 45, 90, 135, 180].map(a => `<line class="a-brillo" x1="60" y1="96" x2="60" y2="112" stroke="#f5c400" stroke-width="5" stroke-linecap="round" transform="rotate(${a - 90} 60 72)"/>`).join("")}` },

  bocina: { vb: "0 0 170 150", ancho: 8, svg: `
    ${sombra(60, 142, 50, 7)}
    <rect x="14" y="20" width="92" height="120" rx="12" fill="#2b2f36"/><rect x="14" y="20" width="92" height="12" rx="6" fill="#3a404a"/>
    <circle cx="60" cy="56" r="18" fill="#4b525d"/><circle cx="60" cy="56" r="8" fill="#1b1e23"/>
    <circle cx="60" cy="104" r="26" fill="#4b525d"/><circle cx="60" cy="104" r="12" fill="#1b1e23"/>
    <g fill="none" stroke="#e4572e" stroke-width="6" stroke-linecap="round">
      <path class="a-onda" d="M116 70 Q128 88 116 106"/><path class="a-onda" style="animation-delay:.3s" d="M130 58 Q148 88 130 118"/>
      <path class="a-onda" style="animation-delay:.6s" d="M144 46 Q168 88 144 130"/></g>
    <text class="a-nota" x="118" y="40" font-size="24" fill="#8055c9">♪</text>` },

  maceta: { vb: "0 0 100 130", ancho: 4.5, svg: `
    ${sombra(50, 124, 34, 5)}
    <path d="M50 70 Q20 40 26 14 Q44 30 50 64 Q56 24 80 10 Q82 44 52 70" fill="#4f9a45"/>
    <path d="M50 68 Q30 56 12 50 Q30 74 50 72" fill="#66b25a"/><path d="M52 68 Q74 52 92 50 Q76 76 52 72" fill="#66b25a"/>
    <path d="M18 70 H82 L74 122 H26Z" fill="#c8693d"/><rect x="14" y="66" width="72" height="12" rx="4" fill="#d97d4e"/>` },

  perro: { vb: "0 0 170 130", ancho: 8, svg: `
    ${sombra(80, 124, 60, 6)}
    <path d="M10 58 Q2 40 14 34" stroke="#a8743f" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="72" cy="70" rx="56" ry="28" fill="#c2884f"/>
    <rect x="28" y="84" width="14" height="38" rx="6" fill="#a8743f"/><rect x="52" y="86" width="14" height="36" rx="6" fill="#c2884f"/>
    <rect x="88" y="86" width="14" height="36" rx="6" fill="#a8743f"/><rect x="108" y="84" width="14" height="38" rx="6" fill="#c2884f"/>
    <circle cx="128" cy="44" r="26" fill="#c2884f"/>
    <path d="M110 26 Q100 50 112 62 Q120 44 116 26Z" fill="#8a5a2e"/>
    <ellipse cx="152" cy="52" rx="14" ry="10" fill="#e3b787"/><circle cx="162" cy="48" r="5" fill="#222"/>
    <circle cx="134" cy="38" r="4" fill="#222"/>
    <rect x="104" y="58" width="30" height="7" rx="3" fill="#d23c3c"/>
    <path d="M118 64 Q150 100 168 128" stroke="#2f7fc1" stroke-width="3" fill="none"/>` },

  bicicleta: { vb: "0 0 200 130", ancho: 10, svg: `
    ${sombra(100, 124, 90, 6)}
    <circle cx="46" cy="88" r="34" fill="none" stroke="#2b2f36" stroke-width="7"/><circle cx="154" cy="88" r="34" fill="none" stroke="#2b2f36" stroke-width="7"/>
    <circle cx="46" cy="88" r="4" fill="#555"/><circle cx="154" cy="88" r="4" fill="#555"/>
    <path d="M46 88 L84 44 L132 44 L100 88 Z M100 88 L84 44 M132 44 L154 88" stroke="#e07a3f" stroke-width="7" fill="none" stroke-linejoin="round"/>
    <path d="M76 36 H96" stroke="#2b2f36" stroke-width="8" stroke-linecap="round"/>
    <path d="M132 44 L126 24 L142 20" stroke="#2b2f36" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="100" cy="88" r="9" fill="#444"/>` },

  gato: { vb: "0 0 120 120", ancho: 5, svg: `
    ${sombra(60, 116, 40, 5)}
    <path d="M96 100 Q120 90 110 62" stroke="#e09a4a" stroke-width="10" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="86" rx="36" ry="30" fill="#f0ad5c"/>
    <circle cx="60" cy="44" r="28" fill="#f0ad5c"/>
    <path d="M36 30 L34 6 L54 22Z M84 30 L86 6 L66 22Z" fill="#f0ad5c"/>
    <path d="M40 24 L40 12 L50 22Z M80 24 L80 12 L70 22Z" fill="#f7c9a0"/>
    <path d="M46 40 q4 -4 8 0 M66 40 q4 -4 8 0" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M56 52 L64 52 L60 57Z" fill="#d46a6a"/>
    <path d="M44 70 Q60 64 76 70" stroke="#d98a3a" stroke-width="5" fill="none"/>` },

  manguera: { vb: "0 0 260 130", ancho: 12, svg: `
    ${charco(170, 112, 88, 16)}
    <g fill="none" stroke="#3c9a46" stroke-width="10">
      <ellipse cx="50" cy="92" rx="40" ry="16"/><ellipse cx="50" cy="86" rx="34" ry="13"/><ellipse cx="50" cy="80" rx="28" ry="10"/></g>
    <path d="M80 90 Q110 104 130 86" stroke="#3c9a46" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="126" y="74" width="26" height="14" rx="5" fill="#f2c230" transform="rotate(-20 139 81)"/>
    <g stroke="#6fc3ea" stroke-width="5" fill="none" stroke-linecap="round">
      <path class="a-chorro" d="M152 74 Q190 70 226 104"/><path class="a-chorro" style="animation-delay:.15s" d="M152 74 Q186 80 210 108"/>
      <path class="a-chorro" style="animation-delay:.3s" d="M152 74 Q196 60 242 98"/></g>
    <circle class="a-salpica" cx="214" cy="106" r="4" fill="#9ad6f0"/><circle class="a-salpica" style="animation-delay:.25s" cx="236" cy="100" r="4" fill="#9ad6f0"/>` },

  bolsasNegras: { vb: "0 0 220 140", ancho: 12, svg: `
    ${sombra(110, 132, 100, 8)}
    <path d="M30 132 Q10 132 14 100 Q18 64 50 58 L54 46 L62 46 L66 58 Q98 64 100 100 Q104 132 82 132Z" fill="#1d2126"/>
    <path d="M40 74 Q46 96 40 122" stroke="#3a4049" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M88 132 Q72 132 76 104 Q80 80 104 74 L108 62 L116 62 L120 74 Q146 80 150 104 Q152 132 136 132Z" fill="#24292f"/>
    <path d="M98 88 Q102 104 98 124" stroke="#3d444d" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M140 132 Q128 120 140 100 Q156 86 174 98 Q190 110 184 132Z" fill="#1a1e23"/>
    <path d="M150 106 L160 98 L168 108Z" fill="#fff" opacity=".15"/>
    <rect x="176" y="118" width="22" height="14" rx="2" fill="#f3efe4" transform="rotate(-18 187 125)"/>
    <ellipse cx="200" cy="130" rx="12" ry="5" fill="#e3c35a"/>
    <rect x="160" y="124" width="18" height="10" rx="2" fill="#d63b3b" transform="rotate(20 169 129)"/>
    ${mosca(60, 36)}${mosca(120, 50, .4)}${mosca(180, 86, .8)}` },

  contaminacionVisual: { vb: "0 0 280 170", ancho: 10, svg: `
    <rect x="0" y="0" width="280" height="170" rx="6" fill="#efe3cc"/>
    <g stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 120 Q40 70 70 120 T130 110" stroke="#d63b8f"/><path d="M150 140 L170 96 L190 140 M160 124 H182" stroke="#2f7fc1"/>
      <path d="M200 60 Q240 20 266 70 Q230 90 210 70" stroke="#3aa04a"/></g>
    <g>
      <rect x="20" y="16" width="60" height="70" fill="#fff8a8" transform="rotate(-6 50 51)"/><rect x="28" y="26" width="44" height="8" fill="#e4572e" transform="rotate(-6 50 51)"/>
      <rect x="66" y="30" width="56" height="66" fill="#bde3f5" transform="rotate(5 94 63)"/><rect x="74" y="40" width="40" height="22" fill="#2f7fc1" transform="rotate(5 94 63)"/>
      <rect x="116" y="12" width="58" height="72" fill="#ffd1dc" transform="rotate(-3 145 48)"/><circle cx="145" cy="40" r="14" fill="#d63b8f"/>
      <rect x="160" y="70" width="52" height="58" fill="#fff" transform="rotate(8 186 99)"/><rect x="168" y="80" width="36" height="6" fill="#555" transform="rotate(8 186 99)"/><rect x="168" y="92" width="30" height="6" fill="#555" transform="rotate(8 186 99)"/>
      <path d="M120 84 L128 100 L114 96Z" fill="#fff" opacity=".8"/></g>` },

  arbolCortado: { vb: "0 0 300 160", ancho: 14, svg: `
    ${sombra(150, 150, 140, 9)}
    <path d="M36 148 L40 100 Q60 92 80 100 L84 148Z" fill="#7a5130"/>
    <ellipse cx="60" cy="100" rx="21" ry="8" fill="#e8c79a"/>
    <ellipse cx="60" cy="100" rx="13" ry="5" fill="none" stroke="#c49a66" stroke-width="2"/><ellipse cx="60" cy="100" rx="6" ry="2.5" fill="none" stroke="#c49a66" stroke-width="2"/>
    <path d="M40 108 L62 120 L40 128Z" fill="#e8c79a"/>
    <g fill="#e8c79a">${[[30, 150], [92, 148], [100, 152], [20, 146], [110, 150]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2"/>`).join("")}</g>
    <path d="M96 138 L262 112 L268 130 L100 152Z" fill="#8a5a34"/>
    <ellipse cx="98" cy="145" rx="6" ry="8" fill="#e8c79a" transform="rotate(-10 98 145)"/>
    <path d="M170 124 L196 92 M220 116 L240 82 M230 118 L272 100" stroke="#7a5130" stroke-width="7" stroke-linecap="round"/>
    <g fill="#8fae4a"><ellipse cx="196" cy="86" rx="24" ry="14"/><ellipse cx="242" cy="78" rx="26" ry="15"/><ellipse cx="276" cy="96" rx="20" ry="13"/></g>
    <g fill="#b8a04a"><ellipse cx="216" cy="92" rx="14" ry="8"/><ellipse cx="262" cy="86" rx="12" ry="7"/></g>
    <g transform="translate(128 106) rotate(-30)"><rect x="0" y="-3" width="56" height="7" rx="3" fill="#a8743f"/><path d="M50 -16 L68 -12 L66 12 L50 10Z" fill="#9aa3ab"/></g>` },

  llantaTirada: { vb: "0 0 190 100", ancho: 10, svg: `
    ${sombra(95, 88, 86, 9)}
    <ellipse cx="95" cy="62" rx="82" ry="28" fill="#1f2328"/>
    <ellipse cx="95" cy="54" rx="82" ry="28" fill="#2c3238"/>
    <path d="M20 50 Q95 24 170 50" stroke="#3d444c" stroke-width="5" fill="none" stroke-dasharray="8 8"/>
    <ellipse cx="95" cy="56" rx="48" ry="15" fill="#5a4a2f"/>
    <ellipse cx="95" cy="58" rx="44" ry="12" fill="#6b8a6a" opacity=".9"/>
    <ellipse cx="82" cy="55" rx="14" ry="4" fill="#fff" opacity=".35"/>
    ${mosca(70, 26)}${mosca(110, 18, .5)}${mosca(140, 32, 1)}` },

  popo: { vb: "0 0 90 70", ancho: 4, svg: `
    ${sombra(45, 64, 34, 5)}
    <ellipse cx="45" cy="56" rx="32" ry="10" fill="#6b4423"/><ellipse cx="45" cy="44" rx="24" ry="9" fill="#7d5130"/>
    <ellipse cx="45" cy="34" rx="15" ry="7" fill="#8a5a36"/><path d="M45 28 Q52 20 46 16" stroke="#8a5a36" stroke-width="6" fill="none" stroke-linecap="round"/>
    ${mosca(22, 18)}${mosca(68, 12, .6)}` },

  paradaCamion: { vb: "0 0 120 230", ancho: 6, svg: `
    ${sombra(60, 224, 40, 5)}
    <rect x="54" y="40" width="10" height="186" fill="#7d858c"/>
    <rect x="14" y="10" width="92" height="64" rx="10" fill="#2f7fc1"/>
    <rect x="34" y="22" width="52" height="30" rx="6" fill="#fff"/><rect x="40" y="27" width="40" height="13" rx="3" fill="#2f7fc1"/>
    <circle cx="46" cy="52" r="4" fill="#2f7fc1"/><circle cx="74" cy="52" r="4" fill="#2f7fc1"/>
    <text x="60" y="68" font-size="11" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">PARADA</text>` },

  semaforo: { vb: "0 0 70 220", ancho: 3.5, svg: `
    <rect x="30" y="90" width="10" height="130" fill="#4a4f55"/>
    <rect x="10" y="6" width="50" height="104" rx="10" fill="#2b2f36"/>
    <circle cx="35" cy="28" r="12" fill="#5a2222"/><circle cx="35" cy="58" r="12" fill="#5a4a1e"/><circle cx="35" cy="88" r="12" fill="#35d06a"/>
    <circle cx="35" cy="88" r="18" fill="#35d06a" opacity=".25"/>` },

  arbolBanqueta: { vb: "0 0 150 210", ancho: 8, svg: `
    <rect x="40" y="194" width="70" height="12" rx="3" fill="#8a8f94"/>
    <path d="M70 196 Q68 150 72 110 M72 140 Q90 124 100 108 M71 150 Q54 132 46 118" stroke="#6b4a2f" stroke-width="12" fill="none" stroke-linecap="round"/>
    <g fill="#4f9a45"><circle cx="50" cy="96" r="34"/><circle cx="100" cy="92" r="36"/><circle cx="76" cy="60" r="40"/></g>
    <g fill="#66b25a"><circle cx="64" cy="54" r="18"/><circle cx="104" cy="80" r="14"/></g>` },

  humoFabrica: { vb: "0 0 220 170", ancho: 9, svg: `
    ${[[70, 140, 30, 0], [100, 110, 38, .5], [140, 80, 44, 1], [170, 46, 40, 1.5], [60, 100, 26, .8]].map(([x, y, r, d]) =>
      `<circle class="a-humo-grande" style="animation-delay:${d}s" cx="${x}" cy="${y}" r="${r}" fill="#3a3d42" opacity=".85"/>`).join("")}
    <circle cx="120" cy="96" r="18" fill="#55595f" opacity=".7"/>` },

  carroHumo: { vb: "0 0 420 170", ancho: 19, svg: `${carro("#2f6fb5", "#7fb3e6")}${bocanadas(14, 118, "#4a4d52")}` },

  carroAlarma: { vb: "0 0 420 170", ancho: 18, svg: `${carro("#d1453b", "#f08a80", `
    <rect class="a-parpadeo" x="392" y="94" width="18" height="16" rx="4" fill="#ffb020"/>
    <rect class="a-parpadeo" x="18" y="98" width="14" height="16" rx="4" fill="#ffb020"/>
    <circle class="a-parpadeo" cx="401" cy="102" r="24" fill="#ffb020" opacity=".35"/>
    <g fill="none" stroke="#e4572e" stroke-width="6" stroke-linecap="round" transform="translate(300 -10)">
      <path class="a-onda" d="M70 30 Q84 44 70 58"/><path class="a-onda" style="animation-delay:.3s" d="M84 18 Q104 44 84 70"/></g>
    <g transform="translate(250 0)"><rect x="0" y="0" width="92" height="30" rx="14" fill="#fff" stroke="#e4572e" stroke-width="3"/>
    <text x="46" y="21" font-size="16" text-anchor="middle" fill="#e4572e" font-family="Arial" font-weight="bold">¡PIIII!</text></g>`)}` },

  fugaBanqueta: { vb: "0 0 280 180", ancho: 15, svg: `
    ${charco(150, 160, 130, 18)}
    <path d="M60 150 L110 140 L130 152 L170 138 L230 150" stroke="#8a8f94" stroke-width="4" fill="none"/>
    <path d="M102 150 L112 132 L124 146 L136 130 L150 150Z" fill="#7d858c"/>
    <rect x="104" y="124" width="56" height="18" rx="6" fill="#8d959c"/><path d="M128 124 L134 116 L140 124" fill="#8d959c"/>
    <g stroke="#5fb7e5" stroke-width="7" fill="none" stroke-linecap="round">
      <path class="a-chorro" d="M132 120 Q126 60 96 30"/><path class="a-chorro" style="animation-delay:.2s" d="M132 120 Q136 50 160 24"/>
      <path class="a-chorro" style="animation-delay:.4s" d="M132 120 Q132 60 130 14"/></g>
    <g fill="#9ad6f0">${[[92, 36], [164, 30], [128, 16], [80, 70], [184, 64]].map(([x, y], k) => `<circle class="a-salpica" style="animation-delay:${k * .2}s" cx="${x}" cy="${y}" r="5"/>`).join("")}</g>` },

  basuraSoda: { vb: "0 0 240 100", ancho: 13, svg: `
    ${charco(120, 80, 100, 16, "#7a4a1e")}
    <ellipse cx="96" cy="78" rx="34" ry="8" fill="#9a6a3a" opacity=".7"/>
    <rect x="120" y="66" width="14" height="10" rx="2" fill="#e8f6fc" opacity=".9"/><rect x="146" y="72" width="12" height="9" rx="2" fill="#e8f6fc" opacity=".9"/>
    <g transform="rotate(-72 70 60)"><path d="M48 30 H92 L86 92 H54Z" fill="#fff"/><rect x="48" y="26" width="44" height="8" rx="3" fill="#d63b3b"/>
      <path d="M50 52 H90" stroke="#d63b3b" stroke-width="10"/></g>
    <path d="M22 44 L4 20" stroke="#f2c230" stroke-width="5" stroke-linecap="round"/>
    <path d="M178 70 Q190 56 206 66 Q214 80 198 86 Q182 88 178 70Z" fill="#f3efe4"/><path d="M186 70 L200 76 M190 64 L196 82" stroke="#cfc8b8" stroke-width="2"/>
    <path d="M200 40 L226 46 L222 72 L196 66Z" fill="#f2c230"/><path d="M204 48 L220 52" stroke="#d63b3b" stroke-width="4"/>
    ${mosca(150, 40)}` }
};
