# Git 提交 / Git commits

DeepSeek Harness 插件：在 Web UI 侧边栏底部加一个「Git 提交」入口，点开后可以

- **改动**：查看工作区未提交的改动，逐个文件暂存 / 取消暂存，写提交信息后提交，并把当前分支推送到远端
- **提交历史**：浏览提交列表，逐个提交对比改动文件的统一差异（unified diff）

## 安装

```bash
dsh plugin add dsh-plugin-git-commits
```

装进指定 profile（`web` 是 Web UI 正在使用的那个，`headless` 是无界面模式，两者互不影响）：

```bash
dsh plugin --profile web add dsh-plugin-git-commits
```

装完重启 `dsh web` 宿主才会挂载。验证：

```bash
dsh plugins list
```

## 能力

改动页

- 已暂存 / 未暂存（含未跟踪）两组文件，`A` `M` `D` `R` `U` 状态徽标与 `+n / -n` 统计
- 单文件「+ / −」切换暂存状态，分组头可「全部暂存 / 全部取消暂存」
- 选中文件显示带行号的 diff：工作区 vs 索引、索引 vs HEAD，未跟踪文件按新增文件渲染
- 提交框：`⌘/Ctrl + Enter` 提交，只提交已暂存内容；按钮上显示待提交文件数
- 推送：显示领先 / 落后远端提交数；首次推送自动 `-u origin HEAD`；点击后需再点一次「确认推送」
- 分支、远端、仓库路径在头部与底部展示，操作结果（成功输出或 git 报错原文）就地显示

历史页

- 提交列表（短哈希、作者、时间、标题）分页加载
- 选中提交后列出改动文件，选中文件查看带行号的 diff，新增 / 删除分色，hunk 头高亮

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
POST /git-commits-write/push?path=<dir>      {}
```

## 安全边界

- 只对 `workspaceRegistry` 登记过的工作区（以及 profile 默认目录）执行命令，其它路径一律 403
- 文件路径必须是仓库内相对路径：绝对路径、`..`、以 `-` 开头的一律拒绝
- 写请求要求 `Origin` 与 `Host` 同源，否则 403；读请求只接受 GET/HEAD
- `git` 命令全部用 argv 数组执行，不经 shell；写命令超时 120s，读命令 20s
- 推送不是破坏性操作，但会改写远端分支，因此界面上需要二次确认

## 安装位置与维护

- 源码：`~/code/dsh-plugins/git-commits`（独立目录，不属于任何业务仓库）
- 安装：当前 profile（`desktop`）里以链接目录方式安装
  `~/.dsh/profiles/desktop/node_modules/dsh-plugin-git-commits → ~/code/dsh-plugins/git-commits`
- 生效范围：装进 profile 后对**所有会话、所有工作区**可用；面板顶部的工作区下拉会列出
  `workspaceRegistry` 里登记的全部工作区，选择会被记住。
- 其他 profile（例如 `dsh --profile web`）要用的话，`install_bundle` 指向这个绝对路径即可。
- 改完代码：设置 → 插件 里把「Git 提交」关掉再打开（重载 Host 半边），再刷新页面（重载 Client 半边）。
- 卸载：在 设置 → 插件 里移除 `dsh-plugin-git-commits`，不会影响磁盘上的源码。

## 许可证

[MIT](./LICENSE)
