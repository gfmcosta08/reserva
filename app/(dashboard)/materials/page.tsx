import { Suspense } from "react";
import { getMaterials } from "@/app/actions/materials";
import { getMaterialCategoryOptions } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function MaterialsLoading() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-10 w-72 rounded-lg bg-slate-800" />
      <div className="h-14 rounded-2xl border border-slate-800 bg-slate-900/50" />
      <div className="min-h-[320px] rounded-2xl border border-slate-800 bg-slate-900/50" />
    </div>
  );
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; status?: string; name?: string; reservation_id?: string };
}) {
  const materials = await getMaterials(searchParams);
  const categories = await getMaterialCategoryOptions();

  const supabase = await createClient()

  const { data: allMaterials, error: allMaterialsError } = await supabase
    .from("materials")
    .select("name, reservation_id")

  if (allMaterialsError) {
    console.error("[materials/page] select name,reservation_id", allMaterialsError.message)
  }

  const materialNames = Array.from(new Set((allMaterials ?? []).map((m) => m.name))).filter(Boolean).sort() as string[]
  const locations = Array.from(new Set((allMaterials ?? []).map((m) => m.reservation_id))).filter(Boolean).sort() as string[]

  return (
    <Suspense fallback={<MaterialsLoading />}>
      <MaterialsClient
        initialMaterials={materials}
        categoryOptions={categories}
        materialNames={materialNames}
        locations={locations}
      />
    </Suspense>
  );
}
