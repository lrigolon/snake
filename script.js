// =====================================================================
// SNAKE - il codice del gioco
// =====================================================================
// Idea di base: il campo è una griglia di quadratini (celle).
// Il serpente è una lista di celle; ogni "passo" del gioco aggiungiamo
// una cella davanti alla testa e, se non ha mangiato, togliamo l'ultima
// cella della coda. Così sembra che il serpente si muova.
//
// Il codice è diviso in due parti che lavorano insieme:
// - la LOGICA (funzione passoDiGioco): sposta il serpente di una cella
//   alla volta, a intervalli regolari, e controlla cibo e collisioni;
// - il DISEGNO (funzione disegna): ridisegna lo schermo circa 60 volte
//   al secondo. Tra un passo e l'altro fa scivolare il serpente
//   dolcemente da una cella alla successiva, così il movimento è fluido.
// =====================================================================


// ---------- 1. Impostazioni del gioco ----------

// Quante celle ci sono per lato (la griglia è quadrata: 20 x 20)
const CELLE_PER_LATO = 20;

// Velocità del serpente: è il tempo in millisecondi tra un passo e l'altro,
// quindi un numero più BASSO vuol dire un serpente più VELOCE.
const VELOCITA_INIZIALE_MS = 120; // all'inizio della partita
const VELOCITA_MASSIMA_MS = 60;   // il serpente non andrà mai più veloce di così
const ACCELERAZIONE_MS = 8;       // di quanto si accorcia il tempo a ogni accelerazione
const MELE_PER_ACCELERARE = 5;    // ogni quante mele mangiate il serpente accelera

// Grandezza del campo di gioco in pixel
const DIMENSIONE_CAMPO = 400;

// Nome con cui il record viene salvato nella memoria del browser
const CHIAVE_RECORD = "snake-record";

// Colori usati per disegnare
const COLORE_CASELLA_CHIARA = "#1f3a2a";
const COLORE_CASELLA_SCURA = "#1a3324";
const COLORE_CIBO = "#ff4d4d";
const COLORE_FOGLIA = "#5fd36a";
const COLORE_PICCIOLO = "#7a4a2a";

// Il serpente ha una sfumatura: verde chiaro sulla testa, verde scuro sulla coda.
// I colori sono scritti come [rosso, verde, blu], ognuno da 0 a 255.
const COLORE_TESTA = [198, 243, 107];
const COLORE_CODA = [31, 140, 80];


// ---------- 2. Elementi della pagina ----------

// Prendiamo dalla pagina HTML gli elementi che ci servono, usando il loro id
const tela = document.getElementById("tela");
const pennello = tela.getContext("2d"); // lo strumento per disegnare sulla tela
const testoPunteggio = document.getElementById("punteggio");
const testoRecord = document.getElementById("record");
const scrittaNuovoRecord = document.getElementById("nuovo-record");
const riquadroMessaggio = document.getElementById("messaggio");
const testoMessaggio = document.getElementById("testo-messaggio");
const pulsanteRicomincia = document.getElementById("pulsante-ricomincia");

// Grandezza di una cella in pixel (400 pixel / 20 celle = 20 pixel)
const LATO_CELLA = DIMENSIONE_CAMPO / CELLE_PER_LATO;

// Gli schermi moderni hanno più pixel "veri" per ogni pixel della pagina.
// Rendiamo la tela più grande in proporzione, così il disegno è nitido
// e non sfocato. "setTransform" fa in modo che noi possiamo continuare
// a ragionare come se la tela fosse di 400 x 400.
const DENSITA_PIXEL = window.devicePixelRatio || 1;
tela.width = DIMENSIONE_CAMPO * DENSITA_PIXEL;
tela.height = DIMENSIONE_CAMPO * DENSITA_PIXEL;
pennello.setTransform(DENSITA_PIXEL, 0, 0, DENSITA_PIXEL, 0, 0);


// ---------- 3. Stato del gioco ----------
// Queste variabili cambiano mentre si gioca.

