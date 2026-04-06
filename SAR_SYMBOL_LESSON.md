# درس: رمز الريال السعودي الرسمي في مشاريع الويب
# Lesson: Official Saudi Riyal Symbol in Web Projects

---

## المصدر الرسمي / Official Source

الرمز معتمد من **البنك المركزي السعودي (ساما)** بتاريخ **20 فبراير 2025**.
Approved by **SAMA (Saudi Central Bank)** on **February 20, 2025**.

- **Unicode:** `U+20C1` (added in Unicode 17.0, September 2025)
- **HTML Entity:** `&#x20C1;` or `&#8385;`
- **CSS content:** `"\20C1"`
- **Official SVG file:** https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg
- **Guidelines page:** https://www.sama.gov.sa/en-US/Currency/SRS/Pages/Guidelines.aspx
- **Wikimedia Commons:** https://commons.wikimedia.org/wiki/File:Saudi_Riyal_Symbol.svg

---

## SVG Path Data (من الملف الرسمي لساما)

**ViewBox:** `0 0 1124.14 1256.39`
**Aspect ratio:** width ÷ height ≈ **0.895** (أطول من عرضه — taller than wide)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39">
  <!-- Bottom horizontal bar (الشريط الأفقي السفلي) -->
  <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/>

  <!-- Main body: two vertical strokes + two horizontal bars (الجسم الرئيسي) -->
  <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/>
</svg>
```

---

## React / Next.js Component (جاهز للنسخ)

```tsx
// SarSymbol.tsx
"use client";

/**
 * Official Saudi Riyal currency symbol (SAR)
 * Source: SAMA (Saudi Central Bank) — sama.gov.sa
 * Approved: February 20, 2025
 */
export default function SarSymbol({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const s = size ?? 16;
  const w = s * (1124.14 / 1256.39); // maintain official aspect ratio (~0.895)
  return (
    <svg
      className={className}
      width={w}
      height={s}
      viewBox="0 0 1124.14 1256.39"
      fill="currentColor"
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0 }}
      role="img"
      aria-label="SAR"
    >
      <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z" />
      <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z" />
    </svg>
  );
}

/** Convenience: inline price display with SAR symbol */
export function Price({
  amount,
  className,
  size,
}: {
  amount: number;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={className}
      style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      {amount.toFixed(0)}
      <SarSymbol size={size} />
    </span>
  );
}
```

---

## Plain HTML / Vanilla JS

```html
<!-- Inline SVG — works anywhere, no fonts or libraries needed -->
<svg
  width="14"
  height="15.64"
  viewBox="0 0 1124.14 1256.39"
  fill="currentColor"
  style="display:inline-block;vertical-align:-0.15em"
  aria-label="SAR"
>
  <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/>
  <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/>
</svg>
```

**Size formula:** for any `height` you want, `width = height × 0.895`

---

## كيف تحسب الأبعاد / How to Size It

| Height (px) | Width (px) |
|-------------|------------|
| 12          | 10.74      |
| 14          | 12.53      |
| 16          | 14.32      |
| 18          | 16.11      |
| 20          | 17.90      |
| 24          | 21.48      |

---

## قواعد الاستخدام الرسمية / Official Usage Rules

1. **الموضع:** يوضع الرمز **بعد** الرقم في العربية، و**بعد** الرقم في الإنجليزية أيضاً.
   Example: `١٢٥ ﷼` / `125 ﷼`

2. **المسافة:** مسافة صغيرة بين الرقم والرمز (space or thin space `&#x202F;`).

3. **الألوان:** يعمل الرمز بأي لون — استخدم `fill="currentColor"` ليرث لون النص تلقائياً.

4. **الحجم الأدنى:** لا تستخدمه بحجم أقل من 12px لوضوح القراءة.

5. **لا تحرفه:** لا تمط أو تشوه أبعاد الرمز — حافظ على نسبة الأبعاد الرسمية (0.895).

---

## بدائل إذا لم يُدعم Unicode / Fallbacks

```css
/* إذا كان الخط يدعم U+20C1 */
.sar-char::after {
  content: "\20C1";
}

/* أو استخدم مكتبة الخط الرسمية */
/* https://github.com/emran-alhaddad/Saudi-Riyal-Font */
```

---

## أخطاء شائعة يجب تجنبها / Common Mistakes to Avoid

| ❌ خطأ | ✅ صحيح |
|--------|---------|
| استخدام `ر.س` | استخدام الرمز الجديد `﷼` / SVG |
| استخدام U+FDFC (﷼) — هذا الريال الإيراني | استخدام U+20C1 للريال السعودي الجديد |
| رسم الرمز يدوياً بأشكال هندسية | نسخ الـ path data الرسمي من ساما |
| تشويه النسبة (stretch) | الحفاظ على نسبة 0.895 |
| وضعه قبل الرقم | وضعه بعد الرقم |

---

## المراجع / References

- SAMA Official SVG: https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg
- SAMA Guidelines: https://www.sama.gov.sa/en-US/Currency/SRS/Pages/Guidelines.aspx
- Unicode 17.0 Chart: https://www.unicode.org/charts/
- Open Source Font (SIL OFL): https://github.com/emran-alhaddad/Saudi-Riyal-Font
- Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Saudi_Riyal_Symbol.svg
