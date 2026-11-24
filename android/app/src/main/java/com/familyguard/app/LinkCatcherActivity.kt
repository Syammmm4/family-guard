package com.familyguard.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.time.Instant

/**
 * Ibu/bapa mode. Family Guard is the default browser, so a link tapped in WhatsApp opens here first:
 *  - safe link            -> handed straight to Chrome (the parent barely notices)
 *  - risky link           -> "Biar anak anda sahkan pautan ini dulu" while anak decides
 *  - no answer in time    -> "Jangan buka pautan ini", with 997 for when money or details were given
 *  - already blocked site -> blocked immediately
 * The parent can always go back to WhatsApp; only this one link waits. The phone is never locked.
 */
class LinkCatcherActivity : Activity() {

    private enum class Screen { CHECKING, WAITING, ESCALATED, SAFE, BLOCKED, OFFLINE, BUSY }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var ui: Ui
    private var screen = Screen.CHECKING
    private var url = ""
    private var domain = ""
    private var source = ""
    private var incidentId: String? = null
    private var expiresAt = 0L
    private var decided = false
    private var isResumedNow = false
    private var openWhenResumed = false
    private var guardianName = ""
    private var guardianPhone: String? = null
    private var timeoutSeconds = 180
    private var countdownView: TextView? = null
    private var tips: List<String> = emptyList()

