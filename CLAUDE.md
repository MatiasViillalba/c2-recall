# C2 Recall — instructions for Claude Code

Personal Anki-style flashcard app (React + Vite PWA, IndexedDB, optional Supabase sync, FSRS via `ts-fsrs`)
for Matías's Cambridge C2 Proficiency preparation. Published on GitHub Pages:
https://matiasviillalba.github.io/c2-recall/ (installed on his iPhone and laptop).

Talk to Matías in Spanish (Rioplatense). Everything inside the app must be in **English**.

## What the app is (keep it this way)

- Two tabs only: **Flashcards** and **Settings**. No library, stats, decks, import screens, audio or extras.
- Each card = one C2 item (chunk, collocation, idiom, phrasal verb, fixed phrase, KWT structure, pattern,
  dependent preposition, word formation) with **one word missing**. Front: the chunk with a gap + a short
  English cue. Back: the full chunk with the word highlighted, the cue and one example sentence.
- Literal Anki flow: tap to flip → Again / Hard / Good / Easy (with interval previews) → FSRS schedules it.
  Learning cards first, then due reviews mixed with new cards up to the daily limit; "Learn 10 more" when done.

## Adding new content (the main recurring task)

Matías will paste or attach material from his classes, coursebook, mock exams or online exercises and ask you
to add it. For each chunk / collocation / idiom / phrasal verb / structure worth remembering:

1. **Check it is not already in the bank.** Search `content/` (and `public/seed/seed.json`) for the key words.
   - If it exists, do not duplicate it. If he got it wrong again, raise its priority on the existing item
     (`miss`/`prio` fields in `content/seed-src/*`, or the `extra` argument of `card()` for new-style items).
2. **Write it in a new file** `content/seed-src/30-YYYY-MM-DD-<source>.mjs` (one file per batch), e.g.:

   ```js
   // Mock 3 (Cambridge C2 Practice Tests, Test 3) — 2026-11-05
   import { deck } from '../lib/flash.mjs';

   const idiom = deck('idiom', ['P1', 'P2']);
   const colloc = deck('collocation', ['P1', 'P2']);
   const pv = deck('phrasal_verb', ['P1', 'P2', 'P4']);
   const structure = deck(['grammar_pattern', 'fixed_phrase'], ['P4']);

   export default [
     idiom('at the eleventh {{hour}}', 'at the last possible moment', 'The deal was saved {{at the eleventh hour}}.', { src: 'Mock 3', miss: 1, prio: 3 }),
     colloc('{{wreak}} havoc on', 'cause great damage to', 'The storm {{wreaked havoc on}} the harvest.'),
   ];
   ```

   Categories available: `idiom`, `phrasal_verb`, `collocation`, `fixed_phrase`, `prepositional_phrase`,
   `grammar_pattern` (+ `inversion`, `cleft`, `conditional`…), `verb_pattern`, `linking`, `vocabulary`,
   `word_formation` (pass the root as `extra`: `wf('make an {{educated}} guess', 'a guess based on some knowledge', '…', { root: 'EDUCATE' })`).
3. **Card rules**
   - Front = the chunk itself in **dictionary form** (`take issue with`, `it's high time + subject + past simple`),
     never a sentence or fragment copied from an exercise (`have the whole room laughing`, `the alarm went off`).
   - Hide exactly one **fixed** word of the chunk with `{{…}}`: the tested word in Open Cloze / KWT, the collocating
     verb/adjective, the particle of a phrasal verb, the fixed word of a structure (`Not {{only}} …, but also …`).
     Never hide a free slot that many words could fill (a verb in `have someone ___ing`, an auxiliary that depends
     on tense, an example noun). The build fails if the hidden word is not part of the chunk (`t`).
   - Leave out things that are not chunks (pure grammar rules, spelling, exam strategies).
   - Cue: short English definition (2–8 words). It must **never contain the missing word** (the build warns).
   - Example: one natural C2 sentence with the whole chunk marked `{{…}}`. British spelling.
   - Correct English only; if you are not sure an item is right, say so instead of adding it.
4. **Build, test, publish** (Matías has authorised you to commit, push and deploy without asking):

   ```bash
   npm run seed      # must end with 0 errores; read new warnings in content/coverage/issues.txt
   npm test          # unit tests
   npm run deploy    # tests + build + publish to gh-pages
   git add -A && git commit -m "Contenido: <fuente>" && git push
   ```

   Reviews and progress are never lost: the seed only adds/updates content, FSRS state comes from review history.
5. Tell Matías (in Spanish) how many cards you added, by category, and that the app will show
   "A new version is available → Update".

## Code map

- `src/pages/Flashcards.tsx` study screen · `src/pages/Settings.tsx` · `src/components/Layout.tsx` tab bar.
- `src/lib/practice.ts` Anki queue + categories · `src/lib/scheduler.ts` FSRS · `src/lib/repo.ts` writes/reviews.
- `content/build-seed.ts` compiles `content/seed-src/*.mjs` (+ `content/flashcards/*.mjs`, which adds the
  flashcard front/cue to the original bank items by id) into `public/seed/seed.json`.
- Styles: `src/index.css` (palette at the top, flashcard styles at the bottom).
- Tests: `npm test` (Vitest) and `npm run test:e2e` (Playwright, desktop + iPhone; `SHOTS_DIR=… ` saves screenshots).
