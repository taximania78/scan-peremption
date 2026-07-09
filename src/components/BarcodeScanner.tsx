"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraPermissionGranted, setIsCameraPermissionGranted] = useState(false);
  const isScanningRef = useRef(false);
  const isMountedRef = useRef(false);

  // Keep the latest callbacks in refs so the scanner effect can run once on
  // mount without restarting whenever the parent passes new callback identities.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  });

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanningRef.current) {
      isScanningRef.current = false;
      try {
        await scannerRef.current.stop();
        if (isMountedRef.current) {
          setIsScanning(false);
        }
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
  }, []);

  const startScanning = useCallback(async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }

      const cameras = await Html5Qrcode.getCameras();

      if (cameras && cameras.length > 0) {
        const backCamera = cameras.find((c) => 
          c.label?.toLowerCase().includes("back") || 
          c.label?.toLowerCase().includes("arrière") ||
          c.label?.toLowerCase().includes("environment")
        );
        const cameraId = backCamera ? backCamera.id : cameras[0].id;

        isScanningRef.current = true;
        await scannerRef.current.start(
          { deviceId: cameraId },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isScanningRef.current) return;
            onScanRef.current(decodedText);
            stopScanning();
          },
          () => {}
        );

        if (isMountedRef.current) {
            setIsScanning(true);
            setIsCameraPermissionGranted(true);
        }
      } else {
        onErrorRef.current?.("Aucune caméra détectée");
      }
    } catch (error) {
      isScanningRef.current = false;
      console.error("Scanner error:", error);
      const errorMessage =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Permission caméra refusée"
          : "Erreur lors du démarrage du scanner";
      onErrorRef.current?.(errorMessage);
    }
  }, [stopScanning]);

  useEffect(() => {
    isMountedRef.current = true;
    // Starts the external camera scanner on mount; any setState runs only after
    // async camera init (not synchronously), so cascading renders don't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startScanning();
    return () => {
      isMountedRef.current = false;
      stopScanning();
    };
  }, [startScanning, stopScanning]);

  const handleManualInput = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const barcode = formData.get("barcode") as string;
    if (barcode) {
      onScan(barcode);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div id="reader" className="w-full overflow-hidden rounded-xl border-2 border-black bg-black min-h-[300px]" />

      {!isScanning && (
        <>
          {isCameraPermissionGranted ? (
            <button
              type="button"
              onClick={startScanning}
              className="w-full bg-neo-yellow border-2 border-black shadow-neo text-black font-black py-4 px-4 rounded-xl uppercase transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Scanner un code-barres
            </button>
          ) : (
            <button
              type="button"
              onClick={startScanning}
              className="w-full bg-neo-yellow border-2 border-black shadow-neo text-black font-black py-4 px-4 rounded-xl uppercase transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Activer la caméra
            </button>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-black" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-black font-bold uppercase">ou</span>
            </div>
          </div>

          <form onSubmit={handleManualInput} className="flex gap-2">
            <input
              type="text"
              name="barcode"
              placeholder="Code-barres manuel"
              className="flex-1 border-2 border-black rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-yellow/50"
              autoFocus
            />
            <button
              type="submit"
              className="bg-black text-white border-2 border-black font-bold py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors"
            >
              OK
            </button>
          </form>
        </>
      )}

      {isScanning && (
        <button
          type="button"
          onClick={stopScanning}
          className="w-full bg-red-400 border-2 border-black shadow-neo text-black font-black py-3 px-4 rounded-xl transition-colors hover:bg-red-500"
        >
          Arrêter le scan
        </button>
      )}
    </div>
  );
}
