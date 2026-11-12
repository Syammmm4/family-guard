package com.familyguard.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import org.json.JSONObject

/**
 * Ibu/bapa mode. Started when the parent leaves the waiting screen ("Kembali ke telefon").
 * Keeps checking the server for this one link and tells the parent with a notification when
 * anak decides (or when anak has not answered in time). Stops itself once the link is settled.
 */
class ParentWatchService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var incidentId: String? = null
    private var url = ""
    private var domain = ""
    private var guardianName = "Anak anda"
    private var escalatedShown = false
    private var startedAt = 0L

    private val tick = object : Runnable {
        override fun run() {
            val id = incidentId ?: return stopSelf()
            if (System.currentTimeMillis() - startedAt > MAX_WATCH_MS) return stopSelf()
            Bg.task({ Api.call(this@ParentWatchService, "GET", "/api/state") }) { result ->
                result.onSuccess { state -> if (onState(id, state)) return@task stopSelf() }
                handler.postDelayed(this, POLL_MS)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notifs.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        incidentId = intent?.getStringExtra(EXTRA_ID) ?: incidentId
        url = intent?.getStringExtra(EXTRA_URL) ?: url
        domain = intent?.getStringExtra(EXTRA_DOMAIN) ?: domain
        guardianName = intent?.getStringExtra(EXTRA_GUARDIAN) ?: guardianName
        escalatedShown = intent?.getBooleanExtra(EXTRA_ESCALATED, false) ?: escalatedShown
        startedAt = System.currentTimeMillis()
        if (incidentId == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        val notification = Notifs.parentWaiting(this, domain, guardianName, url)
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(Notifs.ID_PARENT_WAIT, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(Notifs.ID_PARENT_WAIT, notification)
        }
        handler.removeCallbacks(tick)
        handler.post(tick)
        return START_NOT_STICKY
    }

    /** Returns true when the link is settled and the service can stop. */
    private fun onState(id: String, state: JSONObject): Boolean {
        guardianName = state.str("guardianName") ?: guardianName
        val active = state.optJSONObject("active")
        // If the parent is looking at the waiting screen, that screen shows the update itself.
        val onScreen = LinkCatcherActivity.visibleIncidentId == id
        if (active != null && active.optString("id") == id) {
            if (active.optString("status") == "ESCALATED" && !escalatedShown) {
                escalatedShown = true
                if (!onScreen) Notifs.parentEscalated(this, domain, guardianName, url)
            }
            return false
        }
        val last = state.optJSONObject("lastResolved")
        if (last != null && last.optString("id") == id) {
            // The parent's own "sekat" choice needs no notification: they just made it.
            if (!onScreen && last.optString("decidedBy") != "IBU_BAPA") {
                Notifs.parentDecision(this, domain, last.optString("decision") == "SAFE", guardianName, url)
            }
            return true
        }
        // The alert is gone without a matching decision. Nothing more to watch.
        return true
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    companion object {
        private const val POLL_MS = 3000L
        private const val MAX_WATCH_MS = 2 * 60 * 60 * 1000L
        private const val EXTRA_ID = "id"
        private const val EXTRA_URL = "url"
        private const val EXTRA_DOMAIN = "domain"
        private const val EXTRA_GUARDIAN = "guardian"
        private const val EXTRA_ESCALATED = "escalated"

        fun start(ctx: Context, id: String, url: String, domain: String, guardianName: String, escalated: Boolean) {
            val intent = Intent(ctx, ParentWatchService::class.java)
                .putExtra(EXTRA_ID, id)
                .putExtra(EXTRA_URL, url)
                .putExtra(EXTRA_DOMAIN, domain)
                .putExtra(EXTRA_GUARDIAN, guardianName)
                .putExtra(EXTRA_ESCALATED, escalated)
            ctx.startForegroundService(intent)
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, ParentWatchService::class.java))
        }
    }
}
