const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://chguaozitzwfsmqyhreb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU'
);

async function setup() {
  console.error(
    "Obsoleto: a tabela `categories` foi unificada em `materials.category`. Não execute este script. Encerrando."
  );
  process.exit(1);
  // 1. Delete invalid categories
  console.log('1. Cleaning up invalid categories...');
  
  const invalidPatterns = ['1º BPM', '01', '02', 'XX', 'SEM OBS', 'CAUTELADA', 'CAUTALADA', 'PALMAS'];
  
  const { data: allCats } = await supabase.from('categories').select('id, name');
  const toDelete = allCats?.filter(c => 
    invalidPatterns.some(inv => c.name.includes(inv))
  ).map(c => c.id) || [];
  
  console.log('Categories to delete:', toDelete.length, toDelete);
  
  if (toDelete.length > 0) {
    // First update materials to remove category_id for these categories
    await supabase.from('materials').update({ category_id: null }).in('category_id', toDelete);
    // Then delete categories
    for (const id of toDelete) {
      await supabase.from('categories').delete().eq('id', id);
    }
    console.log('Deleted categories:', toDelete.length);
  }
  
  // 2. Create CARREGADORES category
  console.log('\n2. Creating CARREGADORES category...');
  const { data: carregadoresCat } = await supabase.from('categories').select('*').eq('name', 'CARREGADORES').single();
  
  let carregadoresId;
  if (carregadoresCat) {
    carregadoresId = carregadoresCat.id;
    console.log('CARREGADORES already exists:', carregadoresId);
  } else {
    const { data: newCat } = await supabase.from('categories').insert({ name: 'CARREGADORES' }).select('id').single();
    carregadoresId = newCat?.id;
    console.log('CARREGADORES created:', carregadoresId);
  }
  
  // 3. Get MUNICOES category ID
  console.log('\n3. Getting MUNICOES category ID...');
  const { data: municoesCat } = await supabase.from('categories').select('id').eq('name', 'MUNIÇÕES').single();
  console.log('MUNICOES ID:', municoesCat?.id);
  
  // 4. Delete old ammunition and carregador materials
  console.log('\n4. Deleting old ammunition materials...');
  const catIdsToDelete = [carregadoresId, municoesCat?.id].filter(Boolean);
  
  if (catIdsToDelete.length > 0) {
    // First get materials to delete
    const { data: matsToDelete } = await supabase.from('materials').select('id').in('category_id', catIdsToDelete);
    const matIds = matsToDelete?.map(m => m.id) || [];
    
    if (matIds.length > 0) {
      // Delete cautela_items first
      await supabase.from('cautela_items').delete().in('material_id', matIds);
      // Then delete materials
      await supabase.from('materials').delete().in('id', matIds);
      console.log('Deleted materials:', matIds.length);
    }
  }
  
  console.log('\n=== READY FOR IMPORT ===');
  console.log('CARREGADORES ID:', carregadoresId);
  console.log('MUNICOES ID:', municoesCat?.id);
  
  return { carregadoresId, municoesId: municoesCat?.id };
}

setup().then(r => console.log('\nDone!', JSON.stringify(r))).catch(console.error);
