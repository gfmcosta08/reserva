const https = require('https');

const options = {
  hostname: 'chguaozitzwfsmqyhreb.supabase.co',
  port: 443,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MDE3NiwiZXhwIjoyMDg5ODM2MTc2fQ.8rlShgZ8wFSJEE0IhBCvJJlObJD8XzCpyC-lVM1l1oU'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    const cautelasSchema = json.definitions.cautelas;
    console.log("Cautelas columns:", Object.keys(cautelasSchema.properties));
    const itemsSchema = json.definitions.cautela_items;
    console.log("Cautela Items columns:", Object.keys(itemsSchema.properties));
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
