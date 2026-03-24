import { getMaterials } from "@/app/actions/materials";
import { getCategories } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";
import { createClient } from "@/lib/supabase-server";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category_id?: string; status?: string; name?: string; reservation_id?: string };
}) {
  const materials = await getMaterials(searchParams);
  const categories = await getCategories();

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single()

  const { data: allMaterials } = await supabase.from("materials").select("name, reservation_id");
  const materialNames = Array.from(new Set(allMaterials?.map(m => m.name))).filter(Boolean).sort() as string[];
  const locations = Array.from(new Set(allMaterials?.map(m => m.reservation_id))).filter(Boolean).sort() as string[];

  return (
    <MaterialsClient 
      initialMaterials={materials} 
      categories={categories} 
      userRole={profile?.role || "operator"}
      materialNames={materialNames}
      locations={locations}
    />
  );
}
