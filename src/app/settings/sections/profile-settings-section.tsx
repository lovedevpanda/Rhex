import { BrowsingSettingsPanel } from "@/components/profile/browsing-settings-panel"
import { ProfileAccountBindingSettings } from "@/components/profile/profile-account-binding-settings"
import { ProfileEditForm } from "@/components/profile/profile-edit-form"
import { ProfileNotificationSettings } from "@/components/profile/profile-notification-settings"
import { SettingsTabs } from "@/components/settings/settings-tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { profileTabs } from "@/app/settings/settings-page-loader"
import type { ProfileTabKey, SettingsPageData } from "@/app/settings/settings-page-loader"
import { createDefaultUserNotificationPreferences } from "@/lib/user-notification-preferences"

const profileSectionCopy: Record<ProfileTabKey, { title: string; description: string }> = {
  basic: {
    title: "资料设置",
    description: "在这里维护个人资料与账号信息。",
  },
  privacy: {
    title: "隐私设置",
    description: "在这里控制个人主页活动轨迹与介绍的公开范围。",
  },
  notifications: {
    title: "通知设置",
    description: "在这里配置 webhook / 邮箱两个通知渠道，以及不同通知事件的投递偏好。",
  },
  accounts: {
    title: "账号绑定",
    description: "在这里管理内置第三方登录、插件追加登录方式与 Passkey。",
  },
  browsing: {
    title: "浏览设置",
    description: "在这里维护当前浏览器的浏览偏好。",
  },
}

export function ProfileSettingsSection({ data }: { data: SettingsPageData }) {
  const { route, profile, dbUser, settings, accountBindings } = data
  const panelMeta = profileSectionCopy[route.currentProfileTab]

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle>{panelMeta.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{panelMeta.description}</p>
        </div>
        <SettingsTabs tabs={profileTabs} queryKey="profileTab" basePath="/settings?tab=profile" />
      </CardHeader>

      <CardContent className="space-y-6">
        {route.currentProfileTab === "basic" || route.currentProfileTab === "privacy" ? (
          <ProfileEditForm
            key={route.currentProfileTab}
            username={profile.username}
            initialNickname={profile.displayName}
            initialBio={profile.bio}
            initialIntroduction={profile.introduction}
            initialGender={profile.gender ?? null}
            initialAvatarPath={profile.avatarPath}
            initialEmail={dbUser?.email ?? null}
            initialEmailVerified={Boolean(dbUser?.emailVerifiedAt)}
            passwordChangeRequireEmailVerification={settings.passwordChangeRequireEmailVerification}
            emailDeliveryEnabled={settings.smtpEnabled}
            initialActivityVisibility={dbUser?.activityVisibility ?? "PUBLIC"}
            initialIntroductionVisibility={dbUser?.introductionVisibility ?? "PUBLIC"}
            nicknameChangePointCost={data.nicknameChangePointCost}
            nicknameChangePriceDescription={data.nicknameChangePriceDescription}
            introductionChangePointCost={data.introductionChangePointCost}
            introductionChangePriceDescription={data.introductionChangePriceDescription}
            avatarChangePointCost={data.avatarChangePointCost}
            avatarChangePriceDescription={data.avatarChangePriceDescription}
            pointName={settings.pointName}
            avatarMaxFileSizeMb={settings.uploadAvatarMaxFileSizeMb}
            markdownEmojiMap={settings.markdownEmojiMap}
            markdownImageUploadEnabled={settings.markdownImageUploadEnabled}
            initialSection={route.currentProfileTab === "privacy" ? "privacy" : "basic"}
            availableSections={route.currentProfileTab === "privacy" ? ["privacy"] : ["basic", "avatar", "email", "password"]}
          />
        ) : null}

        {route.currentProfileTab === "notifications" ? (
          <ProfileNotificationSettings
            initialNotificationPreferences={dbUser?.notificationPreferences ?? createDefaultUserNotificationPreferences()}
            initialEmail={dbUser?.email ?? null}
            initialEmailVerified={Boolean(dbUser?.emailVerifiedAt)}
            emailDeliveryEnabled={settings.smtpEnabled}
          />
        ) : null}

        {route.currentProfileTab === "accounts" && accountBindings ? (
          <ProfileAccountBindingSettings providers={accountBindings.providers} passkey={accountBindings.passkey} />
        ) : null}

        {route.currentProfileTab === "browsing" ? <BrowsingSettingsPanel /> : null}
      </CardContent>
    </Card>
  )
}