let serpente;            // lista di celle {x, y}; la prima è la testa
let serpentePrecedente;  // com'era il serpente al passo prima (serve per l'animazione)
let direzione;           // direzione attuale del movimento, es. {x: 1, y: 0} = destra
let prossimeDirezioni;   // tasti premuti in attesa di essere usati (vedi sotto)
let cibo;                // cella {x, y} dove si trova il cibo
let punteggio;           // quanti pezzi di cibo sono stati mangiati
let partitaFinita;       // true quando la partita è terminata
let timerGioco;          // il "cronometro" che fa avanzare il gioco a ogni passo
let istanteUltimoPasso;  // quando è avvenuto l'ultimo passo (in millisecondi)
let particelle = [];     // scintille che volano via quando il serpente mangia
let scossaFinoA = 0;     // fino a quando il campo deve tremare (dopo un game over)
let tempoPasso;          // millisecondi tra un passo e l'altro (scende quando il serpente accelera)
let scrittaVelocitaFinoA = 0; // fino a quando mostrare la scritta "Più veloce!"
let record = leggiRecord(); // il punteggio migliore di sempre
let recordBattuto;       // true se in questa partita il record è stato superato
let istanteFinePartita = 0; // quando è finita l'ultima partita (in millisecondi)


// ---------- 3b. Salvataggio del record ----------
// Il browser ha una piccola memoria, "localStorage", che resta anche dopo
// averlo chiuso. Ci salviamo il record come testo, con il nome CHIAVE_RECORD.
// Usiamo "try ... catch" perché in alcuni casi (per esempio navigazione
// in incognito con certe impostazioni) il browser non permette di usarla:
// in quel caso il gioco funziona lo stesso, solo che il record non resta.

// Legge il record salvato; se non c'è (o non si può leggere) restituisce 0
function leggiRecord() {
  try {
    const valoreSalvato = localStorage.getItem(CHIAVE_RECORD);
    const numero = parseInt(valoreSalvato, 10); // trasforma il testo in numero
    return isNaN(numero) ? 0 : numero;          // isNaN = "non è un numero"
  } catch (errore) {
    return 0;
  }
}

// Salva il record nella memoria del browser
function salvaRecord() {
  try {
    localStorage.setItem(CHIAVE_RECORD, String(record));
  } catch (errore) {
    // Non si può salvare: pazienza, il record resta valido fino alla chiusura
  }
}


// ---------- 4. Avvio e riavvio della partita ----------

// Prepara tutto per una partita nuova
function iniziaPartita() {
  // Il serpente parte con 3 celle al centro, rivolto verso destra
  const centro = Math.floor(CELLE_PER_LATO / 2);
  serpente = [
    { x: centro, y: centro },     // testa
    { x: centro - 1, y: centro },
    { x: centro - 2, y: centro }  // coda
  ];
  serpentePrecedente = copiaSerpente(serpente);

  direzione = { x: 1, y: 0 }; // verso destra
  prossimeDirezioni = [];
  punteggio = 0;
  partitaFinita = false;
  particelle = [];
  scossaFinoA = 0;
  scrittaVelocitaFinoA = 0;
  recordBattuto = false;
  tempoPasso = VELOCITA_INIZIALE_MS; // ogni partita riparte alla velocità iniziale
  istanteUltimoPasso = performance.now();

  aggiornaPunteggio();
  posizionaCibo();
  riquadroMessaggio.classList.add("nascosto");

  avviaCronometro();
}

// Avvia il cronometro che chiama la funzione "passoDiGioco" ogni "tempoPasso"
// millisecondi. Se c'era già un cronometro attivo lo fermiamo prima:
// serve sia a inizio partita sia quando il serpente accelera.
function avviaCronometro() {
  clearInterval(timerGioco);
  timerGioco = setInterval(passoDiGioco, tempoPasso);
}

// Ogni MELE_PER_ACCELERARE mele il serpente diventa un po' più veloce.
// L'operatore % dà il resto della divisione: "punteggio % 5 === 0" è vero
// quando il punteggio è 5, 10, 15, 20...
function controllaAccelerazione() {
  if (punteggio % MELE_PER_ACCELERARE !== 0 || tempoPasso <= VELOCITA_MASSIMA_MS) {
    return; // non è il momento di accelerare, oppure siamo già al massimo
  }

  // Math.max impedisce di scendere sotto la velocità massima
  tempoPasso = Math.max(VELOCITA_MASSIMA_MS, tempoPasso - ACCELERAZIONE_MS);
  avviaCronometro(); // ripartiamo con il nuovo tempo tra un passo e l'altro

  // Mostriamo la scritta "Più veloce!" per un secondo
  scrittaVelocitaFinoA = performance.now() + 1000;
}

