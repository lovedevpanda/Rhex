import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"
import { buildPluginPointReason, getPluginInstallation } from "@/lib/plugins"

export async function chargePluginTicket(input: { pluginId: string; userId: number }) {
  const [plugin, settings] = await Promise.all([
    getPluginInstallation(input.pluginId),
    getSiteSettings(),
  ])

  if (!plugin || !plugin.enabled) {
    throw new Error("插件未安装或未启用")
  }

  const ticketKey = plugin.pointsIntegration?.ticketKey
  const ticketCost = ticketKey ? Number(plugin.config[ticketKey] ?? 0) : 0

  if (ticketCost <= 0) {
    return { charged: false, amount: 0 }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, points: true },
    })

    if (!user) {
      throw new Error("用户不存在")
    }

    if (user.points < ticketCost) {
      throw new Error(`${settings.pointName}不足，无法支付门票`)
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        points: {
          decrement: ticketCost,
        },
      },
    })

    await tx.pointLog.create({
      data: {
        userId: user.id,
        changeType: "DECREASE",
        changeValue: ticketCost,
        reason: buildPluginPointReason(plugin.displayName, "ticket", settings.pointName, ticketCost),
      },
    })

    return { charged: true, amount: ticketCost }
  })
}

export async function rewardPluginWinner(input: { pluginId: string; userId: number }) {
  const [plugin, settings] = await Promise.all([
    getPluginInstallation(input.pluginId),
    getSiteSettings(),
  ])

  if (!plugin || !plugin.enabled) {
    throw new Error("插件未安装或未启用")
  }

  const rewardKey = plugin.pointsIntegration?.rewardKey
  const rewardAmount = rewardKey ? Number(plugin.config[rewardKey] ?? 0) : 0

  if (rewardAmount <= 0) {
    return { rewarded: false, amount: 0 }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    })

    if (!user) {
      throw new Error("用户不存在")
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        points: {
          increment: rewardAmount,
        },
      },
    })

    await tx.pointLog.create({
      data: {
        userId: user.id,
        changeType: "INCREASE",
        changeValue: rewardAmount,
        reason: buildPluginPointReason(plugin.displayName, "reward", settings.pointName, rewardAmount),
      },
    })

    return { rewarded: true, amount: rewardAmount }
  })
}
