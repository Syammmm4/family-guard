package com.familyguard.app

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import org.json.JSONObject

/**
 * Anak mode. Checks the Family Guard server every few seconds while running in the background
 * and posts an alert when ibu/bapa taps a risky link. No Firebase needed: this is designed for a
 * demo on the same Wi-Fi as the laptop server.
 */
class GuardianService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var running = false
    private var lastKey: String? = null

    private val tick = object : Runnable {
        override fun run() {
            if (!Prefs(this@GuardianService).isAnak) {
                stopSelf()
                return
            }
            Bg.task({ Api.call(this@GuardianService, "GET", "/api/state") }) { result ->
                result.onSuccess { state -> onState(state) }
                if (running) handler.postDelayed(this, POLL_MS)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notifs.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = Notifs.monitoring(this)
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(Notifs.ID_MONITOR, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(Notifs.ID_MONITOR, notification)
        }
        if (!running) {
            running = true
            handler.post(tick)
        }
        return START_STICKY
    }

    private fun onState(state: JSONObject) {
        val active = state.optJSONObject("active")
        if (active == null) {
            if (lastKey != null) Notifs.cancelAlert(this)
            lastKey = null
            return
        }
        // Alert once per new link, and once more when it escalates to 997.
        val key = active.optString("id") + ":" + active.optString("status")
        if (key == lastKey) return
        lastKey = key
        Notifs.alert(this, active, state.str("seniorName") ?: "Ibu/bapa")
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    companion object {
        private const val POLL_MS = 3000L
    }
}
