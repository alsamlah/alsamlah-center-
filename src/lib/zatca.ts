/**
 * zatca.ts — ZATCA (Saudi Zakat, Tax and Customs Authority) utilities
 *
 * Implements Phase-1 simplified tax invoice compliance:
 *  - TLV (Tag-Length-Value) QR code data as per FATOORAH specification
 *  - VAT calculations (15% inclusive)
 *
 * Phase-1 QR fields (TLV, Base64 encoded):
 *   Tag 0x01 — Seller name (UTF-8)
 *   Tag 0x02 — VAT registration number (15 digits)
 *   Tag 0x03 — Invoice timestamp (ISO 8601)
 *   Tag 0x04 — Invoice total including VAT
 *   Tag 0x05 — VAT amount
 */

import QRCode from "qrcode";

// ── TLV encoder ──────────────────────────────────────────────────────────────

function encodeTLV(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  const len = valueBytes.length;

  // Length > 127 needs multi-byte encoding (0x81 + 1-byte length)
  if (len > 127) {
    const buf = new Uint8Array(3 + len);
    buf[0] = tag;
    buf[1] = 0x81; // indicates next byte is the length
    buf[2] = len;
    buf.set(valueBytes, 3);
    return buf;
  }

  const buf = new Uint8Array(2 + len);
  buf[0] = tag;
  buf[1] = len;
  buf.set(valueBytes, 2);
  return buf;
}

/** Build the Base64-encoded TLV string for the ZATCA QR code. */
export function buildZatcaTLV(params: {
  sellerName: string;
  vatNumber: string;
  /** ISO 8601 timestamp, e.g. "2026-04-06T14:30:00Z" */
  timestamp: string;
  /** Total amount INCLUDING 15% VAT, formatted to 2 decimal places */
  totalWithVat: string;
  /** VAT amount only, formatted to 2 decimal places */
  vatAmount: string;
}): string {
  const fields = [
    encodeTLV(0x01, params.sellerName),
    encodeTLV(0x02, params.vatNumber),
    encodeTLV(0x03, params.timestamp),
    encodeTLV(0x04, params.totalWithVat),
    encodeTLV(0x05, params.vatAmount),
  ];

  const totalLen = fields.reduce((s, f) => s + f.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const f of fields) {
    combined.set(f, offset);
    offset += f.length;
  }

  // Base64 encode
  return btoa(String.fromCharCode(...combined));
}

// ── VAT calculations (15% inclusive) ────────────────────────────────────────

export const VAT_RATE = 0.15; // 15%

/** Given a total that INCLUDES 15% VAT, extract the VAT component. */
export function vatFromInclusive(totalInclVat: number): number {
  return totalInclVat * (VAT_RATE / (1 + VAT_RATE)); // = total × 15/115
}

/** Given a total that INCLUDES 15% VAT, return the pre-tax base amount. */
export function baseFromInclusive(totalInclVat: number): number {
  return totalInclVat / (1 + VAT_RATE); // = total × 100/115
}

/** Format a number to exactly 2 decimal places as a string (for ZATCA fields). */
export function fmtVatAmount(n: number): string {
  return n.toFixed(2);
}

// ── QR image generation ──────────────────────────────────────────────────────

/**
 * Generates a ZATCA-compliant QR code as a PNG data URL.
 * Returns null if vatNumber is empty / not configured.
 */
export async function generateZatcaQR(params: {
  sellerName: string;
  vatNumber: string;
  invoiceTimestamp: number; // JS timestamp (ms)
  totalWithVat: number;
}): Promise<string | null> {
  if (!params.vatNumber || !params.sellerName) return null;

  const vat = vatFromInclusive(params.totalWithVat);
  const tlv = buildZatcaTLV({
    sellerName: params.sellerName,
    vatNumber: params.vatNumber,
    timestamp: new Date(params.invoiceTimestamp).toISOString(),
    totalWithVat: fmtVatAmount(params.totalWithVat),
    vatAmount: fmtVatAmount(vat),
  });

  try {
    return await QRCode.toDataURL(tlv, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}
