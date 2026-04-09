import { getMaterials } from "@/app/actions/materials";
import { getMaterialCategoryOptions } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; status?: string; name?: string; reservation_id?: string };
}) {
  const materials = await getMaterials(searchParams);
  const categories = await getMaterialCategoryOptions();

  const supabase = await createClient();

  const { data: allMaterials, error: allMaterialsError } = await supabase
    .from("materials")
    .select("name, reservation_id");

  if (allMaterialsError) {
    console.error("[materials/page] select name,reservation_id", allMaterialsError.message);
  }

  const materialNames = Array.from(new Set((allMaterials ?? []).map((m) => m.name))).filter(Boolean).sort() as string[];
  const locations = Array.from(new Set((allMaterials ?? []).map((m) => m.reservation_id))).filter(Boolean).sort() as string[];

  const urlQuery = {
    search: searchParams.search,
    name: searchParams.name,
    reservation_id: searchParams.reservation_id,
    category: searchParams.category,
    status: searchParams.status,
  };

  const urlQueryKey = JSON.stringify(urlQuery);

  return (
    <MaterialsClient
      key={urlQueryKey}
      initialMaterials={materials}
      categoryOptions={categories}
      materialNames={materialNames}
      locations={locations}
      urlQuery={urlQuery}
    />
  );
}
