import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  const user = await getCurrentUser()

  return NextResponse.json({
    code: 0,
    message: "success",
    data: user,
  })
}
