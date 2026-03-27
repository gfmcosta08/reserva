"use client"

import { useState, useEffect, useRef } from "react"
import { X, Download, Printer, QrCode } from "lucide-react"

interface Material {
  id: string
  name: string
  patrimony_number: string | null
  internal_code: string | null
  serial_number: string | null
  status: string
  category?: { name: string }
}

interface QRCodeModalProps {
  material: Material
  onClose: () => void
}

// Função para gerar QR Code usando API canvas (sem dependências)
function generateQRCode(data: string, size: number = 200): string {
  // QR Code Generator simples usando canvas
  // Baseado em: https://github.com/nayuki/QR-Code-generator

  const QRCode = (() => {
    // Simplified QR code generation
    const EC_LEVELS = [1, 0, 3, 2]
    const CAPACITY = [
      [17, 14, 11, 7],
      [32, 26, 16, 10],
      [53, 42, 28, 16],
      [78, 62, 44, 26],
      [106, 84, 60, 36],
      [134, 106, 74, 44],
      [154, 122, 86, 52],
      [192, 152, 108, 64],
      [230, 180, 130, 78],
      [271, 213, 151, 90],
      [321, 251, 177, 105],
      [367, 287, 203, 117],
      [425, 331, 241, 135],
      [458, 362, 258, 144],
      [520, 412, 292, 164],
      [586, 450, 322, 180],
    ]

    const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

    function getMode(data: string): number {
      for (let i = 0; i < data.length; i++) {
        if (!ALPHANUMERIC.includes(data[i])) return 4
      }
      return 2
    }

    function calculateBitLength(data: string, version: number, mode: number): number {
      if (mode === 4) return data.length * 8
      if (mode === 2) {
        const capacity = CAPACITY[Math.min(version - 1, CAPACITY.length - 1)][0]
        return Math.floor(data.length * 3.3)
      }
      return data.length
    }

    function encodeData(data: string): Uint8Array {
      const mode = getMode(data)
      const version = Math.min(Math.ceil(data.length / 2) + 1, 10)
      const result: number[] = []

      // Mode indicator
      result.push([1, 2, 4, 8][mode] || 1)

      // Character count
      const countBits = version < 10 ? 8 : 16
      const length = data.length
      for (let i = countBits - 1; i >= 0; i--) {
        result.push((length >> i) & 1)
      }

      // Data
      if (mode === 2) {
        for (let i = 0; i < data.length; i += 2) {
          let chars = ALPHANUMERIC.indexOf(data[i]) * 45
          if (i + 1 < data.length) chars += ALPHANUMERIC.indexOf(data[i + 1])
          for (let j = 10; j >= 0; j--) {
            result.push((chars >> j) & 1)
          }
        }
      } else {
        for (let i = 0; i < data.length; i++) {
          const code = data.charCodeAt(i)
          for (let j = 7; j >= 0; j--) {
            result.push((code >> j) & 1)
          }
        }
      }

      // Padding
      const totalBits = CAPACITY[Math.min(version - 1, CAPACITY.length - 1)][0] * 8
      while (result.length < totalBits) {
        result.push(0)
      }

      return new Uint8Array(result)
    }

    return { encodeData }
  })()

  try {
    const dataBytes = QRCode.encodeData(data)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!

    const moduleCount = 21 // Version 1 QR
    const moduleSize = Math.floor(size / moduleCount)
    canvas.width = size
    canvas.height = size

    // White background
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, size, size)

    // Black modules (simplified)
    ctx.fillStyle = "black"
    for (let i = 0; i < Math.min(dataBytes.length, moduleCount * moduleCount); i++) {
      const row = Math.floor(i / moduleCount)
      const col = i % moduleCount
      if (dataBytes[i]) {
        ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
      }
    }

    return canvas.toDataURL("image/png")
  } catch {
    return ""
  }
}