// Crea una copia del serpente (una lista nuova con celle nuove).
// Serve perché altrimenti modificando l'originale cambierebbe anche la "copia".
function copiaSerpente(lista) {
  return lista.map(function (pezzo) {
    return { x: pezzo.x, y: pezzo.y };
  });
}


// ---------- 5. Il cibo ----------

// Mette il cibo in una cella casuale che non sia occupata dal serpente
function posizionaCibo() {
  // Prima raccogliamo tutte le celle libere...
  const celleLibere = [];
  for (let x = 0; x < CELLE_PER_LATO; x++) {
    for (let y = 0; y < CELLE_PER_LATO; y++) {
      if (!occupataDalSerpente(x, y)) {
        celleLibere.push({ x: x, y: y });
      }
    }
  }

  // ...se non ce n'è nessuna, il serpente ha riempito tutto il campo!
  if (celleLibere.length === 0) {
    cibo = null;
    return;
  }

  // ...poi ne scegliamo una a caso
  const indiceCasuale = Math.floor(Math.random() * celleLibere.length);
  cibo = celleLibere[indiceCasuale];
}

// Restituisce true se la cella (x, y) fa parte del serpente
function occupataDalSerpente(x, y) {
  return serpente.some(function (pezzo) {
    return pezzo.x === x && pezzo.y === y;
  });
}


// ---------- 6. Un passo del gioco ----------

// Questa funzione viene chiamata dal cronometro a ogni passo
function passoDiGioco() {
  // Ci ricordiamo com'era il serpente prima di muoverlo:
  // il disegno lo farà scivolare dalla posizione vecchia a quella nuova
  serpentePrecedente = copiaSerpente(serpente);
  istanteUltimoPasso = performance.now();

  // Se il giocatore ha premuto una freccia, usiamo la prima in attesa
  if (prossimeDirezioni.length > 0) {
    direzione = prossimeDirezioni.shift();
  }

  // Calcoliamo dove andrà la testa
  const testa = serpente[0];
  const nuovaTesta = { x: testa.x + direzione.x, y: testa.y + direzione.y };

  // Controllo 1: la testa è uscita dal campo (ha toccato un bordo)?
  const fuoriDalCampo =
    nuovaTesta.x < 0 || nuovaTesta.x >= CELLE_PER_LATO ||
    nuovaTesta.y < 0 || nuovaTesta.y >= CELLE_PER_LATO;

  // Il serpente mangia se la nuova testa finisce sopra il cibo
  const staMangiando = cibo !== null &&
    nuovaTesta.x === cibo.x && nuovaTesta.y === cibo.y;

  // Controllo 2: la testa tocca il corpo?
  // Nota: se il serpente NON mangia, la coda si sposta in questo stesso passo,
  // quindi la cella della coda non conta (la testa può "inseguire" la coda).
  const corpoDaControllare = staMangiando ? serpente : serpente.slice(0, -1);
  const toccaSeStesso = corpoDaControllare.some(function (pezzo) {
    return pezzo.x === nuovaTesta.x && pezzo.y === nuovaTesta.y;
  });

  if (fuoriDalCampo || toccaSeStesso) {
    finePartita("Game over!", false);
    return;
  }

  // Aggiungiamo la nuova testa all'inizio della lista
  serpente.unshift(nuovaTesta);

  if (staMangiando) {
    // Ha mangiato: NON togliamo la coda, così il serpente si allunga di 1
    punteggio++;
    aggiornaPunteggio();
    creaParticelle(cibo.x, cibo.y);
    posizionaCibo();
    controllaAccelerazione();

    // Se non c'è più spazio per il cibo, il giocatore ha vinto
    if (cibo === null) {
      finePartita("Hai vinto!", true);
      return;
    }
  } else {
    // Non ha mangiato: togliamo l'ultima cella, così la lunghezza resta uguale
    serpente.pop();
  }
}

