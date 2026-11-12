package com.familyguard.app

import android.content.Context
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val status: Int, message: String) : Exception(message)

/** Returns null for a missing or JSON-null value (optString would return the text "null"). */
fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key).ifBlank { null }

/** Talks to the same Family Guard Node server used by the website. Call only from a background thread. */
object Api {

    fun normalizeServer(input: String): String {
        var s = input.trim().trimEnd('/')
        if (s.isEmpty()) return s
        if (!s.startsWith("http://", ignoreCase = true) && !s.startsWith("https://", ignoreCase = true)) s = "http://$s"
        return s
    }

    private fun raw(server: String, method: String, path: String, token: String?, body: JSONObject?): Pair<Int, JSONObject> {
        val conn = try {
            URL(server + path).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            throw ApiException(0, "Alamat pelayan tidak sah.")
        }
        try {
            conn.requestMethod = method
            conn.connectTimeout = 6000
            conn.readTimeout = 8000
            conn.setRequestProperty("Accept", "application/json")
            if (token != null) conn.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val stream = if (status >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val json = try {
                if (text.isBlank()) JSONObject() else JSONObject(text)
            } catch (e: Exception) {
                JSONObject()
            }
            return status to json
        } catch (e: IOException) {
            throw ApiException(0, "Tidak dapat berhubung dengan pelayan Family Guard. Pastikan telefon dan komputer berada dalam Wi-Fi yang sama.")
        } finally {
            conn.disconnect()
        }
    }

    fun login(server: String, role: String, pin: String): String {
        val (status, json) = raw(server, "POST", "/api/auth", null, JSONObject().put("role", role).put("pin", pin))
        if (status != 200) throw ApiException(status, json.str("error") ?: "Log masuk gagal ($status).")
        return json.getString("token")
    }

    /** Authenticated request. Signs in again automatically if the server restarted and forgot the session. */
    fun call(context: Context, method: String, path: String, body: JSONObject? = null): JSONObject {
        val prefs = Prefs(context)
        if (!prefs.isSetUp) throw ApiException(0, "Family Guard belum disediakan pada telefon ini.")
        var token = prefs.token
        if (token.isBlank()) {
            token = login(prefs.server, prefs.role, prefs.pin)
            prefs.token = token
        }
        var (status, json) = raw(prefs.server, method, path, token, body)
        if (status == 401) {
            token = login(prefs.server, prefs.role, prefs.pin)
            prefs.token = token
            val retry = raw(prefs.server, method, path, token, body)
            status = retry.first
            json = retry.second
        }
        if (status !in 200..299) throw ApiException(status, json.str("error") ?: "Permintaan gagal ($status).")
        return json
    }
}
