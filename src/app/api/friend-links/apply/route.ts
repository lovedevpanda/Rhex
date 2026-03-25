import { NextResponse } from "next/server"

import { submitFriendLinkApplication } from "@/lib/friend-links"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await submitFriendLinkApplication({
      name: body.name,
      url: body.url,
      logoPath: body.logoPath,
    })


    return NextResponse.json({ code: 0, message: "申请已提交，待管理员审核" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "申请提交失败" }, { status: 400 })
  }
}
