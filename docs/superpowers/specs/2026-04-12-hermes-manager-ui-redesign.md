# Hermes Manager — UI 重设计规范

**日期**：2026-04-12
**状态**：已确认
**背景**：Phase 1 MVP 使用深色「黑科技」风格，本次重设计目标是换成 Apple 亮色设计语言，对小白更友好，同时加入中英双语支持。

---

## 1. 设计目标

- **风格**：Apple 亮色设计语言，参考 macOS 系统偏好设置 / Xcode Preferences
- **受众**：不熟悉命令行的普通用户（小白友好）
- **语言**：中英双语，跟随 macOS 系统语言为默认，Config 面板提供手动切换

---

## 2. 设计决策汇总

| 维度 | 决策 | 理由 |
|------|------|------|
| 色彩模式 | 亮色（不提供深色模式） | 小白友好，认知负担低 |
| 导航结构 | 顶部 Segmented Control | macOS 原生控件，内容区最宽 |
| 主色调 | 蒂尔绿 `#30B0C7` | 有辨识度，科技感不过激 |
| 内容区风格 | 白色圆角卡片 + `#F2F2F7` 背景 | macOS 偏好设置风格，熟悉感强 |
| 字体 | `-apple-system`（SF Pro） | 原生，无需加载外部字体 |
| 国际化 | 跟随系统 + 手动覆盖 | 最灵活，符合 Apple HIG |

---

## 3. 色彩规范

### 背景色阶
| Token | 值 | 用途 |
|-------|-----|------|
| `bg-window` | `#F2F2F7` | 窗口背景、面板背景 |
| `bg-card` | `#FFFFFF` | 卡片、输入框 |
| `bg-secondary` | `#E5E5EA` | 次级填充、分割线 |
| `bg-tertiary` | `#D1D1D6` | 禁用背景 |
| `bg-titlebar` | `rgba(246,246,246,.95)` | 标题栏（毛玻璃效果） |

### 文字色
| Token | 值 | 用途 |
|-------|-----|------|
| `text-primary` | `#1D1D1F` | 主要文字 |
| `text-secondary` | `#424245` | 次要文字 |
| `text-tertiary` | `#6C6C70` | 辅助文字、区块标签 |
| `text-placeholder` | `#8E8E93` | 占位符、禁用文字 |

### 主色与状态色
| Token | 值 | 用途 |
|-------|-----|------|
| `accent` | `#30B0C7` | 按钮、选中状态、进度条 |
| `accent-light` | `#E8F8FB` | 主色背景填充（徽章、选中卡片） |
| `status-green` | `#34C759` | 成功、运行中 |
| `status-yellow` | `#FF9F0A` | 警告 |
| `status-red` | `#FF3B30` | 错误、危险操作 |
| `status-green-bg` | `#E8F9F0` | 成功徽章背景 |
| `status-yellow-bg` | `#FFF8E6` | 警告徽章背景 |
| `status-red-bg` | `#FFF0F0` | 错误徽章背景 |

---

## 4. 字体规范

字体族：`-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`（无需 Google Fonts）

| 用途 | 大小 | 字重 |
|------|------|------|
| 页面大标题 | 22px | 700 |
| 区块标题 | 15px | 600 |
| 正文 / 表单标签 | 13px | 400 |
| 辅助说明 | 12px | 400 |
| 区块分区标签（全大写） | 11px | 600，`letter-spacing: 0.3px` |
| 徽章 / 日志 | 11px | 600 |
| 代码 / 路径 / 日志行 | 12px | 400，`font-family: monospace` |

---

## 5. 间距与圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `radius-sm` | `6px` | 小按钮、输入框 |
| `radius-md` | `8px` | 按钮、输入框、小卡片 |
| `radius-lg` | `12px` | 主卡片 |
| `radius-xl` | `14px` | 窗口圆角 |
| `radius-pill` | `20px` | 徽章 |

内容区 padding：`20px`。卡片间距：`12px`。卡片内 padding：`16px`。

---

## 6. 组件规范

### 6.1 窗口框架
- Traffic light 按钮（关闭/最小化/最大化），12px × 12px，间距 7px
- 标题栏：`rgba(246,246,246,.95)` + `backdrop-filter: blur(20px)`，高度 ~44px
- 窗口标题居中：`Hermes Manager`，13px / 600 weight
- 底部紧接 Segmented Control，居中对齐

### 6.2 Segmented Control（顶部导航）
- 容器：`background: rgba(0,0,0,.06)`，`border-radius: 9px`，`padding: 3px`
- 选中段：白色背景，`box-shadow: 0 1px 3px rgba(0,0,0,.12)`，`border-radius: 7px`
- 文字：选中 13px/600，未选中 13px/500 `#424245`
- 6 个面板：总览 / 安装 / 配置 / 工具 / 网关 / 迁移（Phase 2 的面板正常显示但点击提示「Phase 2 即将推出」）

