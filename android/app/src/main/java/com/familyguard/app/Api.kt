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

    /**
     * Adds a scheme if the user typed none. Online servers (e.g. Render) need https://.
     * Local addresses (an IP address, localhost or an address with a :port) use http://.
     */
    fun normalizeServer(input: String): String {
        var s = input.trim().trimEnd('/')
        if (s.isEmpty()) return s
        if (!s.startsWith("http://", ignoreCase = true) && !s.startsWith("https://", ignoreCase = true)) {
            val host = s.substringBefore('/')
            val local = host.contains(':') || host.startsWith("localhost", ignoreCase = true) ||
                Regex("""^\d{1,3}(\.\d{1,3}){3}$""").matches(host)
            s = (if (local) "http://" else "https://") + s
        }
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
            // A free Render server can take 30–60 s to wake up from sleep.
            conn.connectTimeout = 15000
            conn.readTimeout = 60000
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
            throw ApiException(0, "Tidak dapat berhubung dengan pelayan Family Guard. Semak sambungan internet dan alamat pelayan, kemudian cuba lagi.")
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
