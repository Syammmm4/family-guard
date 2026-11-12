# Requirements Document

## Introduction

Family Guard helps an older person check a scam link with a trusted family member **before** the link opens.

This spec answers **Use Case 1, Digital Safety & Fraud Prevention ("Spot the Scam")** of the MDEC–KAF Digital Bank Launchpad KIRO Workshop & Innovation Challenge.

> **Challenge:** How would you design a tool to help people quickly tell if a message is a scam, before they click?

### Persona (Persona 3 from the brief)

**Puan Rosnah, 68, retiree.**
- Uses WhatsApp to talk to her grandchildren.
- Has a small screen and prefers Bahasa Malaysia.
- Trusts anyone who sounds official.

### Specific problem we solve

Puan Rosnah receives WhatsApp messages that look official, such as a "Maybank" warning, a "POS" parcel notice or a "TNG" prize. Each message contains a link. She trusts official-sounding messages, so she taps the link and may enter her card number, TAC or password.

Once money is sent, scammers can empty an account within minutes. We stop the link **at the moment she taps it** and ask her child (**anak**) to confirm it first. If anak cannot answer in time, we guide her to the National Scam Response Centre (NSRC) on **997**.

### How the guiding questions are answered

| Guiding question (brief) | Where it is answered |
|---|---|
| What warning signs do scam messages usually have? | Requirement 2 |
| How can the tool explain the risk in simple words? | Requirements 2, 4 and 8 |
| What should the user do after a message is flagged? | Requirements 4, 5 and 6 |
| How do you avoid false alarms on genuine bank messages? | Requirements 2, 3 and 7 |
| Why might a tech-savvy 21-year-old still fall for a scam? | Out of scope for this persona. See "Future work" |

### Out of scope (this phase)

- Screening phone calls from fake police, Bank Negara or LHDN officers. Planned as future work using Android call screening.
- Reading or scoring the **text** of a message. Only the link is checked.
- Deleting messages inside the real WhatsApp. Android does not allow another app to do this.
- Automatically calling 997. A person must always press the call button.
- iPhone support.
- Verified threat-intelligence feeds. Detection uses transparent heuristic rules.

## Glossary

- **Ibu/bapa (Senior):** the protected parent, Puan Rosnah.
- **Anak (Guardian):** the trusted child who confirms links.
- **Server:** the Family Guard Node.js server that both phones use.
- **Parent App:** the Android app in ibu/bapa mode.
- **Anak App:** the Android app in anak mode.
- **Web Dashboard:** the browser dashboard that anak can use instead of the Anak App.
- **Incident:** one risky link waiting for a decision.
- **Timeout:** how long anak has to answer. The default is 180 seconds.
- **Escalated:** the state of an incident after the timeout has passed without a decision.

## Requirements

### Requirement 1: Catch link taps before they open

**User Story:** As Puan Rosnah, I want links I tap in WhatsApp to be checked first, so that I am protected without changing how I use my phone.

#### Acceptance Criteria

1. WHEN the Parent App is set as the default browser AND ibu/bapa taps an `http` or `https` link in any app that opens links in the default browser, THE Parent App SHALL receive the link before any website is loaded.
2. WHEN a link is caught, THE Parent App SHALL record the app the link came from (for example "WhatsApp" or "Mesej SMS") and send it to the Server.
3. WHEN the Parent App is not yet the default browser, THE Parent App SHALL show "Perlindungan belum aktif" and an "Aktifkan perlindungan" button that opens Android's default browser setting.
4. WHEN the device is not set up in ibu/bapa mode, THE Parent App SHALL pass the link straight to the real browser without checking it.
5. THE Parent App SHALL never open a checked link inside itself, and SHALL hand allowed links to an installed browser, preferring Chrome.

### Requirement 2: Check the link and explain the warning signs

**User Story:** As anak, I want to see why a link looks dangerous in simple words, so that I can decide quickly and confidently.

#### Acceptance Criteria

1. WHEN the Server receives a link, THE Server SHALL score it from 0 to 100 using these warning signs:
   - no HTTPS
   - a numeric IP address
   - disguised (punycode) characters
   - an `@` sign or embedded login details
   - a link shortener
   - too many subdomains
   - a frequently abused domain ending
   - urgency or account words in the domain name
   - sensitive page paths (`/verify`, `/otp`, `/claim` and similar)
   - a brand name (Maybank, CIMB, TNG, PayPal, Google, Microsoft, WhatsApp) on a domain that is not that brand's official domain
