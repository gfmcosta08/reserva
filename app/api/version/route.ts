import { NextResponse } from "next/server"

/** Confirma que este build é o app RESERVA (Next.js) e expõe o commit do Git na Vercel. */
export async function GET() {
  return NextResponse.json({
    app: "RESERVA",
    framework: "next",
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  })
}
