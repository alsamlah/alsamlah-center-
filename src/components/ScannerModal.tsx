"use client";

import { useEffect, useRef, useState } from "react";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";

interface Props {
  onScan: (value: string) => void;
  onClose: () => void;
  settings: SystemSettings;
}

export default function ScannerModal({ onScan, onClose, settings }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!("BarcodeDetector" in window)) { setSupported(false); return; }

    let interval: ReturnType<typeof setInterval>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        interval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const codes: { rawValue: string }[] = await detector.detect(videoRef.current);
            if (codes.length > 0) { clearInterval(interval); onScan(codes[0].rawValue); }
          } catch { /* frame not ready */ }
        }, 300);
      })
      .catch(() => setError(isRTL ? "لا يمكن الوصول للكاميرا" : "Camera access denied"));

    return () => {
      clearInterval(interval);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onScan, isRTL]);

  return (
    <div className="fixed inset-0 z-[600] flex flex-col" style={{ background: "#000" }} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ background: "rgba(0,0,0,0.7)" }}>
        <span className="font-bold text-white text-sm">📷 {t.scanQr}</span>
        <button onClick={onClose} className="text-white text-xl leading-none opacity-70 hover:opacity-100">✕</button>
      </div>

      {!supported ? (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <div className="text-5xl mb-4">😞</div>
            <p className="text-white text-sm mb-6">{t.scannerUnsupported}</p>
            <button onClick={onClose} className="btn btn-ghost" style={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}>{t.back}</button>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <div className="text-5xl mb-4">📷</div>
            <p className="text-white text-sm mb-6">{error}</p>
            <button onClick={onClose} className="btn btn-ghost" style={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}>{t.back}</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {/* Overlay with cutout */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <div className="w-56 h-56 relative" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}>
              <div className="absolute inset-0 rounded-lg" style={{ border: "2px solid rgba(255,255,255,0.15)" }} />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8" style={{ borderTop: "3px solid white", borderLeft: "3px solid white", borderRadius: "4px 0 0 0" }} />
              <div className="absolute top-0 right-0 w-8 h-8" style={{ borderTop: "3px solid white", borderRight: "3px solid white", borderRadius: "0 4px 0 0" }} />
              <div className="absolute bottom-0 left-0 w-8 h-8" style={{ borderBottom: "3px solid white", borderLeft: "3px solid white", borderRadius: "0 0 0 4px" }} />
              <div className="absolute bottom-0 right-0 w-8 h-8" style={{ borderBottom: "3px solid white", borderRight: "3px solid white", borderRadius: "0 0 4px 0" }} />
            </div>
          </div>
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <p className="text-white text-sm font-medium" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
              {isRTL ? "وجّه الكاميرا نحو رمز QR للغرفة" : "Point camera at the room QR code"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
