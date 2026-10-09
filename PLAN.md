# PLAN: Offline Study-Material Generator (Android, mid-range target)

Turns documents and text into study material: structured notes, flashcards, quizzes, and a PDF
reviewer with answer key. Personal use, Filipino college students.
Offline-first: after a one-time model download, v1 and v2 work with no connection.

**Language priority: English only for v1 and v2.** Small on-device models understand English well
but are unreliable in Tagalog/Taglish. Tagalog support is a separate later phase (Phase 3) that uses
cloud AI and requires an internet connection.

Stack: Expo SDK 57 / React Native 0.86 (dev builds, not Expo Go), Expo Router, NativeWind,
expo-sqlite, expo-file-system. Model names are starting points: verify against the latest
releases and benchmark before locking in.

## 1. Phases at a glance

| Phase | Scope | Connectivity |
|-------|-------|--------------|
| 0 | Feasibility spike (English) | offline |
| 1 (v1) | Text/PDF/DOCX -> notes, flashcards, quizzes, PDF export | offline |
| 2 (v2) | Audio, image OCR, scanned PDFs, richer models and quiz types | offline |
| 3 | Tagalog/Taglish via cloud AI | **online (Wi-Fi) required** |

## 2. Target device

Baseline researched Oct 2026 from Philippine mid-range listings (Unbox.ph, GadgetPH, Pinoy Techno Guide
rankings; prices roughly PHP 10k-25k). Popular brands: Infinix, TECNO, POCO/Redmi, Samsung A-series, realme, HONOR.

| Tier | Typical chips | RAM | Examples seen |
|------|---------------|-----|---------------|
| Floor (must work) | Dimensity 7300/7400, Snapdragon 6 Gen 4, Helio G99-class, Exynos 1580 | 6-8 GB | TECNO Camon 50 Ultra (D7400), HONOR X9d (SD 6 Gen 4, 12 GB), CMF Phone 1 (D7300, 8 GB), Galaxy A56 (Exynos 1580) |
| Upper mid (nice to have) | Dimensity 8350/8400/8500, Snapdragon 7 Gen 3 | 8-12 GB | POCO X7 Pro (D8400), OnePlus Nord CE5 (D8350), POCO X8 Pro (D8500) |

Design baseline = **Floor tier, 8 GB RAM**. 6 GB is the minimum supported.
A global RAM/NAND shortage is raising prices, so users likely keep older 6-8 GB phones longer.

Throughput is NOT yet measured. No reliable llama.cpp numbers found for this tier. Reference: a flagship
(Pixel 9 Pro) reaches about 12 tok/s on a 3B Q4_K_M; Floor-tier CPUs should be well below that.
Working assumption until Phase 0: 1.7-2B Q4 ~ 6-10 tok/s on the Floor tier.

| Device | Profile |
|--------|---------|
| Floor, 8 GB | One ~2B model for all LLM stages; Quick mode default |
| Floor, 6 GB | 1.7B or smaller; Quick mode only |
| Upper mid, 8 GB+ | Same 2B by default; 4B as an opt-in slow mode (Phase 2) |
| <6 GB | Unsupported |

Pick the profile from **available** memory at runtime (`ActivityManager.MemoryInfo.availMem`, tiny native
module), not installed RAM: an "8 GB" phone often leaves only ~4-5 GB to the app.
Load one model at a time. mmap on, threads = performance cores only. Context 2048 on the baseline
(4096 only if the memory test passes); quantize the KV cache (q8_0; V-cache quantization needs flash attention).

## 3. Constraints

- Inference is mostly CPU on Android. OpenCL (Adreno) is optional and unstable: test, don't depend on it.
- Processing time depends on chunks read and tokens generated, not tok/s alone. Measure time per page.
- Foreground service must be a real native one (Android 14+ requires a declared service type; `dataSync`
  has a runtime cap on Android 15, so use `specialUse`, fine for a sideloaded APK). `expo-background-task`
  is WorkManager-based (deferrable) and is not proof that long inference survives backgrounding.
  Use a maintained library (e.g. notifee foreground service) or a small config plugin + native module,
  plus a PARTIAL_WAKE_LOCK.
- Android's low-memory killer can kill the app even with a foreground service. Jobs are chunk-checkpointed
  in SQLite and resumable.
- Thermal: read `PowerManager.getCurrentThermalStatus()` and add adaptive cooldown pauses / fewer threads
  as status rises, instead of fixed sleeps.
