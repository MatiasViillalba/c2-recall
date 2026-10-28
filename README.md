# C2 Recall

Tu Anki personal para **Cambridge C2 Proficiency**: tarjetas de recuperación activa con repetición espaciada **FSRS**, diseño premium, instalable como app (PWA) en el iPhone y en la notebook, que funciona **sin conexión** y sincroniza entre dispositivos con un plan **gratuito** de Supabase.

- **App:** https://matiasviillalba.github.io/c2-recall/
- **Banco inicial:** 641 conocimientos y 1.401 tarjetas extraídos de tus tres PDF (ver [informe de cobertura](docs/COVERAGE.md)).
- **Costo de mantenimiento:** US$0 (GitHub Pages + Supabase Free, sin tarjeta de crédito).

---

## Qué hace

| Área | Detalle |
| --- | --- |
| **Tarjetas** | 8 tipos: recuperación ES→EN, completar (cloze), contraste entre confundibles, Key Word Transformation, Word Formation, patrón gramatical, producción activa (traducir) y corregir el error. El reverso muestra la respuesta destacada, la oración completa, significado, ejemplos con traducción, regla, tus errores típicos, diferencias, familia de palabras, fuente (PDF, página, ejercicio) y audio. |
| **FSRS** | `ts-fsrs` (FSRS‑6). Again/Hard/Good/Easy con vista previa del intervalo, pasos de aprendizaje y reaprendizaje, retención objetivo configurable, límites diarios, tarjetas hermanas enterradas (una por conocimiento y día), detección de difíciles, suspender/reiniciar, deshacer. El estado se **recalcula a partir del historial** (event sourcing): editar el texto nunca toca la programación. |
| **Repaso intensivo** | Errores, difíciles, favoritas o selección libre: se registran aparte y **no alteran FSRS**. |
| **Biblioteca** | Búsqueda, filtros (parte, categoría, fuente, dificultad, estado, errores, favoritas, pendientes, reportadas), orden, detalle con historial, editar, agregar tarjetas, archivar/restaurar, dominado/difícil, fusionar duplicados (conserva tarjetas e historial), «Lo volví a fallar». |
| **Mazos** | Filtros combinables (una tarjeta puede estar en varios mazos sin duplicarse): KWT, Open Cloze, MC, WF, phrasal verbs, idioms, collocations, fixed phrases, grammar, confusing words, errores recurrentes, Masterclass… y los tuyos (p. ej. «Mock Exam 3»). |
| **Estadísticas** | Repasos por día, retención real, recuerdo estimado, racha, estados (nuevas/aprendiendo/jóvenes/maduras/reaprendiendo), pronóstico 30 días, heatmap, progreso por parte y categoría, más difíciles, errores recurrentes, evolución mensual. |
| **Importación** | JSON `c2-recall/v1` o CSV con vista previa: detecta nuevos, existentes y recurrencias; nunca duplica ni reinicia el historial. Bandeja de importación con token (integración directa). |
| **Datos** | IndexedDB local (offline), sincronización opcional con Supabase (RLS), exportación JSON completa y CSV, restauración (combinar o reemplazar). |

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

### Atajos de teclado (estudio)
`Espacio`/`Enter` mostrar respuesta (y luego = Good) · `1`–`4` calificar · `H` pista · `P` audio · `Z` deshacer · `E` editar · `F` favorita · `T` escribir la respuesta · `Esc` salir.

---

## Sincronizar notebook e iPhone (gratis) — guía paso a paso

La app funciona completa sin esto (modo local, se indica como «Solo en este dispositivo»). Para tener la misma biblioteca y el mismo progreso en ambos dispositivos:

