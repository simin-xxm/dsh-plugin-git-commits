# dsh-plugin-git-commits

[English](./README.md) | [中文](./README.zh.md)

DeepSeek Harness 插件：在 Web UI 侧边栏底部加一个「Git 提交」入口。浏览提交历史、对比文件差异、暂存并提交改动，以及同步、拉取、推送当前分支，都不用离开应用。

## 能力

### 改动页

- 文件分「已暂存 / 未暂存（含未跟踪）」两组，`A` `M` `D` `R` `U` 状态徽标与 `+n / -n` 统计
- 单文件「+ / −」切换暂存状态，分组头可「全部暂存 / 全部取消暂存」
- 选中文件显示带行号的 diff：工作区 vs 索引、索引 vs HEAD；未跟踪文件按新增文件渲染
- 提交框：`⌘/Ctrl + Enter` 提交，**只提交已暂存内容**；按钮上显示待提交文件数
- **同步** 执行 `git fetch --all --prune`，按钮上显示 `↓n`（落后）与 `↑n`（领先）角标
- **拉取 ↓n** 合并远端提交，可选变基（rebase，默认）或合并（merge）；带 `--autostash`，本地未提交的改动会自动暂存并在完成后恢复
- **推送** 把当前分支推到远端；首次推送自动 `-u origin HEAD` 设置上游
- 所有写远端的操作都会先要求二次确认
- 拉取产生冲突时，底部出现红色冲突条，列出冲突文件并提供「中止合并」（`git rebase --abort` / `merge --abort`）
- 分支、远端、仓库路径在头部与底部展示，操作结果（成功输出或 git 报错原文）就地显示

### 提交历史页

- 提交列表（短哈希、作者、时间、标题），底部「加载更多」分页
- 选中提交后列出改动文件，选中文件查看带行号的 diff，新增 / 删除分色，hunk 头高亮

## 安装

```bash
dsh plugin add dsh-plugin-git-commits
```

装进指定 profile（每个 profile 互不影响）：

```bash
dsh plugin --profile web add dsh-plugin-git-commits
```

装完重启 `dsh web` 宿主才会挂载，然后验证：

```bash
dsh plugins list
```

需要 `git` 在 `PATH` 上。如果装在别处，把 `DSH_GIT_BINARY` 指向它的绝对路径。

## 组成

| 半边 | 文件 | 作用 |
| --- | --- | --- |
| Host | `index.js` | 读路由 `/git-commits-api`（resource，仅 GET/HEAD）+ 写路由 `/git-commits-write`（raw handler，仅 POST） |
| Client | `client.js` | `sidebar.footer.action` 入口按钮 + `shell.overlay` 抽屉面板 |
| 展示 | `locale/*.json`、`icon.svg` | 插件管理页里的标题、描述与图标 |

读接口（GET，返回 JSON）：

```
GET /git-commits-api/workspaces
GET /git-commits-api/status?path=<dir>
GET /git-commits-api/log?path=<dir>&limit=30&skip=0
GET /git-commits-api/files?path=<dir>&hash=<commit>
GET /git-commits-api/diff?path=<dir>&hash=<commit>&file=<path>
GET /git-commits-api/workdiff?path=<dir>&file=<path>&staged=0|1
```

写接口（POST，JSON body）：

```
POST /git-commits-write/stage?path=<dir>     { "files": ["a"] } | { "all": true }
POST /git-commits-write/unstage?path=<dir>   { "files": ["a"] } | { "all": true }
POST /git-commits-write/commit?path=<dir>    { "message": "feat: ..." }
POST /git-commits-write/fetch?path=<dir>     {}
POST /git-commits-write/pull?path=<dir>      { "mode": "rebase" | "merge" }
POST /git-commits-write/push?path=<dir>      {}
POST /git-commits-write/abort?path=<dir>     {}
```

`fetch` 返回 `ahead`、`behind` 和 `incoming`（远端有、本地没有的提交列表）；
`pull` 失败时返回 `conflicts`（冲突文件路径），前端据此显示冲突条。

## 安全边界

- 命令只对 `workspaceRegistry` 登记过的工作区（以及 profile 的默认目录）执行，其它路径一律 403
- 文件路径必须是仓库内相对路径：绝对路径、`..`、以 `-` 开头的一律拒绝
- 写请求要求 `Origin` 与 `Host` 同源，否则 403；读请求只接受 GET/HEAD
- `git` 命令全部用 argv 数组执行，不经 shell；写命令超时 120s，读命令 20s
- 推送会改写远端分支、拉取会改写本地工作区，因此都需要二次确认；拉取用 `--autostash` 保护未提交的改动
- 拉取失败（冲突）时仓库会停在冲突状态，此时可以「中止合并」回到拉取前

## 许可证

[MIT](./LICENSE)
