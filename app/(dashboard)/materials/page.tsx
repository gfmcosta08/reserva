import MaterialsPageLoader from "@/components/MaterialsPageLoader";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    category?: string;
    status?: string;
    name?: string;
    reservation_id?: string;
  };
}) {
  const urlQuery = {
    search: searchParams.search,
    name: searchParams.name,
    reservation_id: searchParams.reservation_id,
    category: searchParams.category,
    status: searchParams.status,
  };

  const urlQueryKey = JSON.stringify(urlQuery);

  return <MaterialsPageLoader urlQuery={urlQuery} urlQueryKey={urlQueryKey} />;
}
