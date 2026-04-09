const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://chguaozitzwfsmqyhreb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU'
);

const CARREGADORES_ID = '0c0ebe58-2b9f-41e8-8132-64a7e0f7478c';
const MUNICOES_ID = '63b44f45-56ae-49ca-b32c-f16c72486633';

async function importData() {
  // Categories to insert (from the CSV, excluding CARREGADORES which already exists)
  const categoriesToUpsert = [
    { id: '01ee95ce-c1fb-4d98-91b9-ee1a769df875', name: 'REVÓLVER' },
    { id: '04b9e532-89fe-42b0-ac85-651f0ba7ebf4', name: 'METRALHADORA MTR 9MM' },
    { id: '06052f3f-04b5-4aac-8a95-6efd8b55827a', name: 'DETECTORES DE METAL' },
    { id: '07b920cd-0072-4916-8770-9c1ef5e21f6a', name: 'PISTOLAS TAURUS PT 840' },
    { id: '19115816-2897-4562-9b9b-2cd311ac582d', name: 'PISTOLA SPARK Z 2.0' },
    { id: '1a1a59d3-93ed-4072-b818-3400fad1d283', name: 'CARABINA CAL. 5.56  M-15' },
    { id: '20b4e6c6-5048-48ce-8ba2-7a3a37eb9dea', name: 'PISTOLAS IMBEL TCMD6' },
    { id: '2539b6c1-24d5-4be3-87fb-b2594824eec2', name: 'LANÇADOR DE MUNIÇÃO NÃO LETAL' },
    { id: '32bcf89f-046e-4184-9a04-c9ec1bc465ae', name: 'REVOLVER TAURUS CAL. 38' },
    { id: '336391ae-331f-403b-bad1-24e6c396bfd8', name: 'SMARTPHONE' },
    { id: '3486a871-4e8a-4fb2-94db-e2819af3301b', name: 'FUZIL 762 AR-10' },
    { id: '35ad86e3-59e8-40e8-a063-f0a3a40fd312', name: 'PISTOLA GLOCK MOD G17 .9mm' },
    { id: '4437e06c-90ff-46a2-9b09-748d17e474bd', name: 'PISTOLA GLOCK MOD G19 .9mm' },
    { id: '4612e0d3-0280-496c-ae49-564f0b92767d', name: 'TAURUS TS9' },
    { id: '461e0a17-6649-4343-82c5-e40207a7fff0', name: 'PISTOLAS TAURUS PT 100' },
    { id: '490ec267-d920-4b02-a775-ea7708ae8ffd', name: 'TRANSCEPTORES PORTATEIS "HT" NOVOS' },
    { id: '51564171-78a0-4642-a341-d7d12e962c8f', name: 'PISTOLA TAURUS MOD TS9 .9mm' },
    { id: '593a0300-860c-4935-a267-c4c973377ad0', name: 'CARABINA CAL. 5.56 MD-97' },
    { id: '63b44f45-56ae-49ca-b32c-f16c72486633', name: 'MUNIÇÕES' },
    { id: '70d037f0-714e-4f24-9afc-368739ebd2e8', name: 'PISTOLAS IMBEL GCMD1' },
    { id: '8bc45329-f7de-4687-af67-6f5cf47b5db9', name: 'FUZIL CAL. 5.56 MD-97' },
    { id: '9dacac8e-2154-43db-a0c0-1ed87a0fa39f', name: 'CELULARES' },
    { id: 'a9afb84f-1e79-4fe9-a496-bba08b420e3b', name: 'FUZIL 762' },
    { id: 'ad49d93b-936c-44e6-9a38-65bfa437ade4', name: 'PISTOLAS GLOCK 9MM' },
    { id: 'b56ec505-024f-4b7c-a2d5-d1534d21cd56', name: 'TONFAS E CACETETES' },
    { id: 'b74e232d-f87e-46d1-9abe-6a84edf3afea', name: 'PT IMBEL' },
    { id: 'b777ccb3-4482-463d-bc4c-c8caf4c4ecad', name: 'CARABINA 556 IA2' },
    { id: 'bc183192-5ba4-4ffe-89f3-f23b2c64bbab', name: 'ESPINGARDA DE REPETIÇÃO MILITARY 3.0 RT CAL. 12' },
    { id: 'c263c68e-c351-458c-9ddd-d2a81b90b030', name: 'CARABINA CAL. 5.56 M-15' },
    { id: 'c96461f5-7f9e-4770-8767-96fd69d3a40f', name: 'COLETES BALISTICOS CAUTELADOS 1ºBPM' },
    { id: 'c9f1bc6e-b6c4-43cd-9e23-cf6daaf5f90e', name: 'REVOLVER ROSSI CAL. 38' },
    { id: 'ca3e1bf1-337a-47d4-ad68-7d76cd6ce081', name: 'SUB-METRALHADORA .40' },
    { id: 'ce6fab6e-f434-492a-b754-1891e0e84bc4', name: 'PISTOLAS BERETTA APX 9MM' },
    { id: 'd2910ff8-3891-4eef-9bbd-8f623e4fc8b9', name: 'IMPRESSORAS' },
    { id: 'd59ea0fb-d60a-4718-9d2a-6ed0dc039472', name: 'CARABINA CT .40' },
    { id: 'd718fd49-6140-44c7-ac0c-228d3b9e6a2a', name: 'BAIONETAS' },
    { id: '0c0ebe58-2b9f-41e8-8132-64a7e0f7478c', name: 'CARREGADORES' },
  ];

  // Insert categories
  console.log('1. Inserting categories...');
  for (const cat of categoriesToUpsert) {
    const { error } = await supabase.from('categories').upsert(cat, { onConflict: 'id' });
    if (error) console.log('Error inserting', cat.name, error.message);
  }
  console.log('Categories done!');

  // Materials - Municoes
  console.log('\n2. Inserting munition materials...');
  const municoesMaterials = [
    { name: 'MUNIÇÃO 5.56mm', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-556MM', serial_number: '556MM', internal_code: 'GEN-INT-556MM', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO 9mm', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-9mm', serial_number: '9mm', internal_code: 'GEN-INT-9mm', status: 'available' },
    { name: 'MUNIÇÃO .40 S&W', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-.40 S&W', serial_number: '.40 S&W', internal_code: 'GEN-INT-.40 S&W', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO .38 SPL', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-.38 SPL', serial_number: '.38 SPL', internal_code: 'GEN-INT-.38 SPL', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO 7.62x51mm', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-762x51mm', serial_number: '762x51mm', internal_code: 'GEN-INT-762x51mm', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO 12mm', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-12mm', serial_number: '12mm', internal_code: 'GEN-INT-12mm', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO ELASTÔMERO', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-ELASTÔMERO', serial_number: 'ELASTÔMERO', internal_code: 'GEN-INT-ELASTÔMERO', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO EXPO – 147gr', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-EXPO', serial_number: 'EXPO', internal_code: 'GEN-INT-EXPO', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO FESTIM', category_id: MUNICOES_ID, patrimony_number: 'GEN-PAT-FESTIM', serial_number: 'FESTIM', internal_code: 'GEN-INT-FESTIM', status: 'available', notes: 'NORMAL' },
  ];

  for (const mat of municoesMaterials) {
    const { error } = await supabase.from('materials').insert(mat);
    if (error) console.log('Error inserting', mat.name, error.message);
    else console.log('Inserted:', mat.name);
  }

  // Materials - Carregadores
  console.log('\n3. Inserting carregador materials...');
  const carregadorMaterials = [
    { name: 'CARREGADOR 9MM - GLOCK G17 GEN5', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-11', serial_number: '01-11', internal_code: 'GEN-INT-01-11', status: 'available', notes: 'G17/Gen5' },
    { name: 'CARREGADOR 9MM - GLOCK G19 GEN5', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-02-6', serial_number: '02-6', internal_code: 'GEN-INT-02-6', status: 'available', notes: 'G19/Gen5' },
    { name: 'CARREGADOR 9MM - TAURUS TS9C', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-3', serial_number: '01-3', internal_code: 'GEN-INT-01-3', status: 'available', notes: 'TS9C' },
    { name: 'CARREGADOR .40 - TAURUS PT100', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-6', serial_number: '01-6', internal_code: 'GEN-INT-01-6', status: 'available', notes: 'PT 100' },
    { name: 'CARREGADOR .40 - IMBEL GCMD1', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-5', serial_number: '01-5', internal_code: 'GEN-INT-01-5', status: 'available', notes: 'GCMD1' },
    { name: 'CARREGADOR 9MM - METRALHADORA MTR', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-4', serial_number: '01-4', internal_code: 'GEN-INT-01-4', status: 'available', notes: '976' },
    { name: 'CARREGADOR 7.62mm - FUZIL PARAFAL', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-7', serial_number: '01-7', internal_code: 'GEN-INT-01-7', status: 'available', notes: 'PARAFAL' },
    { name: 'CARREGADOR 7.62mm - FUZIL AR-10', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-8', serial_number: '01-8', internal_code: 'GEN-INT-01-8', status: 'available', notes: 'AR-10' },
    { name: 'CARREGADOR 5.56mm - FUZIL IA2/MD97', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-9', serial_number: '01-9', internal_code: 'GEN-INT-01-9', status: 'available', notes: '5.56' },
    { name: 'CARREGADOR .40 - CARABINA CT', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-01-10', serial_number: '01-10', internal_code: 'GEN-INT-01-10', status: 'available', notes: 'CARABINA' },
    { name: 'CARREGADOR .40 - CARABINA CT', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-02-4', serial_number: '02-4', internal_code: 'GEN-INT-02-4', status: 'available', notes: 'CARABINA' },
    { name: 'CARREGADOR .40 - SMT', category_id: CARREGADORES_ID, patrimony_number: 'GEN-PAT-02-5', serial_number: '02-5', internal_code: 'GEN-INT-02-5', status: 'available', notes: 'SMT 40' },
  ];

  for (const mat of carregadorMaterials) {
    const { error } = await supabase.from('materials').insert(mat);
    if (error) console.log('Error inserting', mat.name, error.message);
    else console.log('Inserted:', mat.name);
  }

  console.log('\n=== IMPORT COMPLETE ===');
  
  // Verify
  const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { count: matCount } = await supabase.from('materials').select('*', { count: 'exact', head: true });
  console.log('Total categories:', catCount);
  console.log('Total materials:', matCount);
}

importData().catch(console.error);
