# C2 Recall

Tu Anki personal para **Cambridge C2 Proficiency**: tarjetas de recuperación activa con repetición espaciada **FSRS**, diseño premium, instalable como app (PWA) en el iPhone y en la notebook, que funciona **sin conexión** y sincroniza entre dispositivos con un plan **gratuito** de Supabase.

- **App:** https://matiasviillalba.github.io/c2-recall/
- **Banco:** ~1.150 flashcards (tus tres PDF + contenido C2 nuevo); ver [informe de cobertura](docs/COVERAGE.md).
- **Costo de mantenimiento:** US$0 (GitHub Pages + Supabase Free, sin tarjeta de crédito).

---

## Qué hace

Flashcards estilo **Anki**, en inglés y sin distracciones. Cada tarjeta es un chunk, collocation, idiom, phrasal verb, fixed phrase, estructura de KWT, patrón, preposición dependiente o word formation **con una palabra faltante** y una pista breve en inglés. Lo pensás, tocás la tarjeta (o **Show answer**) y se da vuelta: el chunk completo con la palabra resaltada y una oración de ejemplo. Después calificás como en Anki: **Again / Hard / Good / Easy**, con el intervalo de cada botón arriba. FSRS (`ts-fsrs`) programa la repetición espaciada.

- **Cola como Anki:** primero lo que está en aprendizaje, después los repasos vencidos mezclados con las nuevas del día (límite configurable). Arriba se ven los contadores (nuevas · aprendiendo · repasos), y hay un botón para deshacer.
- **Al terminar:** «All caught up!» y la opción **Learn 10 more** para seguir con nuevas.
- **Dos pestañas:** Flashcards y Settings (tema, nuevas por día, retención, sincronización, copia de seguridad).
- **Banco:** ~1.150 flashcards. Las ~670 de tus PDF más ~480 nuevas de nivel C2: idioms, collocations, phrasal verbs, fixed phrases, estructuras de KWT y preposiciones dependientes.

---

## Instalar la app

### iPhone 15 Pro (Safari)
1. Abrí **https://matiasviillalba.github.io/c2-recall/** en **Safari** (no en Chrome: en iOS solo Safari instala PWAs con todas las funciones).
2. Esperá a que cargue el inicio (la primera vez descarga el banco de tarjetas; después funciona sin conexión).
3. Tocá **Compartir** (cuadrado con flecha) → **Agregar a pantalla de inicio** → **Agregar**.
4. Abrila desde el ícono: se abre a pantalla completa, sin barra de Safari.

### Windows (Edge o Chrome)
1. Abrí la URL en **Edge** o **Chrome**.
2. En la barra de direcciones tocá el ícono **Instalar** (pantalla con flecha) → **Instalar**. En Edge también: menú `…` → **Aplicaciones** → **Instalar este sitio como aplicación**.
3. Queda en el menú Inicio y podés anclarla a la barra de tareas.

> Las actualizaciones llegan solas: cuando hay una versión nueva, la app muestra «Hay una nueva versión» → **Actualizar**. Tus datos no se tocan.

### Teclado (notebook)
`Espacio`/`Enter` da vuelta la tarjeta (y después = Good) · `1`–`4` califican · `Z` deshace.

---

## Sincronizar notebook e iPhone (gratis) — guía paso a paso

La app funciona completa sin esto (modo local, se indica como «Solo en este dispositivo»). Para tener la misma biblioteca y el mismo progreso en ambos dispositivos:

1. **Crear el proyecto** (sin tarjeta): entrá a https://supabase.com → *Start your project* → registrate con GitHub o email → **New project** → nombre `c2-recall`, contraseña de base de datos (guardala), región *South America (São Paulo)* → **Create new project**. El plan es **Free**: no pide tarjeta y si alguna vez se supera un límite, el servicio se pausa en vez de cobrar.
2. **Crear las tablas**: menú **SQL Editor** → **New query** → pegá todo el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**. Debe decir *Success*.
3. **Autenticación**: menú **Authentication → Sign In / Providers → Email**: dejalo activado. Opcional: desactivá *Confirm email* para no depender del correo (la cuenta es solo tuya).
4. **Copiar las credenciales públicas**: **Project Settings → API Keys** (o *Data API*): copiá la **Project URL** y la clave **publishable / anon**. ⚠️ Nunca copies ni compartas la clave *secret / service_role*.
5. **Conectar la app** — dos opciones:
   - **A (recomendada, se hace una vez):** pasale la URL y la clave publishable a Claude (o ponelas vos en un archivo `.env.local` con las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, ver `.env.example`) y volvé a publicar con `npm run deploy`. Ambos dispositivos quedan configurados automáticamente.
   - **B (por dispositivo):** en la app, **Settings → Sync**, pegá URL y clave → *Save*.
6. **Crear tu cuenta**: en **Settings → Sync** escribí email y contraseña → **Create account** (y confirmá el email si dejaste esa opción). En el otro dispositivo, **Sign in** con los mismos datos.
7. **Cerrar registros nuevos** (recomendado): en Supabase, **Authentication → Sign In / Providers → Allow new users to sign up: off**. Solo vos podés entrar.
8. **Comprobar**: repasá una tarjeta en la notebook → en el iPhone abrí la app (o tocá el ícono de nube) → la tarjeta que repasaste no vuelve a aparecer hasta su próxima fecha.

