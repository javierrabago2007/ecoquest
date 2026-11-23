/* ==========================================================================
   EcoQuest · escenas.js
   Fondos ilustrados (SVG) del juego «Detective ambiental».
   Son dibujos propios hechos con código: no usan imágenes externas.
   Cada escena mide 1600 × 900 "puntos". Los objetos que se buscan NO están
   aquí: se colocan encima desde datos/primero.json (campo "elementos").
   Para agregar una escena nueva: añade una entrada a ESCENAS_SVG y usa su
   nombre en el campo "fondo" del juego.
   ========================================================================== */

"use strict";

/* ---------- Piezas reutilizables ---------- */

const svgNube = (x, y, s, clase) => `
  <g class="nube ${clase}" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="0" rx="90" ry="38" fill="#fff" opacity=".95"/>
    <ellipse cx="-55" cy="12" rx="55" ry="28" fill="#fff" opacity=".95"/>
    <ellipse cx="60" cy="10" rx="60" ry="30" fill="#fff" opacity=".95"/>
    <ellipse cx="10" cy="-22" rx="50" ry="32" fill="#fff" opacity=".95"/>
  </g>`;

const svgSol = (x, y) => `
  <g transform="translate(${x} ${y})">
    <g class="sol-rayos" stroke="#ffd45e" stroke-width="10" stroke-linecap="round" opacity=".8">
      ${Array.from({ length: 12 }, (_, k) => `<line x1="0" y1="-95" x2="0" y2="-125" transform="rotate(${k * 30})"/>`).join("")}
    </g>
    <circle r="72" fill="#ffd85e"/><circle r="56" fill="#ffe58a"/>
  </g>`;

/** Palo verde: árbol del desierto de tronco verde. */
const svgPaloVerde = (x, y, s = 1) => `
  <g class="mece-lento" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="6" rx="80" ry="14" fill="#00000018"/>
    <path d="M-6 0 Q-10 -60 -40 -110 M-4 -40 Q20 -80 45 -120 M-8 -70 Q-20 -100 -10 -140" stroke="#7fa34a" stroke-width="14" fill="none" stroke-linecap="round"/>
    <g fill="#a9cc63"><circle cx="-45" cy="-125" r="42"/><circle cx="10" cy="-150" r="48"/><circle cx="55" cy="-125" r="40"/><circle cx="-10" cy="-110" r="38"/></g>
    <g fill="#f4d34c"><circle cx="-30" cy="-140" r="5"/><circle cx="25" cy="-165" r="5"/><circle cx="50" cy="-120" r="5"/><circle cx="-5" cy="-118" r="5"/><circle cx="-60" cy="-115" r="5"/></g>
  </g>`;

/** Mezquite: árbol de tronco café y copa ancha. */
const svgMezquite = (x, y, s = 1) => `
  <g class="mece-lento" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="6" rx="110" ry="16" fill="#00000018"/>
    <path d="M0 0 Q-6 -50 -30 -90 M0 -30 Q25 -70 60 -95" stroke="#6b4a2f" stroke-width="18" fill="none" stroke-linecap="round"/>
    <g fill="#5c9440"><ellipse cx="-50" cy="-110" rx="70" ry="40"/><ellipse cx="45" cy="-115" rx="75" ry="42"/><ellipse cx="0" cy="-145" rx="70" ry="38"/></g>
    <g fill="#6fa84d"><ellipse cx="-20" cy="-140" rx="40" ry="18"/><ellipse cx="55" cy="-125" rx="35" ry="15"/></g>
  </g>`;

