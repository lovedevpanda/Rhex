import type { Config } from "tailwindcss"

// 可切换的全站主字体方案。
// 试字体时只需要修改 `activeSansFontPreset` 这一行，不用动下面的 Tailwind 配置结构。
type SansFontPresetName = "systemUi" | "notoSansSc" | "sourceHanSansSc" | "appleFriendly" | "windowsFriendly"

const sansFontPresets: Record<SansFontPresetName, string[]> = {
  // 方案 A：系统无衬线（默认推荐）
  // 特点：加载零成本，跨平台稳定，最适合论坛 / 社区 / 后台类产品。
  systemUi: ["system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans CJK SC"', '"Noto Sans SC"', "sans-serif"],

  // 方案 B：更现代、统一的中文无衬线
  // 说明：如果你后续接入 `Noto Sans SC` Web Font，可以把它放到最前面；没接入时会自动回退到系统字体。
  notoSansSc: ['"Noto Sans SC"', '"Noto Sans CJK SC"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', "sans-serif"],

  // 方案 C：更书面、更沉稳的中文黑体风格
  // 说明：适合内容型社区；如果未接入思源黑体，会自动回退到后面的系统字体。
  sourceHanSansSc: ['"Source Han Sans SC"', '"Noto Sans CJK SC"', '"Noto Sans SC"', "system-ui", "-apple-system", '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"],

  // 方案 D：偏苹果系审美的优先级
  // 特点：在 Apple 设备上观感更精致，Windows 上会自然回退到 `Segoe UI` / `Microsoft YaHei`。
  appleFriendly: ['"PingFang SC"', '"Hiragino Sans GB"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', '"Microsoft YaHei"', '"Noto Sans SC"', "sans-serif"],

  // 方案 E：偏 Windows / 中文桌面端习惯
  // 特点：更接近传统中文桌面网站观感，适合你想要熟悉、稳妥的社区阅读体验。
  windowsFriendly: ['"Segoe UI"', '"Microsoft YaHei"', '"PingFang SC"', '"Noto Sans SC"', "system-ui", "sans-serif"],
}

// 在这里切换当前启用的字体方案：
// - "systemUi"
// - "notoSansSc"
// - "sourceHanSansSc"
// - "appleFriendly"
// - "windowsFriendly"
const activeSansFontPreset: SansFontPresetName = "sourceHanSansSc"
const fontStack = sansFontPresets[activeSansFontPreset]

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: fontStack,
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        soft: "0 14px 44px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: [],
}

export default config