1. **Crear el proyecto** (sin tarjeta): entrá a https://supabase.com → *Start your project* → registrate con GitHub o email → **New project** → nombre `c2-recall`, contraseña de base de datos (guardala), región *South America (São Paulo)* → **Create new project**. El plan es **Free**: no pide tarjeta y si alguna vez se supera un límite, el servicio se pausa en vez de cobrar.
2. **Crear las tablas**: menú **SQL Editor** → **New query** → pegá todo el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**. Debe decir *Success*.
3. **Autenticación**: menú **Authentication → Sign In / Providers → Email**: dejalo activado. Opcional: desactivá *Confirm email* para no depender del correo (la cuenta es solo tuya).
4. **Copiar las credenciales públicas**: **Project Settings → API Keys** (o *Data API*): copiá la **Project URL** y la clave **publishable / anon**. ⚠️ Nunca copies ni compartas la clave *secret / service_role*.
5. **Conectar la app** — dos opciones:
   - **A (recomendada, se hace una vez):** pasale la URL y la clave publishable a Claude, o creá en GitHub → repo `c2-recall` → *Settings → Secrets and variables → Actions → Variables* las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y volvé a ejecutar el workflow. Ambos dispositivos quedan configurados automáticamente.
   - **B (por dispositivo):** en la app, **Ajustes → Cuenta y sincronización**, pegá URL y clave → *Guardar configuración*.
6. **Crear tu cuenta**: en **Ajustes → Cuenta y sincronización** escribí email y contraseña → **Crear cuenta** (y confirmá el email si dejaste esa opción). En el otro dispositivo, **Iniciar sesión** con los mismos datos.
7. **Cerrar registros nuevos** (recomendado): en Supabase, **Authentication → Sign In / Providers → Allow new users to sign up: off**. Solo vos podés entrar.
8. **Comprobar**: repasá una tarjeta en la notebook → en el iPhone abrí la app (o tocá el ícono de nube) → en *Estadísticas* aparece el repaso y la tarjeta tiene la misma próxima fecha.

**Cómo funciona:** cada cambio se guarda primero en el dispositivo (IndexedDB) y se encola. Con conexión, la app sube la cola y baja lo nuevo cada pocos segundos, al volver a la app y al recuperar internet. Los repasos son eventos con id único (enviar dos veces no duplica) y el estado FSRS se recalcula reproduciendo todos los eventos en orden, así que dos dispositivos que estudiaron offline convergen al mismo resultado. Las ediciones usan «la última gana».

**Límites del plan gratuito relevantes:** 500 MB de base (tu banco ocupa < 10 MB), 50.000 usuarios activos/mes, 5 GB de transferencia. Los proyectos gratuitos se **pausan tras 7 días sin actividad**: si te pasa, entrá a supabase.com y tocá *Restore* (gratis). Mientras tanto la app sigue funcionando en local y sincroniza al reactivarlo.

---

## Agregar conocimientos nuevos (mocks, ejercicios, clases)

### Método 1 — con Claude, sin configuración
1. En la app: **Agregar → Con Claude → Copiar instrucciones para Claude**.
2. En una conversación con Claude: pegá las instrucciones y adjuntá capturas, PDF o el texto de tus correcciones.
3. Claude devuelve un JSON `c2-recall/v1`. Copialo.
4. **Agregar → Importar** → pegalo → **Analizar y previsualizar**: vas a ver *Nuevo*, *Se completa* (ya existía: se agregan fuentes/ejemplos/tarjetas) y *Lo volviste a fallar* (sube la prioridad y, si querés, cuenta como «Again» para que FSRS lo reprograme).
5. **Confirmar importación**. Nada se duplica y nada pierde su historial.

Formato completo: [`docs/IMPORT_FORMAT.md`](docs/IMPORT_FORMAT.md) · JSON Schema: [`docs/import.schema.json`](docs/import.schema.json) · también se acepta CSV.

### Método 2 — integración directa (opcional)
Con la sincronización activa: **Ajustes → Integración directa → Crear token de importación**. Una herramienta autorizada (por ejemplo Claude Code en tu notebook, si le das el token) puede dejar un lote en tu bandeja:

```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/submit_import" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"token":"c2r_…","title":"Mock 3","payload":{"format":"c2-recall/v1","items":[…]}}'
```

El lote queda en **Agregar → Bandeja** hasta que lo revisás y confirmás. El token se guarda solo como hash (SHA‑256), se puede revocar y tiene límite de tamaño y frecuencia. Una conversación normal de Claude **no** tiene acceso permanente a tu base de datos.

---

## Copias de seguridad
**Ajustes → Copias de seguridad → Exportar todo (JSON)** descarga conocimientos, tarjetas, estados, historial completo, mazos, fuentes y ajustes. Restaurar: *Combinar* (conserva lo más reciente de cada registro y une historiales) o *Reemplazar todo*. También hay CSV de conocimientos, tarjetas y repasos.

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
