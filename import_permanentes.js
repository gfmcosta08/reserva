const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Config do DB usando a chave SERVICE_ROLE localizada no cleanDB.js
const supabaseUrl = 'https://chguaozitzwfsmqyhreb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runImport() {
    console.log("Iniciando importação de Cautelas Permanentes...");
    const csvData = fs.readFileSync('public/cautelas_permanentes.csv', 'utf8').split('\n');
    const headers = csvData[0].split(',');

    let { data: profiles } = await supabase.from('profiles').select('id').limit(1);
    let operatorId = profiles && profiles.length > 0 ? profiles[0].id : null;

    if (!operatorId) {
        console.log("Nenhum profile encontrado. Criando usuário admin dummy...");
        const { data: user, error } = await supabase.auth.admin.createUser({
          email: 'admin_import@sistema.com',
          password: 'password123',
          email_confirm: true
        });
        if (error) {
            console.error("Failed to create admin auth user:", error);
            return;
        }
        operatorId = user.user.id;
        // Upsert no profile para garantir (caso a trigger falhe)
        await supabase.from('profiles').upsert({ id: operatorId, email: 'admin_import@sistema.com', name: 'Admin Import', role: 'supervisor' });
    }

    const defaultPinHash = await bcrypt.hash('123456', 10);

    for (let i = 1; i < csvData.length; i++) {
        const line = csvData[i].trim();
        if (!line) continue;
        
        const cols = line.split(',');
        // Categoria,Patente,RG,Nome,Serial_Numero,Carregadores,Tamanho,Destino,Data,Situacao
        const categoria = cols[0];
        const patente = cols[1];
        let rg = cols[2].replace(/[^\d]/g, ''); // apenas números
        const nome = cols[3];
        let serial = cols[4];
        const carregadores = cols[5];
        const tamanho = cols[6];
        const destino = cols[7];
        // data = cols[8] (ignorando porque criaremos com created_at local)
        const situacao = cols[9];

        if (!rg) rg = '99999' + i; // fallback se for vazio
        if (!serial) serial = 'S/N-' + i;

        // 1. Verificar categoria
        let catId;
        const { data: catData } = await supabase.from('categories').select('id').eq('name', categoria).single();
        if (catData) {
            catId = catData.id;
        } else {
            const { data: newCat } = await supabase.from('categories').insert({ name: categoria }).select().single();
            catId = newCat ? newCat.id : null;
        }

        // 2. Verificar/Criar Pessoa
        let personId;
        const { data: personData } = await supabase.from('persons').select('id').eq('registration_number', rg).single();
        if (personData) {
            personId = personData.id;
        } else {
            console.log(`Criando pessoa: ${nome} (RG: ${rg})`);
            const { data: newPerson, error: pErr } = await supabase.from('persons').insert({
                full_name: nome,
                registration_number: rg,
                function: patente,
                pin_hash: defaultPinHash
            }).select().single();
            if (pErr) { console.error("Erro pessoa:", pErr); continue; }
            personId = newPerson.id;
        }

        // 3. Verificar/Criar Material
        let materialId;
        const patNum = `PAT-${serial}`;
        const intCode = `INT-${serial}`;
        const { data: matData } = await supabase.from('materials').select('id').eq('patrimony_number', patNum).single();
        if (matData) {
            materialId = matData.id;
        } else {
            console.log(`Criando material: ${serial}`);
            const { data: newMat, error: mErr } = await supabase.from('materials').insert({
                name: categoria,
                category_id: catId,
                patrimony_number: patNum,
                serial_number: serial,
                internal_code: intCode,
                status: 'cautelado',
                tamanho: tamanho || null // NOVA COLUNA
            }).select().single();
            if (mErr) { console.error("Erro material:", mErr); continue; }
            materialId = newMat.id;
        }

        // 4. Criar Cautela Permanente
        console.log(`Criando cautela permanente para ${nome}`);
        const { data: cautelaData, error: cErr } = await supabase.from('cautelas').insert({
            person_id: personId,
            operator_id: operatorId,
            type: 'permanent',
            status: 'open',
            destino: destino || null, // NOVA COLUNA
            situacao_legado: situacao || null // NOVA COLUNA
        }).select().single();

        if (cErr) { console.error("Erro cautela:", cErr); continue; }

        // 5. Vincular Material na Cautela Item
        const { error: ciErr } = await supabase.from('cautela_items').insert({
            cautela_id: cautelaData.id,
            material_id: materialId,
            status: 'pending',
            carregadores: carregadores || null // NOVA COLUNA
        });

        if (ciErr) { console.error("Erro cautela_item:", ciErr); }
        
        await delay(100);
    }
    
    console.log("Importação concluída com sucesso!");
}

runImport().catch(console.error);
