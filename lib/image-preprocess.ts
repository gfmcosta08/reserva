/**
 * Pré-processamento de imagem para OCR
 * Converte a imagem para escala de cinza com alto contraste
 * para que o Tesseract consiga ler o texto com precisão.
 */
export async function preprocessImageForOCR(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject("Canvas não suportado")

      // Manter resolução alta para OCR
      const MAX = 2000
      let w = img.width
      let h = img.height
      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h)
        w = Math.floor(w * scale)
        h = Math.floor(h * scale)
      }
      canvas.width = w
      canvas.height = h

      // Desenhar imagem original
      ctx.drawImage(img, 0, 0, w, h)

      // Pegar pixels
      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data

      // 1. Converter para escala de cinza
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }

      // 2. Aumentar contraste (stretch histogram)
      let min = 255, max = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < min) min = data[i]
        if (data[i] > max) max = data[i]
      }
      const range = max - min || 1
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.floor(((data[i] - min) / range) * 255)
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
      }

      // 3. Binarização adaptativa (threshold)
      // Usar threshold de Otsu simplificado
      const histogram = new Array(256).fill(0)
      for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++
      }
      const totalPixels = w * h
      let sum = 0, sumB = 0, wB = 0, wF = 0, maxVariance = 0, threshold = 128
      for (let i = 0; i < 256; i++) sum += i * histogram[i]
      
      for (let t = 0; t < 256; t++) {
        wB += histogram[t]
        if (wB === 0) continue
        wF = totalPixels - wB
        if (wF === 0) break
        sumB += t * histogram[t]
        const mB = sumB / wB
        const mF = (sum - sumB) / wF
        const variance = wB * wF * (mB - mF) * (mB - mF)
        if (variance > maxVariance) {
          maxVariance = variance
          threshold = t
        }
      }

      // Aplicar threshold com margem para preservar texto fino
      const adjustedThreshold = Math.min(threshold + 15, 240)
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i] < adjustedThreshold ? 0 : 255
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
      }

      ctx.putImageData(imageData, 0, 0)

      // Exportar como PNG (sem compressão com perdas)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject("Erro ao gerar imagem processada")
        },
        "image/png",
        1.0
      )
    }
    img.onerror = () => reject("Erro ao carregar imagem")
    img.src = URL.createObjectURL(file)
  })
}
