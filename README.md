# Orbis 图片生成工具

## 简介

Orbis 是一款纯前端 Web 图片生成工具，基于 Vite + React + TypeScript + Tailwind CSS 构建。它通过 OpenAI 兼容 API 服务进行图像生成，覆盖文生图（Text-to-Image）与图生图（Image-to-Image）两种生成模式，并内置本地历史记录管理。所有数据均存储在用户浏览器本地，无需后端服务即可运行。

> 当前 API 服务已切换为 **OpenAI 兼容模式**，使用 OpenAI 标准 API 接口格式（`/v1/images/generations`、`/v1/images/edits` 等），可对接 OpenAI 官方接口或任意兼容该协议的第三方 / 反代服务。

## 功能特性

- **OpenAI 兼容 API**：统一使用 OpenAI 标准 API 接口格式，支持自定义 Base URL、API Key、Model 与请求超时，可对接任意 OpenAI 兼容服务。
- **连接测试**：设置面板内置「测试连接」功能，调用 `/v1/models` 验证认证与连通性，覆盖认证错误、网络异常、超时等异常情况。
- **文生图 + 图生图**：通过模式切换在「文生图」与「图生图」之间无缝切换；图生图支持拖拽或点击上传参考图，对现有图片进行二次创作。
- **参数控制**：支持风格预设、生成数量、图像尺寸等参数（具体可用项随当前 API 能力动态显示）。
- **历史管理**：自动保存每次生成结果到本地历史，支持复用提示词/参数、下载图片、删除单条与清空全部，最多保留 100 条。
- **响应式布局**：桌面端三栏布局（提示词 / 结果 / 历史），平板与移动端自动收起为单栏堆叠，触控操作友好。
- **本地安全存储**：API Key 与历史记录均使用浏览器 localStorage 按域名隔离存储，不经过任何第三方服务器（调用对应 API 时除外）。
- **Toast 通知**：操作反馈、错误提示以非侵入式 Toast 形式展示，自动消失。
- **AbortController 中断**：生成过程支持随时取消，避免长时间等待无效请求。

## 技术栈

| 技术 | 版本 | 说明 |
| --- | --- | --- |
| Vite | ^8.1.0 | 构建工具与开发服务器 |
| React | ^19.2.7 | UI 框架 |
| TypeScript | ~6.0.2 | 类型系统 |
| Tailwind CSS | ^3.4.19 | 原子化 CSS 框架 |
| ESLint + Prettier | - | 代码规范与格式化 |

## 环境要求

- **Node.js**：18 或更高版本
- **npm**：随 Node.js 一并安装即可

> 建议使用 LTS 版本的 Node.js 以获得最佳兼容性。

## 本地启动

```bash
npm install      # 安装依赖
npm run dev      # 开发模式（启动 Vite 开发服务器，默认 http://localhost:5173）
npm run build    # 生产构建（先执行 tsc 类型检查，再执行 vite build）
npm run preview  # 预览构建产物（本地静态服务器预览 dist/ 目录）
npm run lint     # 代码检查（ESLint）
```

## 使用指南

1. **首次配置**：首次打开应用会自动弹出设置面板。填入 OpenAI 兼容 API 服务的 API Key，可选填 Base URL、Model 与请求超时，保存后可点击「测试连接」验证。详细配置方法请参阅 [API 配置指南](docs/API_CONFIG.md)。
2. **输入提示词**：在左栏（提示词面板）输入正向提示词，可切换至「图生图」模式并上传参考图。
3. **调整参数**：在中部参数面板调整可用参数（参数项随当前 API 能力动态显隐）。
4. **生成图片**：点击「生成」按钮，结果将展示在中栏（结果面板）。生成过程中可点击「取消」中断请求。
5. **历史记录**：右栏（历史面板）按时间倒序展示历史生成结果，可复用提示词与参数、下载图片、删除单条或清空全部。点击单条记录可查看详情。
6. **本地存储**：所有配置与历史均存储在浏览器本地，详见 [本地存储说明](docs/STORAGE.md)。

## 项目结构

```text
Orbis/
├── docs/                  # 项目文档
│   ├── API_CONFIG.md      # API 配置指南
│   ├── STORAGE.md         # 本地存储说明
│   └── COMPATIBILITY.md   # 浏览器兼容性测试报告
├── public/                # 静态资源（favicon、图标）
├── src/
│   ├── adapters/          # API 适配器层
│   │   ├── openai.ts      # OpenAI 兼容图像生成适配器（含连接测试）
│   │   ├── types.ts       # 适配器公共类型定义
│   │   └── index.ts       # 适配器统一导出与注册
│   ├── components/        # UI 组件
│   │   ├── HistoryPanel.tsx    # 历史记录面板
│   │   ├── ImageUpload.tsx     # 图生图参考图上传组件
│   │   ├── ModeSwitch.tsx      # 文生图/图生图模式切换
│   │   ├── ParamPanel.tsx      # 参数控制面板
│   │   ├── PromptPanel.tsx     # 提示词输入面板
│   │   ├── ResultPanel.tsx     # 结果展示面板
│   │   ├── SettingsModal.tsx   # 设置弹窗
│   │   ├── Toast.tsx           # Toast 通知组件
│   │   └── index.ts            # 组件统一导出
│   ├── hooks/             # 自定义 React Hooks
│   │   ├── useGenerate.ts # 图片生成逻辑（含取消控制）
│   │   ├── useHistory.ts  # 历史记录管理
│   │   ├── useSettings.ts # API 设置管理
│   │   ├── useToast.ts    # Toast 通知管理
│   │   └── index.ts       # Hooks 统一导出
│   ├── storage/           # 本地存储封装
│   │   └── index.ts       # localStorage 读写工具
│   ├── types/             # 全局类型定义
│   │   └── index.ts
│   ├── assets/            # 图片等静态资源（由 Vite 处理）
│   ├── App.tsx            # 应用根组件
│   ├── App.css            # 应用级样式
│   ├── main.tsx           # 应用入口
│   └── index.css          # 全局样式与 Tailwind 指令
├── index.html             # HTML 模板
├── vite.config.ts         # Vite 配置
├── tailwind.config.js     # Tailwind 配置
├── postcss.config.js      # PostCSS 配置
├── tsconfig.json          # TypeScript 配置
└── package.json           # 项目依赖与脚本
```

各目录职责简述：

- `src/adapters/`：封装不同图片生成 API 的调用细节，对外提供统一接口，便于扩展新的提供商。
- `src/components/`：纯展示与交互组件，不直接操作 localStorage，数据通过 props 与回调与上层通信。
- `src/hooks/`：业务逻辑层，封装状态管理与副作用，连接 storage、adapters 与 components。
- `src/storage/`：localStorage 读写封装，集中管理键名与序列化逻辑。
- `src/types/`：跨模块共享的 TypeScript 类型定义。

## 截图

> 以下截图为占位符，实际使用时请替换为真实截图。

![主界面](docs/screenshot-main.png)

![设置面板](docs/screenshot-settings.png)

![图生图模式](docs/screenshot-img2img.png)

![历史记录](docs/screenshot-history.png)

## 浏览器兼容性

本应用基于标准 Web API 开发，兼容 Chrome、Firefox、Safari 最新版本。详细测试结果请参阅 [浏览器兼容性测试报告](docs/COMPATIBILITY.md)。

## 许可证

[MIT](LICENSE)
