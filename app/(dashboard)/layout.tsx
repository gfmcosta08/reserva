import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single()

  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut()
    redirect("/auth/login?reason=inactive")
  }

  return (
    <DashboardShell user={{ email: user.email, role: profile?.role || "operator" }}>
      {children}
    </DashboardShell>
  );
}
