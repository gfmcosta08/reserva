import csv
import re

importacao_file = 'public/importacao.csv'
cautelas_file = 'public/cautelas_permanentes.csv'
output_file = 'public/importacao_disponivel.csv'

# Read importacao.csv
with open(importacao_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    importacao_fields = reader.fieldnames
    importacao_data = list(reader)

# Read cautelas_permanentes.csv
with open(cautelas_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    cautelas_data = list(reader)

# Store used indexes to avoid double counting
matched_importacao_indexes = set()
unmatched_cautelas = []

def clean_serial(s):
    # Remove EX. prefix and non-alphanumeric chars for looser matching
    s = s.replace('EX.', '')
    return re.sub(r'[^A-Za-z0-9]', '', s).upper()

# Try to match each cautela to an item in importacao
for cautela in cautelas_data:
    serial_cautela = cautela['Serial_Numero'].strip()
    if not serial_cautela:
        continue
    
    c_clean = clean_serial(serial_cautela)
    
    match_idx = -1
    
    # Priority 1: Exact match with NumeroSerie (ignoring case/whitespace)
    for i, item in enumerate(importacao_data):
        if i in matched_importacao_indexes:
            continue
        i_clean = clean_serial(item['NumeroSerie'])
        if c_clean == i_clean and c_clean != '':
            match_idx = i
            break
            
    # Priority 2: cautela serial is a suffix of importacao NumeroSerie
    if match_idx == -1:
        for i, item in enumerate(importacao_data):
            if i in matched_importacao_indexes:
                continue
            i_clean = clean_serial(item['NumeroSerie'])
            # if c_clean is '303', it matches 'BPDC303' ending with '303'
            # if c_clean is 'EX39619', wait, we removed EX. so it's '39619'
            if i_clean.endswith(c_clean) and len(c_clean) > 0:
                # To be safer, maybe check if the categories are somewhat matching?
                cat_cautela = cautela['Categoria'].upper()
                cat_import = item['Categoria'].upper()
                # Basic overlap check or just accept suffix
                match_idx = i
                break
                
    if match_idx != -1:
        matched_importacao_indexes.add(match_idx)
        print(f"MATCH: Cautela '{serial_cautela}' ({cautela['Categoria']}) -> Importacao '{importacao_data[match_idx]['NumeroSerie']}' ({importacao_data[match_idx]['Categoria']})")
    else:
        unmatched_cautelas.append(cautela)
        print(f"NO MATCH: Cautela '{serial_cautela}' ({cautela['Categoria']})")

print(f"\nTotal importacao items: {len(importacao_data)}")
print(f"Total cautelas processed: {len(cautelas_data)}")
print(f"Matches found: {len(matched_importacao_indexes)}")
print(f"Unmatched cautelas: {len(unmatched_cautelas)}")

# Write available items
available_data = [item for i, item in enumerate(importacao_data) if i not in matched_importacao_indexes]

with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=importacao_fields)
    writer.writeheader()
    writer.writerows(available_data)

print(f"Wrote {len(available_data)} remaining items to {output_file}")