- JS<->native: throttle progress callbacks (about 1/s), pass chunk IDs not big payloads, keep the DB in
  `expo-sqlite` (WAL).
- OEM battery killers (Xiaomi/Oppo/Realme): onboarding step to disable battery optimization.
- Development on Windows: local Android builds (`npx expo run:android`), sideload the APK.
- Always check the SDK 57 docs and use `npx expo install` before adding packages (see AGENTS.md).

## 4. Models

License rule: strictly open source (OSI-style, e.g. Apache-2.0/MIT). **Gemma 3 and EmbeddingGemma are
excluded**: Gemma's custom terms include a use policy, remote-restriction and derivative-deletion clauses.
(Google links an Apache-licensed Gemma 4 license; read its terms and sizes before considering it.)

| Phase | Role | Candidates |
|-------|------|------------|
| 1 | LLM (single model, ~2B, Q4) | Qwen3.5-2B (Apache-2.0, has vision encoder, non-thinking default) or Qwen3-1.7B (thinking disabled). Decide by English bake-off. |
| 1 | Runtime | `llama.rn` (llama.cpp), JSON-schema/GBNF constrained decoding |
| 2 | STT | `whisper.rn`, small Q5 (English) |
| 2 | OCR | PaddleOCR mobile via `onnxruntime-react-native` (compare PP-OCRv6 tiny/small vs PP-OCRv5); Tesseract fallback |
| 2 | Heavy LLM (opt-in) | Qwen3-4B-Instruct-2507 Q4_K_M |
| 2 | Vision (manual opt-in) | Qwen3.5-2B vision, or Florence-2 / SmolVLM2 / Granite-Docling |
| 2 | Embeddings | multilingual-e5-small (MIT), only if heading/sequence chunking is not enough |
| 2 | VAD / denoise | Silero VAD; RNNoise or GTCRN (optional) |

Quantization policy: natively small models at Q4/QAT. Nothing below Q4.
Delivery: APK stays small; a model manager downloads GGUFs from HuggingFace once (resumable, checksum),
or side-loads via file picker.

## 5. v1 pipeline (Phase 1)

```
Ingest: pasted text | PDF text layer | DOCX (XML parse)
   -> normalize (dedupe, strip headers/footers) -> chunk by headings/sequence (source refs kept)
   -> MAP     LLM, JSON-grammar output per chunk (facts, definitions, steps, qualifications, relations, Q/A candidates)
   -> REDUCE  LLM merges per section; one pass for outline + cross-links
   -> Knowledge Base (SQLite, single source of truth)
   -> Renderers (no LLM): Notes UI | PDF reviewer | PDF quiz + answer key | Flashcards/quiz (in-app)
```

Rules:
- Deterministic text cleanup only. No telegraphic compression (it hurts small-model comprehension).
- All LLM output is constrained by JSON-schema grammar.
- Traceability: every note, card and quiz item stores its source chunk IDs; the UI shows the original text beside it.
- Map schema keeps qualifications, worked steps and relations, not just a fact list.
- Quiz grounding is deterministic first: prefer questions whose answer is an exact span of the source
  (cloze, T/F from a source sentence, MCQ whose correct option is a source span). Check the answer string
  exists in the cited chunk. A second small-model "verifier" is a weak signal only; JSON grammar guarantees
  shape, not truth. Users can flag/edit items.
- Quick vs Thorough is a Phase 0 question. If Quick skips content via a salience filter, the UI must show
  what was skipped.

## 6. v1 scope (Phase 1)

In:
- Input: pasted text; PDF and DOCX with a text layer.
- One ~2B model (Qwen3.5-2B or Qwen3-1.7B, decided by bake-off).
- Output: structured notes; flashcards (cloze and Q/A); MCQ and True/False quizzes; PDF export (HTML ->
  `expo-print`) with the answer key on the final page.
- Flashcard review with `ts-fsrs`.
- Source text shown beside every generated item.
- Resumable job with a native foreground service.
- Model download manager (download once, then fully offline).

Out (deferred): audio, OCR, scanned PDFs, embeddings, 4B, vision, denoise, Anki export, matching /
multi-select / short-answer, Tagalog.

## 7. v2 scope (Phase 2)

