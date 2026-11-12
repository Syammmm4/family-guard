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
 *  - no answer in time    -> "Hubungi 997" button
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
    private var source = "Aplikasi lain"
    private var incidentId: String? = null
    private var expiresAt = 0L
    private var decided = false
    private var isResumedNow = false
    private var openWhenResumed = false
    private var guardianName = "anak anda"
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
            if (!Browsers.open(this, url)) Toast.makeText(this, "Tiada pelayar lain dijumpai. Sila pasang Chrome.", Toast.LENGTH_LONG).show()
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

    /** Which app the link was tapped in, e.g. "WhatsApp". Shown to anak. */
    private fun sourceLabel(): String = when (referrer?.host) {
        null -> "Aplikasi lain"
        "com.whatsapp" -> "WhatsApp"
        "com.whatsapp.w4b" -> "WhatsApp Business"
        "org.telegram.messenger" -> "Telegram"
        "com.google.android.apps.messaging", "com.samsung.android.messaging" -> "Mesej SMS"
        "com.facebook.orca" -> "Messenger"
        "com.facebook.katana" -> "Facebook"
        packageName -> "Ujian Family Guard"
        else -> "Aplikasi lain"
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
        tips = incident.optJSONArray("tips")?.let { arr -> List(arr.length()) { arr.optString(it) }.filter { it.isNotBlank() } } ?: emptyList()
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
            result.onFailure { e -> Toast.makeText(this, e.message, Toast.LENGTH_LONG).show() }
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
            Toast.makeText(this, "Tiada pelayar lain dijumpai. Sila pasang Chrome.", Toast.LENGTH_LONG).show()
        }
    }

    private fun dial(number: String) {
        try {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
        } catch (e: Exception) {
            Toast.makeText(this, "Tidak dapat membuka aplikasi telefon.", Toast.LENGTH_LONG).show()
        }
    }

    private fun confirm(message: String, yes: String, action: () -> Unit) {
        AlertDialog.Builder(this)
            .setMessage(message)
            .setPositiveButton(yes) { _, _ -> action() }
            .setNegativeButton("Batal", null)
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
        ui.text(card, "Dari: $source", 14f, Palette.onDark, top = 6)
    }

    private fun showChecking() {
        val col = begin(Screen.CHECKING, "MENYEMAK PAUTAN", "🛡️", "Sekejap, kami semak pautan ini…")
        ui.text(col, domain, 17f, Palette.onDark, center = true, top = 12)
    }

    private fun showWaiting(incident: JSONObject) {
        val col = begin(Screen.WAITING, "TUNGGU SEKEJAP", "🔒", "Biar $guardianName sahkan pautan ini dulu.")
        ui.text(col, "Pautan ini menunjukkan tanda-tanda scam. Kami sudah hantar kepada $guardianName untuk disemak. Jangan buka pautan ini sementara menunggu.", 18f, Palette.onDark, center = true, top = 12)
        linkCard(col, "Pautan mencurigakan", incident.optString("domain", domain))

        tipsCard(col)

        val timer = ui.card(col, Palette.navyCard, top = 16)
        ui.text(timer, "Menunggu jawapan anak", 16f, Palette.onDark, center = true)
        countdownView = ui.text(timer, "", 44f, Palette.white, bold = true, center = true, top = 4)
        ui.text(timer, "Jika $guardianName tidak menjawab dalam ${durationText(timeoutSeconds)}, kami akan tunjukkan apa yang perlu dibuat.", 16f, Palette.onDark, center = true, top = 4)
        handler.post(tickTask)

        guardianPhone?.let { phone ->
            ui.button(col, "📞  Hubungi $guardianName", Palette.mint, Palette.greenDark, top = 20) { dial(phone) }
        }
        ui.button(col, "Kembali ke telefon (pautan tidak dibuka)", Palette.navy, Palette.white, top = 12, stroke = Palette.onDark) { finish() }
        ui.text(col, "Telefon anda boleh digunakan seperti biasa. Kami akan beritahu anda apabila $guardianName menjawab.", 16f, Palette.white, center = true, top = 14)
    }

    /** Up to 2 plain-language reasons, so the parent learns why the link looks dangerous. */
    private fun tipsCard(col: LinearLayout) {
        if (tips.isEmpty()) return
        val card = ui.card(col, Palette.navyCard, top = 14)
        ui.text(card, "Kenapa pautan ini bahaya?", 16f, Palette.mint, bold = true)
        for (tip in tips) ui.text(card, "•  $tip", 17f, Palette.white, top = 6)
    }

    private fun showEscalated(incident: JSONObject) {
        val col = begin(Screen.ESCALATED, "ANAK ANDA BELUM MENJAWAB", "✋", "Jangan buka pautan ini.")
        ui.text(col, "$guardianName belum menjawab dalam ${durationText(timeoutSeconds)}. Hubungi $guardianName atau ahli keluarga lain untuk bertanya dahulu.", 18f, Palette.onDark, center = true, top = 12)
        linkCard(col, "Pautan mencurigakan", incident.str("displayUrl") ?: domain)
        tipsCard(col)

        guardianPhone?.let { phone ->
            ui.button(col, "📞  Hubungi $guardianName", Palette.mint, Palette.greenDark, top = 22) { dial(phone) }
        }
        ui.button(col, "⛔  Saya tidak akan buka. Sekat pautan ini.", Palette.redSoft, Palette.redInk, top = 12) {
            confirm("Sekat pautan ini? Ia tidak akan dibuka.", "Ya, sekat") { blockMyself() }
        }

        val money = ui.card(col, Palette.navyCard, top = 22, stroke = Palette.red)
        ui.text(money, "Sudah beri maklumat bank, OTP atau pindah wang?", 17f, Palette.white, bold = true)
        ui.text(money, "Hubungi bank anda dan Pusat Respons Scam Kebangsaan (NSRC) 997 dengan segera.", 16f, Palette.onDark, top = 6)
        ui.button(money, "📞  Hubungi 997 sekarang", Palette.red, Palette.white, top = 12) { dial("997") }

        ui.text(col, "Hanya $guardianName boleh membenarkan pautan ini dibuka.", 16f, Palette.white, center = true, top = 16)
    }

    private fun showSafe() {
        val col = begin(Screen.SAFE, "DISAHKAN SELAMAT", "✅", "$guardianName kata pautan ini selamat.")
        ui.text(col, "Pautan akan dibuka sekarang.", 18f, Palette.onDark, center = true, top = 12)
        ui.button(col, "Buka pautan", Palette.mint, Palette.greenDark, top = 24) { openAndFinish() }
        handler.postDelayed({ if (!isDestroyed && !isFinishing) openAndFinish() }, 1500)
    }

    private fun showBlocked(byParent: Boolean, remembered: Boolean) {
        screen = Screen.BLOCKED
        handler.removeCallbacks(pollTask)
        val title = if (byParent) "Pautan telah disekat." else "Ini SCAM. Pautan telah disekat."
        val col = begin(Screen.BLOCKED, "PAUTAN DISEKAT", "⛔", title)
        val why = when {
            remembered -> "Laman ini telah disahkan scam sebelum ini. Family Guard menyekatnya terus."
            byParent -> "Anda memilih untuk tidak membuka pautan ini. Pilihan yang selamat."
            else -> "$guardianName telah sahkan pautan ini sebagai scam."
        }
        ui.text(col, why, 18f, Palette.onDark, center = true, top = 12)
        ui.text(col, "Jangan tekan pautan ini lagi. Jika ditekan, ia akan terus disekat.", 18f, Palette.white, bold = true, center = true, top = 14)
        ui.button(col, "Kembali ke telefon", Palette.mint, Palette.greenDark, top = 24) { finish() }
        ui.text(col, "Jika anda sudah memberi maklumat bank, OTP atau memindahkan wang, hubungi bank anda dan NSRC 997 segera.", 16f, Palette.peach, center = true, top = 18)
        ui.button(col, "📞  Hubungi 997", Palette.navy, Palette.white, top = 12, stroke = Palette.onDark) { dial("997") }
    }

    private fun showOffline(message: String?) {
        val col = begin(Screen.OFFLINE, "TIDAK DAPAT MENYEMAK", "📡", "Pautan ini belum dapat disemak.")
        ui.text(col, message ?: "Ralat tidak diketahui.", 17f, Palette.onDark, center = true, top = 12)
        ui.button(col, "Jangan buka (lebih selamat)", Palette.mint, Palette.greenDark, top = 24) { finish() }
        ui.button(col, "Cuba lagi", Palette.navy, Palette.white, top = 12, stroke = Palette.onDark) { showChecking(); scan() }
        // Deliberately small and low-contrast: the safe choices above are the easy ones.
        ui.quietButton(col, "Buka juga tanpa semakan", Palette.onDark, top = 24) {
            confirm("Pautan ini BELUM disemak dan mungkin scam. Anda pasti mahu buka?", "Buka juga") { openAndFinish() }
        }
    }

    private fun showBusy() {
        val col = begin(Screen.BUSY, "SATU PAUTAN SEDANG DISEMAK", "⏳", "Tunggu jawapan untuk pautan sebelumnya dulu.")
        ui.text(col, "$guardianName sedang menyemak pautan lain yang anda tekan. Cuba pautan ini lagi selepas itu.", 18f, Palette.onDark, center = true, top = 12)
        ui.button(col, "Kembali ke telefon", Palette.mint, Palette.greenDark, top = 24) { finish() }
    }

    // ---------------------------------------------------------------- helpers

    private fun parseTime(iso: String): Long = try {
        Instant.parse(iso).toEpochMilli()
    } catch (e: Exception) {
        System.currentTimeMillis() + timeoutSeconds * 1000L
    }

    private fun clock(seconds: Long): String = "%02d:%02d".format(seconds / 60, seconds % 60)

    private fun durationText(seconds: Int): String = if (seconds >= 60) "${(seconds + 30) / 60} minit" else "$seconds saat"

    companion object {
        /** The alert currently shown on screen, so the background watcher does not notify about it twice. */
        @Volatile
        var visibleIncidentId: String? = null
    }
}
