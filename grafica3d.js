// =====================================================================
// SNAKEC - la grafica 3D
// =====================================================================
// Questo file DISEGNA il gioco in 3D. Non cambia le regole: il serpente,
// il cibo, le pietre e il punteggio sono gestiti da script.js esattamente
// come nella vista 2D. Qui leggiamo quelle informazioni e le mostriamo
// come oggetti solidi, visti dall'alto e un po' di lato.
//
// Usiamo WebGL, lo strumento per il 3D che è già dentro ogni browser
// moderno (niente librerie da scaricare). WebGL è molto "a basso livello":
// sa disegnare solo triangoli. Quindi:
// - costruiamo noi le forme (cubo, sfera, campo) come elenchi di triangoli;
// - scriviamo due piccoli programmi ("shader") che girano sulla scheda
//   grafica: uno decide DOVE finisce ogni punto sullo schermo, l'altro
//   di che COLORE è ogni pixel, in base alla luce;
// - usiamo un po' di matematica (matrici) per la prospettiva: le cose
//   lontane sembrano più piccole, come in una fotografia.
//
// Sistema di coordinate del mondo 3D (in "celle"):
// - x va verso destra, come le colonne della griglia;
// - z va verso chi guarda, come le righe della griglia (la y del 2D);
// - y va verso l'ALTO (è l'altezza da terra).
// Il centro del campo è il punto (0, 0, 0).
// =====================================================================


// ---------- 1. Variabili della grafica 3D ----------

let gl = null;           // il "contesto" WebGL: lo strumento per disegnare in 3D
let programma3D = null;  // gli shader (i programmi per la scheda grafica) già pronti
let attributi = {};      // dove gli shader ricevono i dati di ogni punto (posizione, ecc.)
let uniformi = {};       // dove gli shader ricevono i valori uguali per tutto l'oggetto (colore, ecc.)
let meshCubo, meshSfera, meshCampo; // le forme già caricate sulla scheda grafica
let posizioneCamera;     // da dove "guarda" la telecamera

// Direzione da cui arriva la luce (dall'alto, un po' da sinistra e da dietro).
// "normalizza" la rende lunga 1, come serve ai calcoli della luce.
const DIREZIONE_LUCE = normalizza([-0.5, 1, -0.4]);

// Colore dello sfondo dietro al campo [rosso, verde, blu] da 0 a 1
const COLORE_SFONDO_3D = [0.07, 0.10, 0.15];


// ---------- 2. Avvio ----------

// Prepara WebGL sulla tela indicata. Restituisce true se tutto è andato bene,
// false se il browser non sa fare il 3D (in quel caso si gioca in 2D).
function inizializza3D(tela) {
  try {
    // "stencil" ci serve per le ombre (vedi disegnaOmbre3D)
    const opzioni = { antialias: true, stencil: true };
    gl = tela.getContext("webgl", opzioni) || tela.getContext("experimental-webgl", opzioni);
  } catch (errore) {
    gl = null;
  }
  if (!gl) {
    return false;
  }

  // Come per la tela 2D: più pixel veri sugli schermi ad alta densità
  const densita = window.devicePixelRatio || 1;
  tela.width = DIMENSIONE_CAMPO * densita;
  tela.height = DIMENSIONE_CAMPO * densita;

  programma3D = creaProgramma(CODICE_VERTICI, CODICE_PIXEL);
  if (!programma3D) {
    gl = null;
    return false;
  }

  // Ci segniamo dove si trovano gli ingressi degli shader, per usarli dopo
  attributi = {
    posizione: gl.getAttribLocation(programma3D, "aPosizione"),
    normale: gl.getAttribLocation(programma3D, "aNormale"),
    colore: gl.getAttribLocation(programma3D, "aColore")
  };
  ["uModello", "uVistaProiezione", "uScala", "uColore", "uLuce",
   "uCamera", "uLucentezza", "uEmissione"].forEach(function (nome) {
    uniformi[nome] = gl.getUniformLocation(programma3D, nome);
  });

  // Costruiamo le forme una volta sola e le carichiamo sulla scheda grafica
  meshCubo = creaMesh(geometriaCubo());
  meshSfera = creaMesh(geometriaSfera(14, 22));
  meshCampo = creaMesh(geometriaCampo());

  // "Test di profondità": un oggetto più vicino copre quelli dietro
  gl.enable(gl.DEPTH_TEST);
  return true;
}


