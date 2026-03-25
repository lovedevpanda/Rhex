import { redirect } from "next/navigation"

export default function LevelPage() {
  redirect("/settings?tab=level")
}
