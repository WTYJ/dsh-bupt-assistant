# dsh-bupt-assistant

适用于 **DeepSeek Harness (DSH)** 的独立北邮个人助理插件：可视化系统钥匙串登录、内置定时同步北邮教学云作业 DDL 与移动教务课表/考试，并无损导出至任意指定目录的 Markdown 文件。

## 核心特性

- **🔐 系统钥匙串安全登录（零明文落盘）**
  - 在 DSH「设置 → 北邮个人助理」中直接管理「教学云（统一认证）」与「移动教务」账号。
  - 前端仅经由本机回环（`127.0.0.1` / `::1`）提交，后台通过子进程 `stdin` 直写操作系统凭据库（macOS Keychain / Windows Credential Manager）。
  - 学号、密码与 Token **绝不写入配置文件、绝不打日志、绝不回显给前端、绝不进入 AI 对话或提示词**。
  - 支持一键「测试连通（Verify）」与「清除凭据」。
- **🔄 DSH 内置自动定时同步（无需系统定时任务）**
  - 在 DSH 进程内运行轻量定时器（可自由调整刷新间隔，支持启动时自动同步与一键「立即同步」），退出 DSH 自动清理。
  - 具备单飞防并发锁与容错兜底：单侧接口临时异常时自动保留上次成功缓存，不清空已有日程。
- **📚 独立可视化数据源开关（实时热生效）**
  - **教学云作业与 DDL**：同步未完成待办、自动反查缺失的所属课程名称，并扫描通知提前发现尚未开始的作业。
  - **移动教务课表与考试**：展开今/明/后天课表（附北邮 1-14 节标准时间，自动标出早八/上午课）与近期考试倒计时。
- **📂 通用无损 Markdown 导出与可选工作区摘要**
  - 可自由指定任意导出目录与文件名（DSH 工作区、Obsidian 笔记库或普通本地文件夹均可）。
  - 仅原子替换 `<!-- AUTO:ASSISTANT-SYNC-START -->` 与 `<!-- AUTO:ASSISTANT-SYNC-END -->` 之间的自动同步区，**绝不覆盖你的个人手记待办**。
  - 可选开启「向匹配工作区注入客观日程摘要」：仅当当前 DSH 会话工作区等于导出目录时，注入中立客观的提醒雷达摘要，并挂载 `bupt_refresh_schedule` 工具供 Agent 按需实时刷新。
- **🪶 零外部 npm 运行时依赖**：纯原生 Node.js ESM 实现，独立解耦，不侵入其他插件或工作区指令文件。

## 前置依赖（本机数据采集引擎）

本插件通过独立外部进程隔离调用开源 CLI 工具 [Sun-sunshine06/bupt-anything](https://github.com/Sun-sunshine06/bupt-anything)（GPL-3.0，仅直连北邮官方域名）完成校园接口只读查询：

```bash
# 1. 安装 uv（如尚未安装）并克隆 bupt-anything 到 ~/Projects/bupt-anything
mkdir -p ~/Projects
git clone https://github.com/Sun-sunshine06/bupt-anything.git ~/Projects/bupt-anything
cd ~/Projects/bupt-anything
uv sync --frozen
```

> 如将 `bupt-anything` 放在其他路径，可在插件运行时配置 `~/.dsh/integrations/dsh-bupt-assistant/settings.json` 的 `paths.buptAgentDir` 中指定。

## 安装方式

### 方式一：通过 DSH 插件管理器从 GitHub 安装

在 DSH 中添加插件：`github:WTYJ/dsh-bupt-assistant`，重启 DSH 即可在 **`设置 → 北邮个人助理`** 中配置账号并开始同步。

### 方式二：本地开发软链接安装

1. 克隆本仓库到本地独立目录（不要放进你的个人工作区或笔记库）；
2. 在 DSH profile 的 `package.json`（如 `~/.dsh/profiles/desktop/package.json`）中添加：
   - `dependencies`: `"dsh-bupt-assistant": "link:/path/to/dsh-bupt-assistant"`
   - `dsh.profile.bundles`: `"dsh-bupt-assistant"`
3. 建立对应的 `node_modules/dsh-bupt-assistant` 软链接并重启 DSH。

## 使用说明

1. 打开 DSH **`设置 → 北邮个人助理`**；
2. 在「校园账号」卡片中分别输入教学云（统一认证）与移动教务账号密码 → 点击 **「保存到钥匙串」** → 点击 **「测试连通」**；
3. 在「Markdown 导出与工作区摘要」卡片中设置你希望导出的目录与文件名（默认 `~/Documents/bupt-assistant/待办与日程.md`）；
4. 点击右上角 **「立即同步」**，此后 DSH 将按设定间隔自动刷新。

## 运行测试

```bash
# 使用 Node.js >= 22（或 DSH 内置运行时）执行语法检查与单元测试
node --check lib/client.js
node --test test/assistant.test.mjs
```

## 安全与致谢

- 所有校园接口请求均在本机执行且严格只读，不提供代交作业、代签到或修改通知状态等写操作。
- 感谢开源项目 [Sun-sunshine06/bupt-anything](https://github.com/Sun-sunshine06/bupt-anything) 提供的本地北邮校园只读 CLI 能力。
- 本插件源码采用 [MIT License](./LICENSE) 开源。
