# درس: مشكلة CSS مع Next.js 15.5 + Turbopack على Windows

---

## المشكلة

عند تشغيل `next dev` بالإصدار **15.5+**، يظهر خطأ:

```
Module parse failed: Unexpected character '@' (1:0)
> @import url('https://fonts.googleapis.com/...');
|
| @tailwind base;

Import trace for requested module:
./src/app/globals.css
./src/app/layout.tsx
```

وكذلك خطأ ثانوي:
```
[Error: ENOENT: no such file or directory, open '.next\required-server-files.json']
```

---

## السبب

### 1. `NODE_ENV` غير معياري
كانت بيئة Windows عندنا فيها متغير `NODE_ENV` بقيمة غير معياري (ليست `development` أو `production`). هذا يتسبب في أن webpack لا يُهيئ CSS loaders بشكل صحيح، فيحاول قراءة ملف `.css` كأنه ملف JavaScript — فيفشل عند أول `@`.

**الدليل:** في السجلات ظهر:
```
⚠ You are using a non-standard "NODE_ENV" value in your environment.
```

### 2. `@import url(...)` في بداية `globals.css`
ملف `globals.css` كان يبدأ بـ:
```css
@import url('https://fonts.googleapis.com/...');
@tailwind base;
```

هذا الأسلوب يعتمد على معالج CSS يفهم `@import` — وعندما يفشل معالج CSS بسبب المشكلة الأولى، يظهر الخطأ مباشرة على هذا السطر.

### 3. `.next` cache تالف
بعد محاولات إعادة التشغيل بدون مسح الـ cache، بقيت ملفات مختلطة في `.next` أدت لخطأ `required-server-files.json`.

---

## الحل

### ✅ الخطوة 1: تعيين `NODE_ENV=development` في `start-dev.bat`

```bat
@echo off
cd /d "C:\Users\USER\OneDrive\Documents\alsamlah"
set NODE_ENV=development
node node_modules\next\dist\bin\next dev --port 3001
```

> **ملاحظة:** `--no-turbopack` غير موجود في Next.js 15.5 (Turbopack أصبح افتراضياً).
> الحل الصحيح هو تعيين `NODE_ENV` وليس تعطيل Turbopack.

---

### ✅ الخطوة 2: نقل Google Fonts من `globals.css` إلى `layout.tsx`

**قبل (خطأ):** في `globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=...');
@tailwind base;
```

**بعد (صحيح):** في `layout.tsx`:
```tsx
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet" />
  ...
</head>
```

وفي `globals.css` تبقى فقط:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

> هذا هو الأسلوب الموصى به من Next.js أصلاً — الخطوط الخارجية تُحمَّل عبر `<link>` في الـ HTML، لا عبر `@import` في CSS.

---

### ✅ الخطوة 3: مسح `.next` cache قبل إعادة التشغيل

```bat
rmdir /s /q .next
```

ثم أعد تشغيل السيرفر.

---

## ملخص سريع

| المشكلة | السبب | الحل |
|---|---|---|
| `Module parse failed: '@'` | `NODE_ENV` غير معياري | `set NODE_ENV=development` في الـ bat |
| `@import url(...)` يسبب خطأ | استخدام `@import` في CSS | نقل الـ fonts لـ `<link>` في layout.tsx |
| `required-server-files.json` مفقود | cache تالف | `rmdir /s /q .next` ثم إعادة تشغيل |
| `--no-turbopack` غير معروف | Next.js 15.5+ لا يدعمه | لا تستخدمه، Turbopack افتراضي الآن |

---

## قاعدة عامة للمشروع

- **دائماً** شغّل السيرفر من `start-dev.bat` (يضبط `NODE_ENV` تلقائياً)
- **لا تضع** `@import url(...)` في `globals.css` — استخدم `<link>` في `layout.tsx`
- **عند أي خطأ غريب في CSS:** امسح `.next` وأعد التشغيل

---

*آخر تحديث: أبريل 2026*
