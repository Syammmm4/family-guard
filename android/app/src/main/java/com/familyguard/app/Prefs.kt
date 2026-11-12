package com.familyguard.app

import android.content.Context

/**
 * Settings saved on this phone.
 * DEMO ONLY: the PIN is kept in private app storage so the app can sign in again by itself
 * after the laptop server restarts. A real app would use proper accounts instead.
 */
class Prefs(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("familyguard", Context.MODE_PRIVATE)

    var server: String
        get() = sp.getString("server", "") ?: ""
        set(value) = sp.edit().putString("server", value).apply()

    /** "senior" (ibu/bapa) or "guardian" (anak). */
    var role: String
        get() = sp.getString("role", "") ?: ""
        set(value) = sp.edit().putString("role", value).apply()

    var pin: String
        get() = sp.getString("pin", "") ?: ""
        set(value) = sp.edit().putString("pin", value).apply()

    var token: String
        get() = sp.getString("token", "") ?: ""
        set(value) = sp.edit().putString("token", value).apply()

    val isSetUp: Boolean
        get() = server.isNotBlank() && role.isNotBlank() && pin.isNotBlank()

    val isParent: Boolean get() = isSetUp && role == ROLE_PARENT
    val isAnak: Boolean get() = isSetUp && role == ROLE_ANAK

    /** Sign out but keep the server address for convenience. */
    fun signOut() {
        sp.edit().remove("role").remove("pin").remove("token").apply()
    }

    companion object {
        const val ROLE_PARENT = "senior"
        const val ROLE_ANAK = "guardian"
    }
}
