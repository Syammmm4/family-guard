package com.familyguard.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.role.RoleManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.time.Instant

/** Setup screen, ibu/bapa home screen, and anak dashboard. */
class MainActivity : Activity() {

    private lateinit var ui: Ui
    private lateinit var prefs: Prefs
    private val handler = Handler(Looper.getMainLooper())
    private var isVisibleNow = false

    // Anak dashboard state
    private var anakBox: LinearLayout? = null
    private var anakKey: String? = null
    private var anakCountdown: TextView? = null
    private var anakExpiresAt = 0L

    private val anakPoll = object : Runnable {
        override fun run() { refreshAnak() }
    }
    private val anakTick = object : Runnable {
        override fun run() {
            anakCountdown?.text = clock(((anakExpiresAt - System.currentTimeMillis()) / 1000).coerceAtLeast(0))
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ui = Ui(this)
        prefs = Prefs(this)
    }

    override fun onResume() {
        super.onResume()
        isVisibleNow = true
        render()
    }

    override fun onPause() {
        isVisibleNow = false
        handler.removeCallbacksAndMessages(null)
        super.onPause()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_BROWSER_ROLE && !Browsers.isFamilyGuardDefault(this)) openDefaultAppsSettings()
    }

    private fun render() {
        handler.removeCallbacksAndMessages(null)
        anakBox = null
        anakKey = null
        anakCountdown = null
        when {
            prefs.isParent -> showParentHome()
            prefs.isAnak -> showAnakHome()
            else -> showSetup()
        }
    }

    /** Top-of-screen button that switches between Bahasa Malaysia and English. */
    private fun languageButton(col: LinearLayout) {
        val label = if (isEn()) "🌐  Bahasa Malaysia" else "🌐  English"
        ui.quietButton(col, label, Palette.greenDark, top = 4) {
            prefs.lang = if (isEn()) Prefs.LANG_MS else Prefs.LANG_EN
            Notifs.ensureChannels(this)
            render()
        }
    }

    // ---------------------------------------------------------------- setup

    private fun showSetup() {
        val (root, col) = ui.page(Palette.paper)
        ui.text(col, "familyguard.", 26f, Palette.green, bold = true)
        languageButton(col)
        ui.text(col, tr("Sediakan telefon ini", "Set up this phone"), 28f, Palette.ink, bold = true, top = 12)
        ui.text(col, tr("Lakukan sekali sahaja. Anak biasanya yang menyediakan telefon ini.", "You only need to do this once. Usually anak sets up this phone."), 16f, Palette.sub, top = 8)

        ui.text(col, tr("Alamat pelayan", "Server address"), 16f, Palette.ink, bold = true, top = 24)
        val server = ui.field(col, prefs.server, tr("cth. https://family-guard-xxxx.onrender.com", "e.g. https://family-guard-xxxx.onrender.com"), Ui.TYPE_URL)
        ui.text(col, tr(
            "Gunakan alamat Render. Ujian di komputer: http://10.0.2.2:3000 (emulator) atau http://ALAMAT-IP:3000 (Wi-Fi sama).",
            "Use the Render address. Testing on a computer: http://10.0.2.2:3000 (emulator) or http://IP-ADDRESS:3000 (same Wi-Fi)."
        ), 14f, Palette.sub, top = 6)

        ui.text(col, tr("Telefon ini milik siapa?", "Whose phone is this?"), 16f, Palette.ink, bold = true, top = 24)
        val group = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val parent = RadioButton(this).apply {
            id = View.generateViewId(); text = tr("Ibu / bapa (dilindungi)", "Ibu / bapa (protected)"); textSize = 19f; setTextColor(Palette.ink); minHeight = ui.dp(52)
        }
        val anak = RadioButton(this).apply {
            id = View.generateViewId(); text = tr("Anak (sahkan pautan untuk ibu/bapa)", "Anak (checks links for ibu/bapa)"); textSize = 19f; setTextColor(Palette.ink); minHeight = ui.dp(52)
        }
        group.addView(parent)
        group.addView(anak)
        group.check(if (prefs.role == Prefs.ROLE_ANAK) anak.id else parent.id)
        col.addView(group)

        ui.text(col, tr("PIN akses", "Access PIN"), 16f, Palette.ink, bold = true, top = 18)
        val pin = ui.field(col, "", tr("Masukkan PIN", "Enter PIN"), Ui.TYPE_PIN)
        val error = ui.text(col, "", 15f, Palette.redInk, top = 10)

        lateinit var submit: android.widget.Button
        submit = ui.button(col, tr("Log masuk", "Sign in"), Palette.green, Palette.white, top = 16) {
            val address = Api.normalizeServer(server.text.toString())
            val role = if (group.checkedRadioButtonId == anak.id) Prefs.ROLE_ANAK else Prefs.ROLE_PARENT
            val code = pin.text.toString().trim()
            if (address.isBlank() || code.isBlank()) {
                error.text = tr("Sila isi alamat pelayan dan PIN.", "Please fill in the server address and PIN.")
                return@button
            }
            submit.isEnabled = false
            error.text = ""
            val en = isEn()
            Bg.task({ Api.login(address, role, code, en) }) { result ->
                submit.isEnabled = true
                result.onSuccess { token ->
                    prefs.server = address
                    prefs.role = role
                    prefs.pin = code
                    prefs.token = token
                    // Both phones use notifications: anak gets alerts, ibu/bapa gets anak's decision.
                    askNotificationPermission()
                    render()
                }
                result.onFailure { e -> error.text = e.message }
            }
        }
        ui.text(col, tr(
            "Minta PIN daripada orang yang menyediakan pelayan. Log masuk pertama mungkin mengambil masa sehingga 1 minit jika pelayan sedang tidur.",
            "Ask the person who set up the server for the PIN. The first sign-in may take up to 1 minute if the server is asleep."
        ), 14f, Palette.sub, top = 14)
        setContentView(root)
    }

