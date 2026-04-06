import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "الصملة - نظام الإدارة",
  description: "نظام إدارة مركز الصملة للترفيه",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f0f12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Cairo:wght@300;400;500;600;700;800;900&family=Noto+Sans+Arabic:wght@300;400;500;600;700;800;900&family=Rubik:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Anti-flash: apply theme + font BEFORE React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
          var s=JSON.parse(localStorage.getItem('als-settings')||'{}');
          var theme=s.theme||'dark';
          if(theme==='system'){theme=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}
          document.documentElement.setAttribute('data-theme',theme);
          var fonts={ibm:"'IBM Plex Sans Arabic',sans-serif",cairo:"'Cairo',sans-serif",noto:"'Noto Sans Arabic',sans-serif",rubik:"'Rubik',sans-serif",inter:"'Inter',sans-serif"};
          var sizes={sm:'0.9',md:'1',lg:'1.1'};
          if(s.font&&fonts[s.font])document.documentElement.style.setProperty('--font',fonts[s.font]);
          if(s.fontSize&&sizes[s.fontSize])document.documentElement.style.setProperty('--font-scale',sizes[s.fontSize]);
          var langMap={ar:'rtl',en:'ltr'};
          if(s.lang){document.documentElement.setAttribute('lang',s.lang);document.documentElement.setAttribute('dir',langMap[s.lang]||'rtl');}
        }catch(e){}})();` }} />
      </head>
      <body className="min-h-screen">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
