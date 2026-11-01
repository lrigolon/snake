# Snake

Gioco Snake che gira nel browser.

## Regole del progetto

### Avvio
- Il gioco si avvia aprendo `index.html` con un doppio clic (protocollo `file://`).
- Niente server, niente installazioni, niente passaggi di build.
- Quindi: niente moduli ES (`<script type="module">`), niente `fetch()` di file locali, niente funzioni che richiedono un server: in `file://` il browser li blocca.

### Tecnologie
- Solo HTML, CSS e JavaScript puro (vanilla).
- Nessuna libreria o framework esterno, nessun CDN, nessun font o immagine caricati da internet.
- Tutto deve funzionare offline. Eventuali risorse (immagini, suoni) stanno nella cartella del progetto e si collegano con percorsi relativi.

### Lingua
- Tutti i testi visibili nel gioco (titoli, pulsanti, messaggi, punteggio, istruzioni) sono in italiano.

### Commenti nel codice
- Il codice è commentato in italiano.
- I commenti devono permettere a un principiante di capire cosa fa ogni parte: spiega lo scopo di ogni funzione, delle variabili importanti e dei passaggi non ovvi.
- Preferisci nomi di variabili e funzioni chiari e descrittivi.

### Nuove funzionalità
- Prima di aggiungere una funzione nuova, assicurati che quelle esistenti continuino a funzionare.
- Dopo ogni modifica, verifica che il gioco si avvii ancora con doppio clic su `index.html` e che le funzioni già presenti (movimento, cibo, crescita del serpente, collisioni, punteggio, game over, ecc.) si comportino come prima.