    // ---------------------------------------------------------------- ibu/bapa

    private fun showParentHome() {
        val (root, col) = ui.page(Palette.paper)
        ui.text(col, "familyguard.", 22f, Palette.green, bold = true)
        languageButton(col)
        ui.text(col, tr("Selamat datang", "Welcome"), 30f, Palette.ink, bold = true, top = 12)
        ui.text(col, tr("Guna WhatsApp seperti biasa. Jika pautan nampak bahaya, anak anda akan semak dahulu.", "Use WhatsApp as usual. If a link looks dangerous, your anak will check it first."), 17f, Palette.sub, top = 6)

        val active = Browsers.isFamilyGuardDefault(this)
        if (active) {
            val card = ui.card(col, Palette.greenSoft, top = 22)
            ui.text(card, tr("✅  Perlindungan pautan AKTIF", "✅  Link protection is ON"), 20f, Palette.greenDark, bold = true)
            ui.text(card, tr("Pautan yang ditekan dalam WhatsApp, SMS dan aplikasi lain akan disemak dahulu sebelum dibuka.", "Links tapped in WhatsApp, SMS and other apps are checked before they open."), 16f, Palette.ink, top = 6)
        } else {
            val card = ui.card(col, Palette.amberSoft, top = 22)
            ui.text(card, tr("⚠️  Perlindungan belum aktif", "⚠️  Protection is not on yet"), 20f, Palette.amberInk, bold = true)
            ui.text(card, tr(
                "Tetapkan Family Guard sebagai aplikasi pelayar lalai supaya setiap pautan disemak dahulu. Pautan selamat tetap dibuka dalam Chrome.",
                "Set Family Guard as the default browser app so every link is checked first. Safe links still open in Chrome."
            ), 16f, Palette.ink, top = 6)
            ui.button(card, tr("Aktifkan perlindungan", "Turn on protection"), Palette.green, Palette.white, top = 14) { requestBrowserRole() }
        }

        val test = ui.card(col, Palette.white, top = 16, stroke = Palette.line)
        ui.text(test, tr("Cuba sekarang", "Try it now"), 19f, Palette.ink, bold = true)
        ui.text(test, tr("Lihat apa yang berlaku apabila pautan ditekan.", "See what happens when a link is tapped."), 15f, Palette.sub, top = 4)
        ui.button(test, tr("Cuba pautan scam contoh", "Try a sample scam link"), Palette.redSoft, Palette.redInk, top = 12) {
            openCatcher("https://maybank-secure-verification.example/verify")
        }
        ui.button(test, tr("Cuba pautan selamat", "Try a safe link"), Palette.greenSoft, Palette.greenDark, top = 10) {
            openCatcher("https://www.google.com")
        }

        val how = ui.card(col, Palette.white, top = 16, stroke = Palette.line)
        ui.text(how, tr("Cara ia berfungsi", "How it works"), 19f, Palette.ink, bold = true)
        ui.text(how, tr("1.  Tekan pautan dalam WhatsApp seperti biasa.", "1.  Tap links in WhatsApp as usual."), 16f, Palette.ink, top = 10)
        ui.text(how, tr("2.  Pautan selamat terus dibuka.", "2.  Safe links open straight away."), 16f, Palette.ink, top = 6)
        ui.text(how, tr("3.  Pautan bahaya: anak anda sahkan dahulu. Telefon anda boleh digunakan seperti biasa.", "3.  Dangerous links: your anak checks first. You can use your phone as usual."), 16f, Palette.ink, top = 6)
        ui.text(how, tr("4.  Anda akan dimaklumkan apabila anak menjawab.", "4.  You will be told when anak answers."), 16f, Palette.ink, top = 6)
        ui.text(how, tr("5.  Anak tidak menjawab? Jangan buka pautan itu. Jika wang sudah hilang, hubungi bank dan 997.", "5.  Anak didn't answer? Don't open the link. If money has been lost, contact your bank and 997."), 16f, Palette.ink, top = 6)

        if (!Notifs.canNotify(this)) {
            val warn = ui.card(col, Palette.amberSoft, top = 16)
            ui.text(warn, tr("⚠️  Notifikasi dimatikan", "⚠️  Notifications are off"), 18f, Palette.amberInk, bold = true)
            ui.text(warn, tr("Benarkan notifikasi supaya anda tahu jawapan anak walaupun anda sedang guna aplikasi lain.", "Allow notifications so you hear anak's answer even while using other apps."), 16f, Palette.ink, top = 4)
            ui.button(warn, tr("Benarkan notifikasi", "Allow notifications"), Palette.green, Palette.white, top = 12) { askNotificationPermission() }
        }

        val conn = ui.text(col, tr("Pelayan: ${prefs.server}", "Server: ${prefs.server}"), 14f, Palette.sub, top = 20)
        ui.button(col, tr("Uji sambungan", "Test connection"), Palette.white, Palette.greenDark, top = 8, stroke = Palette.line) { testConnection(conn) }
        ui.button(col, tr("Tukar tetapan / log keluar", "Change settings / sign out"), Palette.paper, Palette.sub, top = 8) { signOut() }
        setContentView(root)
    }

