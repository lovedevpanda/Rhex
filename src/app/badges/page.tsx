import { redirect } from "next/navigation"

export default function BadgesPage() {
  redirect("/settings?tab=badges")
}