    private val pollTask = object : Runnable {
        override fun run() { poll() }
    }
    private val tickTask = object : Runnable {
        override fun run() {
            countdownView?.text = clock(((expiresAt - System.currentTimeMillis()) / 1000).coerceAtLeast(0))
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ui = Ui(this)
        guardianName = tr("anak anda", "your anak")
        val data = intent?.data
        val scheme = data?.scheme?.lowercase()
        if (data == null || (scheme != "http" && scheme != "https")) {
            finish()
            return
        }
        url = data.toString()
        domain = (data.host ?: "").lowercase().trimEnd('.')
        source = sourceLabel()

        // Not a protected parent phone (not set up, or this is anak's phone): behave like a normal hand-off.
        if (!Prefs(this).isParent) {
            if (!Browsers.open(this, url)) toast(noBrowser())
            finish()
            return
        }
        showChecking()
        scan()
    }

    override fun onResume() {
        super.onResume()
        isResumedNow = true
        visibleIncidentId = incidentId
        if (openWhenResumed) openAndFinish()
    }

    override fun onPause() {
        isResumedNow = false
        if (visibleIncidentId == incidentId) visibleIncidentId = null
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun toast(text: String?) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
    private fun noBrowser() = tr("Tiada pelayar lain dijumpai. Sila pasang Chrome.", "No other browser found. Please install Chrome.")

    /** Which app the link was tapped in, e.g. "WhatsApp". Shown to anak. */
    private fun sourceLabel(): String = when (referrer?.host) {
        "com.whatsapp" -> "WhatsApp"
        "com.whatsapp.w4b" -> "WhatsApp Business"
        "org.telegram.messenger" -> "Telegram"
        "com.google.android.apps.messaging", "com.samsung.android.messaging" -> tr("Mesej SMS", "SMS messages")
        "com.facebook.orca" -> "Messenger"
        "com.facebook.katana" -> "Facebook"
        packageName -> tr("Ujian Family Guard", "Family Guard test")
        else -> tr("Aplikasi lain", "Another app")
    }

    // ---------------------------------------------------------------- server

    private fun scan() {
        val body = JSONObject().put("url", url).put("simulate", false).put("source", source)
        Bg.task({ Api.call(this, "POST", "/api/scan", body) }) { result ->
            if (isDestroyed) return@task
            result.onSuccess { json -> handleScan(json) }
            result.onFailure { e ->
                if (e is ApiException && e.status == 409) adoptActiveAlert() else showOffline(e.message)
            }
        }
    }

    private fun handleScan(json: JSONObject) {
        val remembered = json.str("remembered")
        when {
            remembered == "BLOCKED" -> showBlocked(byParent = false, remembered = true)
            json.optBoolean("triggered") -> startWaiting(json.getJSONObject("incident"))
            else -> openAndFinish() // low risk, or anak already said this site is safe
        }
    }

    /** Another alert is already active. If it is for this same website (tapped again), keep waiting for it. */
    private fun adoptActiveAlert() {
        Bg.task({ Api.call(this, "GET", "/api/state") }) { result ->
            if (isDestroyed) return@task
            result.onSuccess { state ->
                readNames(state)
                val active = state.optJSONObject("active")
                if (active != null && active.optString("domain") == domain) startWaiting(active) else showBusy()
            }
            result.onFailure { e -> showOffline(e.message) }
        }
    }

    private fun startWaiting(incident: JSONObject) {
        val id = incident.getString("id")
        incidentId = id
        if (isResumedNow) visibleIncidentId = id
        expiresAt = parseTime(incident.optString("expiresAt"))
        tips = incident.textList(this, "tips")
        val escalated = incident.optString("status") == "ESCALATED"
        if (escalated) showEscalated(incident) else showWaiting(incident)
        // Keeps watching even if the parent leaves this screen, and notifies them of the decision.
        try {
            ParentWatchService.start(this, id, url, domain, guardianName, escalated)
        } catch (e: Exception) {
            // Not fatal: this screen still checks while it is open.
        }
        handler.removeCallbacks(pollTask)
        handler.post(pollTask)
    }

    private fun poll() {
        val id = incidentId ?: return
        if (decided) return
        Bg.task({ Api.call(this, "GET", "/api/state") }) { result ->
            if (isDestroyed || decided) return@task
            result.onSuccess { state -> applyState(id, state) }
            // On a network blip just try again.
            if (!decided) handler.postDelayed(pollTask, 2000)
        }
    }

    private fun applyState(id: String, state: JSONObject) {
        readNames(state)
        val active = state.optJSONObject("active")
        if (active != null && active.optString("id") == id) {
            val status = active.optString("status")
            if (status == "ESCALATED" && screen != Screen.ESCALATED) showEscalated(active)
            return
        }
        val last = state.optJSONObject("lastResolved")
        if (last != null && last.optString("id") == id) {
            decided = true
            handler.removeCallbacks(pollTask)
            val byParent = last.optString("decidedBy") == "IBU_BAPA"
            if (last.optString("decision") == "SAFE") showSafe() else showBlocked(byParent = byParent, remembered = false)
        }
    }

    private fun readNames(state: JSONObject) {
        guardianName = state.str("guardianName") ?: guardianName
        guardianPhone = state.str("guardianPhone")
        timeoutSeconds = state.optInt("timeoutSeconds", timeoutSeconds)
    }

    /** After the timeout the parent may block the link themselves. Only anak can allow it. */
    private fun blockMyself() {
        val id = incidentId ?: return
        Bg.task({ Api.call(this, "POST", "/api/incidents/${Uri.encode(id)}/report-997", JSONObject().put("decision", "BLOCKED")) }) { result ->
            if (isDestroyed) return@task
            result.onSuccess { handler.removeCallbacks(pollTask); handler.post(pollTask) }
            result.onFailure { e -> toast(e.message) }
        }
    }

    // ---------------------------------------------------------------- actions

    private fun openAndFinish() {
        if (!isResumedNow) {
            // Android does not allow opening another app from the background. Open when the parent returns.
            openWhenResumed = true
            return
        }
        openWhenResumed = false
        if (Browsers.open(this, url)) {
            finish()
        } else {
            toast(noBrowser())
        }
    }

    private fun dial(number: String) {
        try {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
        } catch (e: Exception) {
            toast(tr("Tidak dapat membuka aplikasi telefon.", "Cannot open the phone app."))
        }
    }

    private fun confirm(message: String, yes: String, action: () -> Unit) {
        AlertDialog.Builder(this)
            .setMessage(message)
            .setPositiveButton(yes) { _, _ -> action() }
            .setNegativeButton(tr("Batal", "Cancel"), null)
            .show()
    }

    // ---------------------------------------------------------------- screens

    private fun begin(next: Screen, topline: String, icon: String, title: String): LinearLayout {
        screen = next
        countdownView = null
        handler.removeCallbacks(tickTask)
        val (root, col) = ui.page(Palette.navy, centered = true)
        ui.text(col, "familyguard.", 16f, Palette.mint, bold = true, center = true)
        ui.text(col, icon, 54f, Palette.white, center = true, top = 24)
        ui.text(col, topline, 14f, Palette.mint, bold = true, center = true, top = 12)
        ui.text(col, title, 28f, Palette.white, bold = true, center = true, top = 10)
        setContentView(root)
        return col
    }

    private fun linkCard(col: LinearLayout, label: String, value: String) {
        val card = ui.card(col, Palette.navyCard, top = 22)
        ui.text(card, "⚠️  $label", 16f, Palette.peach, bold = true)
        ui.text(card, value, 16f, Palette.white, top = 6)
        ui.text(card, tr("Dari: $source", "From: $source"), 14f, Palette.onDark, top = 6)
    }

    private fun showChecking() {
        val col = begin(Screen.CHECKING, tr("MENYEMAK PAUTAN", "CHECKING LINK"), "🛡️", tr("Sekejap, kami semak pautan ini…", "One moment, we are checking this link…"))
        ui.text(col, domain, 17f, Palette.onDark, center = true, top = 12)
    }

    private fun showWaiting(incident: JSONObject) {
        val anak = guardianName
        val col = begin(Screen.WAITING, tr("TUNGGU SEKEJAP", "PLEASE WAIT"), "🔒", tr("Biar $anak sahkan pautan ini dulu.", "Let $anak check this link first."))
        ui.text(col, tr(
            "Pautan ini menunjukkan tanda-tanda scam. Kami sudah hantar kepada $anak untuk disemak. Jangan buka pautan ini sementara menunggu.",
            "This link shows signs of a scam. We have sent it to $anak to check. Please do not open it while you wait."
        ), 18f, Palette.onDark, center = true, top = 12)
        linkCard(col, tr("Pautan mencurigakan", "Suspicious link"), incident.optString("domain", domain))

        tipsCard(col)

        val timer = ui.card(col, Palette.navyCard, top = 16)
        ui.text(timer, tr("Menunggu jawapan anak", "Waiting for anak to answer"), 16f, Palette.onDark, center = true)
        countdownView = ui.text(timer, "", 44f, Palette.white, bold = true, center = true, top = 4)
        ui.text(timer, tr(
            "Jika $anak tidak menjawab dalam ${durationText(timeoutSeconds)}, kami akan tunjukkan apa yang perlu dibuat.",
            "If $anak does not answer within ${durationText(timeoutSeconds)}, we will show you what to do."
        ), 16f, Palette.onDark, center = true, top = 4)
        handler.post(tickTask)

        guardianPhone?.let { phone ->
            ui.button(col, tr("📞  Hubungi $anak", "📞  Call $anak"), Palette.mint, Palette.greenDark, top = 20) { dial(phone) }
        }
        ui.button(col, tr("Kembali ke telefon (pautan tidak dibuka)", "Back to my phone (link not opened)"), Palette.navy, Palette.white, top = 12, stroke = Palette.onDark) { finish() }
        ui.text(col, tr(
            "Telefon anda boleh digunakan seperti biasa. Kami akan beritahu anda apabila $anak menjawab.",
            "You can use your phone as usual. We will tell you when $anak answers."
        ), 16f, Palette.white, center = true, top = 14)
    }

    /** Up to 2 plain-language reasons, so the parent learns why the link looks dangerous. */
    private fun tipsCard(col: LinearLayout) {
        if (tips.isEmpty()) return
        val card = ui.card(col, Palette.navyCard, top = 14)
        ui.text(card, tr("Kenapa pautan ini bahaya?", "Why is this link dangerous?"), 16f, Palette.mint, bold = true)
        for (tip in tips) ui.text(card, "•  $tip", 17f, Palette.white, top = 6)
    }

    private fun showEscalated(incident: JSONObject) {
        val anak = guardianName
        val col = begin(Screen.ESCALATED, tr("ANAK ANDA BELUM MENJAWAB", "YOUR ANAK HAS NOT ANSWERED YET"), "✋", tr("Jangan buka pautan ini.", "Do not open this link."))
        ui.text(col, tr(
            "$anak belum menjawab dalam ${durationText(timeoutSeconds)}. Hubungi $anak atau ahli keluarga lain untuk bertanya dahulu.",
            "$anak has not answered within ${durationText(timeoutSeconds)}. Call $anak or another family member to ask first."
        ), 18f, Palette.onDark, center = true, top = 12)
        linkCard(col, tr("Pautan mencurigakan", "Suspicious link"), incident.str("displayUrl") ?: domain)
        tips = incident.textList(this, "tips")
        tipsCard(col)

        guardianPhone?.let { phone ->
            ui.button(col, tr("📞  Hubungi $anak", "📞  Call $anak"), Palette.mint, Palette.greenDark, top = 22) { dial(phone) }
        }
        ui.button(col, tr("⛔  Saya tidak akan buka. Sekat pautan ini.", "⛔  I won't open it. Block this link."), Palette.redSoft, Palette.redInk, top = 12) {
            confirm(tr("Sekat pautan ini? Ia tidak akan dibuka.", "Block this link? It will not be opened."), tr("Ya, sekat", "Yes, block")) { blockMyself() }
        }

        val money = ui.card(col, Palette.navyCard, top = 22, stroke = Palette.red)
        ui.text(money, tr("Sudah beri maklumat bank, OTP atau pindah wang?", "Already gave bank details, an OTP or sent money?"), 17f, Palette.white, bold = true)
        ui.text(money, tr(
            "Hubungi bank anda dan Pusat Respons Scam Kebangsaan (NSRC) 997 dengan segera.",
            "Contact your bank and the National Scam Response Centre (NSRC) on 997 immediately."
        ), 16f, Palette.onDark, top = 6)
        ui.button(money, tr("📞  Hubungi 997 sekarang", "📞  Call 997 now"), Palette.red, Palette.white, top = 12) { dial("997") }

        ui.text(col, tr("Hanya $anak boleh membenarkan pautan ini dibuka.", "Only $anak can allow this link to open."), 16f, Palette.white, center = true, top = 16)
    }

    private fun showSafe() {
        val col = begin(Screen.SAFE, tr("DISAHKAN SELAMAT", "CONFIRMED SAFE"), "✅", tr("$guardianName kata pautan ini selamat.", "$guardianName says this link is safe."))
        ui.text(col, tr("Pautan akan dibuka sekarang.", "The link will open now."), 18f, Palette.onDark, center = true, top = 12)
        ui.button(col, tr("Buka pautan", "Open link"), Palette.mint, Palette.greenDark, top = 24) { openAndFinish() }
        handler.postDelayed({ if (!isDestroyed && !isFinishing) openAndFinish() }, 1500)
    }

    private fun showBlocked(byParent: Boolean, remembered: Boolean) {
        screen = Screen.BLOCKED
        handler.removeCallbacks(pollTask)
        val title = if (byParent) tr("Pautan telah disekat.", "The link is blocked.") else tr("Ini SCAM. Pautan telah disekat.", "This is a SCAM. The link is blocked.")
        val col = begin(Screen.BLOCKED, tr("PAUTAN DISEKAT", "LINK BLOCKED"), "⛔", title)
        val why = when {
            remembered -> tr("Laman ini telah disahkan scam sebelum ini. Family Guard menyekatnya terus.", "This site was already confirmed as a scam. Family Guard blocks it straight away.")
            byParent -> tr("Anda memilih untuk tidak membuka pautan ini. Pilihan yang selamat.", "You chose not to open this link. That was the safe choice.")
            else -> tr("$guardianName telah sahkan pautan ini sebagai scam.", "$guardianName confirmed this link is a scam.")
        }
        ui.text(col, why, 18f, Palette.onDark, center = true, top = 12)
        ui.text(col, tr("Jangan tekan pautan ini lagi. Jika ditekan, ia akan terus disekat.", "Do not tap this link again. If you do, it will be blocked straight away."), 18f, Palette.white, bold = true, center = true, top = 14)
        ui.button(col, tr("Kembali ke telefon", "Back to my phone"), Palette.mint, Palette.greenDark, top = 24) { finish() }
        ui.text(col, tr(
            "Jika anda sudah memberi maklumat bank, OTP atau memindahkan wang, hubungi bank anda dan NSRC 997 segera.",
            "If you have already given bank details or an OTP, or sent money, contact your bank and NSRC 997 immediately."
        ), 16f, Palette.peach, center = true, top = 18)
        ui.button(col, tr("📞  Hubungi 997", "📞  Call 997"), Palette.navy, Palette.white, top = 12, stroke = Palette.onDark) { dial("997") }
    }

    private fun showOffline(message: String?) {
        val col = begin(Screen.OFFLINE, tr("TIDAK DAPAT MENYEMAK", "CANNOT CHECK"), "📡", tr("Pautan ini belum dapat disemak.", "This link could not be checked yet."))
        ui.text(col, message ?: tr("Ralat tidak diketahui.", "Unknown error."), 17f, Palette.onDark, center = true, top = 12)
        ui.button(col, tr("Jangan buka (lebih selamat)", "Don't open it (safer)"), Palette.mint, Palette.greenDark, top = 24) { finish() }
        ui.button(col, tr("Cuba lagi", "Try again"), Palette.navy, Palette.white, top = 12, stroke = Palette.onDark) { showChecking(); scan() }
        // Deliberately small and low-contrast: the safe choices above are the easy ones.
        ui.quietButton(col, tr("Buka juga tanpa semakan", "Open anyway without a check"), Palette.onDark, top = 24) {
            confirm(
                tr("Pautan ini BELUM disemak dan mungkin scam. Anda pasti mahu buka?", "This link has NOT been checked and may be a scam. Are you sure you want to open it?"),
                tr("Buka juga", "Open anyway")
            ) { openAndFinish() }
        }
    }

    private fun showBusy() {
        val col = begin(Screen.BUSY, tr("SATU PAUTAN SEDANG DISEMAK", "A LINK IS BEING CHECKED"), "⏳", tr("Tunggu jawapan untuk pautan sebelumnya dulu.", "Please wait for the answer about your previous link first."))
        ui.text(col, tr(
            "$guardianName sedang menyemak pautan lain yang anda tekan. Cuba pautan ini lagi selepas itu.",
            "$guardianName is checking another link you tapped. Try this link again after that."
        ), 18f, Palette.onDark, center = true, top = 12)
        ui.button(col, tr("Kembali ke telefon", "Back to my phone"), Palette.mint, Palette.greenDark, top = 24) { finish() }
    }

    // ---------------------------------------------------------------- helpers

    private fun parseTime(iso: String): Long = try {
        Instant.parse(iso).toEpochMilli()
    } catch (e: Exception) {
        System.currentTimeMillis() + timeoutSeconds * 1000L
    }

    private fun clock(seconds: Long): String = "%02d:%02d".format(seconds / 60, seconds % 60)

    companion object {
        /** The alert currently shown on screen, so the background watcher does not notify about it twice. */
        @Volatile
        var visibleIncidentId: String? = null
    }
}
