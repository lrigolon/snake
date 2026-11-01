---
name: pubblica
description: Controlla il gioco, mostra un riepilogo delle modifiche, chiede conferma e poi fa commit e push su GitHub (che aggiorna il sito su GitHub Pages).
disable-model-invocation: true
---

# /pubblica — pubblica il gioco su GitHub

Segui questi passi **in ordine**. Parla sempre in italiano, in modo semplice
(l'utente è un principiante). Se un passo fallisce, fermati e spiega il problema:
non passare mai al commit con errori.

## 1. Controlla che il gioco non abbia errori evidenti

Esegui dalla cartella del progetto:

```
node .claude/skills/pubblica/controlla.js
```

- Se scrive **ERRORI** (codice di uscita 1): mostra gli errori all'utente spiegandoli
  in parole semplici, proponi come correggerli e **fermati qui**. Non fare commit.
- Se scrive **AVVISI**: riportali, ma puoi continuare.
- Se scrive **TUTTO OK**: vai avanti.

## 2. Riepilogo delle modifiche dall'ultimo commit

Esegui:

```
git status --short
git diff HEAD --stat
git diff HEAD
git log origin/master..HEAD --oneline
```

- Se non ci sono modifiche **e** non ci sono commit da caricare: dì che non c'è
  niente da pubblicare e fermati.
- Se ci sono file nuovi non tracciati (`??`), leggili per capire cosa sono.
- Se tra i file da salvare ce n'è qualcuno che non dovrebbe finire su un progetto
  pubblico (password, chiavi, file personali, file temporanei o enormi),
  segnalalo e non includerlo senza il permesso esplicito dell'utente.

Mostra all'utente un riepilogo breve, raggruppato per file, che dica **cosa cambia
nel gioco** (non riga per riga): per esempio "script.js: il serpente accelera ogni 5 mele".
Se ci sono commit già fatti ma non ancora caricati, elencali.

Poi proponi un **messaggio di commit** in italiano: una riga di massimo ~70 caratteri,
che inizi con un verbo all'imperativo (es. "Aggiungi…", "Correggi…", "Cambia…")
e descriva il cambiamento per il giocatore.

## 3. Chiedi conferma

Usa lo strumento AskUserQuestion con la domanda "Pubblico queste modifiche su GitHub?"
e mostra il messaggio di commit proposto. Opzioni:

- **Pubblica**: fai commit e push con il messaggio proposto
- **Annulla**: non fare niente

(L'utente può anche scrivere un messaggio diverso con "Other": in quel caso usa il suo.)

Se l'utente annulla, fermati e conferma che non è stato modificato niente.

## 4. Commit e push

Solo dopo la conferma:

1. Aggiungi i file mostrati nel riepilogo, elencandoli per nome
   (`git add file1 file2 ...`), mai file esclusi al passo 2.
2. Fai il commit con il messaggio confermato, terminato dalla riga di attribuzione:

   ```
   git commit -F - <<'EOF'
   <messaggio confermato>

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   ```

   (Se la conversazione indica una riga di attribuzione diversa, usa quella.)
3. Esegui `git push`.
4. Controlla con `git status -sb` che il ramo sia allineato con `origin/master`.

Alla fine dì all'utente:
- il codice del commit (es. `2ff5069`) e il messaggio;
- che tra 1-2 minuti la nuova versione sarà su **https://lrigolon.github.io/snake/**
  (basta ricaricare la pagina).

Se il push fallisce (per esempio per l'accesso a GitHub), mostra l'errore, spiega
cosa significa e ricorda che il commit è comunque salvato sul computer.