// ---------- 3. Gli shader ----------
// Sono scritti in un linguaggio speciale (GLSL), simile al C, e vengono
// eseguiti dalla scheda grafica milioni di volte al secondo.

// Shader dei VERTICI: per ogni punto di una forma calcola dove finisce
// sullo schermo e passa avanti le informazioni per la luce.
const CODICE_VERTICI = [
  "attribute vec3 aPosizione;",   // posizione del punto nella forma
  "attribute vec3 aNormale;",     // direzione "verso fuori" della superficie
  "attribute vec3 aColore;",      // colore del punto (usato dal campo a scacchi)
  "uniform mat4 uModello;",       // sposta, ruota e ingrandisce la forma nel mondo
  "uniform mat4 uVistaProiezione;", // telecamera + prospettiva
  "uniform vec3 uScala;",         // di quanto è ingrandita la forma (serve alle normali)
  "varying vec3 vNormale;",
  "varying vec3 vPosizioneMondo;",
  "varying vec3 vColore;",
  "void main() {",
  "  vec4 posizioneMondo = uModello * vec4(aPosizione, 1.0);",
  "  vPosizioneMondo = posizioneMondo.xyz;",
  // Se la forma è stirata, la normale va "corretta" dividendo per la scala
  "  vNormale = mat3(uModello) * (aNormale / (uScala * uScala));",
  "  vColore = aColore;",
  "  gl_Position = uVistaProiezione * posizioneMondo;",
  "}"
].join("\n");

// Shader dei PIXEL: decide il colore di ogni pixel.
// Luce = ambiente (un minimo di luce ovunque) + diffusa (più luce dove la
// superficie guarda verso la luce) + riflesso lucido + "emissione" (oggetti
// che brillano di luce propria, come la mela e le scintille).
const CODICE_PIXEL = [
  "precision mediump float;",
  "uniform vec4 uColore;",        // colore dell'oggetto (la quarta cifra è la trasparenza)
  "uniform vec3 uLuce;",          // direzione della luce
  "uniform vec3 uCamera;",        // posizione della telecamera
  "uniform float uLucentezza;",   // quanto è lucido (0 = opaco)
  "uniform float uEmissione;",    // quanto brilla di luce propria
  "varying vec3 vNormale;",
  "varying vec3 vPosizioneMondo;",
  "varying vec3 vColore;",
  "void main() {",
  "  vec3 normale = normalize(vNormale);",
  "  float diffusa = max(dot(normale, uLuce), 0.0);",
  "  vec3 versoCamera = normalize(uCamera - vPosizioneMondo);",
  "  vec3 metaStrada = normalize(uLuce + versoCamera);",
  "  float riflesso = pow(max(dot(normale, metaStrada), 0.0), 32.0) * uLucentezza;",
  "  vec3 base = uColore.rgb * vColore;",
  "  vec3 colore = base * (0.42 + 0.68 * diffusa) + vec3(riflesso) + base * uEmissione;",
  "  gl_FragColor = vec4(colore, uColore.a);",
  "}"
].join("\n");