- Audio: VAD, optional denoise, `whisper.rn` small Q5 (English).
- Image OCR and scanned PDFs: preprocess -> PaddleOCR (sequential pages, one ONNX session, release tensors
  between batches) -> light-LLM correction of obvious OCR errors only. Figures/tables stay as cropped images
  in the output. VLM is a manual per-image opt-in only.
- Embeddings + topic clustering (only if Phase 0/1 shows heading/sequence chunking is not enough).
- 4B model as opt-in slow mode on capable devices; vision model (manual).
- Anki `.apkg` export.
- Matching, multi-select and short-answer quiz types, once the simple types are proven reliable.

## 8. Phase 3: Tagalog via cloud AI (later)

Requirement: **internet (Wi-Fi) needed** for Tagalog/Taglish processing. Everything else stays offline.
- Opt-in per project ("Process with cloud AI"); the UI clearly says the content leaves the device.
- Connectivity check (`expo-network`) before starting; Wi-Fi-only by default to avoid mobile data cost.
- Results are stored in the same Knowledge Base, so notes/cards/quizzes work offline afterwards.
- On-device stages (text extraction, OCR, STT, rendering) still run locally; only the language-heavy
  map/reduce/quiz generation goes to the cloud.
- Open items (decide when we get there): cloud provider/model, API key handling (`expo-secure-store` or a
  backend), cost per document, privacy disclosure, rate limits and retry/resume, how Whisper/OCR handle
  Tagalog (local models may still be weak: consider cloud for those too).
- The "open-source models only" rule applies to on-device models; the cloud choice is a separate decision.

## 9. Phase 0: feasibility spike (English)

Goal: prove the core loop on a real phone, and learn the real speed. Build a `/bench` screen in a dev build.

Experiments:
- **Decisive experiment:** one representative English document (10-20 pages of PDF) end to end on the device:
  ingest -> map -> reduce -> notes + flashcards + quiz. Judge: time, no OOM/kill, and whether the output
  is trustworthy (manual check against the source).
- Model bake-off, English: Qwen3.5-2B vs Qwen3-1.7B (summary quality, quiz correctness, JSON validity).
- Context memory scaling: RAM at ctx 1024 / 2048 / 4096, with and without q8_0 KV cache.
- 20-minute continuous generation: sample thermal status, tok/s and available memory over time.
- Constrained decoding: JSON-schema/GBNF validity and missing-key rate at low temperature (about 0.1).
- Time per page and per generated token, to extrapolate processing time and set the page limit.
- Foreground service survival: run a long job, background the app, lock the screen, check completion and
  resume after a kill.

Instrumentation: `llama.rn` timings (prompt eval vs generation), a small local Expo native module for
`availMem`, `Debug.getMemoryInfo`, VmRSS (`/proc/self/status`), `PowerManager.getCurrentThermalStatus()`.
CPU clock speeds only if readable (usually blocked on Android 10+). One-tap suite exports one JSON report
including device info (model, SoC, total/available RAM, Android version). Models are side-loaded
(`adb push` or file picker) for Phase 0.

Proposed go/no-go gates (adjust after first runs):
- >= about 5 tok/s on a ~2B model, no out-of-memory kills.
- >= 95% of JSON outputs valid.
- Manual check of 10 pages: >= 80% of quiz items correct and answerable from the source.
- 10 pages processed in <= 15 minutes (placeholder: a larger bar is acceptable for an overnight,
  while-charging job; the page limit is a RESULT of this phase, not an assumption).

Fallbacks if gates fail:
- No-LLM mode: rule-based extraction and cloze cards from keywords (fast, always faithful to the source).
- Narrower LLM use: the user selects a section and the LLM only writes cards/questions for it.
- Require an upper-mid device (Dimensity 8000-class).

First benchmark on whatever phone you have, even if not Floor-tier; it gives an upper bound.

## 10. Roadmap

0. Feasibility spike (section 9).
1. **v1** (section 6): job queue + foreground service + model manager first (foundations), then ingest,
   KB, notes UI, flashcards/quizzes, PDF export.
2. **v2** (section 7).
3. **Tagalog via cloud** (section 8).

## 11. Open items

- Test phone: ideally a Floor-tier device (Dimensity 7300/7400, 8 GB); otherwise your own phone as an upper bound.
- Max pages per project for v1: set from Phase 0 measurements.
- Which English sample document to use for the decisive experiment.
- Phase 3 cloud provider and privacy/cost model.
