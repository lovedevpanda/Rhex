import { NextResponse } from "next/server"

import { getHomepagePosts } from "@/lib/posts"

export async function GET() {
  const posts = await getHomepagePosts()

  return NextResponse.json({
    code: 0,
    message: "success",
    data: posts,
  })
}
