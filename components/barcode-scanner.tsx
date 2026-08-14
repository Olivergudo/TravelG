"use client";

import { Camera, Keyboard, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isValidBarcode, normalizeBarcode } from "@/lib/products/barcode";

type NativeDetector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};
type NativeDetectorConstructor = new (options?: {
  formats?: string[];
}) => NativeDetector;

export function BarcodeScanner({
  close,
  scanned,
  continuous = false,
}: {
  close: () => void;
  scanned: (code: string) => void;
  continuous?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("Apunta al código de barras");
  useEffect(() => {
    let stopped = false;
    let stopReader: (() => void) | undefined;
    const finish = (value: string) => {
      const code = normalizeBarcode(value);
      if (!stopped && isValidBarcode(code)) {
        stopped = true;
        stopReader?.();
        scanned(code);
      }
    };
    const start = async () => {
      try {
        const Detector = (
          window as typeof window & {
            BarcodeDetector?: NativeDetectorConstructor;
          }
        ).BarcodeDetector;
        if (Detector) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          stopReader = () =>
            stream.getTracks().forEach((track) => track.stop());
          if (!video.current) return stopReader();
          video.current.srcObject = stream;
          await video.current.play();
          const detector = new Detector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
          });
          while (!stopped) {
            const codes = await detector.detect(video.current);
            if (codes[0]) finish(codes[0].rawValue);
            await new Promise((resolve) => window.setTimeout(resolve, 300));
          }
          return;
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video.current!,
          (result) => {
            if (result) finish(result.getText());
          },
        );
        stopReader = () => controls.stop();
      } catch {
        setMessage("No pudimos abrir la cámara. Puedes escribir el código.");
      }
    };
    start();
    return () => {
      stopped = true;
      stopReader?.();
    };
  }, [scanned]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const code = normalizeBarcode(manual);
    if (isValidBarcode(code)) scanned(code);
    else setMessage("Escribe un código válido de 8 a 14 dígitos.");
  };
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">
              Refrigerador
            </p>
            <h2 className="text-2xl font-bold">Escanear producto</h2>
          </div>
          <button
            onClick={close}
            aria-label={continuous ? "Terminar de escanear" : "Cerrar"}
            className={
              continuous
                ? "min-h-11 px-3 font-bold text-[#176b46]"
                : "grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
            }
          >
            {continuous ? "Listo" : <X />}
          </button>
        </div>
        <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video
            ref={video}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-white/90" />
          <Camera className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white" />
        </div>
        <p className="mt-3 text-center text-sm text-[#718078]">{message}</p>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f0f4f1] px-3">
            <Keyboard size={18} />
            <input
              inputMode="numeric"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Ingresar código"
              className="min-h-12 min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
          <button className="rounded-xl bg-[#176b46] px-4 font-semibold text-white">
            Buscar
          </button>
        </form>
      </section>
    </div>
  );
}