// Ferma il gioco e mostra il messaggio finale.
// "haVinto" decide il colore del messaggio (verde se vinci, rosso se perdi).
function finePartita(testo, haVinto) {
  partitaFinita = true;
  istanteFinePartita = performance.now();
  clearInterval(timerGioco);
  testoMessaggio.textContent = testo;
  testoMessaggio.classList.toggle("vittoria", haVinto);
  // Mostriamo "Nuovo record!" solo se il record è stato battuto in questa partita
  scrittaNuovoRecord.classList.toggle("nascosto", !recordBattuto);
  riquadroMessaggio.classList.remove("nascosto");

  // Se ha perso, facciamo tremare il campo per un terzo di secondo
  if (!haVinto) {
    scossaFinoA = performance.now() + 300;
  }
}

// Scrive il punteggio aggiornato nella pagina e lo fa "saltare".
// Se il punteggio supera il record, aggiorna e salva anche il record.
function aggiornaPunteggio() {
  testoPunteggio.textContent = punteggio;
  if (punteggio > 0) {
    faiSaltare(testoPunteggio);
  }

  if (punteggio > record) {
    record = punteggio;
    recordBattuto = true;
    // Salviamo subito, così il record resta anche se si chiude il browser a metà partita
    salvaRecord();
    faiSaltare(testoRecord);
  }
  testoRecord.textContent = record;
}

// Fa partire l'animazione "salto" (definita nel CSS) su un elemento della pagina.
// Per farla ripartire ogni volta togliamo la classe, chiediamo al browser di
// ricalcolare la pagina (leggendo offsetWidth) e poi la rimettiamo.
function faiSaltare(elemento) {
  elemento.classList.remove("salto");
  void elemento.offsetWidth;
  elemento.classList.add("salto");
}


// ---------- 7. Le scintille ----------

// Crea un piccolo scoppio di scintille al centro della cella (x, y)
function creaParticelle(x, y) {
  const centroX = x * LATO_CELLA + LATO_CELLA / 2;
  const centroY = y * LATO_CELLA + LATO_CELLA / 2;

  for (let i = 0; i < 14; i++) {
    // Ogni scintilla parte in una direzione casuale con una velocità casuale
    const angolo = Math.random() * Math.PI * 2;
    const velocita = 40 + Math.random() * 80; // pixel al secondo
    particelle.push({
      x: centroX,
      y: centroY,
      vx: Math.cos(angolo) * velocita,
      vy: Math.sin(angolo) * velocita,
      vita: 1, // parte da 1 e scende fino a 0, poi la scintilla sparisce
      colore: Math.random() < 0.5 ? COLORE_CIBO : "#ffd166"
    });
  }
}

// Sposta le scintille e le fa svanire piano piano.
// "secondi" è il tempo passato dall'ultimo disegno.
function aggiornaParticelle(secondi) {
  particelle.forEach(function (p) {
    p.x += p.vx * secondi;
    p.y += p.vy * secondi;
    p.vx *= 0.92; // rallentano un po' a ogni fotogramma
    p.vy *= 0.92;
    p.vita -= secondi * 2; // in mezzo secondo spariscono
  });

  // Teniamo solo le scintille ancora "vive"
  particelle = particelle.filter(function (p) {
    return p.vita > 0;
  });
}


// ---------- 8. Disegno ----------

// Ridisegna tutto da capo. "istante" è l'ora attuale in millisecondi.
function disegna(istante) {
  pennello.save(); // salviamo le impostazioni del pennello per ripristinarle alla fine

  // Se il campo deve tremare, lo spostiamo un pochino a caso
  if (istante < scossaFinoA) {
    const forza = (scossaFinoA - istante) / 300 * 5; // il tremolio si calma piano piano
    pennello.translate((Math.random() - 0.5) * forza, (Math.random() - 0.5) * forza);
  }

  disegnaCampo();
  disegnaCibo(istante);
  disegnaSerpente(istante);
  disegnaParticelle();
  disegnaScrittaVelocita(istante);

  pennello.restore();
}

