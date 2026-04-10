const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('cautela_permanente.html', 'utf8');
const $ = cheerio.load(html);

let csv = 'Categoria,Patente,RG,Nome,Serial_Numero,Carregadores,Tamanho,Destino,Data,Situacao\n';

let currentCategory = 'Geral';

$('p, table').each((i, el) => {
    if (el.tagName === 'p') {
        const text = $(el).text().trim();
        // Ignore simple text that doesn't look like a category
        if (text && text.length > 3 && !text.includes('TOTAL') && !text.includes('RELAÇÃO')) {
            currentCategory = text;
        }
    } else if (el.tagName === 'table') {
        let isColete = currentCategory.toLowerCase().includes('colete');
        
        $(el).find('tr').each((j, tr) => {
            const tds = $(tr).find('td');
            // Skip header and totals
            if (tds.length >= 6) {
                const textNodes = tds.map((k, td) => $(td).text().trim()).get();
                if (textNodes[0].toUpperCase().includes('TOTAL') || textNodes[0].toUpperCase().includes('Nº')) return;
                
                // Usually: Nº | GRAD. | RG | NOME | SERIAL | CARR | DESTINO | DATA | SITUAÇÂO
                // Coletes: Nº | GRAD. | RG | NOME | Nº | TAMANHO | DESTINO | DATA | SITUAÇÂO
                // Revolver: Nº | GRAD. | RG | NOME | REVÓLVER | DESTINO | DATA | SITUAÇÂO
                
                let patente = '', rg = '', nome = '', serial = '', carregadores = '', tamanho = '', destino = '', data = '', situacao = '';
                
                if (isColete) {
                    if (textNodes.length >= 9) {
                        patente = textNodes[1];
                        rg = textNodes[2];
                        nome = textNodes[3];
                        serial = textNodes[4];
                        tamanho = textNodes[5];
                        destino = textNodes[6];
                        data = textNodes[7];
                        situacao = textNodes[8];
                    }
                } else {
                    // Guns
                    if (textNodes.length === 8) {
                        // Revolver: Nº | GRAD. | RG | NOME | REVÓLVER | DESTINO | DATA | SITUAÇÂO
                        patente = textNodes[1];
                        rg = textNodes[2];
                        nome = textNodes[3];
                        serial = textNodes[4];
                        destino = textNodes[5];
                        data = textNodes[6];
                        situacao = textNodes[7];
                    } else if (textNodes.length >= 9) {
                        patente = textNodes[1];
                        rg = textNodes[2];
                        nome = textNodes[3];
                        serial = textNodes[4];
                        carregadores = textNodes[5];
                        destino = textNodes[6];
                        data = textNodes[7];
                        situacao = textNodes[8];
                    }
                }
                
                // Sanitize commas
                [currentCategory, patente, rg, nome, serial, carregadores, tamanho, destino, data, situacao] = 
                [currentCategory, patente, rg, nome, serial, carregadores, tamanho, destino, data, situacao].map(s => (s || '').replace(/,/g, ' '));
                
                if (nome && rg) {
                    csv += `${currentCategory},${patente},${rg},${nome},${serial},${carregadores},${tamanho},${destino},${data},${situacao}\n`;
                }
            }
        });
    }
});

fs.writeFileSync('public/cautelas_permanentes.csv', csv);
console.log('CSV escrito com sucesso em public/cautelas_permanentes.csv no formato correto.');
