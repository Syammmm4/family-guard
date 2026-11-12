# Family Guard - presenter guide

For Nur Imamulhaq, Project Manager. Prepared 4 November 2026.

## Opening in English

Thank you for your time. I am Nur Imamulhaq, the project manager of Family Guard. Our team is exploring a simple question: how can an older adult pause before opening a suspicious link and involve someone they trust? Today, we will show our working prototype, explain its current limits and propose a small evaluation with corporate partners.

## Optional opening in Malay

Terima kasih atas masa yang diberikan. Saya Nur Imamulhaq, pengurus projek Family Guard. Sistem ini membantu warga emas berhenti seketika apabila pautan menunjukkan tanda mencurigakan, kemudian mendapatkan semakan ahli keluarga yang dipercayai. Hari ini kami akan menunjukkan prototaip, menerangkan skop semasa dan mencadangkan satu penilaian bersama pihak syarikat.

## How to frame the discussion

The CEOs are the presentation audience and potential sponsors. Older adults and guardians are the users. Explain the human problem before technical details. Business applications are hypotheses: an employee family programme or a customer scam-awareness pilot. No loss-reduction claim or financial forecast has been measured.

## Before the meeting

1. Extract `Family_Guard_Source_Code.zip`. Install Node.js if needed.
2. Open a terminal in `family-guard`. Run `npm ci`, copy `.env.example` to `.env`, then run `npm start`.
3. Keep the server terminal open. Open `http://127.0.0.1:3000` in two tabs.
4. Senior sample PIN: `1357`. Guardian sample PIN: `2468`. Change both before a shared-network demonstration.
5. Keep SMS credentials and phone fields blank for the meeting. No real calls are needed.
6. Play the downloaded MP4 locally as a dependable presentation path. Confirm sound and captions before the meeting.
7. The source default is 180 seconds. If you set `INCIDENT_TIMEOUT_SECONDS=20` for a live demo, restart the server and explicitly announce the shortened timer. Restore 180 afterwards.

## Live demonstration

1. Sign into Senior in one tab and Guardian in the other. Show that the roles have separate views.
2. Paste `https://www.google.com` in Senior and run the check. Explain that no obvious indicators does not guarantee safety.
3. Paste the fictional address `https://maybank-secure-verification.example/verify`. Check it without opening that destination.
4. Show the in-app protective pause, then the guardian's warning reasons and deadline.
5. In Guardian, choose **Block link & unlock**, accept the confirmation and show the released Senior view and history.
6. For the unavailable-guardian scenario, leave Guardian closed or disconnected, create another incident and allow the configured deadline to expire. The server must stay running.
7. Show the escalated state and manual contact actions without tapping any telephone link. Backup SMS works only when configured and is disabled in this package's demonstration.
8. Reopen Guardian, sign in if needed and resolve the incident. Explain that reconnection gives the current server state.

If money has already been transferred or an unauthorised transaction is suspected, the family should seek bank/NSRC help immediately. The app's response timer is not a reason to wait.

## Likely CEO questions

**What is the business value?**
The hypothesis is clearer family support during a confusing link encounter. We propose measuring understanding, completion, response delay and support effort. We have not established savings, revenue or demand.

**How is this different from a basic link checker?**
The focus is the family review workflow: an understandable pause, a guardian decision, a visible deadline and a follow-up record. The URL checker is currently basic and needs validated threat intelligence for a production use case.

**Does it lock the entire phone?**
The current browser prototype covers Family Guard only. Native device interventions and supported link interception require a separate feasibility project.

**Does it call the guardian twice or automatically call 997?**
Those automatic guardian calls are not implemented. The website offers manual contact actions. It does not silently dial the hotline. The optional integration sends family SMS only when configured.

**Can it work when everyone is offline?**
The server can keep a deadline when the guardian disconnects, and it sends current state on reconnection. A disconnected senior cannot submit new checks to this server. Full local mobile protection is further work.

**Is the system secure enough to launch?**
It is a local, single-family prototype with role PINs. Production requires secure enrollment, separate family authorization, HTTPS, a managed database, a retention policy, delivery monitoring and security review.

**What does the team need from the three companies?**
One nominated sponsor per company, a shared pilot brief, agreed participant access and evaluation priorities, and a cost ceiling. Each company can choose a contribution after discussion. No participation is presumed.

**How much will it cost?**
The budget has not been agreed. Estimate people effort, hosting, threat intelligence, messaging and user research from actual scope and quotations. There is no invented cost or financial return in the report.

**When can it go live?**
The proposed six weeks are for evaluation. A production launch date depends on the feasibility and evidence review.

## Closing

Our request is to agree one focused evaluation, with clear owners and a review point. If the evidence shows that families understand and can use the workflow reliably, we can define the next engineering stage together. Thank you.