2. THE Server SHALL classify a score of 60 or more as HIGH, 30–59 as SUSPICIOUS, and below 30 as LOW.
3. THE Server SHALL return every warning sign found as a short reason in Bahasa Malaysia for anak. It SHALL also return up to 2 simpler `tips` for ibu/bapa, with the most important first.
4. WHEN a link is on a listed official domain (for example `maybank2u.com.my`), THE Server SHALL NOT add the brand-impersonation score.
5. IF the link is not a valid `http` or `https` address, THEN THE Server SHALL reject it with a Bahasa Malaysia error message.
6. THE Server SHALL remove query strings and fragments before storing a link, so that tokens and private data are never saved.

### Requirement 3: Let safe links through without bothering anak

**User Story:** As Puan Rosnah, I want normal links to open straight away, so that the protection does not get in my way.

#### Acceptance Criteria

1. WHEN a link scores LOW AND no earlier decision exists for its domain, THE Parent App SHALL open it in the real browser without creating an alert.
2. WHEN anak or 997 has previously marked a domain SAFE, THE Parent App SHALL open later links to that domain without creating an alert.

### Requirement 4: Pause and ask anak for a risky link

**User Story:** As Puan Rosnah, I want a clear message telling me to wait for my child, so that I do not open a scam link by mistake.

#### Acceptance Criteria

1. WHEN a link scores SUSPICIOUS or HIGH, THE Server SHALL create an Incident with status `WAITING` and a deadline equal to the current time plus the Timeout.
2. WHILE an Incident is `WAITING`, THE Parent App SHALL show "Biar [nama anak] sahkan pautan ini dulu.", the suspicious domain, the source app, a live countdown, and up to 2 plain-language reasons ("Kenapa pautan ini bahaya?", for example "Ini bukan laman rasmi Maybank.").
3. WHILE an Incident is `WAITING`, THE Parent App SHALL offer "Kembali ke telefon (pautan tidak dibuka)", so that the rest of the phone remains usable. Only that link waits.
4. WHERE anak's phone number is configured, THE Parent App SHALL show a "Hubungi [nama anak]" button that opens the phone dialer.
5. WHILE an Incident is active, THE Server SHALL reject a new risky scan with HTTP 409. IF the same domain is tapped again, THEN THE Parent App SHALL resume waiting for the existing Incident.
6. WHEN anak's decision arrives, THE Parent App SHALL detect it within about 2 seconds by checking the Server.

### Requirement 5: Anak is alerted and decides

**User Story:** As anak, I want an alert on my phone when my parent taps a risky link, so that I can confirm or block it in time.

#### Acceptance Criteria

1. WHEN an Incident is created, THE Anak App SHALL show a high-priority notification within about 3 seconds. The notification SHALL show the parent's name, the domain and the source app, even when the app is closed.
2. THE notification SHALL include a "⛔ Scam, sekat" action that blocks the link without opening the app.
3. WHEN anak opens the Anak App or Web Dashboard, THE system SHALL show the domain, the full stored address, all warning reasons and the time remaining.
4. THE Anak App and Web Dashboard SHALL offer "Selamat, benarkan" and "Scam, sekat". Each choice SHALL require a confirmation step.
5. WHEN anak decides, THE Server SHALL set the Incident to `RESOLVED` and record the decision (`SAFE` or `BLOCKED`) with `decidedBy = ANAK`.
6. WHEN the decision is SAFE, THE Parent App SHALL show "[nama anak] kata pautan ini selamat." and open the link in the real browser.
7. WHEN the decision is BLOCKED, THE Parent App SHALL show "Ini SCAM. Pautan telah disekat." with bank and NSRC 997 advice, and SHALL NOT open the link.
8. THE Server SHALL allow only an anak session to resolve an Incident.
9. WHEN anak decides while ibu/bapa is not looking at the waiting screen, THE Parent App SHALL show a notification with the decision. Tapping a "safe" notification SHALL open the link in the real browser. The Parent App SHALL also notify ibu/bapa when the Incident escalates.

### Requirement 6: No answer in time → contact 997

**User Story:** As Puan Rosnah, I want to know who to call if my child does not answer, so that I am never left alone with a possible scam.

#### Acceptance Criteria

