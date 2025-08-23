# Production Hardening TODO

This checklist tracks foundational improvements to make the video rendering pipeline robust and production-ready without changing external behavior.

- [x] Rendering config and sane defaults
  - [x] Add central config (env-driven) for encoder timeouts, job watchdog, memory thresholds
  - [x] Use these configs across encoder and generator

- [x] FFmpeg process lifecycle hardening
  - [x] Replace arbitrary startup delay with proper spawn detection + startup timeout
  - [x] Add per-frame write timeout with cleanup and clear listener hygiene
  - [x] Add finish timeout; ensure streams are closed and process is reaped deterministically
  - [x] Improve `kill()` to also destroy stdin to prevent hangs
  - [x] Capture stderr for better diagnostics (log buffer retained)

- [x] Frame generation resource safety
  - [x] Add lightweight job watchdog (max duration, memory cap) that can terminate the encoder and abort safely
  - [x] Ensure watchdog timers/intervals are always cleared

- [x] Storage upload memory safety
  - [x] Stream uploads from disk using `createReadStream` instead of reading entire file into memory
  - [x] Validate file size using `fs.stat` (no buffering the entire file)
  - [x] Maintain existing retry/backoff and signed URL logic

- [x] Temp file and interval cleanup
  - [x] Track cleanup interval in `SmartStorageProvider` and expose `cleanup()`
  - [x] Ensure provider `cleanup()` is called by renderer (success or failure)
  - [ ] Attempt to unlink partial temp files if rendering fails before finalize (best-effort)

- [x] API and job pipeline safety
  - [x] Keep frame count limit; add internal safety timeouts without changing API surface
  - [x] Improve error logging context in encoder via stderr buffer

- [ ] Observability
  - [ ] Add minimal structured logs for encoder lifecycle (start, write backpressure, finish, kill, timeouts)

- [x] Validation
  - [x] Run typecheck and tests; ensure no behavior changes in outputs

- [x] Documentation
  - [x] Document environment variables and defaults for new rendering config

Notes:

- Consider adding per-job unique logger context and structured logs for lifecycle events.
- Partial temp-file unlink on early failure is mostly covered by existing cleanup; additional early best-effort cleanup can be added in job handlers if desired.
