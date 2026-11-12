# Family Guard 🛡️ — full-stack website prototype

**Family Guard** (formerly LinkLock) is a senior-friendly, family-monitored scam-link awareness prototype. It includes two synchronized dashboards, a simple risk-scoring checker, in-app protective overlay, guardian approval, a 3-minute response timer, escalation state, history, and optional family SMS notifications.

> **Important:** This is a working *educational demonstration*, **not** a phone-locking app, SMS-interception product, certified scam detector, or emergency dispatch service. A browser cannot block links opened in WhatsApp/SMS, lock an entire phone, or silently dial NSRC 997. The built-in URL checker uses heuristic warning signs only. For a deployment with true mobile protection, build a native Android app with properly reviewed OS permissions and a reputable threat-intelligence service.

## Quick start (VS Code terminal)

Requirements: **Node.js 20+**, npm.

```bash
cd family-guard
npm ci
cp .env.example .env
npm start
```

On **Windows PowerShell** use `Copy-Item .env.example .env` instead of `cp` if needed.

You may also double-click **`start-windows.bat`** on Windows, or run `./start-mac-linux.sh` on macOS/Linux. The launchers create `.env` and install dependencies when needed.

Open **http://127.0.0.1:3000**. Use two browser tabs:

| Tab | Role | Initial demo PIN |
|---|---|---|
| Tab 1 | Senior | `1357` |
| Tab 2 | Guardian | `2468` |

PINs are demo defaults and **must be changed** in `.env` before use on any shared network. Sessions are separate per tab using `sessionStorage`.

## End-to-end demo walkthrough

1. Sign into the **senior** view in one tab.
2. Sign into the **guardian** view in another tab.
3. Senior clicks **Trigger demo scam alert**, or pastes `https://maybank-secure-verification.example/verify` and clicks **Check this link safely**.
4. Senior browser tab is covered by an in-app protective screen. Guardian receives a real-time notification and sees reasons for the warning.
5. Guardian clicks **Block link & unlock**. Senior tab unlocks immediately.
6. To demonstrate timeout escalation, trigger another demo alert and wait **180 seconds**. The status becomes `ESCALATED`, a backup-family SMS is attempted *only when Twilio is configured*, and senior UI shows manual call actions.
7. Guardian can still resolve an escalated alert.

### Go live on Render (free)

`render.yaml` deploys the server as a public HTTPS site, so testers need no npm and no shared Wi-Fi. Steps (BM): **[docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md)**.

On Render the server refuses to start with the demo PINs, short PINs or identical PINs, and it trusts Render's proxy so the PIN rate limit works per visitor. Free-plan limits: it sleeps when idle (first visit about 30–60 s), history resets on restart, and all testers share one family, so test one at a time.

### Android app (catches link taps in the real WhatsApp)

`android/` contains a native Kotlin app that uses the same server. Open the folder in Android Studio and press Run. Full BM guide: **[docs/PANDUAN_ANDROID.md](docs/PANDUAN_ANDROID.md)**.

- **Ibu/bapa mode:** Family Guard is set as the default browser, so every link tapped in WhatsApp/SMS opens Family Guard first. Low-risk links go straight to Chrome. Risky links wait for anak, with a "Hubungi 997" fallback after the timeout.
- **Anak mode:** a background monitor checks the server every 3 seconds and posts an alert notification with a "Scam, sekat" action. No Firebase needed. Anak can also use the web dashboard instead.
- Sites anak (or 997) already decided on are remembered: a blocked site is blocked straight away next time. Real WhatsApp messages cannot be deleted by another app.
- Phones must reach the laptop: set `HOST=0.0.0.0` in `.env` and use the same private Wi-Fi.

### WhatsApp-style demo (Bahasa Malaysia UI)

The interface is in Bahasa Malaysia. The parent (senior) view is a demo WhatsApp-style phone with four chats. The full user guide and presenter script are in **[docs/PANDUAN_PENGGUNA.md](docs/PANDUAN_PENGGUNA.md)**.

- **Scenario 1:** the parent taps a risky link and sees "Biar anak anda sahkan pautan ini dulu." Anak chooses *Selamat* or *Scam*. If it's a scam, the message is deleted from the demo chat and the phone goes back to normal.
- **Scenario 2:** if anak doesn't answer before the timeout, the parent gets a **Hubungi 997** button. After the call, the parent records what 997 said (*scam* deletes the message). Anak can still decide during this time.
- **Low-risk links** (e.g. the family chat) open without involving anak.
- **Pulihkan mesej demo** restores deleted messages so the demo can be repeated.

The phone and chats are a stand-in. A web page cannot read or delete real WhatsApp messages or call 997 automatically.

For a faster classroom demonstration, set `INCIDENT_TIMEOUT_SECONDS=20` in `.env` and restart the server. Keep it **180** when showing the planned 3-minute design.

## Structure