**Cómo funciona:** cada cambio se guarda primero en el dispositivo (IndexedDB) y se encola. Con conexión, la app sube la cola y baja lo nuevo cada pocos segundos, al volver a la app y al recuperar internet. Los repasos son eventos con id único (enviar dos veces no duplica) y el estado FSRS se recalcula reproduciendo todos los eventos en orden, así que dos dispositivos que estudiaron offline convergen al mismo resultado. Las ediciones usan «la última gana».

**Límites del plan gratuito relevantes:** 500 MB de base (tu banco ocupa < 10 MB), 50.000 usuarios activos/mes, 5 GB de transferencia. Los proyectos gratuitos se **pausan tras 7 días sin actividad**: si te pasa, entrá a supabase.com y tocá *Restore* (gratis). Mientras tanto la app sigue funcionando en local y sincroniza al reactivarlo.

---

## Agregar contenido nuevo (clases, libro, mocks, ejercicios)

Abrí Claude Code en esta carpeta y pasale lo que estudiaste (texto, capturas, PDF, correcciones de un mock): por ejemplo *«agregá los chunks y collocations de este mock; fallé estos tres»*. Claude Code sigue las instrucciones de [`CLAUDE.md`](CLAUDE.md):

1. Revisa que no estén repetidos en el banco.
2. Escribe las flashcards nuevas en `content/seed-src/30-AAAA-MM-DD-<fuente>.mjs`. Lo que fallaste queda con prioridad alta.
3. Compila, prueba, publica y sube los cambios a GitHub.

En el iPhone y la notebook aparece «A new version is available» → **Update**, y las tarjetas nuevas se suman a tu cola sin tocar tu progreso.

---

## Copias de seguridad
**Settings → Backup → Download backup** descarga tarjetas, estados, historial completo y ajustes. **Restore backup** combina la copia con lo que hay (conserva lo más reciente de cada registro y une historiales).

---

## Arquitectura

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4, íconos Lucide, tipografías Fraunces + Inter autoalojadas, animaciones CSS (livianas, respetan *reducir movimiento*), gráficos SVG propios.
- **PWA:** `vite-plugin-pwa` (Workbox): manifest, íconos (incl. maskable y apple-touch), precache de toda la app y del banco → estudio offline completo.
- **Memoria:** `ts-fsrs`. Estado por tarjeta derivado del historial (`src/lib/scheduler.ts`, `replay`).
- **Datos locales:** IndexedDB con Dexie (`src/lib/db.ts`). Tablas: `knowledge`, `cards`, `cardStates` (caché derivada), `reviews` (eventos), `errorLogs`, `decks`, `sources`, `importBatches`, `settings`, `meta`, `outbox`.
- **Sync:** Supabase Postgres + Auth + RLS (`supabase/migrations/0001_init.sql`): `records` (LWW por `updated_at`), `review_events` (append‑only, id único), `import_tokens`, `import_inbox`, RPC `push_records`, `push_reviews`, `submit_import`.
- **Contenido:** `content/seed-src/*.mjs` (fuente legible) → `npm run seed` → `public/seed/seed.json` + `coverage.json` + `docs/COVERAGE.md`. Validación compartida con la app en `src/lib/content/normalize.ts`.

### Modelo de datos (resumen)
- **Knowledge** (conocimiento canónico): expresión, significado ES, pregunta ES, pista, categorías, partes del examen, patrón, ejemplos (EN/ES con marcas `{{ }}`), variantes, respuestas incorrectas originales, notas/regla, confusiones, familia léxica, raíz, etiquetas, fuentes (doc, página, ejercicio), veces visto, veces fallado, prioridad, tipo de error (*error real / alternativa válida / variante de registro / no verificado*), validación, estado, favorito, difícil, fechas.
- **Card**: tipo, pregunta, pista, original/keyword (KWT), raíz/categoría (WF), respuesta, alternativas, explicación, traducción, suspendida, reportada.
- **ReviewEvent**: id, tarjeta, calificación, tipo (*review / cram / external / reset*), fecha, duración, dispositivo, borrado (deshacer).
- **CardState** (derivado): due, stability, difficulty, scheduled days, learning steps, reps, lapses, state.

---

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173/c2-recall/
npm run seed         # recompila el banco y el informe de cobertura
npm test             # 34 pruebas unitarias/integración (FSRS, cola, importación, backup, sync)
npm run build        # seed + typecheck + build
npx playwright install chromium && npm run test:e2e   # 17 pruebas de interfaz (escritorio + iPhone 15 Pro, offline, PWA)
```

### Publicar
`npm run deploy` prueba, compila y publica `dist/` en la rama `gh-pages`, que GitHub Pages sirve en `https://<usuario>.github.io/c2-recall/`. Si preferís despliegue automático con GitHub Actions, copiá `docs/github-actions-deploy.yml` a `.github/workflows/deploy.yml` (requiere un token con permiso `workflow`). Para servir en otra ruta: `BASE_PATH=/ npm run build`.

---

## Privacidad y derechos
- Los PDF originales **no** están en el repositorio (`.gitignore` bloquea `*.pdf`).
- Las oraciones KWT tomadas de la app *Use of English PRO* se adaptaron; las expresiones y explicaciones son tus notas de estudio.
- El repositorio es público porque GitHub Pages gratuito lo requiere; contiene tu banco de tarjetas (no tus credenciales). Tus repasos y ediciones viven en tu dispositivo y, si activás la sincronización, en tu proyecto privado de Supabase protegido por RLS.
