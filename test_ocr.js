const fullText = `
Estado de Goiás
Secretaria de Segurança Pública
João de Paula Ferrreira
Perciliana Josefa da Costa Matos
Naturalidade
Goiânia-GO
Data de Nascimento
08/11/1985
C.P.F.
014.005.001-92
RG / Orgão Expedidor
4723822 DGPC/GO
PIS/PASEP 2.035.208.131-1
`;

let name = "";
const lines = fullText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 6);
for (const line of lines) {
  const words = line.split(/\s+/).filter(w => w.length > 2);
  const lowerCleaned = line.toLowerCase();
  
  // Exclude common phrases found in RG tops
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
      !/\d/.test(line)) {
    name = line;
    break;
  }
}

let rg = "";
const rgPatterns = [
  /Registro\s*Geral[:\s.,]*(\d[\d.,\/\-\s]*\d)/i,
  /R[\.\s]*G[\.\s]*[:\s]*(\d[\d.,\/\-\s]*)/i,
  /IDENTIDADE[:\s]*(\d[\d.,\/\-\s]*\d)/i,
  /RG\s*\/?[a-zA-Z\s]*\n*(\d[\d.,\/\-\s]*\d)/i, 
];
for (const p of rgPatterns) {
  const m = fullText.match(p);
  if (m) {
    const raw = m[1].replace(/[\/\-].*/g, ""); 
    rg = raw.replace(/\D/g, "").slice(0, 9);
    if (rg.length >= 4) break;
    else rg = "";
  }
}
if (!rg) {
  // Find any standalone sequence of 5-9 digits. If it's a CPF (starts with same, or matches), ignore.
  // We'll just take the first matching digits pattern that has 5-9 digits not separated by dashes except normally
  const numMatches = fullText.match(/\b\d{5,10}\b/g) || [];
  if (numMatches.length > 0) {
      rg = numMatches[0];
  } else {
      // Fallback for numbers with dots
      const withDots = fullText.match(/(?:\d\.?){5,10}/g) || [];
      if (withDots.length > 0) {
          rg = withDots[0].replace(/\D/g, "");
      }
  }
}

let matricula = "";
const matPatterns = [
  /Matr[ií]cula[:\s]*(\d{5,12})/i,
  /MAT[:\s]*(\d{5,12})/i,
  /N[°º]?\s*(\d{7,12})/i,
];
for (const p of matPatterns) {
  const m = fullText.match(p);
  if (m) { matricula = m[1]; break; }
}

console.log(JSON.stringify({ name, rg, matricula }, null, 2));