// Compila i due shader e li unisce in un "programma".
// Restituisce null se qualcosa va storto.
function creaProgramma(codiceVertici, codicePixel) {
  function compila(tipo, codice) {
    const shader = gl.createShader(tipo);
    gl.shaderSource(shader, codice);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Errore nello shader:", gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vertici = compila(gl.VERTEX_SHADER, codiceVertici);
  const pixel = compila(gl.FRAGMENT_SHADER, codicePixel);
  if (!vertici || !pixel) {
    return null;
  }

  const programma = gl.createProgram();
  gl.attachShader(programma, vertici);
  gl.attachShader(programma, pixel);
  gl.linkProgram(programma);
  if (!gl.getProgramParameter(programma, gl.LINK_STATUS)) {
    console.error("Errore nel programma:", gl.getProgramInfoLog(programma));
    return null;
  }
  return programma;
}


// ---------- 4. Le forme (geometrie) ----------
// Una forma è fatta di punti (vertici) e di triangoli che li uniscono.
// Per ogni punto ci servono: posizione, normale e colore.

// Crea una forma vuota da riempire
function nuovaGeometria() {
  return { posizioni: [], normali: [], colori: [], indici: [] };
}

// Aggiunge un quadrilatero (4 angoli, tutti con la stessa normale e lo
// stesso colore) come due triangoli
function aggiungiQuadrilatero(geo, a, b, c, d, normale, colore) {
  const primo = geo.posizioni.length / 3; // numero del primo dei 4 nuovi punti
  [a, b, c, d].forEach(function (punto) {
    geo.posizioni.push(punto[0], punto[1], punto[2]);
    geo.normali.push(normale[0], normale[1], normale[2]);
    geo.colori.push(colore[0], colore[1], colore[2]);
  });
  geo.indici.push(primo, primo + 1, primo + 2, primo, primo + 2, primo + 3);
}

// Aggiunge una scatola tra l'angolo "min" [x, y, z] e l'angolo "max".
// La faccia di sotto non la mettiamo: dall'alto non si vede mai.
function aggiungiScatola(geo, min, max, colore) {
  const x0 = min[0], y0 = min[1], z0 = min[2];
  const x1 = max[0], y1 = max[1], z1 = max[2];
  // sopra
  aggiungiQuadrilatero(geo, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], colore);
  // davanti e dietro
  aggiungiQuadrilatero(geo, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], colore);
  aggiungiQuadrilatero(geo, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], colore);
  // destra e sinistra
  aggiungiQuadrilatero(geo, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], colore);
  aggiungiQuadrilatero(geo, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], colore);
}

// Un cubo di lato 1 con il centro in (0, 0, 0), bianco
// (il colore vero lo decidiamo quando lo disegniamo)
function geometriaCubo() {
  const geo = nuovaGeometria();
  aggiungiScatola(geo, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], [1, 1, 1]);
  // Aggiungiamo anche la faccia di sotto: i cubi delle scintille girano
  aggiungiQuadrilatero(geo, [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [0, -1, 0], [1, 1, 1]);
  return geo;
}

