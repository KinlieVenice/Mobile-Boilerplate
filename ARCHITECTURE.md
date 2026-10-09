# ARCHITECTURE: Offline Study-Material Generator

Companion to PLAN.md. Everything runs on the phone. There is **no server**: the existing `server/`
folder and `src/lib/api.ts` are unused and left untouched. Phase 3 (cloud Tagalog) will call a provider
through the same engine interface (see 4); a backend is only reconsidered then.

Package names and APIs below must be checked against the Expo SDK 57 docs before use (AGENTS.md).

## 1. Layers

```
┌─────────────────────────────────────────────────────────────┐
│ UI            Expo Router screens, NativeWind               │
├─────────────────────────────────────────────────────────────┤
│ Features      projects | ingest | pipeline | study | export │
│               | models   (hooks + services per feature)      │
├─────────────────────────────────────────────────────────────┤
│ Pipeline      job runner, stages, checkpoints, governors     │  pure TypeScript,
│ (core)        (thermal / memory), prompts, schemas           │  unit-testable on PC
├─────────────────────────────────────────────────────────────┤
│ Engines       LlmEngine interface                            │  swappable
│ (adapters)    ├ LlamaRnEngine (on-device, v1)                │
│               ├ DevServerEngine (PC llama.cpp, dev only)     │
│               ├ FakeEngine (tests)                           │
│               └ CloudEngine (Phase 3)                        │
│               later: SttEngine, OcrEngine                    │
├─────────────────────────────────────────────────────────────┤
│ Native        foreground service | device stats (availMem,   │
│ modules       thermal, VmRSS) | PDF text extraction          │
├─────────────────────────────────────────────────────────────┤
│ Storage       expo-sqlite (state, KB) | file system (models, │
│               sources, exports)                              │
└─────────────────────────────────────────────────────────────┘
```

Rules: UI never calls engines directly; features talk to the pipeline and DB; the pipeline depends on the
`LlmEngine` interface, not on `llama.rn`. Renderers read the DB only and never call an LLM.

## 2. Suggested folder layout

```
src/
  app/                    routes only (projects, project/[id], study, quiz, settings/models)
  features/
    projects/             create/list/delete, add sources
    ingest/               text, pdf, docx -> normalized text
    pipeline/             runner, stages/, prompts/, schemas/, governors/
    study/                notes view, flashcards (FSRS), quiz player
    export/               HTML templates -> PDF
    models/               catalog, download, verify, load/unload
  engines/                llm/ (interface + adapters)
  db/                     schema, migrations, repositories
  components/ constants/ hooks/   (existing)
modules/                  Expo local native modules (service, device-stats, pdf-text)
```

## 3. Data model (SQLite = source of truth)

| Table | Key columns |
|-------|-------------|
| projects | id, title, created_at, settings_json |
| files | id, kind (text/pdf/docx; audio/image in v2), name, path, size, sha256 (unique), pages_or_duration, origin (upload/paste/recording/capture), extract_status, created_at. The Files tab lists this table; independent of any project. |
| file_text | file_id, text, page_map_json (page/heading offsets). Extraction is cached per file and reused by every project. |
| sources | id, project_id, file_id, selected_sections_json. Join between a project (Library entry) and a file; one file can be used by many projects. |
| chunks | id, source_id, idx, heading, text, token_est, page_range |
| jobs | id, project_id, mode (quick/thorough), status, stage, progress, model_id, error, started/finished_at |
| job_steps | job_id, stage, chunk_id, status, output_json, attempts, duration_ms, tokens_in/out |
| sections | id, project_id, order, title, summary_json |
| items | id, project_id, type (note/card/question), payload_json, source_chunk_ids, flagged, edited |
| card_state | item_id, FSRS fields (due, stability, difficulty, reps, lapses, last_review) |
| quiz_attempts | id, project_id, config_json, score, taken_at |
| generations | id, project_id, output_type, focus_note, config_json, status, item_count, created_at. `items` gain a `generation_id`. Each "Generate more" run creates one row; duplicate check runs against existing items of the project. |
| review_log | id, item_id, project_id, kind (card/question), result (again/hard/good/easy or correct/wrong), reviewed_at, duration_ms. Streaks, mastery, weak spots and stats are computed from this. |
| models | id, name, path, size, sha256, status (missing/downloading/ready), kind |

`job_steps` is the checkpoint: each stage is keyed by (job, stage, chunk) and idempotent, so a resume after
an app kill skips completed steps. `items.source_chunk_ids` powers "source beside every item".

## 4. Engine interface

```ts
interface LlmEngine {
  load(model: ModelRef, opts: { ctx: number; threads: number; kvQuant: boolean }): Promise<void>;
  generateJson<T>(req: { system: string; user: string; schema: JsonSchema; maxTokens: number;
                         temperature: number; signal: AbortSignal }): Promise<{ value: T; stats: Stats }>;
  unload(): Promise<void>;
}
```

- `generateJson` uses JSON-schema/GBNF constrained decoding on-device; cloud adapters use the provider's
  structured-output feature. The pipeline never knows which one it has.
- `DevServerEngine` points at llama.cpp's server on your PC so prompts and the pipeline can be iterated
  quickly on Windows without the phone. `FakeEngine` returns canned JSON for unit tests. Both are dev-only.
- Later engines (`SttEngine`, `OcrEngine`) follow the same load / run / unload pattern.

## 5. Pipeline runner (v1)

Stages: `extract -> normalize -> chunk -> map -> reduce -> build_items`.

