# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HermesHelper 是为 **Hermes Manager** 准备的设计文档与 UI 原型仓库。Hermes Manager 是一个桌面 GUI 应用，用于管理 [Nous Research Hermes](https://nousresearch.com/) AI 助手的安装、配置与运行。

目前仓库内容：
- `docs/` — 设计文档（.docx）与 UI 原型（HTML）

## Application Architecture (from UI Prototype)

UI 原型位于 `docs/hermes-manager-ui.html`，是一个纯前端单页应用，展示了完整的界面设计。

### 面板结构

| Panel ID | 标题 | 功能 |
|----------|------|------|
| `home` | 总览 | Dashboard：系统状态、Doctor 诊断日志、快速操作入口 |
| `install` | 安装 / 更新 | 安装进度动画、版本检测、卸载 |
| `config` | 基础配置 | 配置文件编辑、备份/恢复 |
| `tools` | 工具开关 | 核心工具与可选工具的 toggle 管理（含 voice 模块等） |
| `gateway` | 消息网关 | 多平台消息接入（Node.js，实验性） |
| `migrate` | 导入 / 导出 | 数据迁移与备份，导出为 .zip |

### 设计规范（来自 UI 原型）

- **主色调**：深色背景 (`#060a0f` / `#0d1117`) + Cyan 主色 (`#00d4ff`)
- **字体**：UI 用 `Syne`，代码/路径用 `JetBrains Mono`
- **状态色**：green=正常，yellow=警告，red=错误
- **动效**：`140ms cubic-bezier(0.4,0,0.2,1)` 过渡

## Design Documents

| 文件 | 内容 |
|------|------|
| `01_UI设计文档_Hermes-Manager.docx` | 界面设计规范 |
| `02_功能设计文档_Hermes-Manager.docx` | 功能需求与交互逻辑 |
| `03_技术设计文档_Hermes-Manager.docx` | 技术架构与实现方案 |
| `04_测试文档_Hermes-Manager.docx` | 测试计划与用例 |
