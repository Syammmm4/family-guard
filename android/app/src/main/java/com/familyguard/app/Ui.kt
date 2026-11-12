package com.familyguard.app

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Colours matching the Family Guard website. */
object Palette {
    val navy = Color.parseColor("#0B1E2B")
    val navyCard = Color.parseColor("#17384A")
    val mint = Color.parseColor("#8DE9BD")
    val green = Color.parseColor("#087B65")
    val greenDark = Color.parseColor("#0B584E")
    val greenSoft = Color.parseColor("#E8F8EF")
    val paper = Color.parseColor("#F6F9F8")
    val ink = Color.parseColor("#0D2430")
    val sub = Color.parseColor("#587079")
    val line = Color.parseColor("#E3EBEA")
    val onDark = Color.parseColor("#B8D3D6")
    val red = Color.parseColor("#E5484D")
    val redSoft = Color.parseColor("#FFF0EC")
    val redInk = Color.parseColor("#B23A26")
    val peach = Color.parseColor("#FFC8A6")
    val amberSoft = Color.parseColor("#FFF6D1")
    val amberInk = Color.parseColor("#6B5400")
    val white = Color.WHITE
}

/**
 * Small helper to build screens in code with large, senior-friendly text and big touch targets.
 * (No layout XML or extra libraries needed.)
 */
class Ui(private val ctx: Context) {
    fun dp(v: Int): Int = (v * ctx.resources.displayMetrics.density + 0.5f).toInt()

    private fun fullWidth(top: Int) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(top) }

    /** A scrolling page. Returns the root (to pass to setContentView) and the column to add views to. */
    fun page(bg: Int, centered: Boolean = false): Pair<ScrollView, LinearLayout> {
        val column = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(28), dp(24), dp(32))
            if (centered) gravity = Gravity.CENTER_HORIZONTAL
        }
        val scroll = ScrollView(ctx).apply {
            setBackgroundColor(bg)
            isFillViewport = true
            fitsSystemWindows = true
            addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        return scroll to column
    }

    fun text(
        parent: ViewGroup,
        value: CharSequence,
        sp: Float = 17f,
        color: Int = Palette.ink,
        bold: Boolean = false,
        top: Int = 0,
        center: Boolean = false
    ): TextView {
        val tv = TextView(ctx).apply {
            text = value
            textSize = sp
            setTextColor(color)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setLineSpacing(0f, 1.2f)
            if (center) gravity = Gravity.CENTER_HORIZONTAL
        }
        parent.addView(tv, fullWidth(top))
        return tv
    }

    fun button(
        parent: ViewGroup,
        label: String,
        bg: Int,
        fg: Int,
        top: Int = 12,
        stroke: Int? = null,
        onClick: () -> Unit
    ): Button {
        val b = Button(ctx).apply {
            text = label
            isAllCaps = false
            textSize = 18f
            setTextColor(fg)
            typeface = Typeface.DEFAULT_BOLD
            minHeight = dp(60)
            minimumHeight = dp(60)
            setPadding(dp(18), dp(14), dp(18), dp(14))
            background = GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(bg)
                if (stroke != null) setStroke(dp(2), stroke)
            }
            stateListAnimator = null
            setOnClickListener { onClick() }
        }
        parent.addView(b, fullWidth(top))
        return b
    }

    /** A small, low-emphasis text button for risky or secondary choices (still at least 48dp tall). */
    fun quietButton(parent: ViewGroup, label: String, color: Int, top: Int = 18, onClick: () -> Unit): TextView {
        val tv = TextView(ctx).apply {
            text = label
            textSize = 14f
            setTextColor(color)
            paintFlags = paintFlags or android.graphics.Paint.UNDERLINE_TEXT_FLAG
            gravity = Gravity.CENTER
            minHeight = dp(48)
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }
        parent.addView(tv, fullWidth(top))
        return tv
    }

    fun card(parent: ViewGroup, bg: Int, top: Int = 16, stroke: Int? = null): LinearLayout {
        val c = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(18))
            background = GradientDrawable().apply {
                cornerRadius = dp(18).toFloat()
                setColor(bg)
                if (stroke != null) setStroke(dp(1), stroke)
            }
        }
        parent.addView(c, fullWidth(top))
        return c
    }

    fun field(parent: ViewGroup, value: String, hint: String, type: Int, top: Int = 8): EditText {
        val e = EditText(ctx).apply {
            setText(value)
            this.hint = hint
            inputType = type
            textSize = 18f
            setTextColor(Palette.ink)
            setSingleLine(true)
            minHeight = dp(56)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(Palette.white)
                setStroke(dp(2), Palette.line)
            }
        }
        parent.addView(e, fullWidth(top))
        return e
    }

    companion object {
        const val TYPE_URL = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        const val TYPE_PIN = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
    }
}