// Una sfera di raggio 1. È come un mappamondo: "anelli" sono i paralleli
// e "spicchi" i meridiani. Più sono, più la sfera è liscia.
function geometriaSfera(anelli, spicchi) {
  const geo = nuovaGeometria();
  for (let i = 0; i <= anelli; i++) {
    const latitudine = i * Math.PI / anelli;       // da 0 (polo nord) a PI (polo sud)
    for (let j = 0; j <= spicchi; j++) {
      const longitudine = j * 2 * Math.PI / spicchi; // giro completo
      const x = Math.sin(latitudine) * Math.cos(longitudine);
      const y = Math.cos(latitudine);
      const z = Math.sin(latitudine) * Math.sin(longitudine);
      geo.posizioni.push(x, y, z);
      geo.normali.push(x, y, z); // in una sfera la normale punta dal centro verso il punto
      geo.colori.push(1, 1, 1);
    }
  }
  // Uniamo i punti a due a due tra un anello e il successivo
  for (let i = 0; i < anelli; i++) {
    for (let j = 0; j < spicchi; j++) {
      const a = i * (spicchi + 1) + j;
      const b = a + spicchi + 1;
      geo.indici.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return geo;
}

// Il campo: una scacchiera di caselle a terra (y = 0) con un muretto intorno.
// È una forma sola, così si disegna in un colpo.
function geometriaCampo() {
  const geo = nuovaGeometria();
  const meta = CELLE_PER_LATO / 2;
  const chiara = coloreDaEsadecimale("#2f5b3d");
  const scura = coloreDaEsadecimale("#274d33");

  for (let gx = 0; gx < CELLE_PER_LATO; gx++) {
    for (let gy = 0; gy < CELLE_PER_LATO; gy++) {
      const x0 = gx - meta, z0 = gy - meta;
      const colore = (gx + gy) % 2 === 0 ? chiara : scura;
      aggiungiQuadrilatero(geo, [x0, 0, z0], [x0 + 1, 0, z0], [x0 + 1, 0, z0 + 1], [x0, 0, z0 + 1], [0, 1, 0], colore);
    }
  }

  // Muretto: quattro scatole lungo i bordi. Fa capire bene dove finisce il campo.
  const spessore = 0.45, altezza = 0.4, sotto = -1;
  const fuori = meta + spessore;
  const coloreMuro = coloreDaEsadecimale("#3a5a40");
  aggiungiScatola(geo, [-fuori, sotto, -fuori], [fuori, altezza, -meta], coloreMuro); // dietro
  aggiungiScatola(geo, [-fuori, sotto, meta], [fuori, altezza, fuori], coloreMuro);   // davanti
  aggiungiScatola(geo, [-fuori, sotto, -meta], [-meta, altezza, meta], coloreMuro);   // sinistra
  aggiungiScatola(geo, [meta, sotto, -meta], [fuori, altezza, meta], coloreMuro);     // destra
  return geo;
}

// Carica una forma sulla scheda grafica (nei "buffer") e restituisce
// un oggetto che la rappresenta, pronto da disegnare
function creaMesh(geo) {
  function buffer(tipo, dati) {
    const b = gl.createBuffer();
    gl.bindBuffer(tipo, b);
    gl.bufferData(tipo, dati, gl.STATIC_DRAW);
    return b;
  }
  return {
    posizioni: buffer(gl.ARRAY_BUFFER, new Float32Array(geo.posizioni)),
    normali: buffer(gl.ARRAY_BUFFER, new Float32Array(geo.normali)),
    colori: buffer(gl.ARRAY_BUFFER, new Float32Array(geo.colori)),
    indici: buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.indici)),
    quantiIndici: geo.indici.length
  };
}


// ---------- 5. Un po' di matematica ----------
// Le matrici sono tabelle 4x4 di numeri che servono a spostare, ruotare e
// mettere in prospettiva i punti. WebGL le vuole scritte "per colonne".

// Rende un vettore [x, y, z] lungo esattamente 1, mantenendo la direzione
function normalizza(v) {
  const lunghezza = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / lunghezza, v[1] / lunghezza, v[2] / lunghezza];
}