/** Saguaro con brazos. */
const svgSaguaro = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="4" rx="40" ry="8" fill="#00000018"/>
    <g fill="#4b8a4c" stroke="#3c7440" stroke-width="3">
      <rect x="-18" y="-200" width="36" height="204" rx="18"/>
      <path d="M-18 -90 H-48 Q-58 -90 -58 -100 V-150 Q-58 -162 -46 -162 Q-34 -162 -34 -150 V-112 H-18 Z"/>
      <path d="M18 -120 H46 Q56 -120 56 -130 V-170 Q56 -182 44 -182 Q32 -182 32 -170 V-140 H18 Z"/>
    </g>
    <g stroke="#3c7440" stroke-width="2"><line x1="-6" y1="-190" x2="-6" y2="0"/><line x1="6" y1="-190" x2="6" y2="0"/></g>
  </g>`;

const svgArbusto = (x, y, s = 1, color = "#86b95a") => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="${color}">
    <circle cx="-30" cy="-18" r="28"/><circle cx="5" cy="-30" r="34"/><circle cx="38" cy="-16" r="26"/>
  </g>`;

const svgFlores = (x, y) => `
  <g transform="translate(${x} ${y})">
    ${[[0, 0, "#f26d7d"], [30, 12, "#f7c948"], [60, -4, "#b48ee0"], [-28, 14, "#f7c948"], [90, 10, "#f26d7d"]].map(([dx, dy, c]) =>
      `<line x1="${dx}" y1="${dy}" x2="${dx}" y2="${dy + 26}" stroke="#4f8a3c" stroke-width="4"/><circle cx="${dx}" cy="${dy}" r="9" fill="${c}"/><circle cx="${dx}" cy="${dy}" r="3.5" fill="#fff6c9"/>`).join("")}
  </g>`;

/** Casa sonorense: techo plano, colores vivos. */
const svgCasa = (x, y, w, h, color, puerta = "#8a5a3c") => `
  <g transform="translate(${x} ${y})">
    <rect x="0" y="${-h}" width="${w}" height="${h}" fill="${color}"/>
    <rect x="-8" y="${-h - 16}" width="${w + 16}" height="18" rx="3" fill="#00000022"/>
    <rect x="-8" y="${-h - 18}" width="${w + 16}" height="14" rx="3" fill="#f6efe2"/>
    <rect x="${w * 0.12}" y="${-h * 0.72}" width="${w * 0.3}" height="${h * 0.32}" rx="4" fill="#cfe8f7" stroke="#fff" stroke-width="5"/>
    <line x1="${w * 0.27}" y1="${-h * 0.72}" x2="${w * 0.27}" y2="${-h * 0.4}" stroke="#fff" stroke-width="4"/>
    <rect x="${w * 0.58}" y="${-h * 0.62}" width="${w * 0.26}" height="${h * 0.62}" rx="4" fill="${puerta}"/>
    <circle cx="${w * 0.62}" cy="${-h * 0.3}" r="4" fill="#f7d87c"/>
  </g>`;

/** Edificio con ventanas (ciudad). */
const svgEdificio = (x, y, w, h, color, ventanas = "#d8ecf8") => {
  const filas = Math.floor((h - 40) / 52), cols = Math.max(1, Math.floor((w - 20) / 46));
  let v = "";
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const prendida = (f * 7 + c * 3 + x) % 9 === 0;
    v += `<rect x="${14 + c * 46}" y="${-h + 24 + f * 52}" width="28" height="34" rx="3" fill="${prendida ? "#ffe9a8" : ventanas}"/>`;
  }
  return `<g transform="translate(${x} ${y})"><rect x="0" y="${-h}" width="${w}" height="${h}" fill="${color}"/><rect x="0" y="${-h}" width="${w}" height="10" fill="#00000018"/>${v}</g>`;
};

const svgPoste = (x, yBase, alto) => `
  <g transform="translate(${x} ${yBase})">
    <rect x="-7" y="${-alto}" width="14" height="${alto}" fill="#7d6a58"/>
    <rect x="-40" y="${-alto + 12}" width="80" height="8" fill="#7d6a58"/>
  </g>`;

const svgFarol = (x, yBase, alto) => `
  <g transform="translate(${x} ${yBase})">
    <rect x="-6" y="${-alto}" width="12" height="${alto}" rx="4" fill="#4a5a52"/>
    <path d="M0 ${-alto} q30 -6 46 14" stroke="#4a5a52" stroke-width="10" fill="none" stroke-linecap="round"/>
  </g>`;

/* ---------- Las escenas ---------- */