// Quando il serpente accelera, compare in alto la scritta "Più veloce!"
// che sale un pochino e svanisce nel giro di un secondo
function disegnaScrittaVelocita(istante) {
  if (istante >= scrittaVelocitaFinoA) {
    return;
  }

  // "rimasto" va da 1 (appena comparsa) a 0 (sta per sparire)
  const rimasto = (scrittaVelocitaFinoA - istante) / 1000;

  pennello.save();
  pennello.globalAlpha = Math.min(1, rimasto * 2); // nell'ultimo mezzo secondo svanisce
  pennello.font = "bold 26px 'Segoe UI', Arial, sans-serif";
  pennello.textAlign = "center";
  pennello.fillStyle = "#ffd166";
  pennello.shadowColor = "rgba(0, 0, 0, 0.6)";
  pennello.shadowBlur = 6;
  // La scritta parte a 70 pixel dall'alto e sale di 20 pixel mentre svanisce
  pennello.fillText("Più veloce!", DIMENSIONE_CAMPO / 2, 50 + rimasto * 20);
  pennello.restore();
}

// Il campo è una scacchiera di caselle verdi chiare e scure
function disegnaCampo() {
  for (let x = 0; x < CELLE_PER_LATO; x++) {
    for (let y = 0; y < CELLE_PER_LATO; y++) {
      // (x + y) pari o dispari: così le caselle si alternano come in una scacchiera
      pennello.fillStyle = (x + y) % 2 === 0 ? COLORE_CASELLA_CHIARA : COLORE_CASELLA_SCURA;
      pennello.fillRect(x * LATO_CELLA, y * LATO_CELLA, LATO_CELLA, LATO_CELLA);
    }
  }
}

// Il cibo è una mela rossa che "pulsa" e brilla
function disegnaCibo(istante) {
  if (cibo === null) {
    return;
  }

  const centroX = cibo.x * LATO_CELLA + LATO_CELLA / 2;
  const centroY = cibo.y * LATO_CELLA + LATO_CELLA / 2 + 1;

  // Math.sin va su e giù tra -1 e 1 col passare del tempo: la mela si gonfia e sgonfia
  const pulsazione = 1 + Math.sin(istante / 180) * 0.08;
  const raggio = (LATO_CELLA / 2 - 3) * pulsazione;

  // Corpo della mela, con un alone luminoso intorno ("shadowBlur")
  pennello.save();
  pennello.shadowColor = COLORE_CIBO;
  pennello.shadowBlur = 14;
  pennello.fillStyle = COLORE_CIBO;
  pennello.beginPath();
  pennello.arc(centroX, centroY, raggio, 0, Math.PI * 2);
  pennello.fill();
  pennello.restore();

  // Riflesso bianco in alto a sinistra: fa sembrare la mela lucida
  pennello.fillStyle = "rgba(255, 255, 255, 0.55)";
  pennello.beginPath();
  pennello.arc(centroX - raggio * 0.35, centroY - raggio * 0.35, raggio * 0.25, 0, Math.PI * 2);
  pennello.fill();

  // Picciolo (il gambo marrone)
  pennello.strokeStyle = COLORE_PICCIOLO;
  pennello.lineWidth = 2;
  pennello.lineCap = "round";
  pennello.beginPath();
  pennello.moveTo(centroX, centroY - raggio);
  pennello.lineTo(centroX + 1, centroY - raggio - 4);
  pennello.stroke();

  // Fogliolina verde (un'ellisse inclinata)
  pennello.fillStyle = COLORE_FOGLIA;
  pennello.beginPath();
  pennello.ellipse(centroX + 4, centroY - raggio - 3, 3.5, 1.8, -0.5, 0, Math.PI * 2);
  pennello.fill();
}