// Prodotto vettoriale: dà una direzione perpendicolare a entrambe
function prodottoVettoriale(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function prodottoScalare(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Moltiplica due matrici: il risultato fa prima "b" e poi "a"
function moltiplicaMatrici(a, b) {
  const risultato = new Float32Array(16);
  for (let colonna = 0; colonna < 4; colonna++) {
    for (let riga = 0; riga < 4; riga++) {
      let somma = 0;
      for (let k = 0; k < 4; k++) {
        somma += a[k * 4 + riga] * b[colonna * 4 + k];
      }
      risultato[colonna * 4 + riga] = somma;
    }
  }
  return risultato;
}

// Matrice della prospettiva: "campoVisivo" è l'apertura dell'obiettivo (in radianti)
function matricePerspettiva(campoVisivo, proporzione, vicino, lontano) {
  const f = 1 / Math.tan(campoVisivo / 2);
  const inverso = 1 / (vicino - lontano);
  return new Float32Array([
    f / proporzione, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (lontano + vicino) * inverso, -1,
    0, 0, 2 * lontano * vicino * inverso, 0
  ]);
}

// Matrice della telecamera: messa nel punto "occhio" e rivolta verso "bersaglio"
function matriceGuarda(occhio, bersaglio, alto) {
  const avanti = normalizza([occhio[0] - bersaglio[0], occhio[1] - bersaglio[1], occhio[2] - bersaglio[2]]);
  const destra = normalizza(prodottoVettoriale(alto, avanti));
  const su = prodottoVettoriale(avanti, destra);
  return new Float32Array([
    destra[0], su[0], avanti[0], 0,
    destra[1], su[1], avanti[1], 0,
    destra[2], su[2], avanti[2], 0,
    -prodottoScalare(destra, occhio), -prodottoScalare(su, occhio), -prodottoScalare(avanti, occhio), 1
  ]);
}

// Matrice di un oggetto: lo ingrandisce (sx, sy, sz), lo ruota attorno
// all'asse verticale di "angolo" radianti e lo sposta in (x, y, z)
function matriceModello(x, y, z, sx, sy, sz, angolo) {
  const c = Math.cos(angolo), s = Math.sin(angolo);
  return new Float32Array([
    c * sx, 0, -s * sx, 0,
    0, sy, 0, 0,
    s * sz, 0, c * sz, 0,
    x, y, z, 1
  ]);
}

// Trasforma "#ff4d4d" in [1, 0.3, 0.3] (numeri da 0 a 1)
function coloreDaEsadecimale(testo) {
  const numero = parseInt(testo.slice(1), 16);
  return [(numero >> 16 & 255) / 255, (numero >> 8 & 255) / 255, (numero & 255) / 255];
}

// Mescola due colori [r, g, b] da 0 a 255 (come mescolaColori in script.js)
// e restituisce il risultato con numeri da 0 a 1, come li vuole WebGL
function mescolaColori3D(coloreA, coloreB, t) {
  return [0, 1, 2].map(function (i) {
    return (coloreA[i] + (coloreB[i] - coloreA[i]) * t) / 255;
  });
}

// Le celle della griglia vanno da 0 a 19; nel mondo 3D il centro del campo
// è lo zero, quindi la cella 0 sta a -9.5 e la cella 19 a +9.5
function nelMondo(cella) {
  return cella - CELLE_PER_LATO / 2 + 0.5;
}


// ---------- 6. Disegnare una forma ----------

// Disegna una forma con le impostazioni indicate in "o":
// x, y, z (posizione), sx, sy, sz (grandezza), angolo, colore [r, g, b],
// alfa (trasparenza), lucentezza ed emissione. Quelle mancanti hanno un valore normale.
function disegnaMesh(mesh, o) {
  // Una grandezza zero creerebbe problemi nei calcoli: mettiamo un minimo
  const sx = Math.max(0.001, o.sx), sy = Math.max(0.001, o.sy), sz = Math.max(0.001, o.sz);

  gl.uniformMatrix4fv(uniformi.uModello, false, matriceModello(o.x, o.y, o.z, sx, sy, sz, o.angolo || 0));
  gl.uniform3f(uniformi.uScala, sx, sy, sz);
  const colore = o.colore || [1, 1, 1];
  gl.uniform4f(uniformi.uColore, colore[0], colore[1], colore[2], o.alfa === undefined ? 1 : o.alfa);
  gl.uniform1f(uniformi.uLucentezza, o.lucentezza || 0);
  gl.uniform1f(uniformi.uEmissione, o.emissione || 0);

  // Diciamo agli shader dove trovare posizioni, normali e colori dei punti
  [["posizioni", attributi.posizione], ["normali", attributi.normale], ["colori", attributi.colore]]
    .forEach(function (coppia) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh[coppia[0]]);
      gl.enableVertexAttribArray(coppia[1]);
      gl.vertexAttribPointer(coppia[1], 3, gl.FLOAT, false, 0, 0);
    });

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indici);
  gl.drawElements(gl.TRIANGLES, mesh.quantiIndici, gl.UNSIGNED_SHORT, 0);
}

// Una sfera di raggio "r" nel punto (x, y, z)
function disegnaSfera(x, y, z, r, colore, extra) {
  const o = { x: x, y: y, z: z, sx: r, sy: r, sz: r, colore: colore };
  if (extra) {
    Object.keys(extra).forEach(function (chiave) { o[chiave] = extra[chiave]; });
  }
  disegnaMesh(meshSfera, o);
}


