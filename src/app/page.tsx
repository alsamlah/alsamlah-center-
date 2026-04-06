"use client";

import dynamic from "next/dynamic";

// Dynamically import the cashier system (no SSR needed)
const CashierSystem = dynamic(() => import("@/components/CashierSystem"), { ssr: false });

export default function Home() {
  return <CashierSystem />;
}