    private fun openCatcher(url: String) {
        startActivity(Intent(this, LinkCatcherActivity::class.java).setData(Uri.parse(url)))
    }

    private fun requestBrowserRole() {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_BROWSER)) {
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_BROWSER), REQ_BROWSER_ROLE)
                    return
                } catch (e: Exception) {
                    // Fall through to the settings screen.
                }
            }
        }
        openDefaultAppsSettings()
    }

    private fun openDefaultAppsSettings() {
        Toast.makeText(this, tr("Pilih \"Apl pelayar\" kemudian pilih Family Guard.", "Choose \"Browser app\", then choose Family Guard."), Toast.LENGTH_LONG).show()
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun testConnection(label: TextView) {
        label.text = tr("Menguji sambungan…", "Testing connection…")
        Bg.task({ Api.call(this, "GET", "/api/state") }) { result ->
            result.onSuccess { label.text = tr("✅ Bersambung dengan ${prefs.server}", "✅ Connected to ${prefs.server}") }
            result.onFailure { e -> label.text = "❌ ${e.message}" }
        }
    }

    // ---------------------------------------------------------------- anak

    private fun showAnakHome() {
        startService()
        val (root, col) = ui.page(Palette.paper)
        ui.text(col, "familyguard.", 22f, Palette.green, bold = true)
        languageButton(col)
        ui.text(col, tr("Papan pemuka anak", "Anak dashboard"), 30f, Palette.ink, bold = true, top = 12)
        ui.text(col, tr(
            "Anda akan menerima notifikasi apabila ibu/bapa menekan pautan bahaya, walaupun aplikasi ini ditutup.",
            "You will get a notification when ibu/bapa taps a dangerous link, even when this app is closed."
        ), 16f, Palette.sub, top = 6)

        if (!Notifs.canNotify(this)) {
            val warn = ui.card(col, Palette.amberSoft, top = 18)
            ui.text(warn, tr("⚠️  Notifikasi dimatikan", "⚠️  Notifications are off"), 18f, Palette.amberInk, bold = true)
            ui.text(warn, tr("Benarkan notifikasi supaya anda tidak terlepas amaran.", "Allow notifications so you don't miss an alert."), 15f, Palette.ink, top = 4)
            ui.button(warn, tr("Benarkan notifikasi", "Allow notifications"), Palette.green, Palette.white, top = 12) { askNotificationPermission() }
        }

        anakBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(anakBox)
        ui.text(anakBox!!, tr("Memuatkan…", "Loading…"), 16f, Palette.sub, top = 22)

        ui.text(col, tr("Pelayan: ${prefs.server}", "Server: ${prefs.server}"), 14f, Palette.sub, top = 22)
        ui.button(col, tr("Log keluar", "Sign out"), Palette.paper, Palette.sub, top = 8) { signOut() }
        setContentView(root)
        handler.post(anakPoll)
    }

    private fun refreshAnak() {
        Bg.task({ Api.call(this, "GET", "/api/state") }) { result ->
            if (!isVisibleNow) return@task
            result.onSuccess { state -> drawAnak(state) }
            result.onFailure { e -> drawAnakError(e.message) }
            handler.postDelayed(anakPoll, 3000)
        }
    }

    private fun drawAnakError(message: String?) {
        val box = anakBox ?: return
        if (anakKey == "error") return
        anakKey = "error"
        box.removeAllViews()
        val card = ui.card(box, Palette.redSoft, top = 22)
        ui.text(card, tr("Tidak dapat berhubung", "Cannot connect"), 18f, Palette.redInk, bold = true)
        ui.text(card, message ?: "", 15f, Palette.ink, top = 4)
    }

    private fun drawAnak(state: JSONObject) {
        val box = anakBox ?: return
        val active = state.optJSONObject("active")
        val key = if (active == null) "none" else active.optString("id") + ":" + active.optString("status")
        if (key == anakKey) return // only redraw when something changed (keeps buttons stable)
        anakKey = key
        box.removeAllViews()
        handler.removeCallbacks(anakTick)
        anakCountdown = null
        val senior = state.str("seniorName") ?: "Ibu/bapa"

        if (active == null) {
            val card = ui.card(box, Palette.greenSoft, top = 22)
            ui.text(card, tr("✅  Semua selamat", "✅  All clear"), 22f, Palette.greenDark, bold = true)
            ui.text(card, tr(
                "Tiada amaran aktif. Apabila $senior menekan pautan mencurigakan, ia akan muncul di sini.",
                "No active alerts. When $senior taps a suspicious link, it will appear here."
            ), 16f, Palette.ink, top = 6)
            return
        }

        val escalated = active.optString("status") == "ESCALATED"
        val card = ui.card(box, Palette.white, top = 22, stroke = Palette.red)
        ui.text(card, if (escalated) tr("MASA TAMAT · $senior MASIH MENUNGGU", "TIME IS UP · $senior IS STILL WAITING") else tr("TINDAKAN DIPERLUKAN", "ACTION NEEDED"), 13f, Palette.redInk, bold = true)
        ui.text(card, tr("Sahkan pautan ini: scam atau tidak?", "Check this link: scam or not?"), 22f, Palette.ink, bold = true, top = 6)
        val source = active.str("source")
        ui.text(card, if (source != null) tr("$senior menekan pautan dalam $source.", "$senior tapped a link in $source.") else tr("$senior menekan pautan.", "$senior tapped a link."), 16f, Palette.sub, top = 6)

        ui.text(card, tr("PAUTAN", "LINK"), 12f, Palette.sub, bold = true, top = 14)
        ui.text(card, active.optString("domain"), 19f, Palette.ink, bold = true, top = 2)
        ui.text(card, active.str("displayUrl") ?: "", 14f, Palette.sub, top = 2)

        ui.text(card, tr("KENAPA PAUTAN INI DITANDA", "WHY THIS LINK WAS FLAGGED"), 12f, Palette.sub, bold = true, top = 14)
        for (reason in active.textList(this, "reasons")) ui.text(card, "•  $reason", 15f, Palette.ink, top = 4)

        val timer = ui.card(card, Palette.paper, top = 14)
        ui.text(timer, if (escalated) tr("Anda masih boleh membuat keputusan", "You can still decide") else tr("Masa untuk menjawab", "Time to answer"), 14f, Palette.sub)
        anakCountdown = ui.text(timer, if (escalated) "00:00" else "", 34f, Palette.ink, bold = true)
        if (!escalated) {
            anakExpiresAt = try { Instant.parse(active.optString("expiresAt")).toEpochMilli() } catch (e: Exception) { 0L }
            handler.post(anakTick)
        }

        val id = active.optString("id")
        ui.button(card, tr("✅  Selamat, benarkan", "✅  Safe, allow it"), Palette.green, Palette.white, top = 16) {
            confirm(tr("Adakah anda sudah sahkan pautan ini sah dan selamat?", "Have you checked that this link is genuine and safe?"), tr("Ya, selamat", "Yes, it's safe")) { resolve(id, "SAFE") }
        }
        ui.button(card, tr("⛔  Scam, sekat", "⛔  Scam, block it"), Palette.redSoft, Palette.redInk, top = 10) {
            confirm(tr("Tandakan pautan ini sebagai scam dan sekat untuk $senior?", "Mark this link as a scam and block it for $senior?"), tr("Ya, sekat", "Yes, block")) { resolve(id, "BLOCKED") }
        }
        ui.text(card, tr("Pilih \"Selamat\" hanya selepas anda sahkan alamat rasmi laman tersebut.", "Choose \"Safe\" only after you have checked the site's official address."), 13f, Palette.sub, top = 10)
    }

    private fun resolve(id: String, decision: String) {
        Bg.task({ Api.call(this, "POST", "/api/incidents/${Uri.encode(id)}/resolve", JSONObject().put("decision", decision)) }) { result ->
            result.onSuccess {
                Notifs.cancelAlert(this)
                Toast.makeText(this, if (decision == "SAFE") tr("Pautan dibenarkan.", "Link allowed.") else tr("Pautan disekat.", "Link blocked."), Toast.LENGTH_LONG).show()
                anakKey = null
                handler.removeCallbacks(anakPoll)
                handler.post(anakPoll)
            }
            result.onFailure { e -> Toast.makeText(this, e.message, Toast.LENGTH_LONG).show() }
        }
    }

    private fun startService() {
        try {
            startForegroundService(Intent(this, GuardianService::class.java))
        } catch (e: Exception) {
            Toast.makeText(this, tr("Pemantauan latar belakang tidak dapat dimulakan.", "Background monitoring could not be started."), Toast.LENGTH_LONG).show()
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !Notifs.canNotify(this)) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFICATIONS)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_NOTIFICATIONS) render()
    }

    // ---------------------------------------------------------------- shared

    private fun signOut() {
        confirm(tr("Log keluar dari telefon ini?", "Sign out on this phone?"), tr("Log keluar", "Sign out")) {
            stopService(Intent(this, GuardianService::class.java))
            ParentWatchService.stop(this)
            Notifs.cancelAlert(this)
            prefs.signOut()
            render()
        }
    }

    private fun confirm(message: String, yes: String, action: () -> Unit) {
        AlertDialog.Builder(this)
            .setMessage(message)
            .setPositiveButton(yes) { _, _ -> action() }
            .setNegativeButton(tr("Batal", "Cancel"), null)
            .show()
    }

    private fun clock(seconds: Long): String = "%02d:%02d".format(seconds / 60, seconds % 60)

    companion object {
        private const val REQ_BROWSER_ROLE = 1
        private const val REQ_NOTIFICATIONS = 2
    }
}