// ---------- 7. Il disegno di tutta la scena ----------

// Ridisegna la scena 3D. Viene chiamata da "disegna" in script.js
// circa 60 volte al secondo, quando è attiva la vista 3D.
function disegna3D(istante) {
  const tela = gl.canvas;
  gl.viewport(0, 0, tela.width, tela.height);
  gl.clearColor(COLORE_SFONDO_3D[0], COLORE_SFONDO_3D[1], COLORE_SFONDO_3D[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  gl.useProgram(programma3D);

  preparaCamera(istante);
  gl.uniform3f(uniformi.uLuce, DIREZIONE_LUCE[0], DIREZIONE_LUCE[1], DIREZIONE_LUCE[2]);

  // Il campo a scacchi con il muretto
  disegnaMesh(meshCampo, { x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1 });

  // Le altre forme (cubo e sfera) sono bianche: il loro colore vero
  // arriva da "uColore" quando le disegniamo
  const ombre = []; // le raccogliamo mentre disegniamo e le facciamo tutte insieme alla fine

  disegnaPietre3D(istante, ombre);
  disegnaCibo3D(istante, ombre);
  disegnaSerpente3D(istante, ombre);
  disegnaOmbre3D(ombre);
  disegnaParticelle3D();
}

// Posiziona la telecamera in alto, davanti al campo, rivolta verso il centro.
// Così "su" sulla tastiera vuol dire "verso il fondo del campo", come nel 2D.
function preparaCamera(istante) {
  // Dopo un game over la telecamera trema per un attimo
  let scossaX = 0, scossaY = 0;
  if (istante < scossaFinoA) {
    const forza = (scossaFinoA - istante) / 300 * 0.35;
    scossaX = (Math.random() - 0.5) * forza;
    scossaY = (Math.random() - 0.5) * forza;
  }

  // Telecamera alta e lontana, con un obiettivo stretto (28 gradi): così il
  // campo si vede quasi tutto intero e i bordi lontani non si rimpiccioliscono
  // troppo. Questi numeri sono scelti perché il campo riempia la tela
  // lasciando un po' di spazio in alto per la scritta "Livello ...".
  posizioneCamera = [scossaX, 44 + scossaY, 21];
  const vista = matriceGuarda(posizioneCamera, [scossaX, 0, -0.6], [0, 1, 0]);
  const prospettiva = matricePerspettiva(28 * Math.PI / 180, 1, 1, 100);
  gl.uniformMatrix4fv(uniformi.uVistaProiezione, false, moltiplicaMatrici(prospettiva, vista));
  gl.uniform3f(uniformi.uCamera, posizioneCamera[0], posizioneCamera[1], posizioneCamera[2]);
}

// Le pietre: blocchi grigi con sopra un "cappello" più chiaro.
// Come nel 2D, quando compaiono crescono dal centro e brillano un attimo.
function disegnaPietre3D(istante, ombre) {
  const grigioScuro = coloreDaEsadecimale("#4f5661");
  const grigioChiaro = coloreDaEsadecimale("#737c8a");

  pietre.forEach(function (pietra) {
    const eta = Math.min(1, (istante - pietra.nataAlle) / 400);
    const scala = 1 - Math.pow(1 - eta, 3);
    if (scala <= 0) {
      return;
    }

    const x = nelMondo(pietra.x), z = nelMondo(pietra.y);
    const lato = 0.88 * scala;
    // Ogni pietra ha un'altezza e una rotazione un po' diverse ("variante" è un numero a caso)
    const altezza = (0.55 + pietra.variante * 0.35) * scala;
    const angolo = (pietra.variante - 0.5) * 0.6;
    const bagliore = (1 - eta) * 1.5; // le pietre appena nate brillano

    disegnaMesh(meshCubo, {
      x: x, y: altezza / 2, z: z, sx: lato, sy: altezza, sz: lato, angolo: angolo,
      colore: grigioScuro, emissione: bagliore
    });
    disegnaMesh(meshCubo, {
      x: x, y: altezza * 0.92, z: z, sx: lato * 0.78, sy: altezza * 0.22, sz: lato * 0.78, angolo: angolo,
      colore: grigioChiaro, lucentezza: 0.25, emissione: bagliore
    });

    ombre.push({ mesh: meshCubo, x: x, z: z, altezza: altezza / 2, sx: lato, sz: lato, angolo: angolo });
  });
}

// La mela: una sfera rossa lucida che galleggia, pulsa e gira su se stessa
function disegnaCibo3D(istante, ombre) {
  if (cibo === null) {
    return;
  }

  const x = nelMondo(cibo.x), z = nelMondo(cibo.y);
  const pulsazione = 1 + Math.sin(istante / 180) * 0.08;
  const raggio = 0.36 * pulsazione;
  const y = 0.5 + Math.sin(istante / 300) * 0.08; // sale e scende piano piano
  const giro = istante / 900;                     // angolo per farla girare

  disegnaSfera(x, y, z, raggio, coloreDaEsadecimale(COLORE_CIBO), { lucentezza: 0.9, emissione: 0.25 });

  // Picciolo: un bastoncino marrone sopra la mela
  const cima = y + raggio;
  disegnaMesh(meshCubo, {
    x: x, y: cima + 0.06, z: z, sx: 0.06, sy: 0.18, sz: 0.06, angolo: giro,
    colore: coloreDaEsadecimale(COLORE_PICCIOLO)
  });

  // Fogliolina: una sfera schiacciata, accanto al picciolo, che gira con la mela
  disegnaMesh(meshSfera, {
    x: x + Math.cos(giro) * 0.13, y: cima + 0.06, z: z - Math.sin(giro) * 0.13,
    sx: 0.16, sy: 0.035, sz: 0.08, angolo: giro,
    colore: coloreDaEsadecimale(COLORE_FOGLIA), lucentezza: 0.3
  });

  ombre.push({ mesh: meshSfera, x: x, z: z, altezza: y, sx: raggio, sz: raggio, angolo: 0 });
}

// Il serpente: una fila di sfere che si sovrappongono e formano un tubo,
// grosso e chiaro vicino alla testa, sottile e scuro verso la coda
function disegnaSerpente3D(istante, ombre) {
  const punti = calcolaPuntiSerpente(istante); // posizioni "in movimento", in celle
  const quantiPezzi = punti.length;
  const SFERE_PER_PEZZO = 3; // quante sfere mettiamo tra un pezzo e il successivo

  for (let i = quantiPezzi - 1; i > 0; i--) {
    for (let k = 0; k < SFERE_PER_PEZZO; k++) {
      const f = k / SFERE_PER_PEZZO; // da 0 (sul pezzo i) verso 1 (sul pezzo i-1)
      const cx = punti[i].x + (punti[i - 1].x - punti[i].x) * f;
      const cy = punti[i].y + (punti[i - 1].y - punti[i].y) * f;
      const t = (i - f) / Math.max(1, quantiPezzi - 1); // 0 sulla testa, 1 sulla coda
      const raggio = 0.42 - 0.15 * t;
      const x = nelMondo(cx), z = nelMondo(cy);

      disegnaSfera(x, raggio, z, raggio, mescolaColori3D(COLORE_TESTA, COLORE_CODA, t), { lucentezza: 0.35 });
      if (k === 0) {
        ombre.push({ mesh: meshSfera, x: x, z: z, altezza: raggio, sx: raggio, sz: raggio, angolo: 0 });
      }
    }
  }

  // La testa: una sfera più grande, che brilla un poco
  const testa = punti[0];
  const tx = nelMondo(testa.x), tz = nelMondo(testa.y);
  const raggioTesta = 0.5;
  disegnaSfera(tx, raggioTesta, tz, raggioTesta, mescolaColori3D(COLORE_TESTA, COLORE_CODA, 0),
    { lucentezza: 0.5, emissione: 0.12 });
  ombre.push({ mesh: meshSfera, x: tx, z: tz, altezza: raggioTesta, sx: raggioTesta, sz: raggioTesta, angolo: 0 });

  disegnaOcchi3D(tx, tz, raggioTesta);
}

// Due occhi sopra la testa, rivolti dove va il serpente
function disegnaOcchi3D(tx, tz, raggioTesta) {
  // "avanti" e "laterale" come in disegnaOcchi (2D): la y della griglia è la z del mondo
  const avantiX = direzione.x, avantiZ = direzione.y;
  const lateraleX = -direzione.y, lateraleZ = direzione.x;
  // Angolo della direzione, per ruotare la "x" degli occhi a fine partita
  const angoloDirezione = Math.atan2(-avantiZ, avantiX);
  const nero = [0.1, 0.1, 0.1];

  [-1, 1].forEach(function (lato) {
    const ox = tx + avantiX * 0.22 + lateraleX * 0.22 * lato;
    const oz = tz + avantiZ * 0.22 + lateraleZ * 0.22 * lato;
    const oy = raggioTesta + 0.3;

    // Parte bianca dell'occhio
    disegnaSfera(ox, oy, oz, 0.16, [1, 1, 1], { lucentezza: 0.6 });

    if (partitaFinita && cibo !== null) {
      // Game over: una "x" fatta di due bastoncini incrociati, appoggiata sull'occhio
      [Math.PI / 4, -Math.PI / 4].forEach(function (inclinazione) {
        disegnaMesh(meshCubo, {
          x: ox, y: oy + 0.15, z: oz, sx: 0.24, sy: 0.04, sz: 0.05,
          angolo: angoloDirezione + inclinazione, colore: nero
        });
      });
    } else {
      // Pupilla nera, spostata in avanti e in alto: il serpente "guarda" dove va
      disegnaSfera(ox + avantiX * 0.08, oy + 0.07, oz + avantiZ * 0.08, 0.085, nero, { lucentezza: 0.8 });
    }
  });
}

// Le ombre: macchie scure e trasparenti a terra, sotto gli oggetti, un po'
// spostate dalla parte opposta alla luce. Per non farle diventare più scure
// dove si sovrappongono usiamo lo "stencil": una specie di foglio su cui
// segniamo i pixel già ombreggiati, così ogni pixel si scurisce una volta sola.
function disegnaOmbre3D(ombre) {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);                           // le ombre non coprono niente
  gl.enable(gl.STENCIL_TEST);
  gl.stencilFunc(gl.EQUAL, 0, 0xff);             // disegna solo dove non c'è già ombra...
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);       // ...e segna il pixel come "già in ombra"

  // Di quanto si sposta l'ombra per ogni unità di altezza dell'oggetto
  const spostaX = -DIREZIONE_LUCE[0] / DIREZIONE_LUCE[1];
  const spostaZ = -DIREZIONE_LUCE[2] / DIREZIONE_LUCE[1];

  ombre.forEach(function (ombra) {
    disegnaMesh(ombra.mesh, {
      x: ombra.x + spostaX * ombra.altezza * 0.5, y: 0.01, z: ombra.z + spostaZ * ombra.altezza * 0.5,
      sx: ombra.sx, sy: 0.001, sz: ombra.sz, angolo: ombra.angolo,
      colore: [0, 0, 0], alfa: 0.32
    });
  });

  gl.disable(gl.STENCIL_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

// Le scintille: cubetti colorati che saltano in alto e ricadono girando
function disegnaParticelle3D() {
  particelle.forEach(function (p) {
    const lato = 0.14 * p.vita + 0.04;
    disegnaMesh(meshCubo, {
      x: nelMondo(p.x / LATO_CELLA - 0.5), y: Math.max(lato / 2, p.altezza), z: nelMondo(p.y / LATO_CELLA - 0.5),
      sx: lato, sy: lato, sz: lato, angolo: p.vita * 8,
      colore: coloreDaEsadecimale(p.colore), emissione: 0.9
    });
  });
}
