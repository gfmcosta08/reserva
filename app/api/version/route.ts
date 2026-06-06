import { NextResponse } from "next/server"

/** Confirma que este build é o app RESERVA (Next.js) e expõe o commit do Git na Vercel. */
export async function GET() {
  const supabaseEnv = process.env.RESERVA_SUPABASE_ENV ?? "unknown"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null

  return NextResponse.json({
    app: "RESERVA",
    framework: "next",
    supabaseEnv,
    supabaseRef,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  })
}