const ESCENAS_SVG = {

  /* 🌳 PARQUE: cerros del desierto, estanque, camino y árboles nativos */
  parque: `
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="pqCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8ef"/><stop offset="1" stop-color="#d9f1fb"/></linearGradient>
      <linearGradient id="pqPasto" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3d77a"/><stop offset="1" stop-color="#7fb85a"/></linearGradient>
      <linearGradient id="pqAgua" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ef"/><stop offset="1" stop-color="#4aa8d6"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#pqCielo)"/>
    ${svgSol(1400, 130)}
    ${svgNube(300, 120, 1, "nube-a")}${svgNube(900, 80, .8, "nube-b")}${svgNube(1200, 220, .6, "nube-c")}
    <path d="M0 430 L160 320 L300 400 L470 270 L640 390 L820 300 L990 400 L1180 290 L1380 390 L1600 330 V520 H0Z" fill="#d8c3a0"/>
    <path d="M0 470 L220 380 L420 450 L640 370 L860 450 L1080 380 L1300 450 L1600 400 V540 H0Z" fill="#c4ab84"/>
    <path d="M0 500 Q400 440 800 480 T1600 470 V900 H0Z" fill="url(#pqPasto)"/>
    <path d="M720 900 Q770 720 900 620 T1180 500" stroke="#ecdcb2" stroke-width="95" fill="none" stroke-linecap="round"/>
    <path d="M720 900 Q770 720 900 620 T1180 500" stroke="#f6ebcc" stroke-width="12" fill="none" stroke-dasharray="20 30" stroke-linecap="round"/>
    <g transform="translate(1250 705)">
      <ellipse rx="175" ry="52" fill="#6b9b55"/><ellipse rx="160" ry="44" fill="url(#pqAgua)"/>
      <path class="ola" d="M-90 -6 q20 -10 40 0 t40 0 M20 12 q20 -10 40 0 t40 0" stroke="#d6f2fb" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    <g stroke="#a7855c" stroke-width="7">${Array.from({ length: 12 }, (_, k) => `<line x1="${60 + k * 48}" y1="505" x2="${60 + k * 48}" y2="465"/>`).join("")}<line x1="50" y1="478" x2="600" y2="478"/></g>
    ${svgSaguaro(1480, 520, .9)}${svgSaguaro(620, 500, .55)}
    ${svgMezquite(250, 520, .9)}${svgPaloVerde(1020, 505, .8)}${svgPaloVerde(1530, 640, 1)}
    ${svgArbusto(560, 560, 1)}${svgArbusto(1120, 590, .8, "#9cc35a")}${svgArbusto(120, 640, 1.1, "#7aac50")}
    ${svgFlores(560, 820)}${svgFlores(1380, 830)}${svgFlores(300, 760)}
    ${svgFarol(912, 610, 290)}
    <rect x="410" y="575" width="180" height="16" rx="6" fill="#a7744a"/>
  </svg>`,

  /* 🏘️ COLONIA: casas de colores, banqueta, calle y postes de luz */
  colonia: `
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="coCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ccff0"/><stop offset=".7" stop-color="#ffe7c2"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#coCielo)"/>
    ${svgSol(200, 120)}
    ${svgNube(700, 110, .9, "nube-a")}${svgNube(1250, 70, .7, "nube-b")}
    <path d="M700 380 Q900 170 1100 300 Q1250 220 1400 330 L1600 300 V420 H600Z" fill="#c9a98a"/>
    <path d="M0 400 L200 330 L380 390 L560 340 L800 410 H0Z" fill="#d6bc9b"/>
    <rect y="395" width="1600" height="190" fill="#e8dcc6"/>
    ${svgCasa(30, 570, 230, 170, "#f2a29b")}
    ${svgCasa(300, 570, 210, 190, "#8fd0c4")}
    ${svgCasa(550, 570, 240, 160, "#f6d57a")}
    ${svgCasa(830, 570, 220, 185, "#b9a6e3")}
    ${svgCasa(1090, 570, 230, 165, "#f3b57d")}
    ${svgCasa(1360, 570, 220, 180, "#a6d49f")}
    ${svgMezquite(1050, 575, .75)}
    ${svgArbusto(240, 572, .7, "#7aac50")}${svgArbusto(1330, 572, .6, "#86b95a")}
    ${svgPoste(140, 600, 420)}${svgPoste(780, 600, 420)}${svgPoste(1420, 600, 420)}
    <path d="M140 196 Q460 260 780 196 Q1100 260 1420 196" stroke="#3d3d3d" stroke-width="4" fill="none"/>
    <path d="M140 210 Q460 278 780 210 Q1100 278 1420 210" stroke="#3d3d3d" stroke-width="3" fill="none"/>
    <rect y="575" width="1600" height="60" fill="#d9cfbf"/>
    <g stroke="#c4b8a3" stroke-width="3">${Array.from({ length: 16 }, (_, k) => `<line x1="${k * 100}" y1="575" x2="${k * 100}" y2="635"/>`).join("")}</g>
    <rect y="632" width="1600" height="16" fill="#b9ad98"/>
    <rect y="648" width="1600" height="252" fill="#6d727b"/>
    <g fill="#f3d36b">${Array.from({ length: 9 }, (_, k) => `<rect x="${30 + k * 190}" y="770" width="110" height="12" rx="6"/>`).join("")}</g>
  </svg>`,

  /* 🏙️ CIUDAD: edificios, banqueta, calle con paso peatonal y faroles */
  ciudad: `
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="ciCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fcdea"/><stop offset="1" stop-color="#edf3f2"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#ciCielo)"/>
    ${svgNube(250, 90, .8, "nube-a")}${svgNube(1000, 140, 1, "nube-b")}${svgNube(1450, 60, .6, "nube-c")}
    <g opacity=".55">
      ${svgEdificio(0, 620, 150, 420, "#9fb1c2")}${svgEdificio(170, 620, 120, 520, "#a9b9c8")}${svgEdificio(560, 620, 160, 470, "#9fb1c2")}
      ${svgEdificio(900, 620, 130, 540, "#a9b9c8")}${svgEdificio(1180, 620, 170, 450, "#9fb1c2")}${svgEdificio(1440, 620, 160, 500, "#a9b9c8")}
    </g>
    ${svgEdificio(60, 620, 190, 330, "#e8a87c")}
    ${svgEdificio(300, 620, 220, 400, "#7fa7c9")}
    ${svgEdificio(560, 620, 170, 290, "#f0cf7a")}
    ${svgEdificio(770, 620, 230, 360, "#c7a3d9")}
    ${svgEdificio(1050, 620, 170, 300, "#8cc7a8")}
    <rect x="1240" y="300" width="300" height="320" fill="#b9b2a8"/>
    <rect x="1300" y="160" width="46" height="140" fill="#9a9288"/><rect x="1400" y="200" width="40" height="100" fill="#9a9288"/>
    <g fill="#857d73">${Array.from({ length: 5 }, (_, k) => `<rect x="${1262 + k * 56}" y="360" width="36" height="60" rx="4"/>`).join("")}</g>
    <rect x="1350" y="500" width="90" height="120" fill="#6e665c"/>
    ${svgFarol(270, 650, 230)}${svgFarol(1020, 650, 230)}
    <rect y="620" width="1600" height="50" fill="#d4d0c8"/>
    <rect y="665" width="1600" height="14" fill="#a9a59c"/>
    <rect y="679" width="1600" height="221" fill="#5c6068"/>
    <g fill="#f4f4f4">${Array.from({ length: 7 }, (_, k) => `<rect x="${640 + k * 46}" y="690" width="26" height="200"/>`).join("")}</g>
    <g fill="#f3d36b">${[0, 1, 2, 3].map(k => `<rect x="${40 + k * 140}" y="790" width="90" height="10" rx="5"/>`).join("")}${[0, 1, 2, 3].map(k => `<rect x="${1020 + k * 140}" y="790" width="90" height="10" rx="5"/>`).join("")}</g>
  </svg>`
};
