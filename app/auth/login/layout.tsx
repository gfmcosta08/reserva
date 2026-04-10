/** Evita pré-render estático no build quando env do Supabase ainda não está injetada. */
export const dynamic = "force-dynamic"

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
