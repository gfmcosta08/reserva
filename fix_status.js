const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://chguaozitzwfsmqyhreb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStatus() {
    console.log("Fixing generic 'cautelado' status to 'in_use'...");
    const { error: err1 } = await supabase
        .from('materials')
        .update({ status: 'in_use' })
        .eq('status', 'cautelado');
        
    if (err1) console.error("Error 1:", err1);

    console.log("Fetching all open cautelas to mark their materials as 'in_use'...");
    // Update materials that are in pending cautela items
    const { data: cautelaItems, error: err2 } = await supabase
        .from('cautela_items')
        .select('material_id');
        
    if (err2) console.error("Error 2:", err2);

    if (cautelaItems && cautelaItems.length > 0) {
        const materialIds = Array.from(new Set(cautelaItems.map(ci => ci.material_id)));
        console.log(`Setting ${materialIds.length} materials to 'in_use'...`);
        
        // Supabase JS doesn't support 'in' with large arrays perfectly sometimes, let's do batches if needed or just use 'in'
        const { error: err3 } = await supabase
            .from('materials')
            .update({ status: 'in_use' })
            .in('id', materialIds);
            
        if (err3) console.error("Error 3:", err3);
    }

    console.log("Fix done!");
}

fixStatus().catch(console.error);
