import { getMaterials } from "@/app/actions/materials";
import { getCategories } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category_id?: string; status?: string };
}) {
  const materials = await getMaterials(searchParams);
  const categories = await getCategories();

  return (
    <MaterialsClient 
      initialMaterials={materials} 
      categories={categories} 
    />
  );
}
