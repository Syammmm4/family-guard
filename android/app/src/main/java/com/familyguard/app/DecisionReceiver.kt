package com.familyguard.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import org.json.JSONObject

/** Handles the "Scam, sekat" button on anak's alert notification. */
class DecisionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val decision = intent.getStringExtra(EXTRA_DECISION) ?: return
        if (decision != "SAFE" && decision != "BLOCKED") return
        val app = context.applicationContext
        val pending = goAsync()
        Thread {
            val message = try {
                Api.call(app, "POST", "/api/incidents/${Uri.encode(id)}/resolve", JSONObject().put("decision", decision))
                Notifs.cancelAlert(app)
                if (decision == "BLOCKED") "Pautan disekat. Ibu/bapa anda telah dimaklumkan." else "Pautan dibenarkan."
            } catch (e: Exception) {
                "Gagal: ${e.message}"
            }
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(app, message, Toast.LENGTH_LONG).show()
                pending.finish()
            }
        }.start()
    }

    companion object {
        const val ACTION = "com.familyguard.app.DECIDE"
        const val EXTRA_ID = "id"
        const val EXTRA_DECISION = "decision"
    }
}
