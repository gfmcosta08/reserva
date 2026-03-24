import { getMaterials } from "@/app/actions/materials";
import { getCategories } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";
import { createClient } from "@/lib/supabase-server";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category_id?: string; status?: string };
}) {
  const materials = await getMaterials(searchParams);
  const categories = await getCategories();

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single()

  return (
    <MaterialsClient 
      initialMaterials={materials} 
      categories={categories} 
      userRole={profile?.role || "operator"}
    />
  );
}
