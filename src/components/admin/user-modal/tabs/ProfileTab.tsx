"use client"

import type { UserActionsState } from "@/components/admin/user-modal/hooks/use-user-actions"
import { Field, SelectField, TextAreaField } from "@/components/admin/user-modal/components/FormFields"
import { Button } from "@/components/ui/button"

export function ProfileTab({
  profile,
  isPending,
}: {
  profile: UserActionsState["profile"]
  isPending: boolean
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="rounded-[20px] border border-border p-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">基础资料</h4>
          <p className="text-xs text-muted-foreground">运营可直接维护昵称、邮箱、手机号、简介与介绍。</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="昵称" value={profile.state.draft.nickname} onChange={(value) => profile.setField("nickname", value)} />
          <Field label="邮箱" value={profile.state.draft.email} onChange={(value) => profile.setField("email", value)} placeholder="可留空" />
          <Field label="手机号" value={profile.state.draft.phone} onChange={(value) => profile.setField("phone", value)} placeholder="11 位手机号，可留空" />
          <SelectField
            label="性别"
            value={profile.state.draft.gender}
            onValueChange={(value) => profile.setField("gender", value)}
            options={[
              { value: "unknown", label: "未知" },
              { value: "male", label: "男" },
              { value: "female", label: "女" },
            ]}
          />
          <TextAreaField label="个人简介" value={profile.state.draft.bio} onChange={(value) => profile.setField("bio", value)} className="md:col-span-2" />
          <TextAreaField label="个人介绍" value={profile.state.draft.introduction} onChange={(value) => profile.setField("introduction", value)} className="md:col-span-2" rows={5} />
        </div>
        {profile.state.feedback ? <p className="mt-3 text-xs text-muted-foreground">{profile.state.feedback}</p> : null}
        <Button type="button" disabled={isPending} className="mt-3 h-9 rounded-full px-4 text-xs" onClick={profile.saveProfile}>
          {isPending ? "保存中..." : "保存基础资料"}
        </Button>
      </section>

      <section className="rounded-[20px] border border-border p-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">管理员备注</h4>
          <p className="text-xs text-muted-foreground">备注会写入后台操作日志，方便交接班和工单追溯。</p>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <TextAreaField label="备注内容" value={profile.state.adminNote} onChange={profile.setAdminNote} placeholder="例如：邮箱申诉通过，已人工核验历史工单" rows={6} />
          {profile.state.noteFeedback ? <p className="text-xs text-muted-foreground">{profile.state.noteFeedback}</p> : null}
          <Button type="button" variant="outline" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={profile.saveNote}>
            {isPending ? "记录中..." : "保存备注"}
          </Button>
        </div>
      </section>
    </div>
  )
}
