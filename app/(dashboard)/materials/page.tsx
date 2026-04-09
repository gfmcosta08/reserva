import { getMaterials } from "@/app/actions/materials";
import { getMaterialCategoryOptions } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";
import { createClient } from "@/lib/supabase-server";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; status?: string; name?: string; reservation_id?: string };
}) {
  const materials = await getMaterials(searchParams);
  const categories = await getMaterialCategoryOptions();

  const supabase = await createClient()

  const { data: allMaterials } = await supabase.from("materials").select("name, reservation_id");
  const materialNames = Array.from(new Set(allMaterials?.map(m => m.name))).filter(Boolean).sort() as string[];
  const locations = Array.from(new Set(allMaterials?.map(m => m.reservation_id))).filter(Boolean).sort() as string[];

  return (
    <MaterialsClient
      initialMaterials={materials}
      categoryOptions={categories}
      materialNames={materialNames}
      locations={locations}
    />
  );
}