### 6.3 Button
```
主要（Primary）：background #30B0C7，color white，padding 7px 16px，radius 8px，font 13px/500
次要（Secondary）：background #F2F2F7，color #1D1D1F，border 1px solid #E5E5EA
危险（Danger）：background #FFF0F0，color #FF3B30，border 1px solid #FFD0D0
禁用：opacity .4，cursor not-allowed
加载中：文字替换为「...」，disabled
```

### 6.4 Badge（徽章）
圆角 `20px`，padding `3px 9px`，font 11px/600，五种状态：
- 成功：`#E8F9F0` bg + `#34C759` text
- 警告：`#FFF8E6` bg + `#FF9F0A` text
- 错误：`#FFF0F0` bg + `#FF3B30` text
- 主色：`#E8F8FB` bg + `#30B0C7` text
- 中性：`#F2F2F7` bg + `#6C6C70` text

### 6.5 Toggle（iOS 原生风格）
- 轨道：51px × 31px，`border-radius: 16px`
- 开启：`#30B0C7` 轨道，圆球在右侧（right: 2px）
- 关闭：`#E5E5EA` 轨道，圆球在左侧（left: 2px）
- 圆球：27px × 27px，白色，`box-shadow: 0 1px 3px rgba(0,0,0,.2)`
- 过渡：`transition: all 200ms ease`

### 6.6 Input / Select
- 背景 `#F2F2F7`，border `1px solid #E5E5EA`，radius `8px`，padding `8px 12px`
- 字体 13px，颜色 `#1D1D1F`；placeholder `#8E8E93`
- Focus：border 变为 `1.5px solid #30B0C7`，outline none

### 6.7 LogLine（日志行）
- 容器背景：`#F2F2F7`，radius `8px`，padding `8px 10px`
- ✅ 成功：emoji + `#1D1D1F` 正文；⚠️ 警告：emoji + 正文；❌ 错误：emoji + 正文
- 字体：12px monospace
- 运行中提示行：`#30B0C7` 文字 + `→` 前缀

### 6.8 ProgressBar
- 轨道：`#E5E5EA`，高度 6px，radius 3px
- 填充：`linear-gradient(90deg, #30B0C7, #4ECDE4)`，radius 3px
- 过渡：`transition: width 300ms ease`

### 6.9 Toast
- 位置：窗口底部居中，`position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%)`
- 样式：白色背景，`box-shadow: 0 4px 16px rgba(0,0,0,.12)`，radius `10px`，padding `10px 18px`
- 成功：左侧 `#34C759` 3px 色条；错误：`#FF3B30`；信息：`#30B0C7`
- 自动消失：成功/信息 2.8s，错误 5s

---

## 7. 面板规范

### 7.1 总览（Home）
布局：3 列状态卡 → 系统诊断卡 → 快速操作行

**状态卡**（3 列网格，`gap: 10px`）：
- 安装状态：大标题 + 彩色徽章（运行中/未安装）
- 当前版本：版本号 + 主色徽章（已检测/未检测）
- 诊断结果：`N/M` 格式 + 状态徽章（全部通过/N 项警告）

**系统诊断卡**：
- 标题 + 「运行诊断」主色按钮（右侧）
- 每条结果：emoji 图标 + 文字，`#F2F2F7` 行背景，`border-radius: 8px`
- 警告行背景改为 `#FFF8E6`

**快速操作**：「检查更新」「修改配置」次要按钮

### 7.2 安装（Install）
布局：安装模式选择卡 → 操作按钮行 → 安装进度卡（安装中才显示）

**安装模式选择**：
- Radio 列表，选中行：`#E8F8FB` 背景 + `1.5px solid #30B0C7` 边框，`border-radius: 10px`
- 未选中：白色背景 + `1px solid #E5E5EA`
- Radio 圆圈：选中为 `#30B0C7` 填充白色内点；未选中为空心灰圆圈
- 完整安装附「推荐」主色徽章

**操作行**：「开始安装」主色按钮（左）+ 「卸载 Hermes」危险按钮（右）

**安装进度卡**（仅安装中/完成/失败时显示）：
- 标题 + 进度百分比徽章
- 渐变进度条
- 日志滚动区（monospace，最大高度 160px，overflow scroll）

### 7.3 配置（Config）
布局：2 列网格（LLM 配置卡 | 行为设置卡）→ 通用设置卡（语言选择）→ 保存按钮

**LLM 配置卡**：提供商下拉、模型下拉、API Key 输入（密码框 + 显示/隐藏 + 测试连接按钮）

