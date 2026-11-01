// =====================================================================
// Controllo veloce del gioco prima di pubblicarlo.
// Si avvia con:  node .claude/skills/pubblica/controlla.js
// Cerca errori "evidenti" in index.html e nei file che collega
// (style.css, script.js), seguendo le regole scritte in CLAUDE.md.
// Alla fine scrive ERRORI (e termina con codice 1) oppure TUTTO OK.
// =====================================================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// La cartella del progetto: tre livelli sopra questo file
// (.claude/skills/pubblica/controlla.js -> cartella del progetto)
const cartella = path.resolve(__dirname, "..", "..", "..");

const errori = [];   // problemi che bloccano la pubblicazione
const avvisi = [];   // cose strane da guardare, ma che non bloccano

function errore(testo) { errori.push(testo); }
function avviso(testo) { avvisi.push(testo); }

// ---------- 1. index.html esiste? ----------
const percorsoHtml = path.join(cartella, "index.html");
if (!fs.existsSync(percorsoHtml)) {
  console.log("ERRORI:\n- index.html non esiste");
  process.exit(1);
}
const html = fs.readFileSync(percorsoHtml, "utf8");

// ---------- 2. Struttura di base della pagina ----------
if (!/^\s*<!DOCTYPE html>/i.test(html)) errore("manca <!DOCTYPE html> all'inizio di index.html");
if (!/<html[^>]*lang="it"/i.test(html)) avviso('il tag <html> non ha lang="it" (i testi del gioco sono in italiano)');
if (!/<meta[^>]*charset="?utf-8"?/i.test(html)) errore("manca <meta charset=\"UTF-8\">: le lettere accentate si vedrebbero male");
if (!/<meta[^>]*name="viewport"/i.test(html)) errore("manca il meta viewport: sul telefono la pagina si vedrebbe minuscola");
if (!/<title>[^<]+<\/title>/i.test(html)) errore("manca il <title> (o è vuoto)");

// ---------- 3. Tag aperti e chiusi ----------
// Togliamo i commenti, poi contiamo aperture e chiusure dei tag principali
const htmlSenzaCommenti = html.replace(/<!--[\s\S]*?-->/g, "");
["html", "head", "body", "main", "div", "p", "button", "span", "script", "kbd", "h1"].forEach(function (tag) {
  const aperti = (htmlSenzaCommenti.match(new RegExp("<" + tag + "(\\s|>)", "gi")) || []).length;
  const chiusi = (htmlSenzaCommenti.match(new RegExp("</" + tag + ">", "gi")) || []).length;
  if (aperti !== chiusi) {
    errore("tag <" + tag + ">: " + aperti + " aperti e " + chiusi + " chiusi");
  }
});

// ---------- 4. File collegati (src e href) ----------
const collegamenti = [];
htmlSenzaCommenti.replace(/\s(?:src|href)="([^"]+)"/gi, function (_, indirizzo) {
  collegamenti.push(indirizzo);
});

const fileScript = [];
collegamenti.forEach(function (indirizzo) {
  // Regola di CLAUDE.md: niente risorse da internet, tutto deve funzionare offline
  if (/^(https?:)?\/\//i.test(indirizzo)) {
    errore("index.html carica una risorsa da internet (" + indirizzo + "): il gioco deve funzionare offline");
    return;
  }
  const percorso = path.join(cartella, indirizzo);
  if (!fs.existsSync(percorso)) {
    errore("index.html collega \"" + indirizzo + "\", ma il file non esiste");
  } else if (indirizzo.endsWith(".js")) {
    fileScript.push(indirizzo);
  }
});

// Regola di CLAUDE.md: niente moduli ES, non funzionano aprendo il file con doppio clic
if (/<script[^>]*type="module"/i.test(htmlSenzaCommenti)) {
  errore('c\'è uno <script type="module">: con il doppio clic su index.html non funzionerebbe');
}

// ---------- 5. id duplicati ----------
const idTrovati = {};
htmlSenzaCommenti.replace(/\sid="([^"]+)"/gi, function (_, id) {
  idTrovati[id] = (idTrovati[id] || 0) + 1;
});
Object.keys(idTrovati).forEach(function (id) {
  if (idTrovati[id] > 1) errore("l'id \"" + id + "\" è usato " + idTrovati[id] + " volte (deve essere unico)");
});

// ---------- 6. Gli script ----------
fileScript.forEach(function (nome) {
  const codice = fs.readFileSync(path.join(cartella, nome), "utf8");

  // Errori di scrittura nel codice (parentesi mancanti, virgole, ecc.)
  try {
    new vm.Script(codice, { filename: nome });
  } catch (e) {
    errore(nome + " ha un errore di sintassi: " + e.message);
    return;
  }

  // Ogni getElementById("...") deve trovare un elemento con quell'id nella pagina
  codice.replace(/getElementById\(\s*["']([^"']+)["']\s*\)/g, function (_, id) {
    if (!idTrovati[id]) errore(nome + " cerca l'elemento con id \"" + id + "\", che non esiste in index.html");
  });

  // Regole di CLAUDE.md: niente librerie esterne e niente fetch di file
  if (/\bfetch\s*\(/.test(codice)) avviso(nome + " usa fetch(): aprendo il file con doppio clic potrebbe non funzionare");
  if (/^\s*import\s/m.test(codice)) errore(nome + " usa import: con il doppio clic su index.html non funzionerebbe");
  if (/https?:\/\//.test(codice.replace(/\/\/.*$/gm, ""))) avviso(nome + " contiene un indirizzo internet: controlla che il gioco funzioni offline");
});

// ---------- 7. Risultato ----------
if (avvisi.length > 0) {
  console.log("AVVISI (non bloccano):");
  avvisi.forEach(function (a) { console.log("- " + a); });
}
if (errori.length > 0) {
  console.log("ERRORI:");
  errori.forEach(function (e) { console.log("- " + e); });
  process.exit(1);
}
console.log("TUTTO OK: index.html e i file collegati (" + collegamenti.join(", ") + ") non hanno errori evidenti");
