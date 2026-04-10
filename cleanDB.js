const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://chguaozitzwfsmqyhreb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU');

async function clean() {
  console.log("Iniciando limpeza...");
  const { data, error } = await supabase.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000').select();
  if (error) console.error("Erro:", error);
  else console.log("Apagados com sucesso. Total de linhas:", data ? data.length : 0);
  process.exit(0);
}
clean();
