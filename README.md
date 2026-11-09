# dsh-plugin-git-commits

[English](./README.md) | [中文](./README.zh.md)

A DeepSeek Harness plugin that adds a **Git commits** entry to the Web UI sidebar. Browse commit history, compare file diffs, stage and commit your changes, and sync, pull, or push the current branch — without leaving the app.

## Features

### Changes tab

- Files grouped into **Staged** and **Unstaged** (including untracked), with `A` `M` `D` `R` `U` badges and `+n / -n` counts
- Toggle staging per file, or stage/unstage everything from the group header
- Side-by-side diff with line numbers: worktree vs index, index vs HEAD; untracked files render as new-file diffs
- Commit box: `⌘/Ctrl + Enter` commits, and only staged changes are committed; the button shows the file count
- **Sync** runs `git fetch --all --prune` and shows `↓n` (behind) / `↑n` (ahead) badges
- **Pull ↓n** integrates the incoming commits, with rebase (default) or merge, `--autostash` so uncommitted work is preserved
- **Push** publishes the branch; the first push sets the upstream with `-u origin HEAD`
- Every remote write asks for confirmation first
- When a pull conflicts, a red banner lists the conflicted files and offers **Abort merge** (`git rebase --abort` / `merge --abort`)

### History tab

- Commit list with short hash, author, date, and subject, paged with **Load more**
- Per-commit file list, and a unified diff with line numbers, green additions, red deletions, and highlighted hunk headers

## Install

```bash
dsh plugin add dsh-plugin-git-commits
```

Install into a specific profile (each profile is independent):

```bash
dsh plugin --profile web add dsh-plugin-git-commits
```

Restart the `dsh web` host after installing so the bundle is mounted, then verify:

```bash
dsh plugins list
```

Requires `git` on the `PATH`. If it lives elsewhere, point `DSH_GIT_BINARY` at its absolute path.

## How it works

| Half | File | Role |
| --- | --- | --- |
| Host | `index.js` | Read route `/git-commits-api` (resource, GET/HEAD) and write route `/git-commits-write` (raw handler, POST) |
| Client | `client.js` | `sidebar.footer.action` trigger button and `shell.overlay` drawer panel |
| Display | `locale/*.json`, `icon.svg` | Plugin Manager title, description, and icon |

Read endpoints (GET, JSON):

```
GET /git-commits-api/workspaces
GET /git-commits-api/status?path=<dir>
GET /git-commits-api/log?path=<dir>&limit=30&skip=0
GET /git-commits-api/files?path=<dir>&hash=<commit>
GET /git-commits-api/diff?path=<dir>&hash=<commit>&file=<path>
GET /git-commits-api/workdiff?path=<dir>&file=<path>&staged=0|1
```

Write endpoints (POST, JSON body):

```
POST /git-commits-write/stage?path=<dir>     { "files": ["a"] } | { "all": true }
POST /git-commits-write/unstage?path=<dir>   { "files": ["a"] } | { "all": true }
POST /git-commits-write/commit?path=<dir>    { "message": "feat: ..." }
POST /git-commits-write/fetch?path=<dir>     {}
POST /git-commits-write/pull?path=<dir>      { "mode": "rebase" | "merge" }
POST /git-commits-write/push?path=<dir>      {}
POST /git-commits-write/abort?path=<dir>     {}
```

`fetch` returns `ahead`, `behind`, and `incoming` (the commits the remote has that the local branch does not). A failed `pull` returns `conflicts`, the conflicted file paths.

## Safety

- Commands only ever run in workspaces registered with `workspaceRegistry` (plus the profile's default directory). Any other path is rejected with 403.
- File paths must be repository-relative: absolute paths, `..`, and leading `-` are all refused.
- Write requests must be same-origin (`Origin` must match `Host`); reads accept only GET and HEAD.
- Every `git` invocation goes through an argv array, never a shell. Writes time out after 120s, reads after 20s.
- Pushing rewrites a remote branch and pulling rewrites the working tree, so both ask for confirmation. Pulling uses `--autostash` to protect uncommitted changes.
- A failed pull leaves the repository in a conflicted state; **Abort merge** returns it to where it was before the pull.

## License

[MIT](./LICENSE)
