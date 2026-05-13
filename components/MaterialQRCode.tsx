"use client"

import { useState } from "react"
import { QrCode, X, Download, Copy, Check } from "lucide-react"

interface MaterialQRCodeProps {
  materialId: string
  internalCode: string
  name: string
}

export default function MaterialQRCode({ materialId, internalCode, name }: MaterialQRCodeProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const qrData = encodeURIComponent(internalCode)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&bgcolor=020617&color=ffffff&format=png`
  const downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${qrData}&bgcolor=ffffff&color=000000&format=png`

  function handleCopy() {
    navigator.clipboard.writeText(internalCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const a = document.createElement("a")
    a.href = downloadUrl
    a.download = `qrcode-${internalCode}.png`
    a.target = "_blank"
    a.click()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
        title="Ver QR Code"
      >
        <QrCode className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-blue-400" />
                <h3 className="font-bold text-white text-sm">QR Code do Material</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4">
              <p className="text-xs text-slate-400 text-center truncate w-full">{name}</p>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                <img
                  src={qrUrl}
                  alt={`QR Code ${internalCode}`}
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <div className="w-full bg-slate-800/50 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-slate-200 truncate">{internalCode}</span>
                <button onClick={handleCopy} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors"
              >
                <Download className="h-4 w-4" />
                Baixar QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
