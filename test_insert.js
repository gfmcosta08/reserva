const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://chguaozitzwfsmqyhreb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Testing insert on persons table...");
    const obj = { full_name: "Teste Agent", rg: "999999999", registration_number: "MAT-999999999", pin_hash: "dummyhash123", function: "TEST" };
    const { data, error } = await supabase.from('persons').insert(obj).select();
    console.log("Insert Error:", error ? error.message : null);
    console.log("Insert Data:", data ? data.length : 0, "rows");
}
test();
