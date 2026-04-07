"use client"

interface AdminBooleanSelectFieldProps {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}

export function AdminBooleanSelectField({ label, checked, onChange }: AdminBooleanSelectFieldProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <select value={checked ? "on" : "off"} onChange={(event) => onChange(event.target.value === "on")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
        <option value="on">开启</option>
        <option value="off">关闭</option>
      </select>
    </div>
  )
}
