# Implementation Plan

Tasks are in build order. Checked items are implemented and verified. Unchecked items remain before the finale (17 November 2026).

- [x] 1. Set up the server and the link checker
  - [x] 1.1 Create the Express server with security headers, static web files and a health check
    - _Requirements: 9.3, 9.4_
  - [x] 1.2 Implement `checkUrl()` with the warning-sign rules, risk levels and Bahasa Malaysia reasons
    - Remove query strings and fragments, and reject non-http(s) schemes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 1.3 Write unit tests for the detector (genuine site, lookalike bank, private data, schemes)
    - _Requirements: 2.1, 2.4, 2.6_

- [x] 2. Add sign-in and roles
  - [x] 2.1 Add role PIN sign-in with a timing-safe compare, rate limiting and 12-hour sessions
    - _Requirements: 9.1_
  - [x] 2.2 Add role guards: ibu/bapa scans, anak resolves
    - _Requirements: 5.8, 9.2_

- [x] 3. Build the incident workflow and timer
  - [x] 3.1 Store incidents atomically in `data/incidents.json`, allowing only one active incident
    - _Requirements: 4.1, 4.5_
  - [x] 3.2 Add the server-side escalation timer, restored after a restart
    - _Requirements: 6.1, 10.2_
  - [x] 3.3 Add the resolve endpoint, recording `decision` and `decidedBy`
    - _Requirements: 5.5_
  - [x] 3.4 Add the 997 report endpoint, allowed only after escalation and only for ibu/bapa
    - _Requirements: 6.4, 6.5_
  - [x] 3.5 Remember decisions per domain, and skip them for simulated scans
    - _Requirements: 3.2, 7.1, 7.2, 7.3_
  - [x] 3.6 Add the optional Twilio backup-family SMS on escalation, never to emergency numbers
    - _Requirements: 6.7_
  - [x] 3.7 Write the API workflow test: auth, roles, overlap 409, restart restores the deadline, timeout escalation
    - _Requirements: 4.5, 6.1, 9.2, 10.2_

- [x] 4. Build the Web Dashboard (Bahasa Malaysia)
  - [x] 4.1 Add the anak dashboard: live alert, reasons, countdown, Selamat/Scam with confirmation, history with "decided by"
    - _Requirements: 5.3, 5.4, 8.1_
  - [x] 4.2 Add the ibu/bapa demo: WhatsApp-style phone with 4 sample chats, protective pause, Hubungi 997, 997 report
    - _Requirements: 4.2, 6.2, 6.4, 11.4_
  - [x] 4.3 Add accessibility: focus trapped in the pause, live regions, large tap targets
    - _Requirements: 8.2, 8.4_
  - [x] 4.4 Add the demo reset: restore messages and clear remembered decisions
    - _Requirements: 11.2_

- [x] 5. Build the Android app foundation
  - [x] 5.1 Set up the Gradle project (AGP 8.10.1, Kotlin 2.0.21, SDK 35) with no third-party libraries
  - [x] 5.2 Add `Api` (with automatic re-login), `Prefs`, `Bg` and `Ui` (senior-friendly sizes)
    - _Requirements: 8.2, 10.3_
  - [x] 5.3 Add the setup screen: server address, role (ibu/bapa or anak), PIN
    - _Requirements: 9.1_

- [x] 6. Build ibu/bapa mode: catch link taps
  - [x] 6.1 Register `LinkCatcherActivity` for http/https VIEW intents, detect the source app, and pass links through when not in parent mode
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 6.2 Add the default-browser request (RoleManager, with a settings fallback) and the protection status card
    - _Requirements: 1.3_
  - [x] 6.3 Hand allowed links to the real browser (Chrome first), postponed while in the background
    - _Requirements: 1.5, 3.1, 10.4_
  - [x] 6.4 Add the waiting screen: countdown, "Hubungi anak", "Kembali ke telefon", 2-second state polling
    - _Requirements: 4.2, 4.3, 4.4, 4.6_
  - [x] 6.5 Add the escalated screen: "Hubungi 997 sekarang" (dialer only) and the 997 report buttons
    - _Requirements: 6.2, 6.3, 6.4_
  - [x] 6.6 Add the safe, blocked, remembered-block, offline (fail-safe) and busy screens
    - _Requirements: 4.5, 5.6, 5.7, 7.2, 10.1_
  - [x] 6.7 Add the "Cuba pautan scam contoh" and "Cuba pautan selamat" buttons
    - _Requirements: 11.1_

- [x] 7. Build anak mode: alerts and decisions
  - [x] 7.1 Add the `GuardianService` foreground service, polling every 3 seconds with one alert per incident/status
    - _Requirements: 5.1_
  - [x] 7.2 Add a high-priority notification with the "⛔ Scam, sekat" action handled by `DecisionReceiver`
    - _Requirements: 5.2_
  - [x] 7.3 Add the anak dashboard in the app: reasons, countdown, decision buttons with confirmation, notification permission prompt
    - _Requirements: 5.3, 5.4_

- [x] 8. Verify and document
  - [x] 8.1 Run `npm test`: 23 tests pass
  - [x] 8.2 Run the Android `assembleDebug` and `lintDebug` builds with no errors
  - [x] 8.3 Write `docs/PANDUAN_PENGGUNA.md` (web) and `docs/PANDUAN_ANDROID.md` (setup, demo script, limits, troubleshooting) in BM

- [ ] 9. User testing with at least 3 people outside the team (brief requirement)
  - [x] 9.1 Prepare the test plan, tasks and feedback form (BM), including consent and a no-real-money rule
    - `docs/UJIAN_PENGGUNA.md` (plan, script, questions, Google Form list) and `docs/KEPUTUSAN_UJIAN.md` (results template)
  - [x] 9.1b Expert review (cognitive walkthrough) as the persona. This is NOT user testing.
    - `docs/SEMAKAN_PAKAR.md`: 9 findings, 1 high priority
  - [x] 9.1c Fix the top expert-review findings (#1, #2, #3, #4, #7)
    - Parent notification of anak's decision (`ParentWatchService`)
    - Plain-language tips for the parent
    - Corrected 997 wording; the parent can only block after the timeout, and only anak can allow
    - "Buka juga" made small when offline
    - _Requirements: 2.3, 4.2, 5.9, 6.2, 6.4, 6.5, 10.1_
  - [ ] 9.2 Test with at least 3 participants, ideally 1–2 aged 55+ (persona) plus 1 younger adult
  - [ ] 9.3 Record the results: task success, time to understand the pause screen, quotes, and issues found
  - [ ] 9.4 Fix the top issues found in testing
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 10. Prepare the finale (5 minutes + 3 minutes Q&A)
  - [ ] 10.1 Update the presentation and the CEO package to show the Android app, not the old link-checker website
  - [ ] 10.2 Rehearse the live demo: scenario 1, scenario 2 (20-second timeout), and a safe link
  - [ ] 10.3 Prepare Q&A answers: phone calls (future work), WhatsApp message deletion, false alarms, privacy

- [ ]* 11. Optional, if time allows
  - [ ]* 11.1 Score message text (TAC, card number, "Hi Mum, new number", job and investment wording)
  - [ ]* 11.2 Add a call-screening warning for unknown callers claiming to be police, Bank Negara or the bank
  - [ ]* 11.3 Add sample links for job-offer and investment scams
