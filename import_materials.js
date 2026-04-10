const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://chguaozitzwfsmqyhreb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU'
);

async function importData() {
  // Materials - Municoes (categoria como texto em materials.category)
  console.log('1. Inserting munition materials...');
  const municoesMaterials = [
    { name: 'MUNIÇÃO 5.56mm', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-556MM', serial_number: '556MM', internal_code: 'GEN-INT-556MM', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO 9mm', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-9mm', serial_number: '9mm', internal_code: 'GEN-INT-9mm', status: 'available' },
    { name: 'MUNIÇÃO .40 S&W', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-.40 S&W', serial_number: '.40 S&W', internal_code: 'GEN-INT-.40 S&W', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO .38 SPL', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-.38 SPL', serial_number: '.38 SPL', internal_code: 'GEN-INT-.38 SPL', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO 7.62x51mm', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-762x51mm', serial_number: '762x51mm', internal_code: 'GEN-INT-762x51mm', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO 12mm', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-12mm', serial_number: '12mm', internal_code: 'GEN-INT-12mm', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO ELASTÔMERO', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-ELASTÔMERO', serial_number: 'ELASTÔMERO', internal_code: 'GEN-INT-ELASTÔMERO', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO EXPO – 147gr', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-EXPO', serial_number: 'EXPO', internal_code: 'GEN-INT-EXPO', status: 'available', notes: 'NORMAL' },
    { name: 'MUNIÇÃO FESTIM', category: 'MUNIÇÕES', patrimony_number: 'GEN-PAT-FESTIM', serial_number: 'FESTIM', internal_code: 'GEN-INT-FESTIM', status: 'available', notes: 'NORMAL' },
  ];

  for (const mat of municoesMaterials) {
    const { error } = await supabase.from('materials').insert(mat);
    if (error) console.log('Error inserting', mat.name, error.message);
    else console.log('Inserted:', mat.name);
  }

  console.log('\n2. Inserting carregador materials...');
  const carregadorMaterials = [
    { name: 'CARREGADOR 9MM - GLOCK G17 GEN5', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-11', serial_number: '01-11', internal_code: 'GEN-INT-01-11', status: 'available', notes: 'G17/Gen5' },
    { name: 'CARREGADOR 9MM - GLOCK G19 GEN5', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-02-6', serial_number: '02-6', internal_code: 'GEN-INT-02-6', status: 'available', notes: 'G19/Gen5' },
    { name: 'CARREGADOR 9MM - TAURUS TS9C', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-3', serial_number: '01-3', internal_code: 'GEN-INT-01-3', status: 'available', notes: 'TS9C' },
    { name: 'CARREGADOR .40 - TAURUS PT100', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-6', serial_number: '01-6', internal_code: 'GEN-INT-01-6', status: 'available', notes: 'PT 100' },
    { name: 'CARREGADOR .40 - IMBEL GCMD1', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-5', serial_number: '01-5', internal_code: 'GEN-INT-01-5', status: 'available', notes: 'GCMD1' },
    { name: 'CARREGADOR 9MM - METRALHADORA MTR', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-4', serial_number: '01-4', internal_code: 'GEN-INT-01-4', status: 'available', notes: '976' },
    { name: 'CARREGADOR 7.62mm - FUZIL PARAFAL', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-7', serial_number: '01-7', internal_code: 'GEN-INT-01-7', status: 'available', notes: 'PARAFAL' },
    { name: 'CARREGADOR 7.62mm - FUZIL AR-10', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-8', serial_number: '01-8', internal_code: 'GEN-INT-01-8', status: 'available', notes: 'AR-10' },
    { name: 'CARREGADOR 5.56mm - FUZIL IA2/MD97', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-9', serial_number: '01-9', internal_code: 'GEN-INT-01-9', status: 'available', notes: '5.56' },
    { name: 'CARREGADOR .40 - CARABINA CT', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-01-10', serial_number: '01-10', internal_code: 'GEN-INT-01-10', status: 'available', notes: 'CARABINA' },
    { name: 'CARREGADOR .40 - CARABINA CT', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-02-4', serial_number: '02-4', internal_code: 'GEN-INT-02-4', status: 'available', notes: 'CARABINA' },
    { name: 'CARREGADOR .40 - SMT', category: 'CARREGADORES', patrimony_number: 'GEN-PAT-02-5', serial_number: '02-5', internal_code: 'GEN-INT-02-5', status: 'available', notes: 'SMT 40' },
  ];

  for (const mat of carregadorMaterials) {
    const { error } = await supabase.from('materials').insert(mat);
    if (error) console.log('Error inserting', mat.name, error.message);
    else console.log('Inserted:', mat.name);
  }

  console.log('\n=== IMPORT COMPLETE ===');
  
  const { count: matCount } = await supabase.from('materials').select('*', { count: 'exact', head: true });
  console.log('Total materials:', matCount);
}

importData().catch(console.error);
