// ========================================
// ARQUIVO: src/components/material/QRCodeScanner.tsx
// ========================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, X, RotateCcw, Keyboard, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface QRCodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  fps?: number;
  qrbox?: { width: number; height: number };
  aspectRatio?: number;
  className?: string;
}

export function QRCodeScanner({
  onScan,
  onError,
  fps = 10,
  qrbox = { width: 250, height: 250 },
  aspectRatio = 1.0,
  className,
}: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [manualInput, setManualInput] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    setLoading(true);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        setSelectedCamera(devices[0].id);
        setHasCamera(true);

        const scanner = new Html5Qrcode("qr-reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });

        scannerRef.current = scanner;

        await scanner.start(
          devices[0].id,
          {
            fps,
            qrbox,
            aspectRatio,
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {}
        );

        setIsScanning(true);
      } else {
        setHasCamera(false);
        onError?.("Nenhuma câmera encontrada");
      }
    } catch (err) {
      console.error("Camera error:", err);
      setHasCamera(false);
      onError?.("Erro ao acessar câmera");
    } finally {
      setLoading(false);
    }
  }, [fps, qrbox, aspectRatio, onScan, onError, stopScanner]);

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue("");
      setManualInput(false);
    }
  };

  const switchCamera = async (cameraId: string) => {
    await stopScanner();
    setSelectedCamera(cameraId);
    
    if (scannerRef.current && containerRef.current) {
      try {
        await scannerRef.current.start(
          cameraId,
          { fps, qrbox, aspectRatio },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {}
        );
        setIsScanning(true);
      } catch (err) {
        console.error("Error switching camera:", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className={clsx("flex flex-col items-center gap-4", className)}>
      {!manualInput ? (
        <>
          {/* Scanner Area */}
          <div
            ref={containerRef}
            className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-slate-900"
          >
            <div id="qr-reader" className="w-full h-full" />
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {!hasCamera && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-4 text-center">
                <CameraOff className="h-12 w-12 text-slate-500 mb-3" />
                <p className="text-slate-400 text-sm">Nenhuma câmera disponível</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!isScanning ? (
              <button
                type="button"
                onClick={startScanner}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {loading ? "Iniciando..." : "Ler QR Code"}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanner}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
              >
                <CameraOff className="h-4 w-4" />
                Parar
              </button>
            )}

            <button
              type="button"
              onClick={() => setManualInput(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors"
            >
              <Keyboard className="h-4 w-4" />
              Digitar código
            </button>
          </div>

          {/* Camera selector */}
          {cameras.length > 1 && isScanning && (
            <select
              value={selectedCamera}
              onChange={(e) => switchCamera(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm border border-slate-700"
            >
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Câmera ${cam.id}`}
                </option>
              ))}
            </select>
          )}
        </>
      ) : (
        <>
          {/* Manual Input */}
          <div className="w-full max-w-sm">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Digite o código do material
            </label>
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Código interno ou patrimônio"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={!manualValue.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setManualInput(false);
                setManualValue("");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default QRCodeScanner;
