import { NextResponse } from "next/server"

import { getSessionCookieName } from "@/lib/session"

export async function POST() {
  const response = NextResponse.json({ code: 0, message: "success" })

  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })

  return response
}

