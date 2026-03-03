# 🐙 GitHub Issue Manager

一个本地运行的 Web 应用，帮助你高效管理指定 GitHub 仓库中的 Issue。

## ✨ 功能特性

- 📋 **Issue 浏览** — 按时间范围、状态、标签、关键字筛选 Issue
- 👤 **与我相关** — 查看被提及、被分配、我创建、我评论过的 Issue
- 🤖 **AI 辅助回复** — 使用 LLM 生成专业回复，编辑确认后发布到 GitHub
- ⚡ **仪表板** — 统计概览、未回复 Issue、最近更新
- 🔧 **多仓库支持** — 配置多个仓库，快速切换
- ⌨️ **键盘快捷键** — j/k 导航，Enter 打开，Esc 关闭

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3 `http.server` (ThreadingHTTPServer) |
| 前端 | 原生 HTML + CSS + JavaScript |
| GitHub API | `urllib` (零外部依赖) |
| AI/LLM | OpenAI 兼容 API |
| 数据 | 本地 JSON 文件 |

## 📁 项目结构

```
github-anwser/
├── index.html      # 主页面 (单页应用)
├── style.css       # 样式 (深色主题)
├── app.js          # 前端逻辑
├── server.py       # Python 后端
├── server.sh       # 服务管理脚本
├── data/
│   └── config.json # 配置文件 (gitignored)
└── logs/
    └── server.log  # 运行日志
```

## 🚀 快速开始

### 前提条件
- Python 3.6+

### 启动服务

```bash
# 使用管理脚本
./server.sh start

# 或直接运行
python3 server.py
```

启动后访问 http://localhost:8080

### 管理命令

```bash
./server.sh start    # 后台启动
./server.sh stop     # 停止
./server.sh restart  # 重启
./server.sh status   # 查看状态
./server.sh log      # 查看日志
```

## 📖 使用指南

1. 访问 http://localhost:8080/#settings 配置 GitHub Token 和仓库
2. 配置 GitHub 用户名（用于"与我相关"功能）
3. (可选) 配置 AI API Key 以使用 AI 辅助回复
4. 浏览 Issue、生成 AI 回复、发布评论

## 🔌 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取配置 |
| POST | `/api/settings` | 保存配置 |
| POST | `/api/settings/test-github` | 测试 GitHub 连接 |
| POST | `/api/settings/test-ai` | 测试 AI 连接 |
| GET | `/api/issues` | Issue 列表 |
| GET | `/api/issues/:number` | Issue 详情 |
| GET | `/api/labels` | 标签列表 |
| GET | `/api/my-issues` | 与我相关 |
| GET | `/api/stats` | 统计数据 |
| POST | `/api/ai/generate-reply` | AI 生成回复 |
| POST | `/api/issues/:number/comments` | 发布评论 |
| PATCH | `/api/issues/:number` | 更新 Issue |

## 📄 许可证

MIT
