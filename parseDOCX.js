const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('carga.html', 'utf8');
const $ = cheerio.load(html);

let csv = 'Nome,Patrimonio,CodigoInterno,NumeroSerie,IdentificacaoReserva,Categoria,Observacoes\n';
let currentCat = 'Geral';

$('p, table').each((i, el) => {
    if (el.tagName === 'p') {
        const t = $(el).text().trim();
        if (t && !t.includes('RELAÇÃO')) currentCat = t;
    } else if (el.tagName === 'table') {
        $(el).find('tr').each((j, tr) => {
            const tds = $(tr).find('td');
            if (tds.length >= 2 && j > 0) {
                const textNodes = tds.map((k, td) => $(td).text().trim()).get();
                if (textNodes[0].toUpperCase().includes('TOTAL')) return;
                
                let resId = textNodes[0].replace(/,/g, '');
                let obs = textNodes[textNodes.length - 1].replace(/,/g, '');
                let nome = currentCat.replace(/,/g, '');
                
                // Tratar numeração e códigos. Se não tiver numero gera um com base na cat
                if (!resId) resId = 'S/N';
                const patId = 'GEN-PAT-' + resId;
                const intCod = 'GEN-INT-' + resId;
                
                csv += nome + "," + patId + "," + intCod + "," + resId + "," + resId + "," + nome + "," + obs + "\n";
            }
        });
    }
});

fs.writeFileSync('public/importacao.csv', csv);
console.log('CSV guardado em public/importacao.csv');
