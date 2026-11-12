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

    // ---------------------------------------------------------------- setup

    private fun showSetup() {
        val (root, col) = ui.page(Palette.paper)
        ui.text(col, "familyguard.", 26f, Palette.green, bold = true)
        ui.text(col, "Sediakan telefon ini", 28f, Palette.ink, bold = true, top = 18)
        ui.text(col, "Lakukan sekali sahaja. Pastikan telefon dan komputer pelayan Family Guard menggunakan Wi-Fi yang sama.", 16f, Palette.sub, top = 8)

        ui.text(col, "Alamat pelayan", 16f, Palette.ink, bold = true, top = 24)
        val server = ui.field(col, prefs.server, "cth. http://192.168.1.10:3000", Ui.TYPE_URL)
        ui.text(col, "Lihat alamat IPv4 komputer dengan arahan ipconfig.", 14f, Palette.sub, top = 6)

        ui.text(col, "Telefon ini milik siapa?", 16f, Palette.ink, bold = true, top = 24)
        val group = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val parent = RadioButton(this).apply {
            id = View.generateViewId(); text = "Ibu / bapa (dilindungi)"; textSize = 19f; setTextColor(Palette.ink); minHeight = ui.dp(52)
        }
        val anak = RadioButton(this).apply {
            id = View.generateViewId(); text = "Anak (sahkan pautan untuk ibu/bapa)"; textSize = 19f; setTextColor(Palette.ink); minHeight = ui.dp(52)
        }
        group.addView(parent)
        group.addView(anak)
        group.check(if (prefs.role == Prefs.ROLE_ANAK) anak.id else parent.id)
        col.addView(group)

        ui.text(col, "PIN akses", 16f, Palette.ink, bold = true, top = 18)
        val pin = ui.field(col, "", "Masukkan PIN", Ui.TYPE_PIN)
        val error = ui.text(col, "", 15f, Palette.redInk, top = 10)

        lateinit var submit: android.widget.Button
        submit = ui.button(col, "Log masuk", Palette.green, Palette.white, top = 16) {
            val address = Api.normalizeServer(server.text.toString())
            val role = if (group.checkedRadioButtonId == anak.id) Prefs.ROLE_ANAK else Prefs.ROLE_PARENT
            val code = pin.text.toString().trim()
            if (address.isBlank() || code.isBlank()) {
                error.text = "Sila isi alamat pelayan dan PIN."
                return@button
            }
            submit.isEnabled = false
            error.text = ""
            Bg.task({ Api.login(address, role, code) }) { result ->
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
        ui.text(col, "Demo: PIN ibu/bapa 1357, PIN anak 2468 (tukar dalam fail .env pelayan).", 13f, Palette.sub, top = 14)
        setContentView(root)
    }

    // ---------------------------------------------------------------- ibu/bapa

    private fun showParentHome() {
        val (root, col) = ui.page(Palette.paper)
        ui.text(col, "familyguard.", 22f, Palette.green, bold = true)
        ui.text(col, "Selamat datang", 30f, Palette.ink, bold = true, top = 16)
        ui.text(col, "Guna WhatsApp seperti biasa. Jika pautan nampak bahaya, anak anda akan semak dahulu.", 17f, Palette.sub, top = 6)

        val active = Browsers.isFamilyGuardDefault(this)
        if (active) {
            val card = ui.card(col, Palette.greenSoft, top = 22)
            ui.text(card, "✅  Perlindungan pautan AKTIF", 20f, Palette.greenDark, bold = true)
            ui.text(card, "Pautan yang ditekan dalam WhatsApp, SMS dan aplikasi lain akan disemak dahulu sebelum dibuka.", 16f, Palette.ink, top = 6)
        } else {
            val card = ui.card(col, Palette.amberSoft, top = 22)
            ui.text(card, "⚠️  Perlindungan belum aktif", 20f, Palette.amberInk, bold = true)
            ui.text(card, "Tetapkan Family Guard sebagai aplikasi pelayar lalai supaya setiap pautan disemak dahulu. Pautan selamat tetap dibuka dalam Chrome.", 16f, Palette.ink, top = 6)
            ui.button(card, "Aktifkan perlindungan", Palette.green, Palette.white, top = 14) { requestBrowserRole() }
        }

        val test = ui.card(col, Palette.white, top = 16, stroke = Palette.line)
        ui.text(test, "Cuba sekarang", 19f, Palette.ink, bold = true)
        ui.text(test, "Lihat apa yang berlaku apabila pautan ditekan.", 15f, Palette.sub, top = 4)
        ui.button(test, "Cuba pautan scam contoh", Palette.redSoft, Palette.redInk, top = 12) {
            openCatcher("https://maybank-secure-verification.example/verify")
        }
        ui.button(test, "Cuba pautan selamat", Palette.greenSoft, Palette.greenDark, top = 10) {
            openCatcher("https://www.google.com")
        }

        val how = ui.card(col, Palette.white, top = 16, stroke = Palette.line)
        ui.text(how, "Cara ia berfungsi", 19f, Palette.ink, bold = true)
        ui.text(how, "1.  Tekan pautan dalam WhatsApp seperti biasa.", 16f, Palette.ink, top = 10)
        ui.text(how, "2.  Pautan selamat terus dibuka.", 16f, Palette.ink, top = 6)
        ui.text(how, "3.  Pautan bahaya: anak anda sahkan dahulu. Telefon anda boleh digunakan seperti biasa.", 16f, Palette.ink, top = 6)
        ui.text(how, "4.  Anda akan dimaklumkan apabila anak menjawab.", 16f, Palette.ink, top = 6)
        ui.text(how, "5.  Anak tidak menjawab? Jangan buka pautan itu. Jika wang sudah hilang, hubungi bank dan 997.", 16f, Palette.ink, top = 6)

        if (!Notifs.canNotify(this)) {
            val warn = ui.card(col, Palette.amberSoft, top = 16)
            ui.text(warn, "⚠️  Notifikasi dimatikan", 18f, Palette.amberInk, bold = true)
            ui.text(warn, "Benarkan notifikasi supaya anda tahu jawapan anak walaupun anda sedang guna aplikasi lain.", 16f, Palette.ink, top = 4)
            ui.button(warn, "Benarkan notifikasi", Palette.green, Palette.white, top = 12) { askNotificationPermission() }
        }

        val conn = ui.text(col, "Pelayan: ${prefs.server}", 14f, Palette.sub, top = 20)
        ui.button(col, "Uji sambungan", Palette.white, Palette.greenDark, top = 8, stroke = Palette.line) { testConnection(conn) }
        ui.button(col, "Tukar tetapan / log keluar", Palette.paper, Palette.sub, top = 8) { signOut() }
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
        Toast.makeText(this, "Pilih \"Apl pelayar\" kemudian pilih Family Guard.", Toast.LENGTH_LONG).show()
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun testConnection(label: TextView) {
        label.text = "Menguji sambungan…"
        Bg.task({ Api.call(this, "GET", "/api/state") }) { result ->
            result.onSuccess { label.text = "✅ Bersambung dengan ${prefs.server}" }
            result.onFailure { e -> label.text = "❌ ${e.message}" }
        }
    }

    // ---------------------------------------------------------------- anak

    private fun showAnakHome() {
        startService()
        val (root, col) = ui.page(Palette.paper)
        ui.text(col, "familyguard.", 22f, Palette.green, bold = true)
        ui.text(col, "Papan pemuka anak", 30f, Palette.ink, bold = true, top = 16)
        ui.text(col, "Anda akan menerima notifikasi apabila ibu/bapa menekan pautan bahaya, walaupun aplikasi ini ditutup.", 16f, Palette.sub, top = 6)

        if (!Notifs.canNotify(this)) {
            val warn = ui.card(col, Palette.amberSoft, top = 18)
            ui.text(warn, "⚠️  Notifikasi dimatikan", 18f, Palette.amberInk, bold = true)
            ui.text(warn, "Benarkan notifikasi supaya anda tidak terlepas amaran.", 15f, Palette.ink, top = 4)
            ui.button(warn, "Benarkan notifikasi", Palette.green, Palette.white, top = 12) { askNotificationPermission() }
        }

        anakBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(anakBox)
        ui.text(anakBox!!, "Memuatkan…", 16f, Palette.sub, top = 22)

        ui.text(col, "Pelayan: ${prefs.server}", 14f, Palette.sub, top = 22)
        ui.button(col, "Log keluar", Palette.paper, Palette.sub, top = 8) { signOut() }
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
        ui.text(card, "Tidak dapat berhubung", 18f, Palette.redInk, bold = true)
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
            ui.text(card, "✅  Semua selamat", 22f, Palette.greenDark, bold = true)
            ui.text(card, "Tiada amaran aktif. Apabila $senior menekan pautan mencurigakan, ia akan muncul di sini.", 16f, Palette.ink, top = 6)
            return
        }

        val escalated = active.optString("status") == "ESCALATED"
        val card = ui.card(box, Palette.white, top = 22, stroke = Palette.red)
        ui.text(card, if (escalated) "MASA TAMAT · $senior MASIH MENUNGGU" else "TINDAKAN DIPERLUKAN", 13f, Palette.redInk, bold = true)
        ui.text(card, "Sahkan pautan ini: scam atau tidak?", 22f, Palette.ink, bold = true, top = 6)
        val from = active.str("source")?.let { " dalam $it" } ?: ""
        ui.text(card, "$senior menekan pautan$from.", 16f, Palette.sub, top = 6)

        ui.text(card, "PAUTAN", 12f, Palette.sub, bold = true, top = 14)
        ui.text(card, active.optString("domain"), 19f, Palette.ink, bold = true, top = 2)
        ui.text(card, active.str("displayUrl") ?: "", 14f, Palette.sub, top = 2)

        ui.text(card, "KENAPA PAUTAN INI DITANDA", 12f, Palette.sub, bold = true, top = 14)
        val reasons = active.optJSONArray("reasons")
        if (reasons != null) {
            for (i in 0 until reasons.length()) ui.text(card, "•  " + reasons.optString(i), 15f, Palette.ink, top = 4)
        }

        val timer = ui.card(card, Palette.paper, top = 14)
        ui.text(timer, if (escalated) "Anda masih boleh membuat keputusan" else "Masa untuk menjawab", 14f, Palette.sub)
        anakCountdown = ui.text(timer, if (escalated) "00:00" else "", 34f, Palette.ink, bold = true)
        if (!escalated) {
            anakExpiresAt = try { Instant.parse(active.optString("expiresAt")).toEpochMilli() } catch (e: Exception) { 0L }
            handler.post(anakTick)
        }

        val id = active.optString("id")
        ui.button(card, "✅  Selamat, benarkan", Palette.green, Palette.white, top = 16) {
            confirm("Adakah anda sudah sahkan pautan ini sah dan selamat?", "Ya, selamat") { resolve(id, "SAFE") }
        }
        ui.button(card, "⛔  Scam, sekat", Palette.redSoft, Palette.redInk, top = 10) {
            confirm("Tandakan pautan ini sebagai scam dan sekat untuk $senior?", "Ya, sekat") { resolve(id, "BLOCKED") }
        }
        ui.text(card, "Pilih \"Selamat\" hanya selepas anda sahkan alamat rasmi laman tersebut.", 13f, Palette.sub, top = 10)
    }

    private fun resolve(id: String, decision: String) {
        Bg.task({ Api.call(this, "POST", "/api/incidents/${Uri.encode(id)}/resolve", JSONObject().put("decision", decision)) }) { result ->
            result.onSuccess {
                Notifs.cancelAlert(this)
                Toast.makeText(this, if (decision == "SAFE") "Pautan dibenarkan." else "Pautan disekat.", Toast.LENGTH_LONG).show()
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
            Toast.makeText(this, "Pemantauan latar belakang tidak dapat dimulakan.", Toast.LENGTH_LONG).show()
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
        confirm("Log keluar dari telefon ini?", "Log keluar") {
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
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun clock(seconds: Long): String = "%02d:%02d".format(seconds / 60, seconds % 60)

    companion object {
        private const val REQ_BROWSER_ROLE = 1
        private const val REQ_NOTIFICATIONS = 2
    }
}
