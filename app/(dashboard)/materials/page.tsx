import { getMaterials } from "@/app/actions/materials";
import { getCategories } from "@/app/actions/categories";
import MaterialsClient from "@/components/MaterialsClient";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type MaterialsFilters = {
  search?: string;
  category_id?: string;
  status?: string;
  name?: string;
  reservation_id?: string;
};

type RawSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined> | undefined>
  | undefined;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: RawSearchParams;
}) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};

  const filters: MaterialsFilters = {
    search: firstParam(resolvedSearchParams.search),
    name: firstParam(resolvedSearchParams.name),
    reservation_id: firstParam(resolvedSearchParams.reservation_id),
    category_id: firstParam(resolvedSearchParams.category_id),
    status: firstParam(resolvedSearchParams.status),
  };

  const [materials, categories] = await Promise.all([
    getMaterials(filters).catch((error) => {
      console.error("[materials-page] getMaterials", error);
      return [];
    }),
    getCategories().catch((error) => {
      console.error("[materials-page] getCategories", error);
      return [];
    }),
  ]);

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
