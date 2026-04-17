# TODO List

按优先级排列。标注了「阻塞发布」的项目在打包分发前必须完成。

---

## P0 — 阻塞发布

### [ ] Config 面板：API Key 连接测试为模拟实现
**文件：** `src-tauri/src/commands/config.rs:116`  
**现状：** `test_api_connection` 只检查 key 长度 > 8，不发真实 HTTP 请求。  
**需要：** 对各 provider 发送一个轻量 API 请求（如 `/models` 或 `/me`），返回真实成功/失败。

---

### [ ] Install 面板：安装脚本 URL 待确认
**文件：** `src-tauri/src/commands/installer.rs:64`  
**现状：** 安装命令拼接了一个假设的 GitHub raw URL。  
**需要：** 确认 Hermes 官方安装脚本的真实地址，或改为本地 bundled 安装逻辑。

---

## P1 — 正式发布前

### [ ] Gateway 面板：启动/停止为 Node.js 子进程，尚未经过真机验证
**文件：** `src-tauri/src/commands/gateway.rs`  
**现状：** 逻辑已实现，但需要一个真实的 Telegram Bot Token 端到端验证。  
**需要：** 准备测试 Token，走完「保存配置 → 启动 → 收到消息 → 停止」完整流程。

---

### [ ] Migrate 面板：`filter_api_keys` 过滤规则较宽泛
**文件：** `src-tauri/src/commands/migrate.rs:31`  
**现状：** 使用 `contains("_KEY=")` 和 `contains("_TOKEN=")` 匹配，会误删 `CACHE_KEY=`、`LICENSE_KEY=` 等非密钥变量。  
**需要：** 改为更精准的正则（如 `^[A-Z_]*(API_KEY|SECRET_KEY|BOT_TOKEN|ACCESS_TOKEN)[A-Z_]*=`），或改为用户手动勾选要过滤的行。

---

### [ ] E2E 测试覆盖关键用户流程
**现状：** 只有 Vitest 单元测试，无 Playwright E2E。  
**需要：** 至少覆盖以下流程：
- Migrate 导出 → 导入完整流程
- Config 保存并重新加载
- Tools 关闭工具后重新打开验证持久化

---

### [ ] Tauri build 打包验证
**现状：** 只跑过 `tauri dev`，从未执行 `tauri build`。  
**需要：** 执行 `npm run tauri build`，验证 .app / .dmg 可正常生成并运行。

---

## P2 — 后续迭代

### [ ] Home 面板：Doctor 诊断结果详情
**现状：** 只显示 pass/warn/fail 汇总，没有展开每项的详细说明。  
**需要：** 可展开查看每条诊断的具体描述和修复建议。

### [ ] Config 面板：配置备份/恢复
**现状：** CLAUDE.md 设计文档提到「备份/恢复」功能，当前未实现。  
**需要：** 补充「导出当前配置为备份」和「从备份恢复」的入口（与 Migrate 面板区分：这里只针对 config.toml）。

### [ ] Tools 面板：工具说明文案
**现状：** 每个工具只有名称，没有功能说明。  
**需要：** 为 12 个工具各添加一行描述，帮助用户了解每项工具的用途。

### [ ] 错误上报 / 日志
**现状：** 错误只通过 Toast 短暂显示，无持久日志。  
**需要：** 考虑将错误写入 `~/.hermes/logs/` 或在 Home 面板显示最近错误历史。

### [ ] 应用自动更新
**现状：** 无更新机制。  
**需要：** 接入 Tauri updater plugin，或提供「检查更新」入口。
