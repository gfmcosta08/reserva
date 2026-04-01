// ========================================
// ARQUIVO: src/components/material/QRCodeGenerator.tsx
// ========================================

"use client";

import { QRCodeSVG } from "qrcode.react";
import { Download, Copy, Check } from "lucide-react";
import { useState } from "react";

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  title?: string;
  showDownload?: boolean;
  showCopy?: boolean;
  className?: string;
}

export function QRCodeGenerator({
  value,
  size = 200,
  title,
  showDownload = true,
  showCopy = true,
  className,
}: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    try {
      const svg = document.querySelector(`#qr-code-${value.replace(/\W/g, "")} svg`) as SVGElement;
      if (!svg) {
        setDownloadError(true);
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `qrcode-${value}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadError(false);
    } catch (err) {
      console.error("Download failed:", err);
      setDownloadError(true);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      )}

      <div className="p-4 bg-white rounded-xl">
        <QRCodeSVG
          id={`qr-code-${value.replace(/\W/g, "")}`}
          value={value}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>

      <p className="text-sm text-slate-400 font-mono">{value}</p>

      <div className="flex gap-2">
        {showCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </button>
        )}

        {showDownload && (
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Baixar SVG
          </button>
        )}
      </div>

      {downloadError && (
        <p className="text-xs text-red-400">Erro ao gerar download</p>
      )}
    </div>
  );
}

export default QRCodeGenerator;
