# 🎮 نظام إدارة مركز الصملة للترفيه - AlSamlah

## التقنيات المستخدمة
- **Next.js 15** + **React 19** + **TypeScript**
- **Tailwind CSS** — التصميم
- **Supabase** — قاعدة البيانات + Realtime
- **Vercel** — الاستضافة والنشر

## التثبيت والتشغيل

### 1. تأكد من وجود Node.js
حمل Node.js من: https://nodejs.org (الإصدار 18+)

### 2. افتح Terminal في مجلد المشروع
```bash
cd C:\Users\USER\OneDrive\Documents\ALSAMLAH
```

### 3. تثبيت المكتبات
```bash
npm install
```

### 4. تشغيل المشروع محلياً
```bash
npm run dev
```
افتح المتصفح على: http://localhost:3000

### 5. النشر على Vercel (اختياري)
```bash
npx vercel
```

## هيكل المشروع
```
ALSAMLAH/
├── .env.local              ← مفاتيح Supabase
├── package.json            ← المكتبات
├── next.config.js          ← إعدادات Next.js
├── tailwind.config.js      ← إعدادات الألوان
├── tsconfig.json           ← إعدادات TypeScript
├── public/
│   └── manifest.json       ← إعدادات PWA
├── src/
│   ├── app/
│   │   ├── globals.css     ← الستايل العام
│   │   ├── layout.tsx      ← الهيكل الأساسي
│   │   ├── page.tsx        ← الصفحة الرئيسية (الكاشير)
│   │   └── order/[room]/
│   │       └── page.tsx    ← صفحة طلب الزبون (QR)
│   ├── components/
│   │   ├── CashierSystem.tsx   ← نظام الكاشير الكامل
│   │   └── QrOrdersPanel.tsx   ← شاشة الطلبات الواردة
│   └── lib/
│       ├── supabase.ts     ← اتصال Supabase + الأنواع
│       └── defaults.ts     ← البيانات الافتراضية
└── README.md
```

## روابط QR Code
كل غرفة/طاولة لها رابط خاص:
- غرفة 1: `https://your-domain.com/order/غرفة-1`
- بلياردو 2: `https://your-domain.com/order/بلياردو-2`
- تنس 3: `https://your-domain.com/order/تنس-3`

الزبون يسكان الـ QR → يطلب → الطلب يوصل الكاشير لحظياً
