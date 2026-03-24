import { NextRequest, NextResponse } from "next/server"

/**
 * API Route para OCR server-side usando OCR.space (gratuito)
 * Muito mais preciso que Tesseract.js no navegador
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    const apiKey = process.env.OCR_SPACE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "OCR_SPACE_API_KEY não configurada" }, { status: 500 })
    }

    // Converter File para base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")
    const mimeType = file.type || "image/jpeg"
    const base64Image = `data:${mimeType};base64,${base64}`

    // Chamar API do OCR.space
    const ocrFormData = new URLSearchParams()
    ocrFormData.append("base64Image", base64Image)
    ocrFormData.append("language", "por")
    ocrFormData.append("isOverlayRequired", "false")
    ocrFormData.append("OCREngine", "2") // Engine 2 é melhor para documentos complexos
    ocrFormData.append("isTable", "false")
    ocrFormData.append("scale", "true") // Redimensionar para melhor leitura
    ocrFormData.append("detectOrientation", "true") // Detectar rotação

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: apiKey,
      },
      body: ocrFormData,
    })

    const result = await response.json()

    if (result.IsErroredOnProcessing) {
      return NextResponse.json({ 
        error: result.ErrorMessage?.[0] || "Erro no processamento OCR" 
      }, { status: 500 })
    }

    const fullText = result.ParsedResults?.[0]?.ParsedText || ""
    console.log("===== OCR.SPACE RESULTADO =====")
    console.log(fullText)
    console.log("===============================")

    // ===== EXTRAIR DADOS DO TEXTO =====

    // 1. NOME
    let name = ""
    const namePatterns = [
      /Nome[:\s]+([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][a-zA-ZÁÀÃÂÉÈÊÍÓÔÕÚÇç\s]{5,})/i,
      /NOME[:\s]*\n?\s*([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][a-zA-ZÁÀÃÂÉÈÊÍÓÔÕÚÇç\s]{5,})/i,
    ]
    for (const p of namePatterns) {
      const m = fullText.match(p)
      if (m) { name = m[1].trim().replace(/\s+/g, " "); break }
    }
    // Fallback: heurística para encontrar nome completo (linha longa com várias palavras)
    if (!name) {
      const lines = fullText.split(/[\n\r]+/).map((l: string) => l.trim()).filter((l: string) => l.length > 6)
      for (const line of lines) {
        const words = line.split(/\s+/).filter((w: string) => w.length > 2)
        const lowerCleaned = line.toLowerCase()
        if (line.length > 10 && words.length >= 2 && 
            !lowerCleaned.includes("estado") && 
            !lowerCleaned.includes("secretaria") &&
            !lowerCleaned.includes("naturalidade") &&
            !lowerCleaned.includes("nascimento") &&
            !lowerCleaned.includes("republica") &&
            !lowerCleaned.includes("identidade") &&
            !lowerCleaned.includes("registro") &&
            !lowerCleaned.includes("expedidor") &&
            !lowerCleaned.includes("cpf") &&
            !lowerCleaned.includes("pis") &&
            !lowerCleaned.includes("pasep") &&
            !lowerCleaned.includes("data") &&
            !lowerCleaned.includes("validade") &&
            !/\d/.test(line)) {
          name = line
          break
        }
      }
    }

    // 2. RG
    let rg = ""
    const rgPatterns = [
      /Registro\s*Geral[:\s.,]*(\d[\d.,\/\-\s]*\d)/i,
      /R[\.\s]*G[\.\s]*[:\s]*(\d[\d.,\/\-\s]*)/i,
      /IDENTIDADE[:\s]*(\d[\d.,\/\-\s]*\d)/i,
      /RG\s*\/?[a-zA-Z\s]*\n*(\d[\d.,\/\-\s]*\d)/i, 
    ]
    for (const p of rgPatterns) {
      const m = fullText.match(p)
      if (m) {
        const raw = m[1].replace(/[\/\-].*/g, "") // Remove tudo após barra
        rg = raw.replace(/\D/g, "").slice(0, 9)
        if (rg.length >= 4) break
        else rg = ""
      }
    }
    if (!rg) {
      // Procura sequências de 5 a 9 dígitos isoladas
      const numMatches = fullText.match(/\b\d{5,9}\b/g) || []
      if (numMatches.length > 0) {
        // Assume o primeiro número que pareça RG e não CPF
        rg = numMatches.find((n: string) => n !== "000000000") || numMatches[0]
      } else {
        // Tentativa de achar números com ponto e traço e filtrar dígitos
        const withDots = fullText.match(/(?:\d\.?){5,10}/g) || []
        if (withDots.length > 0) {
          rg = withDots[0].replace(/\D/g, "")
        }
      }
    }

    // 3. MATRÍCULA
    let registration = ""
    const matPatterns = [
      /Matr[ií]cula[:\s]*(\d{5,12})/i,
      /MAT[:\s]*(\d{5,12})/i,
      /N[°º]?\s*(\d{7,12})/i,
    ]
    for (const p of matPatterns) {
      const m = fullText.match(p)
      if (m) { registration = m[1]; break }
    }
    if (!registration) {
      const allNums = fullText.match(/\d{7,12}/g) || []
      // Evitar que a matrícula seja o mesmo que o RG ou CPF.
      registration = allNums.find((n: string) => !n.includes(rg) && n.length >= 7) || ""
    }

    return NextResponse.json({
      success: true,
      fullText,
      extracted: { name, rg, registration },
    })
  } catch (err: any) {
    console.error("Erro OCR API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
