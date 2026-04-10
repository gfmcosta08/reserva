import PersonsClient from "@/components/PersonsClient";
import { createClient } from "@/lib/supabase-server";

export default async function PersonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single()
  
  return <PersonsClient userRole={profile?.role || "operator"} />;
}