1. WHEN the Timeout passes with no decision, THE Server SHALL set the Incident to `ESCALATED`. This SHALL happen even if no app is connected.
2. WHEN an Incident is `ESCALATED`, THE Parent App SHALL show "Jangan buka pautan ini.", advise ibu/bapa to contact anak or another family member, and show a "Hubungi 997 sekarang" button for when bank details, an OTP or money have already been given. NSRC 997 handles reports of financial scams; it is not presented as a link-checking service.
3. THE system SHALL NOT place any call automatically.
4. WHILE an Incident is `ESCALATED`, THE Parent App SHALL let ibu/bapa choose "Saya tidak akan buka. Sekat pautan ini." The Server SHALL store this as BLOCKED with `decidedBy = IBU_BAPA`.
5. IF ibu/bapa tries to block the link before escalation, THEN THE Server SHALL reject it with HTTP 409. IF ibu/bapa tries to ALLOW the link, THEN THE Server SHALL reject it with HTTP 403. Only anak can allow a risky link.
6. WHILE an Incident is `ESCALATED`, anak SHALL still be able to decide.
7. WHERE Twilio and a backup family number are configured, THE Server SHALL send the backup contact an SMS when the Incident escalates. The Server SHALL never send an SMS to an emergency number.

### Requirement 7: Remember decisions and block repeats

**User Story:** As anak, I want a website I blocked to stay blocked, so that my parent is protected even if the same scam message is tapped again.

#### Acceptance Criteria

1. WHEN a link is checked, THE Server SHALL first look for the latest decision on the same domain since the last demo reset.
2. WHEN that decision is BLOCKED, THE Parent App SHALL immediately show "Pautan ini telah disekat" without creating a new Incident.
3. THE Server SHALL ignore remembered decisions for simulated (demo-mode) scans.

### Requirement 8: Senior-friendly and Bahasa Malaysia

**User Story:** As Puan Rosnah, I want large, simple screens in my language, so that I understand what to do on a small phone.

#### Acceptance Criteria

1. THE Parent App, Anak App and Web Dashboard SHALL use Bahasa Malaysia for all user-facing text, warnings and error messages.
2. THE Parent App SHALL show its main instructions in text of at least 16sp and headings of at least 28sp, with buttons at least 60dp tall. Only secondary footnotes may be smaller, and never below 13sp.
3. THE Parent App SHALL use plain words ("pautan", "anak anda", "scam") and avoid technical terms.
4. THE Web Dashboard SHALL keep keyboard focus inside the protective pause, and SHALL announce status changes to assistive technology.

### Requirement 9: Security and privacy

**User Story:** As a family, we want our alerts to be private and controlled by us, so that strangers cannot approve links or read our activity.

#### Acceptance Criteria

1. THE Server SHALL require a role PIN to sign in. It SHALL compare PINs in constant time and limit failed attempts to 12 per IP address per 10 minutes.
2. THE Server SHALL allow only ibu/bapa sessions to scan links or record a 997 decision, and only anak sessions to resolve Incidents.
3. THE Server SHALL bind to `127.0.0.1` by default and SHALL only be reachable from other devices when `HOST=0.0.0.0` is set.
4. THE Web Dashboard SHALL send a strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff` and `no-referrer`.
5. THE Server SHALL hide the backup family number from the ibu/bapa view.

### Requirement 10: Fail safely

**User Story:** As Puan Rosnah, I want the safest choice to be the easiest one when something goes wrong.

#### Acceptance Criteria

1. IF the Parent App cannot reach the Server, THEN it SHALL show "Pautan ini belum dapat disemak" with "Jangan buka (lebih selamat)" as the first, largest option, plus "Cuba lagi". It SHALL offer "Buka juga tanpa semakan" only as a small, low-emphasis text button, and only after a confirmation.
2. WHEN the Server restarts, THE Server SHALL restore every unresolved Incident and its original deadline.
3. WHEN a session is no longer valid (for example after a Server restart), THE apps SHALL sign in again automatically using the saved setup.
4. IF no other browser is installed, THEN THE Parent App SHALL tell the user to install Chrome instead of failing silently.

### Requirement 11: Demonstration support

**User Story:** As a presenter, I want to repeat the demo reliably, so that the finale presentation runs smoothly.

#### Acceptance Criteria

1. THE Parent App SHALL provide "Cuba pautan scam contoh" and "Cuba pautan selamat" buttons.
2. THE Web Dashboard SHALL provide "Pulihkan mesej demo". This SHALL restore demo messages and clear remembered decisions without deleting history.
3. THE Timeout SHALL be configurable from 15 to 3600 seconds through `INCIDENT_TIMEOUT_SECONDS`.
4. THE Web Dashboard SHALL include a WhatsApp-style demo phone for audiences without an Android device.

## Future work

- **Call screening** for Puan Rosnah's key worry ("Is this caller really from the police or the bank?"), using Android's call-screening role to warn about unknown callers.
- **Message text scoring**, to catch "Hi Mum, new number" messages and prize, job-offer and investment messages that ask for a card number or TAC.
- **Self-check mode** for users with no anak, such as a 21-year-old student, who would see the reasons directly.
- **Production setup**: hosted HTTPS server, real accounts and device pairing, push notifications, and a verified URL-reputation service.