// Il serpente è disegnato come un tubo arrotondato con una sfumatura di colore
function disegnaSerpente(istante) {
  // "frazione" dice a che punto siamo tra un passo e il successivo:
  // 0 = appena fatto il passo, 1 = è ora del passo seguente.
  let frazione = (istante - istanteUltimoPasso) / tempoPasso;
  if (partitaFinita || frazione > 1) {
    frazione = 1;
  }

  // Calcoliamo il centro di ogni pezzo, a metà strada tra la posizione
  // vecchia e quella nuova (in base alla frazione)
  const punti = serpente.map(function (pezzo, indice) {
    // Se il serpente si è appena allungato, il pezzo nuovo in coda non
    // aveva una posizione vecchia: usiamo quella dell'ultimo pezzo
    const indicePrima = Math.min(indice, serpentePrecedente.length - 1);
    const prima = serpentePrecedente[indicePrima];
    return {
      x: (prima.x + (pezzo.x - prima.x) * frazione) * LATO_CELLA + LATO_CELLA / 2,
      y: (prima.y + (pezzo.y - prima.y) * frazione) * LATO_CELLA + LATO_CELLA / 2
    };
  });

  const quantiPezzi = punti.length;
  pennello.lineCap = "round";  // estremità delle linee arrotondate
  pennello.lineJoin = "round";

  // Disegniamo dalla coda verso la testa, così la testa resta sopra a tutto.
  // Ogni tratto unisce un pezzo al successivo; la coda è più sottile e più scura.
  for (let i = quantiPezzi - 1; i > 0; i--) {
    const t = i / Math.max(1, quantiPezzi - 1); // 0 sulla testa, 1 sulla coda
    pennello.strokeStyle = mescolaColori(COLORE_TESTA, COLORE_CODA, t);
    pennello.lineWidth = LATO_CELLA * (0.85 - 0.3 * t);
    pennello.beginPath();
    pennello.moveTo(punti[i].x, punti[i].y);
    pennello.lineTo(punti[i - 1].x, punti[i - 1].y);
    pennello.stroke();
  }

  // La testa: un cerchio un po' più grande, con un alone verde
  const testa = punti[0];
  pennello.save();
  pennello.shadowColor = "rgba(198, 243, 107, 0.7)";
  pennello.shadowBlur = 12;
  pennello.fillStyle = mescolaColori(COLORE_TESTA, COLORE_CODA, 0);
  pennello.beginPath();
  pennello.arc(testa.x, testa.y, LATO_CELLA * 0.5, 0, Math.PI * 2);
  pennello.fill();
  pennello.restore();

  disegnaOcchi(testa);
}

// Due occhi sulla testa, rivolti nella direzione in cui va il serpente
function disegnaOcchi(testa) {
  // "laterale" è la direzione perpendicolare a quella di marcia:
  // ci serve per mettere un occhio a destra e uno a sinistra
  const lateraleX = -direzione.y;
  const lateraleY = direzione.x;

  [-1, 1].forEach(function (lato) {
    const occhioX = testa.x + direzione.x * LATO_CELLA * 0.15 + lateraleX * LATO_CELLA * 0.22 * lato;
    const occhioY = testa.y + direzione.y * LATO_CELLA * 0.15 + lateraleY * LATO_CELLA * 0.22 * lato;

    // Parte bianca dell'occhio
    pennello.fillStyle = "#ffffff";
    pennello.beginPath();
    pennello.arc(occhioX, occhioY, LATO_CELLA * 0.15, 0, Math.PI * 2);
    pennello.fill();

    if (partitaFinita && cibo !== null) {
      // Game over: al posto della pupilla disegniamo una piccola "x"
      const d = LATO_CELLA * 0.08;
      pennello.strokeStyle = "#1a1a1a";
      pennello.lineWidth = 1.5;
      pennello.beginPath();
      pennello.moveTo(occhioX - d, occhioY - d);
      pennello.lineTo(occhioX + d, occhioY + d);
      pennello.moveTo(occhioX + d, occhioY - d);
      pennello.lineTo(occhioX - d, occhioY + d);
      pennello.stroke();
    } else {
      // Pupilla nera, spostata un po' in avanti: il serpente "guarda" dove va
      pennello.fillStyle = "#1a1a1a";
      pennello.beginPath();
      pennello.arc(
        occhioX + direzione.x * LATO_CELLA * 0.05,
        occhioY + direzione.y * LATO_CELLA * 0.05,
        LATO_CELLA * 0.075, 0, Math.PI * 2
      );
      pennello.fill();
    }
  });
}

