const fs = require('fs');
const mammoth = require('mammoth');
const path = require('path');

async function parseDoc() {
    const dir = "C:\\Users\\PM\\Downloads";
    const files = fs.readdirSync(dir);
    const target = files.find(f => f.includes('CAUTELADOS') || f.includes('ARMAMENTOS E EQUIPAMENTOS'));
    
    if (!target) {
        console.error("File not found!");
        return;
    }
    
    const fullPath = path.join(dir, target);
    console.log("Reading file:", fullPath);
    
    try {
        const result = await mammoth.convertToHtml({ path: fullPath });
        const html = result.value;
        fs.writeFileSync('cautela_permanente.html', html);
        console.log("Extracted HTML length:", html.length);
        console.log("Saved to cautela_permanente.html");
    } catch (e) {
        console.error("Error reading docx:", e);
    }
}

parseDoc();
