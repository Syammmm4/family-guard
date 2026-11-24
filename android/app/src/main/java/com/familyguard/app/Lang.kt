package com.familyguard.app

import android.content.Context

/*
 * Language support. Bahasa Malaysia is the default, even when the phone itself is set to English,
 * because the persona prefers BM. English is used only when chosen in Family Guard on this phone.
 * Each sentence is written next to its translation: tr("BM", "English").
 * The words "anak" and "ibu/bapa" are deliberately kept as they are in English too.
 */

fun Context.isEn(): Boolean = Prefs(this).lang == Prefs.LANG_EN

/** Pick the sentence for the language chosen on this phone. */
fun Context.tr(ms: String, en: String): String = if (isEn()) en else ms

/** "3 minit" / "3 minutes", "20 saat" / "20 seconds". */
fun Context.durationText(seconds: Int): String {
    if (seconds >= 60) {
        val m = (seconds + 30) / 60
        return tr("$m minit", if (m == 1) "1 minute" else "$m minutes")
    }
    return tr("$seconds saat", "$seconds seconds")
}