**行为设置卡**：四个 Toggle，用分割线隔开：持久记忆 / 自动生成技能 / 命令审批模式 / 预算压力提示

**通用设置卡**（语言）：
- 标题「通用 / General」
- 「语言 / Language」下拉：`跟随系统 / Follow System`、`中文`、`English`
- 默认值：跟随系统

**保存按钮**：全宽主色按钮，`border-radius: 10px`

---

## 8. 国际化（i18n）

### 方案
使用 `react-i18next` + `i18next`。翻译文件放在 `src/locales/`。

```
src/locales/
├── zh/translation.json   # 中文（默认）
└── en/translation.json   # English
```

### 语言初始化逻辑
1. 读取 Config 中保存的 `language` 字段（`"zh"` / `"en"` / `"system"`）
2. 若为 `"system"`（默认），调用 Tauri 命令 `get_system_locale` 获取 macOS 系统语言
3. 若系统语言以 `"zh"` 开头 → 使用中文，否则 → 使用英文
4. `i18next` 初始化时设置 `lng`，后续语言切换调用 `i18n.changeLanguage()`

### 新增 Rust 命令（放在 `config.rs`）
```rust
#[tauri::command]
pub async fn get_system_locale() -> Result<String, String>
// 返回如 "zh-Hans-CN" 或 "en-US"
// 通过 std::env::var("LANG") 或平台 API 获取
```

### Config 结构体新增字段
```rust
#[serde(default = "default_language")]
pub language: String,  // "system" | "zh" | "en"

fn default_language() -> String { "system".into() }
```

### 翻译键命名规范
使用点分层级：`panel.home.title`、`panel.install.mode.full.label` 等。

### Phase 1 需翻译的字符串范围
所有 UI 文字均需提供中英两份，包括：
- 面板标题、分区标签
- 按钮文字、占位符
- 徽章文字、Toast 消息
- 诊断日志的 UI 标签（hermes 进程输出的日志行保持原文，不翻译）

---

## 9. 变更范围（相对 Phase 1 代码）

### 需要修改 / 替换的文件
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/index.css` | 替换 | 全部设计 token 替换为 Apple 亮色系 |
| `src/App.tsx` | 修改 | 移除 Sidebar，新增窗口框架 + Segmented Control |
| `src/components/layout/Sidebar.tsx` | 删除 | 不再需要 |
| `src/components/layout/Topbar.tsx` | 替换 | 新的标题栏（traffic light + app title） |
| `src/components/layout/SegmentedControl.tsx` | 新建 | 导航组件 |
| `src/components/ui/Button.tsx` | 替换 | 新样式 |
| `src/components/ui/Toggle.tsx` | 替换 | iOS 原生大圆球样式 |
| `src/components/ui/Badge.tsx` | 替换 | 新颜色系 |
| `src/components/ui/Toast.tsx` | 替换 | 新样式（左侧色条） |
| `src/components/ui/LogLine.tsx` | 替换 | emoji 图标风格 |
| `src/components/panels/HomePanel.tsx` | 替换 | 新布局 |
| `src/components/panels/InstallPanel.tsx` | 替换 | 新布局 |
| `src/components/panels/ConfigPanel.tsx` | 替换 | 新布局 + 语言选择器 |
| `src/locales/zh/translation.json` | 新建 | 中文翻译 |
| `src/locales/en/translation.json` | 新建 | 英文翻译 |
| `src/lib/i18n.ts` | 新建 | i18next 初始化 |
| `src/lib/tauri.ts` | 修改 | `HermesConfig` 追加 `language: string`；`Commands` 追加 `getSystemLocale` |
| `src-tauri/src/commands/config.rs` | 修改 | `HermesConfig` 新增 `language` 字段；新增 `get_system_locale` 命令 |
| `src-tauri/src/lib.rs` | 修改 | 注册 `get_system_locale` 命令 |

### 不需要修改的文件
- `src/store/`（Zustand store 逻辑不变）
- `src-tauri/src/commands/process.rs`（doctor 模块不变）
- `src-tauri/src/commands/installer.rs`（安装逻辑不变）
- `.github/workflows/`（CI/CD 不变）
- 所有测试文件（逻辑未变，只需更新文字 mock）

---

## 10. 测试策略

现有测试套件（13 前端 + 8 Rust）保持通过；在此基础上新增：

- `Toggle.test.tsx`：补充 iOS 样式验证（checked 时轨道颜色类名）
- `ConfigPanel.test.tsx`：新增语言切换 → `i18n.changeLanguage` 被调用
- `HomePanel.test.tsx`：验证中文文字渲染（mock i18n 返回中文）
- Rust：`get_system_locale` 在 CI 环境返回非空字符串
