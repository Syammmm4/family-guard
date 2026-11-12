package com.familyguard.app

import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors

/** Runs network work off the main thread and delivers the result back on the main thread. */
object Bg {
    private val pool = Executors.newCachedThreadPool()
    private val main = Handler(Looper.getMainLooper())

    fun <T> task(work: () -> T, done: (Result<T>) -> Unit) {
        pool.execute {
            val result = runCatching(work)
            main.post { done(result) }
        }
    }
}
