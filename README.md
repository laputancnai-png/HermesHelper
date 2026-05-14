# HermesHelper

Hermes Helper（Tauri + React）

## 平台支持说明

### Linux

- 推荐：Ubuntu 22.04+（或其他发行版，`glib-2.0 >= 2.70`）
- 不支持：Ubuntu 20.04（`glib-2.0` 版本过低，会在 `glib-sys` 构建阶段失败）

说明：项目依赖链（Tauri/GTK/WebKit）要求较新的 GLib。`npm run bootstrap:linux` 会自动检测并在版本不满足时提前报错。

### macOS

- 推荐：macOS 12+
- 需要：Xcode Command Line Tools、Rust、Node.js 20+

说明：`npm run bootstrap:macos` 会自动检查并安装/校验上述依赖（Xcode CLT 需用户先完成系统弹窗安装）。

### Windows

- 当前仓库尚未完成正式支持（后端命令实现仍有 Unix 假设）

## 快速启动

### Linux

```bash
git pull
npm run bootstrap:linux
npm run tauri dev
```

### macOS

```bash
git pull
npm run bootstrap:macos
npm run tauri dev
```

## macOS 安装说明

### 推荐：一键安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/laputancnai-png/HermesHelper/main/install.sh | sh
```

脚本会自动下载、安装，并处理好所有 Gatekeeper 问题，无需额外操作。

### 直接下载 DMG

从 GitHub Releases 下载 DMG 的用户，macOS Gatekeeper 会因 App 未经 Apple 公证而拦截，
不同芯片的表现不同：

| 芯片 | 现象 | 解决方法 |
|------|------|----------|
| **Apple Silicon (M 系列)** | 弹出 "is damaged and can't be opened"，无法绕过 | 运行 `fix-macos-quarantine.sh`（见下） |
| **Intel** | 弹出 "无法验证开发者" 警告 | 系统设置 → 隐私与安全性 → 仍要打开 |

#### Apple Silicon 修复脚本

下载 DMG 后，在终端运行：

```bash
# 自动查找 ~/Downloads 里最新的 DMG 并安装
curl -fsSL https://raw.githubusercontent.com/laputancnai-png/HermesHelper/main/fix-macos-quarantine.sh | bash

# 或先下载脚本再指定路径
bash fix-macos-quarantine.sh ~/Downloads/hermes-manager-latest-macos-arm64.dmg
```

脚本完成后直接双击打开，后续更新版本需重新运行一次。

## 常见问题

### 1) `tauri: not found`

通常是依赖未完整安装（缺少 `@tauri-apps/cli`）。请先运行对应平台 bootstrap。

### 2) `cargo metadata ... No such file or directory`

说明当前 shell 下 `cargo` 不在 PATH。仓库已通过 `scripts/tauri-run.sh` 在执行 `npm run tauri dev` 前自动加载 `~/.cargo/env`。

### 3) `glib-sys` 构建失败 / 找不到 `glib-2.0.pc`

先运行 `npm run bootstrap:linux` 安装系统依赖；若仍提示 GLib 版本不足，请升级到 Ubuntu 22.04+。
