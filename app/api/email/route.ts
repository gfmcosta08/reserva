import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { cautelaId } = await request.json()

    if (!cautelaId) {
      return NextResponse.json({ error: "Missing cautelaId" }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Fetch cautela details
    const { data: cautela, error: cautelaError } = await supabase
      .from("cautelas")
      .select(`
        *,
        persons(full_name, registration_number),
        profiles(name, email)
      `)
      .eq("id", cautelaId)
      .single()

    if (cautelaError || !cautela) {
      return NextResponse.json({ error: "Cautela not found" }, { status: 404 })
    }

    // 2. Fetch items
    const { data: items } = await supabase
      .from("cautela_items")
      .select(`
        *,
        materials(name, patrimony_number)
      `)
      .eq("cautela_id", cautelaId)

    // 3. Send Email via Resend
    // Enviando para o e-mail do Operador/Supervisor que realizou a cautela
    const emailTo = cautela.profiles?.email
    if (!emailTo) {
      console.warn("Operator has no email configured, falling back to default.")
    }
    
    // Define the recipient
    const recipient = emailTo || process.env.DEFAULT_NOTIFICATION_EMAIL || "suporte@bpm.com.br"

    const itemsList = items?.map((i: any) => `- ${i.materials?.name} (Patrimônio: ${i.materials?.patrimony_number})`).join("\n")
    const emailSubject = `Recibo de Cautela de Material - ${new Date().toLocaleDateString('pt-BR')}`
    const emailBody = `
Olá ${cautela.persons?.full_name},

Este é o recibo da cautela realizada no sistema de Controle de Material.

Data: ${new Date(cautela.created_at).toLocaleString('pt-BR')}
Tipo: ${cautela.type === "daily" ? "Diária" : "Permanente"}
Operador: ${cautela.profiles?.name}

Itens Cautelados:
${itemsList}

${cautela.notes ? `Observações gerais: ${cautela.notes}` : ""}

Por favor, mantenha este documento para controle. A devolução dos materiais deve ser feita nas condições em que foram entregues.

Atenciosamente,
Sistema de Controle de Material
`

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: [recipient],
      subject: emailSubject,
      text: emailBody,
    })

    if (error) {
       console.error("Resend API error:", error)
       return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("Email enviado com sucesso via Resend:", data)
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