// Disegna le scintille: più sono "vecchie", più sono piccole e trasparenti
function disegnaParticelle() {
  particelle.forEach(function (p) {
    pennello.globalAlpha = p.vita;
    pennello.fillStyle = p.colore;
    pennello.beginPath();
    pennello.arc(p.x, p.y, 2.5 * p.vita + 0.5, 0, Math.PI * 2);
    pennello.fill();
  });
  pennello.globalAlpha = 1; // torniamo alla piena opacità
}

// Mescola due colori [r, g, b]: con t = 0 dà il primo, con t = 1 il secondo,
// con t = 0.5 un colore a metà strada. Restituisce un testo tipo "rgb(10, 20, 30)".
function mescolaColori(coloreA, coloreB, t) {
  const r = Math.round(coloreA[0] + (coloreB[0] - coloreA[0]) * t);
  const g = Math.round(coloreA[1] + (coloreB[1] - coloreA[1]) * t);
  const b = Math.round(coloreA[2] + (coloreB[2] - coloreA[2]) * t);
  return "rgb(" + r + ", " + g + ", " + b + ")";
}


// ---------- 9. Il ciclo di disegno ----------

// "requestAnimationFrame" chiede al browser di chiamare una funzione al
// prossimo aggiornamento dello schermo (di solito 60 volte al secondo).
// La funzione "ciclo" si richiama da sola, così il disegno non si ferma mai.
let istantePrecedente = performance.now();

function ciclo(istante) {
  // Quanti secondi sono passati dall'ultimo disegno (al massimo 0.1,
  // così se la scheda resta in secondo piano le scintille non "saltano")
  const secondi = Math.min(0.1, (istante - istantePrecedente) / 1000);
  istantePrecedente = istante;

  aggiornaParticelle(secondi);
  disegna(istante);

  requestAnimationFrame(ciclo);
}


// ---------- 10. Comandi: tastiera, dito e pulsanti ----------

// Le quattro direzioni possibili, con un nome ciascuna.
// x e y dicono di quante celle si sposta la testa a ogni passo
// (attenzione: la y cresce andando verso il BASSO).
const DIREZIONI = {
  su:       { x: 0,  y: -1 },
  giu:      { x: 0,  y: 1 },
  sinistra: { x: -1, y: 0 },
  destra:   { x: 1,  y: 0 }
};

// Collega ogni freccia della tastiera a una direzione
const DIREZIONI_TASTI = {
  ArrowUp:    DIREZIONI.su,
  ArrowDown:  DIREZIONI.giu,
  ArrowLeft:  DIREZIONI.sinistra,
  ArrowRight: DIREZIONI.destra
};

// Chiede al serpente di girare. La usano tutti i comandi (tastiera, swipe,
// pulsanti), così le regole sono le stesse qualunque modo si usi per giocare.
function cambiaDirezione(nuovaDirezione) {
  if (partitaFinita) {
    return;
  }

  // Confrontiamo con l'ultima direzione "prenotata" (o quella attuale).
  // Usiamo una piccola coda di attesa: se il giocatore dà due comandi
  // molto in fretta, nello stesso passo, nessuno dei due va perso.
  const ultimaDirezione = prossimeDirezioni.length > 0
    ? prossimeDirezioni[prossimeDirezioni.length - 1]
    : direzione;

  // Il serpente non può fare inversione a U (andrebbe addosso a se stesso)
  const eInversione =
    nuovaDirezione.x === -ultimaDirezione.x &&
    nuovaDirezione.y === -ultimaDirezione.y;
  // Chiedere di nuovo la stessa direzione non serve a niente
  const eUguale =
    nuovaDirezione.x === ultimaDirezione.x &&
    nuovaDirezione.y === ultimaDirezione.y;

  // Teniamo al massimo 2 direzioni in attesa
  if (!eInversione && !eUguale && prossimeDirezioni.length < 2) {
    prossimeDirezioni.push(nuovaDirezione);
  }
}

