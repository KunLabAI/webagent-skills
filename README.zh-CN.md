# web-agent

[English](./README.md) | 简体中文

[![npm version](https://img.shields.io/npm/v/web-agent.svg)](https://www.npmjs.com/package/web-agent)
[![license](https://img.shields.io/npm/l/web-agent.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/web-agent.svg)](https://nodejs.org)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-agentskills.io-blue)](https://agentskills.io)

对**任意**网站进行 **AI-Agent 就绪度、SEO 可发现性与安全**审计与加固——同时提供可安装的
[Agent Skill](https://agentskills.io)、零依赖 CLI 与可编程 API。一次安装即可在
**Claude Code、Cursor、Codex、Qoder** 中通用。

它把"让站点适配 AI Agent"的清单——robots.txt、sitemap、llms.txt、Markdown-for-Agents、
`.well-known` 发现、OAuth 元数据、安全响应头、Agent Card、Web Bot Auth、商务协议、
DNS-AID、WebMCP——变成 AI 编码 Agent 能在**任意技术栈**上端到端执行的任务。

## 为何与技术栈无关

每项检查都把两件事解耦：

- **规范工件**——由 RFC 定义的文件、响应头或端点，在任何平台都完全一致。
- **投递适配**——该工件在你的平台上如何被服务端下发，可自由替换。

Agent 会先探测你的技术栈，生成规范工件，再通过匹配的适配器落地
（见 [`references/adapters.md`](references/adapters.md)）。Cloudflare 只是其中一个适配器，绝非必需。

## 安装

```bash
# 全局 CLI（提供 `web-agent` 与短别名 `war`）
npm install -g web-agent

# 或免安装直接运行
npx web-agent@latest --help
```

然后把**技能**安装进你的编码 Agent：

```bash
war install                         # 所有 Agent，当前仓库（project 作用域）
war install --scope user            # 本机全局
war install --agents claude,cursor  # 仅指定 Agent
```

| Agent | 项目级 | 用户级 |
|-------|--------|--------|
| Claude Code | `.claude/skills/web-agent/` | `~/.claude/skills/…` |
| Cursor | `.cursor/skills/…` 或 `.agents/skills/…` | `~/.cursor/skills/…` |
| Codex | `.codex/skills/…` | `~/.codex/skills/…` |
| Qoder | `.qoder/skills/…` | — |

**手动安装**：把 `SKILL.md` + `references/` 复制到 `<agent-skills-dir>/web-agent/`。

## 使用

### 作为 CLI

```bash
war audit https://example.com                 # 评分 + 等级 + 逐项报告
war audit https://example.com --json          # 机器可读
war audit https://example.com --category seo,security
war audit https://example.com --timeout 15 --user-agent "MyBot/1.0"
```

输出示例：

```
Agent-readiness audit — https://example.com
===========================================
Score: 89/100 (grade B)   failing checks: 0

[WARN]    ai           Markdown-for-Agents
            - artifact not served (HTTP 500)
[PASS]    seo          robots.txt (RFC 9309)
[PASS]    security     Security response headers
...
Summary: 6 pass  0 fail  2 warn  3 manual  13 skip
```

无检查失败时退出码为 `0`，否则为 `1`——可直接接入 CI。

### 作为库

```ts
import { auditSite } from "web-agent";

const report = await auditSite("https://example.com", { timeout: 12 });
// report: { target, score, grade, failed, counts, results[] }
```

`auditSite` 就是 CLI 使用的同一套引擎——把它 import 进去即可构建评分 API、仪表盘或定时监控。

### 通过你的编码 Agent

安装后，当你说下面这类话时，Agent 会自动加载该技能：

> "审计 kunartai.com 的 agent 就绪度并修复失败项。"
> "给这个 Next.js 应用加上 robots.txt 的 Content-Signal 和 api-catalog。"
> "加固安全响应头并发布 OAuth 发现元数据。"

## Agent 的工作流

1. **审计**——对线上 URL 运行 `war audit`。
2. **探测技术栈**——检查仓库以选择投递适配器。
3. **规划**——把每个失败项映射到对应参考文档，按优先级排序。
4. **生成并部署**——通过适配器产出规范工件。
5. **验证**——反复重跑审计直到全绿（可选：与第三方扫描器交叉核对）。

## 覆盖范围（21 项检查）

| 分类 | 检查项 |
|------|--------|
| SEO / AI 可消费性 | robots.txt (RFC 9309)、Content-Signal、AI 爬虫规则、sitemap.xml、llms.txt、Markdown-for-Agents |
| 发现 / API | Link 头 (RFC 8288)、API Catalog (RFC 9727) |
| 安全 / 认证 | 安全响应头 (CSP/HSTS/XFO…)、OAuth AS (RFC 8414)、OIDC Discovery、OAuth PRM (RFC 9728)、auth.md、Web Bot Auth (RFC 9421) |
| Agent 发现 | A2A Agent Card、Agent Skills Discovery Index (v0.2.0)、MCP Server Card |
| 商务 | ACP、AP2、MPP、UCP、x402 |
| 实验性 | DNS-AID、WebMCP |

每项检查都有一个严重级别（`core` / `recommended` / `optional`），既决定其通过/失败判定，
也决定加权后的 0–100 站点评分。完整表格见 [`references/checklist.md`](references/checklist.md)。

## 项目结构

```
web-agent/
├── package.json / tsconfig.json
├── LICENSE (Apache-2.0) / NOTICE
├── SKILL.md                     # 技能（精简编排器；细节在 references/）
├── AGENTS.md                    # 供读取仓库的 Agent 使用的通用指针
├── bin/war.js                   # npm bin 入口
├── src/                         # TypeScript 源码
│   ├── cli.ts                   # `audit` + `install` 命令
│   ├── audit.ts                 # auditSite() 引擎 + 评分（对外 API）
│   ├── checks.ts                # 21 项检查注册表 + 评估器 + 自定义探针
│   ├── http.ts                  # 零依赖 fetch 层（Node 18+）
│   ├── report.ts                # 人类可读格式化
│   └── install.ts               # 跨 Agent 技能安装器
└── references/                  # 10 份渐进披露文档（随技能一起分发）
    ├── checklist.md · seo-discoverability.md · markdown-negotiation.md
    ├── security-headers.md · discovery-oauth.md · agent-cards.md
    └── web-bot-auth.md · commerce.md · experimental.md · adapters.md
```

## 开发

```bash
npm install         # 安装 typescript + @types/node
npm run build       # tsc → dist/
npm run typecheck   # tsc --noEmit
node bin/war.js audit https://example.com
```

需要 Node ≥ 18.17（全局 `fetch`、`AbortSignal.timeout`）。零运行时依赖。

## 安全保证

- **仅被动审计**——绝不 `POST /agent/auth`、注册账号或触发支付。
- **工件中不含密钥**——只发布公钥/URL；私钥留在你的 KMS。
- **绝不削弱安全**——发现类端点不会放开 CSP/CORS 或暴露私有路径。
- **策略由所有者决定**——在设置宽松的 `Content-Signal`/AI 爬取值前，Agent 会先询问。
- **默认开启 TLS 校验**——`--insecure` 为可选、会显著告警、仅限 staging。
- **SSRF 提示**——`auditSite` 会抓取你传入的任意 URL。若你要构建"任填 URL 即扫"的工具，
  请自行施加出站防护（协议/端口白名单、DNS 解析后拒绝私网/环回/链路本地/保留 IP，含
  `169.254.169.254`、逐跳重定向复验、大小上限）与限流。

## 只读审计器

`web-agent` 是一个只读审计器：它抓取公开 URL、报告发现的问题，且绝不修改被扫描
的站点。商务类检查（`references/commerce.md`）只是*探测*被扫站点是否实现了 agent 支付标准
（ACP/AP2/MPP/UCP/x402），属于检测能力，而非本工具的支付功能。

## 标准与来源

RFC 9309 (robots)、RFC 8288 (Link)、RFC 9727 (api-catalog)、RFC 8414 (OAuth AS)、
RFC 9728 (OAuth PRM)、RFC 9421 (HTTP Message Signatures)、OIDC Discovery 1.0、Sitemaps
protocol、contentsignals.org、llmstxt.org、A2A Protocol、Agent Skills Discovery RFC v0.2.0、
MCP SEP-1649、IETF WebBotAuth、ACP/AP2/MPP/UCP/x402、DNS-AID、WebMCP。检查分类受
Cloudflare 的 agent 就绪度指南与 isitagentready.com 启发。

## 贡献

欢迎提 Issue 与 PR。请把检查项以声明式方式加入 `src/checks.ts`，在
`references/checklist.md` 补上断言，并在提交前运行 `npm run build`。

## 许可证

[Apache-2.0](./LICENSE) © web-agent contributors。详见 [NOTICE](./NOTICE)。
