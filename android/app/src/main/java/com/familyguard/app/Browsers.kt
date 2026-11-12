package com.familyguard.app

import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build

/**
 * Family Guard sits in front of the real browser. Safe links are handed to an installed
 * browser (Chrome first), never back to Family Guard itself, so there is no loop.
 */
object Browsers {
    private val preferred = listOf(
        "com.android.chrome",
        "com.sec.android.app.sbrowser",
        "com.microsoft.emmx",
        "org.mozilla.firefox",
        "com.brave.browser",
        "com.opera.browser"
    )

    private fun query(context: Context, intent: Intent): List<ResolveInfo> {
        val pm = context.packageManager
        return if (Build.VERSION.SDK_INT >= 33) {
            pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong()))
        } else {
            @Suppress("DEPRECATION")
            pm.queryIntentActivities(intent, PackageManager.MATCH_ALL)
        }
    }

    private fun realBrowser(context: Context): String? {
        val probe = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")).addCategory(Intent.CATEGORY_BROWSABLE)
        val packages = query(context, probe).map { it.activityInfo.packageName }.filter { it != context.packageName }.distinct()
        return preferred.firstOrNull { it in packages } ?: packages.firstOrNull()
    }

    /** An intent that opens the link in the real browser, or null if no other browser is installed. */
    fun intentFor(context: Context, url: String): Intent? {
        val pkg = realBrowser(context) ?: return null
        return Intent(Intent.ACTION_VIEW, Uri.parse(url))
            .addCategory(Intent.CATEGORY_BROWSABLE)
            .setPackage(pkg)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    /** Opens the link in the real browser. Returns false if no other browser is installed. */
    fun open(context: Context, url: String): Boolean {
        val intent = intentFor(context, url) ?: return false
        return try {
            context.startActivity(intent)
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
    }

    /** True when Family Guard is the default browser, i.e. link taps come here first. */
    fun isFamilyGuardDefault(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = context.getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_BROWSER)) return rm.isRoleHeld(RoleManager.ROLE_BROWSER)
        }
        val probe = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")).addCategory(Intent.CATEGORY_BROWSABLE)
        @Suppress("DEPRECATION")
        val resolved = context.packageManager.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY)
        return resolved?.activityInfo?.packageName == context.packageName
    }
}