- Runner is a loop over pending `job_steps`, writing results to SQLite after each step. Progress events to
  the UI are throttled (about 1/s).
- **Governors** run before each LLM step: thermal status (pause or reduce threads), available memory
  (abort safely below a floor), battery state (warn if not charging), cancellation.
- **Failure handling:** invalid JSON -> retry once at lower temperature -> mark the chunk `skipped` and
  surface it in the UI. Never silently drop content.
- `build_items` is deterministic: turns map/reduce output into notes, cloze/Q&A cards, MCQ and T/F
  questions; checks every answer string exists in its cited chunk; stores source chunk IDs.
- Modes: Quick vs Thorough are decided by Phase 0 results. If Quick filters chunks, skipped coverage is shown.

## 6. Android job survival

- A native foreground service (specialUse type, wake lock, ongoing notification) keeps the process alive
  while a job runs. The JS runner keeps executing inside the same process; Phase 0 must confirm JS is not
  throttled when backgrounded (a library such as notifee, or a headless-task approach, are the options).
- The low-memory killer can still kill the app: every step is checkpointed, and on next launch the app
  offers "Resume job".
- Onboarding asks the user to exempt the app from battery optimization (OEM-specific hints).

## 7. Model manager

- Bundled `catalog.json` (id, URL, size, sha256, license, min available RAM).
- Resumable download into app storage (verify the exact download API in the SDK 57 docs), checksum on
  completion, and a "side-load from file" option via a document picker.
- Disk-space check before download; delete/redownload; the only network use in v1 is this download.
- Load/unload only through the engine; one model in memory at a time.

## 8. Ingest

- **Storage of uploads:** on import, the file is *copied* into app-private storage
  (`<documentDirectory>/files/<fileId>.<ext>`), and a `files` row is created (deduplicated by sha256). Never
  keep only the picker's URI: Android content URIs can stop working. Pasted text becomes a text file in the same
  store. Files are independent of projects: deleting a Library entry removes the `sources` links but keeps the
  files; deleting a file (Files tab) removes the stored copy but projects keep their chunks and extracted text, so
  "Show source" still works as text. Uninstalling the app deletes everything (the files are not visible in the
  system Files app).
- **Viewing sources (v1):** the Details screen lists sources; tapping one opens an in-app viewer of the
  extracted text with page markers (reliable, offline). "Open original" hands the stored file to the system PDF/doc
  viewer through a FileProvider URI. Each item's "Show source" jumps to its chunk/page in that viewer.
  An in-app page-image view (Android `PdfRenderer`) can come later.
- **Text:** direct.
- **DOCX:** unzip (e.g. `fflate`) + XML parse of `word/document.xml`; keep headings and lists.
- **PDF text layer:** the least trivial part. Options: a native module wrapping an Apache-licensed Android
  library (e.g. PdfBox-Android or PDFium), or `pdf.js` in a hidden WebView/JS. Avoid AGPL libraries (MuPDF,
  iText). Decide in Phase 0 by extraction quality and speed. Keep page numbers for `page_range`.
- Output is normalized text with structure hints (headings, page breaks) for chunking.

## 9. Study and export

- **Notes:** React components from `sections` + `items` (cards, callouts, collapsible source text).
- **Flashcards:** `ts-fsrs` over `card_state`; review queue by due date.
- **Quiz player:** builds a quiz from question items by type and count; stores attempts.
- **PDF export:** HTML templates (reviewer; quiz with the answer key on the last page) -> `expo-print` ->
  share sheet. All offline.

## 10. State management

SQLite is the source of truth; screens read through repository hooks (live queries / change listeners).
Small UI-only state (filters, current card) in a lightweight store such as Zustand. No global copy of
pipeline data in JS memory.

## 11. Testing and dev loop (Windows)

- Pipeline core, prompts, schemas, chunking and `build_items` are pure TypeScript: unit-test with
  `FakeEngine` on the PC.
- Prompt and quality iteration with `DevServerEngine` against llama.cpp on the PC (same GGUF as the phone).
- Phone is for performance and survival tests (Phase 0 `/bench` screen) and real-device acceptance.
- Local Android builds with `npx expo run:android`; sideload the APK.
- Lint (`npx expo lint`) and typecheck (`npx tsc --noEmit`) before finishing any task.

## 12. Privacy and permissions (v1)

No analytics or accounts. The INTERNET permission is needed only for the model download. Documents and
generated data stay in app storage. Phase 3 adds an explicit per-project consent for cloud processing.

## 13. Phase mapping

| Component | v1 | v2 | Phase 3 |
|-----------|----|----|---------|
| Pipeline core, DB, runner | yes | extend (new stages) | extend |
| LlamaRnEngine, model manager | yes | + 4B, vision | |
| Foreground service, device stats | yes | | |
| text / PDF / DOCX ingest | yes | + scanned PDF, images | |
| SttEngine, OcrEngine | | yes | cloud fallback |
| Embedding clustering | | optional | |
| CloudEngine, consent UI | | | yes |
| Anki export, extra quiz types | | yes | |

## 14. Decisions

Decided:
- UI state: Zustand for small UI-only state; SQLite stays the source of truth (live-query hooks from
  `expo-sqlite` if the SDK 57 API supports them).
- `server/` folder: kept for now, unused and untouched.

Decided in Phase 0 by measurement (not before):
1. PDF text extraction: native Apache-licensed library vs `pdf.js`; judged by extraction quality and speed.
2. Foreground service: maintained library (e.g. notifee) vs custom module; judged by whether the job and
   JS runner survive backgrounding, screen lock and the OEM battery manager.
