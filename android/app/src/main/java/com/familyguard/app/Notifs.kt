package com.familyguard.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.os.Build
import org.json.JSONObject

/** Notifications on anak's phone. */
object Notifs {
    private const val CH_MONITOR = "monitor"
    private const val CH_ALERT = "alerts"
    const val ID_MONITOR = 1
    private const val ID_ALERT = 2

    fun ensureChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CH_MONITOR, "Pemantauan latar belakang", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Menunjukkan Family Guard sedang memantau."
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_ALERT, "Amaran pautan", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Apabila ibu/bapa menekan pautan mencurigakan."
                enableVibration(true)
            }
        )
    }

    fun canNotify(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun openApp(ctx: Context): PendingIntent = PendingIntent.getActivity(
        ctx, 0,
        Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    fun monitoring(ctx: Context): Notification = Notification.Builder(ctx, CH_MONITOR)
        .setSmallIcon(R.drawable.ic_stat_shield)
        .setContentTitle("Family Guard sedang memantau")
        .setContentText("Anda akan dimaklumkan jika ibu/bapa menekan pautan bahaya.")
        .setOngoing(true)
        .setContentIntent(openApp(ctx))
        .build()

    fun alert(ctx: Context, active: JSONObject, seniorName: String) {
        if (!canNotify(ctx)) return
        val id = active.optString("id")
        val escalated = active.optString("status") == "ESCALATED"
        val title = if (escalated) "Masa tamat: $seniorName masih menunggu jawapan anda" else "⚠️ $seniorName menekan pautan mencurigakan"
        val from = active.str("source")?.let { " · dari $it" } ?: ""
        val text = active.optString("domain") + from
        val scam = PendingIntent.getBroadcast(
            ctx, 10,
            Intent(ctx, DecisionReceiver::class.java)
                .setAction(DecisionReceiver.ACTION)
                .putExtra(DecisionReceiver.EXTRA_ID, id)
                .putExtra(DecisionReceiver.EXTRA_DECISION, "BLOCKED"),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = Notification.Builder(ctx, CH_ALERT)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText("$text\nTekan untuk lihat sebab dan buat keputusan."))
            .setContentIntent(openApp(ctx))
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            // "Selamat" is only offered inside the app, after anak has looked at the reasons.
            .addAction(Notification.Action.Builder(Icon.createWithResource(ctx, R.drawable.ic_stat_shield), "⛔ Scam, sekat", scam).build())
            .build()
        ctx.getSystemService(NotificationManager::class.java).notify(ID_ALERT, n)
    }

    fun cancelAlert(ctx: Context) {
        ctx.getSystemService(NotificationManager::class.java).cancel(ID_ALERT)
    }

    // ---------------------------------------------------------------- ibu/bapa phone

    const val ID_PARENT_WAIT = 3
    private const val ID_PARENT_RESULT = 4

    /** Re-opens the waiting screen for this link (the app resumes the existing alert). */
    private fun reopenLink(ctx: Context, url: String): PendingIntent = PendingIntent.getActivity(
        ctx, 20,
        Intent(ctx, LinkCatcherActivity::class.java).setData(android.net.Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    /** Shown while the parent uses the phone normally and anak is still deciding. */
    fun parentWaiting(ctx: Context, domain: String, guardianName: String, url: String): Notification =
        Notification.Builder(ctx, CH_MONITOR)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle("Menunggu $guardianName")
            .setContentText("Jangan buka $domain sehingga $guardianName menjawab.")
            .setOngoing(true)
            .setContentIntent(reopenLink(ctx, url))
            .build()

    /** Anak did not answer in time. */
    fun parentEscalated(ctx: Context, domain: String, guardianName: String, url: String) {
        if (!canNotify(ctx)) return
        val n = Notification.Builder(ctx, CH_ALERT)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle("$guardianName belum menjawab")
            .setContentText("Jangan buka $domain. Tekan untuk lihat apa yang perlu dibuat.")
            .setStyle(Notification.BigTextStyle().bigText("Jangan buka $domain. Tekan untuk lihat apa yang perlu dibuat."))
            .setContentIntent(reopenLink(ctx, url))
            .setAutoCancel(true)
            .build()
        ctx.getSystemService(NotificationManager::class.java).notify(ID_PARENT_RESULT, n)
    }

    /** The decision arrived while the parent was elsewhere on the phone. */
    fun parentDecision(ctx: Context, domain: String, safe: Boolean, who: String, url: String) {
        if (!canNotify(ctx)) return
        val title: String
        val text: String
        val tap: PendingIntent
        if (safe) {
            title = "✅ $who kata pautan ini selamat"
            text = "Tekan untuk buka $domain."
            val browser = Browsers.intentFor(ctx, url)
            tap = if (browser != null) {
                PendingIntent.getActivity(ctx, 21, browser, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            } else openApp(ctx)
        } else {
            title = "⛔ $who kata pautan ini SCAM"
            text = "Jangan buka $domain. Pautan ini telah disekat."
            tap = openApp(ctx)
        }
        val n = Notification.Builder(ctx, CH_ALERT)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build()
        ctx.getSystemService(NotificationManager::class.java).notify(ID_PARENT_RESULT, n)
    }
}
