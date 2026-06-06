# Baseline: PRD Obsidian vs repositório

**Gerado em:** 2026-05-18  
**Fonte da verdade:** `docs/obsidian-prd/PRD — Controle de Material.md` (Obsidian v1.2, 2026-05-13)

## Resumo

| Métrica | Obsidian (via junction) | `PRD.md` (repo) |
|---------|------------------------|-----------------|
| Linhas | 987 | 987 (após sync) |
| Tamanho (bytes) | 42.844 | 42.844 (após sync) |
| SHA-256 (após sync) | idêntico | idêntico |

## Divergência encontrada (antes da sincronização)

- **Conteúdo textual:** equivalente linha a linha (`Compare-Object` sem diferenças).
- **Codificação de quebra de linha:** Obsidian usava **LF** (`\n`); o `PRD.md` no Git usava **CRLF** (`\r\n`), gerando ~987 bytes a mais no repo e hashes diferentes.
- **Ação aplicada:** `PRD.md` foi copiado do Obsidian para alinhar o repositório à fonte oficial.

## Como revalidar

```powershell
$obs = (Get-ChildItem "docs\obsidian-prd\*.md").FullName
$h1 = (Get-FileHash -LiteralPath $obs).Hash
$h2 = (Get-FileHash "PRD.md").Hash
$h1 -eq $h2  # deve ser True
```

Se você editar só no Obsidian, rode a cópia de novo ou peça ao agente para sincronizar antes de implementar mudanças.

## Divergências documentais (PRD texto × schema real)

Estas diferenças **não** são resolvidas pela cópia do arquivo; exigem atualização do PRD no Obsidian ou mudança de código:

| Tópico | PRD §2.1 | Código / migration |
|--------|----------|-------------------|
| Categorias | Tabela `categories` + `materials.category_id` | [`20260407120000_merge_categories_into_materials.sql`](../supabase/migrations/20260407120000_merge_categories_into_materials.sql) — coluna `materials.category` (TEXT), tabela `categories` removida |

Ver também: [`BACKLOG-PRD-GAPS.md`](./BACKLOG-PRD-GAPS.md).
