# Ticket: 创建 web 分支 + GitHub Actions 部署工作流

**Type**: task (HITL)
**Status**: open
**Blocked by**: (none)

## Question

需要完成以下基础设施工作才能开始开发：

1. 从 main 创建 `web` 分支
2. 在仓库 Settings 中启用 GitHub Pages（Source: GitHub Actions）
3. 创建 `.github/workflows/deploy-web.yml`，配置：
   - 触发条件：push 到 web 分支
   - 构建步骤：`npm ci` → `npm run build:web`
   - 部署步骤：`actions/deploy-pages@v4`
4. 添加 `build:web` 脚本到 package.json（需要与现有 `build` 区分，可能需要环境变量 `VITE_WEB=true`）
5. 更新 `vite.config.ts` 条件 base 路径（web 构建时 `--base=/MIDI-JAR-NEW/`）
6. 验证首次部署成功

### 预期产出

- `web` 分支已创建
- GitHub Actions workflow 文件已提交
- 首次自动部署成功，可通过 `https://quqr.github.io/MIDI-JAR-NEW/` 访问