```text
family-guard/
├── public/
│   ├── index.html        # Responsive SPA shell
│   ├── styles.css        # Complete accessible UI styles
│   ├── app.js            # Senior + guardian user interface
│   └── favicon.svg
├── server/
│   ├── index.js          # Express API, auth, Socket.IO, timer, escalation
│   ├── detector.js       # URL heuristic rules (not threat intelligence)
│   ├── store.js          # File-backed incident history
│   └── sms.js            # Optional Twilio family SMS
├── tests/
│   ├── detector.test.js
│   ├── sms.test.js
│   └── workflow.test.js  # Isolated API and restored-timer tests
├── data/                 # Incident history JSON created at runtime
├── .env.example
├── start-windows.bat     # Beginner-friendly Windows launcher
├── start-mac-linux.sh    # Beginner-friendly Mac/Linux launcher
├── .gitignore
├── package.json
└── README.md
```

## Features

| Feature | Built? | Notes |
|---|---|---|
| Senior-friendly responsive view | ✅ | Large text, high contrast, clear instructions |
| Guardian dashboard | ✅ | Alerts, incidents, history, status |
| Suspicious link checking | ✅ Prototype | URL heuristics, not verified malware intelligence |
| Real-time link alerts | ✅ | Socket.IO between two open tabs/devices |
| Protective screen overlay | ✅ In-app | Locks the *website view*, not the phone or other apps |
| 3-minute guardian timer | ✅ | Server-side deadline, persists across restart |
| Guardian approve/block | ✅ | Unlocks senior website overlay |
| Escalation after timeout | ✅ | In-app state and optional backup-family SMS |
| SMS to family contacts | ⚙️ Optional | Requires paid/configured Twilio account and consent |
| Automatic emergency hotline dial | ❌ | Browser cannot silently call 997; tap-to-call provided |
| Automatic WhatsApp/SMS interception | ❌ | Requires a native mobile solution / permissions |
| Detection from official threat feed | ❌ | Integrate a verified URL reputation API for real use |
| Authentication | ✅ Demo only | Per-role PIN, ephemeral bearer sessions, local use only |

## Optional family SMS setup

Set the following variables in `.env`:

```ini
GUARDIAN_PHONE=+60123456789
BACKUP_GUARDIAN_PHONE=+60198765432
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

- A high-risk incident triggers a **primary guardian** SMS (if configured).
- If the guardian does not respond before the timeout, a **backup guardian** SMS is attempted (if configured).
- **Never** provide an emergency-services number as the SMS recipient. No code calls or messages NSRC automatically.
- SMS providers may have account restrictions, verified recipient requirements, local regulatory restrictions, and usage charges. Obtain recipient consent.

## Presenting on a phone or another laptop (same private Wi-Fi)

1. Change both PINs in `.env`.
2. Set `HOST=0.0.0.0` in `.env`, then restart `npm start`.
3. Find the laptop's private IP using `ipconfig` (Windows) or `ip addr` (Linux).
4. On the same trusted Wi-Fi, open `http://<LAPTOP_IP>:3000` in the phone browser.
5. Allow inbound TCP 3000 in your local firewall only if necessary. **Do not port-forward or expose this prototype to the internet.** Plain HTTP on LAN is not confidential.

## Tests

```bash
npm test
```

## API (local demonstration)

- `POST /api/auth` `{ "role": "senior" | "guardian", "pin": "..." }` → token
- `GET /api/state` with `Authorization: Bearer <token>` → dashboard state
- `POST /api/scan` (senior) `{ "url": "https://...", "simulate": false }`
- `POST /api/incidents/:id/resolve` (guardian) `{ "decision": "SAFE" | "BLOCKED" }`
- `POST /api/incidents/:id/escalate` (guardian) → manual escalation
- `POST /api/logout`
- `GET /api/health`

Socket.IO connects using `{ auth: { token } }` and receives live `state` events.

## Recommended development beyond the Figma/prototype stage

1. Replace demo PINs with secure account enrollment, hashed passwords/passkeys, role-scoped access, device pairing, audit trails, encryption and HTTPS.
2. Replace JSON file storage with managed database, migrations, retention policy, and proper privacy controls.
3. Replace URL heuristics with up-to-date reputable threat intelligence and carefully manage false positives/negatives.
4. Create native Android protection for link interception and **supported, consent-based** interventions. Avoid falsely claiming OS-wide lock controls.
5. Add reliable background SMS provider monitoring, alert retry, per-family rooms, opt-in settings, and explicit incident follow-up procedures.
6. Test with seniors using real accessibility checks and safe, simulated phishing samples.

**NSRC 997:** The prototype offers *tap-to-call* where appropriate for financial-scam response. Users should contact their bank immediately after suspected financial loss. Hotline calling is not automated.

## CEO delivery package

See `CHANGELOG_CEO.md`, `docs/DEMO.md` and `docs/VERIFICATION.md`. This edition includes a dependency lockfile, 20 passing Node tests and seven browser workflow checks. The video timer is 20 seconds; the source default stays 180 seconds. The interface keeps the protective pause focused for keyboard users and labels pending family review without claiming an offline guardian has received it.
