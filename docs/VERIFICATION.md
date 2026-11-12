# Verification record
Run date: 4 November 2026.
Local educational prototype. Tests exercise software behaviour, not real fraud-detection accuracy.

## Node tests
Command: `npm test`. Result: 20 tests passed, zero failed (including the workflow parent test).
See `node-test-results.txt`.

## Browser workflow checks
- PASS: Live guardian receives the senior incident
- PASS: Background inert and keyboard focus remains in protective screen
- PASS: Guardian block decision unlocks the senior view and records history
- PASS: 20-second demonstration deadline escalates while guardian is offline
- PASS: Manual NSRC action is visible, no telephone action is clicked
- PASS: Reconnected guardian receives current escalated state
- PASS: 390-pixel senior view has no horizontal overflow

No uncaught page errors. Senior viewport checked at 390 x 844 pixels.
Demo timer: 20 seconds. Source default: 180 seconds.
Real SMS disabled and no telephone link activated.

## Not verified
Live SMS delivery, actual telephone calls, physical-device native protection, fraud-detection accuracy, full accessibility conformance, load, penetration testing and production recovery.