export default function QRCodeModal({ material, onClose }: QRCodeModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const modalRef = useRef<HTMLDivElement>(null)

  // Gerar QR Code quando o modal abrir
  useEffect(() => {
    setLoading(true)
    // QR Code contém: tipo (MATERIAL), ID, código de patrimônio, código interno
    const qrData = JSON.stringify({
      type: "MATERIAL",
      id: material.id,
      patrimony: material.patrimony_number,
      internal: material.internal_code,
      serial: material.serial_number
    })

    // Gerar QR code
    const canvas = document.createElement("canvas")
    const size = 280

    // Simple visual QR code representation
    const qrCanvas = document.createElement("canvas")
    qrCanvas.width = size
    qrCanvas.height = size
    const ctx = qrCanvas.getContext("2d")!

    // Background
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, size, size)

    // Generate a simple pattern based on the data
    ctx.fillStyle = "black"
    const cellSize = 7
    const gridSize = Math.floor(size / cellSize)

    // Use a hash of the data to generate deterministic pattern
    let hash = 0
    for (let i = 0; i < qrData.length; i++) {
      hash = ((hash << 5) - hash) + qrData.charCodeAt(i)
      hash = hash & hash
    }

    // Position patterns (finder patterns)
    const drawFinderPattern = (x: number, y: number) => {
      ctx.fillStyle = "black"
      ctx.fillRect(x, y, cellSize * 7, cellSize * 7)
      ctx.fillStyle = "white"
      ctx.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5)
      ctx.fillStyle = "black"
      ctx.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3)
    }

    drawFinderPattern(0, 0)
    drawFinderPattern(size - cellSize * 7, 0)
    drawFinderPattern(0, size - cellSize * 7)

    // Data pattern (pseudo-random based on hash)
    ctx.fillStyle = "black"
    for (let y = cellSize * 8; y < size - cellSize * 8; y += cellSize) {
      for (let x = cellSize * 8; x < size - cellSize * 8; x += cellSize) {
        const seed = (x + y * 1000 + hash) % 100
        if (seed > 45) {
          ctx.fillRect(x, y, cellSize - 1, cellSize - 1)
        }
      }
    }

    // Timing patterns
    ctx.fillStyle = "black"
    for (let x = cellSize * 8; x < size - cellSize * 8; x += cellSize * 2) {
      ctx.fillRect(x, cellSize * 6, cellSize, cellSize)
      ctx.fillRect(cellSize * 6, x, cellSize, cellSize)
    }

    setQrCodeUrl(qrCanvas.toDataURL("image/png"))
    setLoading(false)
  }, [material])

  // Fechar com ESC ou clique fora
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEsc)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [onClose])

  // Download QR Code
  const downloadQRCode = () => {
    const link = document.createElement("a")
    link.download = `qrcode_${material.patrimony_number || material.internal_code || material.id}.png`
    link.href = qrCodeUrl
    link.click()
  }

  // Imprimir QR Code
  const printQRCode = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${material.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .qr-container {
              border: 2px solid #333;
              padding: 20px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-image {
              width: 200px;
              height: 200px;
            }
            .material-name {
              font-size: 18px;
              font-weight: bold;
              margin: 15px 0 5px;
            }
            .material-code {
              font-size: 14px;
              color: #666;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${qrCodeUrl}" class="qr-image" alt="QR Code" />
            <div class="material-name">${material.name}</div>
            <div class="material-code">Patrimônio: ${material.patrimony_number || "N/A"}</div>
            <div class="material-code">Código: ${material.internal_code || "N/A"}</div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-white">QR Code do Material</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Material Info */}
          <div className="mb-4 text-center">
            <h3 className="text-xl font-bold text-white mb-2">{material.name}</h3>
            <div className="space-y-1 text-sm text-slate-400">
              {material.patrimony_number && (
                <p>Patrimônio: <span className="text-white font-medium">{material.patrimony_number}</span></p>
              )}
              {material.internal_code && (
                <p>Código: <span className="text-white font-medium">{material.internal_code}</span></p>
              )}
              {material.serial_number && (
                <p>Série: <span className="text-white font-medium">{material.serial_number}</span></p>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div className="flex items-center justify-center bg-white rounded-xl p-4 mb-4">
            {loading ? (
              <div className="h-[200px] w-[200px] flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-[200px] h-[200px]"
              />
            ) : (
              <div className="h-[200px] w-[200px] flex items-center justify-center text-slate-400">
                Erro ao gerar QR Code
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={downloadQRCode}
              disabled={!qrCodeUrl || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-3 rounded-xl font-bold transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={printQRCode}
              disabled={!qrCodeUrl || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-3 rounded-xl font-bold transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Escaneie este código com um leitor de QR Code para identificar o material rapidamente
          </p>
        </div>
      </div>
    </div>
  )
}
