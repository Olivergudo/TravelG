"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "pwa-install-guide-dismissed";
const SNOOZED_KEY = "pwa-install-guide-snoozed-at";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

type IosNavigator = Navigator & { standalone?: boolean };

function isIosSafari() {
  const userAgent = navigator.userAgent;
  const iosDevice = /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  return iosDevice && safari;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as IosNavigator).standalone === true;
}

function wasDismissed() {
  try {
    if (localStorage.getItem(DISMISSED_KEY) === "true") return true;
    const snoozedAt = Number(localStorage.getItem(SNOOZED_KEY) || 0);
    return snoozedAt > 0 && Date.now() - snoozedAt < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function IosPwaInstallGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isIosSafari() || isStandalone() || wasDismissed()) return;
    const timer = window.setTimeout(() => setOpen(true), 750);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const understood = () => {
    try { localStorage.setItem(SNOOZED_KEY, String(Date.now())); } catch {}
    setOpen(false);
  };
  const neverShowAgain = () => {
    try { localStorage.setItem(DISMISSED_KEY, "true"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  const steps = [
    { icon: <Share size={21}/>, title: "1. Toca Compartir", text: "En Safari, abre el menú Compartir." },
    { icon: <SquarePlus size={21}/>, title: "2. Agregar a pantalla de inicio", text: "Busca y toca “Agregar a pantalla de inicio”." },
  ];

  return <div className="ios-install-guide fixed inset-0 z-[100] flex items-end bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
    <section role="dialog" aria-modal="true" aria-labelledby="ios-install-title" aria-describedby="ios-install-description" className="ios-install-sheet sheet relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[30px] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10" aria-hidden="true"/>
      <button onClick={() => setOpen(false)} aria-label="Cerrar tutorial de instalación" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2] text-[#53655c]"><X size={20}/></button>
      <div className="pr-12"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">Gasto Listo</p><h2 id="ios-install-title" className="mt-1 text-2xl font-bold tracking-[-.02em]">Instala la app en tu iPhone</h2><p id="ios-install-description" className="mt-1.5 text-sm text-[#587067]">Úsala como una app normal, directamente desde tu pantalla de inicio.</p></div>
      <div className="mt-4 space-y-2.5">{steps.map((step) => <div key={step.title} className="ios-install-step flex gap-3 rounded-2xl bg-[#f3f6f3] p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e5f3ea] text-[#176b46]">{step.icon}</span><span className="min-w-0"><b className="block text-sm">{step.title}</b><small className="mt-0.5 block leading-relaxed text-[#718078]">{step.text}</small></span></div>)}</div>
      <p className="mt-3 text-center text-xs leading-relaxed text-[#718078]">La app aparecerá en tu pantalla de inicio para abrirla rápidamente.</p>
      <button onClick={understood} className="mt-4 min-h-14 w-full rounded-2xl bg-[#176b46] px-4 font-bold text-white">Entendido</button>
      <button onClick={neverShowAgain} className="min-h-12 w-full px-4 text-sm font-bold text-[#176b46]">No volver a mostrar</button>
    </section>
  </div>;
}