// --- Tastiera ---
document.addEventListener("keydown", function (evento) {
  // Spazio: ricomincia, ma solo a partita finita
  if (evento.code === "Space") {
    evento.preventDefault(); // evita che la pagina scorra
    if (partitaFinita) {
      iniziaPartita();
    }
    return;
  }

  const nuovaDirezione = DIREZIONI_TASTI[evento.key];
  if (!nuovaDirezione) {
    return; // non è una freccia: ignoriamo il tasto
  }
  evento.preventDefault(); // evita che le frecce facciano scorrere la pagina
  cambiaDirezione(nuovaDirezione);
});

// --- Swipe (scorrere il dito sul campo) ---

// Di quanti pixel deve muoversi il dito perché conti come uno swipe:
// così un tocco appena tremolante non cambia direzione per sbaglio
const SOGLIA_SWIPE = 25;

const areaGioco = document.getElementById("area-gioco");
let inizioTocco = null; // dove si trovava il dito all'inizio (o all'ultimo cambio)

// Il dito tocca il campo: ci segniamo il punto di partenza
areaGioco.addEventListener("touchstart", function (evento) {
  const dito = evento.touches[0];
  inizioTocco = { x: dito.clientX, y: dito.clientY };
}, { passive: true });

// Il dito si muove: appena ha percorso abbastanza strada, cambiamo direzione
// subito, senza aspettare che venga staccato dallo schermo
areaGioco.addEventListener("touchmove", function (evento) {
  // Impedisce al browser di scorrere la pagina o ricaricarla mentre giochi.
  // ("passive: false" qui sotto serve proprio a permettere preventDefault)
  evento.preventDefault();
  if (inizioTocco === null) {
    return;
  }

  const dito = evento.touches[0];
  const spostamentoX = dito.clientX - inizioTocco.x;
  const spostamentoY = dito.clientY - inizioTocco.y;

  // Math.abs toglie il segno: ci interessa solo QUANTO si è mosso il dito
  if (Math.max(Math.abs(spostamentoX), Math.abs(spostamentoY)) < SOGLIA_SWIPE) {
    return; // movimento troppo piccolo: aspettiamo
  }

  // Vince il verso in cui il dito si è mosso di più
  if (Math.abs(spostamentoX) > Math.abs(spostamentoY)) {
    cambiaDirezione(spostamentoX > 0 ? DIREZIONI.destra : DIREZIONI.sinistra);
  } else {
    cambiaDirezione(spostamentoY > 0 ? DIREZIONI.giu : DIREZIONI.su);
  }

  // Ripartiamo da qui: così si può fare una "L" senza staccare il dito
  inizioTocco = { x: dito.clientX, y: dito.clientY };
}, { passive: false });

// Il dito si stacca (o il tocco viene interrotto): dimentichiamo il punto di partenza
areaGioco.addEventListener("touchend", function () {
  inizioTocco = null;
});
areaGioco.addEventListener("touchcancel", function () {
  inizioTocco = null;
});

// --- Pulsanti freccia ---
// Usiamo "pointerdown" (il dito appena tocca il pulsante) invece di "click"
// (che arriva solo quando il dito si stacca): così il serpente gira subito.
document.querySelectorAll(".freccia").forEach(function (pulsante) {
  pulsante.addEventListener("pointerdown", function (evento) {
    evento.preventDefault();
    // pulsante.dataset.direzione legge l'attributo data-direzione dell'HTML
    cambiaDirezione(DIREZIONI[pulsante.dataset.direzione]);
  });
});

// --- Ricominciare ---

// Toccare (o cliccare) il riquadro di fine partita fa ricominciare.
// Aspettiamo però mezzo secondo dalla fine: se il giocatore stava toccando
// lo schermo proprio mentre ha perso, non vogliamo ripartire per sbaglio.
riquadroMessaggio.addEventListener("click", function () {
  if (partitaFinita && performance.now() - istanteFinePartita > 500) {
    iniziaPartita();
  }
});

// Il pulsante "Ricomincia" fa partire una nuova partita in qualsiasi momento
pulsanteRicomincia.addEventListener("click", function () {
  iniziaPartita();
  // Togliamo il "focus" dal pulsante: altrimenti premere Spazio
  // lo "cliccherebbe" di nuovo durante la partita
  pulsanteRicomincia.blur();
});


// ---------- 11. Si parte! ----------
iniziaPartita();
requestAnimationFrame(ciclo);
