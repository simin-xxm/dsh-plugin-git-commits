window.__ModuleLoader__.load({
	id: 'dsh-plugin-git-commits',
	factory(require) {
		const React = require('react')
		const h = React.createElement

		/** Dictionary namespace owned by this plugin. */
		const NS = 'gitCommits'
		/** Same-origin read route served by this package's Host half. */
		const API = '/git-commits-api'
		/** Same-origin write route: raw routes, because resources only serve reads. */
		const WRITE_API = '/git-commits-write'
		/** Remembered workspace across panel openings. */
		const WORKSPACE_KEY = 'dsh.git-commits.workspace'
		/** Page size for one history request. */
		const PAGE_SIZE = 30
		/** Rendered diff rows before the view stops rendering more. */
		const MAX_DIFF_ROWS = 4000

		const zh = {
			title: 'Git 提交',
			openPanel: '打开 Git 改动与提交对比',
			close: '关闭',
			refresh: '刷新',
			workspace: '工作区',
			changes: '改动',
			history: '提交历史',
			commits: '提交历史',
			files: '改动文件',
			staged: '已暂存',
			unstaged: '未暂存',
			untracked: '未跟踪',
			stage: '暂存此文件',
			unstage: '取消暂存此文件',
			stageAll: '全部暂存',
			unstageAll: '全部取消暂存',
			clean: '工作区是干净的，没有未提交的改动',
			messagePlaceholder: '提交信息，例如：feat: 新增员工档案导出',
			messageHint: '⌘/Ctrl + Enter 提交 · 只提交已暂存的内容',
			commit: '提交 {n} 个文件',
			commitIdle: '提交',
			committing: '提交中…',
			pushing: '推送中…',
			push: '推送',
			pushAhead: '推送 ↑{n}',
			confirmPush: '确认推送 ↑{n}',
			confirmPushNoUpstream: '确认推送并设置上游',
			ahead: '↑{n}',
			behind: '↓{n}',
			loading: '加载中…',
			loadMore: '加载更多',
			noCommits: '这个仓库还没有提交',
			notRepo: '此目录不在 Git 仓库中',
			noFiles: '此提交没有显示文件改动',
			noDiff: '没有可显示的差异',
			selectFile: '从左侧选择一个文件查看差异',
			diffTruncated: '差异过大，已截断显示',
			readOnly: '提交与推送只作用于当前分支，请确认后再操作',
			error: '加载失败',
			retry: '重试',
			noWorkspace: '没有可用的工作区',
			emptyMessage: '请填写提交信息',
			nothingStaged: '先暂存要提交的文件',
			committed: '已提交',
			pushed: '已推送',
			staged_one: '已暂存',
			unstaged_one: '已取消暂存',
			sync: '同步',
			syncing: '同步中…',
			syncTitle: '从远端拉取最新代码',
			synced: '已同步',
			syncedUpToDate: '已是最新',
			pullBehind: '拉取 ↓{n} 个提交',
			pulling: '拉取中…',
			pulled: '已拉取',
			pullModeRebase: '变基（rebase）',
			pullModeMerge: '合并（merge）',
			pullMode: '拉取方式',
			confirmPull: '确认拉取 {n} 个提交',
			confirmPullTitle: '确认拉取远端的 {n} 个提交？本地未提交的改动会自动暂存并恢复。',
			noUpstream: '当前分支没有上游分支，无法拉取',
			conflicts: '有 {n} 个文件冲突',
			conflictTitle: '冲突文件',
			abortMerge: '中止合并',
			abortDone: '已中止',
			incoming: '远端新增 {n} 个提交',
			noIncoming: '远端没有新提交',
		}

		const en = {
			title: 'Git commits',
			openPanel: 'Open git changes and commit comparison',
			close: 'Close',
			refresh: 'Refresh',
			workspace: 'Workspace',
			changes: 'Changes',
			history: 'History',
			commits: 'History',
			files: 'Files',
			staged: 'Staged',
			unstaged: 'Unstaged',
			untracked: 'Untracked',
			stage: 'Stage this file',
			unstage: 'Unstage this file',
			stageAll: 'Stage all',
			unstageAll: 'Unstage all',
			clean: 'The working tree is clean',
			messagePlaceholder: 'Commit message, e.g. feat: add employee export',
			messageHint: '⌘/Ctrl + Enter to commit · only staged changes are committed',
			commit: 'Commit {n} files',
			commitIdle: 'Commit',
			committing: 'Committing…',
			pushing: 'Pushing…',
			push: 'Push',
			pushAhead: 'Push ↑{n}',
			confirmPush: 'Confirm push ↑{n}',
			confirmPushNoUpstream: 'Confirm push and set upstream',
			ahead: '↑{n}',
			behind: '↓{n}',
			loading: 'Loading…',
			loadMore: 'Load more',
			noCommits: 'This repository has no commits yet',
			notRepo: 'This directory is not inside a git repository',
			noFiles: 'This commit shows no changed files',
			noDiff: 'Nothing to show',
			selectFile: 'Pick a file on the left to compare it',
			diffTruncated: 'The diff is large and was truncated',
			readOnly: 'Commit and push act on the current branch; review before confirming',
			error: 'Could not load',
			retry: 'Retry',
			noWorkspace: 'No workspace available',
			emptyMessage: 'Write a commit message first',
			nothingStaged: 'Stage the files you want to commit first',
			committed: 'Committed',
			pushed: 'Pushed',
			staged_one: 'Staged',
			unstaged_one: 'Unstaged',
			sync: 'Sync',
			syncing: 'Syncing…',
			syncTitle: 'Fetch and pull the latest code from the remote',
			synced: 'Synced',
			syncedUpToDate: 'Already up to date',
			pullBehind: 'Pull ↓{n}',
			pulling: 'Pulling…',
			pulled: 'Pulled',
			pullModeRebase: 'Rebase',
			pullModeMerge: 'Merge',
			pullMode: 'Pull strategy',
			confirmPull: 'Confirm pull {n}',
			confirmPullTitle: 'Pull the {n} incoming commits? Local uncommitted changes are stashed and restored automatically.',
			noUpstream: 'This branch has no upstream, so it cannot pull',
			conflicts: '{n} conflicted files',
			conflictTitle: 'Conflicted files',
			abortMerge: 'Abort merge',
			abortDone: 'Aborted',
			incoming: '{n} new commits on the remote',
			noIncoming: 'No new commits on the remote',
		}

		const PANEL_CSS = `
.gc-panel-root { position: fixed; inset: 0; pointer-events: none; }
.gc-scrim { position: absolute; inset: 0; pointer-events: auto; background: color-mix(in srgb, var(--dsw-alias-bg-base) 62%, transparent); backdrop-filter: blur(1.5px); }
.gc-panel { position: absolute; inset-block: 0; inset-inline-end: 0; width: min(1120px, 95vw); display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; background: var(--dsw-alias-bg-layer-1); border-inline-start: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); font-size: 13px; }
.gc-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-block-end: 1px solid var(--dsw-alias-border-l1); }
.gc-glyph { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); color: var(--dsw-alias-brand-primary); flex: none; }
.gc-titles { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.gc-title { font-size: 14px; font-weight: 600; line-height: 18px; }
.gc-subtitle { font-size: 11px; line-height: 14px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 380px; }
.gc-spacer { flex: 1 1 auto; }
.gc-tabs { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); flex: none; }
.gc-tab { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.gc-tab:hover { color: var(--dsw-alias-label-primary); }
.gc-tab:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.gc-tab[data-active='true'] { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.gc-tab-count { font-size: 10.5px; line-height: 15px; height: 15px; padding: 0 5px; border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); color: var(--dsw-alias-brand-primary); }
.gc-select { height: 28px; max-width: 220px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 12px; padding: 0 6px; outline: none; }
.gc-select:focus-visible { border-color: var(--dsw-alias-brand-primary); }
.gc-iconbtn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: none; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 0; }
.gc-iconbtn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.gc-iconbtn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.gc-body { flex: 1 1 auto; display: flex; min-height: 0; }
.gc-col { display: flex; flex-direction: column; min-height: 0; }
.gc-col-list { width: 300px; flex: none; border-inline-end: 1px solid var(--dsw-alias-border-l1); }
.gc-col-files { width: 262px; flex: none; border-inline-end: 1px solid var(--dsw-alias-border-l1); display: flex; flex-direction: column; min-height: 0; }
.gc-file { display: flex; align-items: center; gap: 7px; width: 100%; text-align: start; border: 0; background: transparent; color: inherit; font: inherit; padding: 6px 10px; cursor: pointer; }
.gc-file:hover { background: var(--dsw-alias-bg-layer-2); }
.gc-file:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.gc-file[aria-current='true'] { background: var(--dsw-alias-bg-layer-2); }
.gc-col-head { display: flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); border-block-end: 1px solid var(--dsw-alias-border-l1); }
.gc-count { font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--dsw-alias-state-idle-primary); }
.gc-scroll { flex: 1 1 auto; overflow: auto; min-height: 0; }
.gc-group { display: flex; align-items: center; gap: 6px; padding: 7px 12px 5px; font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); position: sticky; top: 0; z-index: 1; background: var(--dsw-alias-bg-layer-1); }
.gc-group .gc-spacer { flex: 1 1 auto; }
.gc-groupaction { border: 0; background: transparent; color: var(--dsw-alias-brand-primary); font: inherit; font-size: 10.5px; letter-spacing: 0; text-transform: none; cursor: pointer; padding: 0; }
.gc-groupaction:disabled { color: var(--dsw-alias-state-idle-primary); cursor: default; }
.gc-crow { display: flex; align-items: center; }
.gc-cfile { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 7px; border: 0; background: transparent; color: inherit; font: inherit; text-align: start; padding: 6px 8px 6px 12px; cursor: pointer; }
.gc-cfile:hover { background: var(--dsw-alias-bg-layer-2); }
.gc-cfile:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.gc-cfile[aria-current='true'] { background: var(--dsw-alias-bg-layer-2); }
.gc-stagebtn { flex: none; width: 22px; height: 22px; margin-inline-end: 8px; padding: 0; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.gc-stagebtn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.gc-stagebtn:disabled { opacity: .4; cursor: default; }
.gc-commit { display: block; width: 100%; text-align: start; border: 0; border-inline-start: 2px solid transparent; background: transparent; color: inherit; font: inherit; padding: 8px 12px; cursor: pointer; }
.gc-commit:hover { background: var(--dsw-alias-bg-layer-2); }
.gc-commit:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.gc-commit[aria-current='true'] { background: var(--dsw-alias-bg-layer-2); border-inline-start-color: var(--dsw-alias-brand-primary); }
.gc-commit-subject { font-size: 12.5px; line-height: 17px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.gc-commit-meta { margin-block-start: 3px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.gc-hash { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-brand-primary); }
.gc-detail { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.gc-detail-head { padding: 9px 14px; border-block-end: 1px solid var(--dsw-alias-border-l1); display: flex; flex-direction: column; gap: 4px; }
.gc-detail-title { font-size: 13px; font-weight: 600; line-height: 18px; word-break: break-all; }
.gc-detail-line { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.gc-split { flex: 1 1 auto; display: flex; min-height: 0; }
.gc-diffpane { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.gc-diffhead { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-block-end: 1px solid var(--dsw-alias-border-l1); font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.gc-difffile { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.gc-diffbody { flex: 1 1 auto; min-height: 0; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 18px; }
.gc-row { display: flex; align-items: stretch; white-space: pre; }
.gc-ln { flex: none; width: 42px; padding-inline-end: 8px; text-align: end; color: var(--dsw-alias-state-idle-primary); user-select: none; }
.gc-code { flex: 1 1 auto; padding-inline-end: 16px; }
.gc-row.is-add { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 13%, transparent); }
.gc-row.is-del { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 13%, transparent); }
.gc-row.is-add .gc-code { color: var(--dsw-alias-state-success-primary); }
.gc-row.is-del .gc-code { color: var(--dsw-alias-state-error-primary); }
.gc-row.is-hunk { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); }
.gc-row.is-meta { color: var(--dsw-alias-label-secondary); }
.gc-status { flex: none; width: 16px; height: 16px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-weight: 700; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.gc-status.is-add { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 20%, transparent); color: var(--dsw-alias-state-success-primary); }
.gc-status.is-del { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 20%, transparent); color: var(--dsw-alias-state-error-primary); }
.gc-status.is-mod { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 20%, transparent); color: var(--dsw-alias-state-warn-primary); }
.gc-status.is-ren { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent); color: var(--dsw-alias-brand-primary); }
.gc-file-name { min-width: 0; flex: 1 1 auto; font-size: 12px; line-height: 16px; word-break: break-all; }
.gc-dir { color: var(--dsw-alias-label-secondary); }
.gc-num { flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; }
.gc-num.add { color: var(--dsw-alias-state-success-primary); }
.gc-num.del { color: var(--dsw-alias-state-error-primary); }
.gc-note { padding: 10px 14px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.gc-note.gc-error { white-space: pre-wrap; word-break: break-word; }
.gc-error { color: var(--dsw-alias-state-error-primary); }
.gc-center { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.gc-more { margin: 8px 12px 12px; height: 30px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 12px; cursor: pointer; }
.gc-more:hover { border-color: var(--dsw-alias-border-l2); }
.gc-linkbtn { border: 0; background: transparent; color: var(--dsw-alias-brand-primary); font: inherit; cursor: pointer; text-decoration: underline; padding: 0; }
.gc-composer { flex: none; background: var(--dsw-alias-bg-layer-1); border-block-start: 1px solid var(--dsw-alias-border-l1); padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 7px; }
.gc-composer-box { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); transition: border-color .15s ease; }
.gc-composer-box:focus-within { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1)); }
.gc-message { border: 0; border-radius: 10px 10px 0 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; line-height: 17px; padding: 8px 10px; min-height: 46px; max-height: 132px; resize: none; outline: none; field-sizing: content; }
.gc-message::placeholder { color: var(--dsw-alias-state-idle-primary); }
.gc-composer-foot { display: flex; align-items: center; gap: 8px; padding: 0 8px 8px 10px; }
.gc-hint { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10.5px; color: var(--dsw-alias-state-idle-primary); }
.gc-primary { flex: none; height: 28px; padding: 0 14px; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); color: var(--dsw-alias-brand-primary); font: inherit; font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.gc-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent); }
.gc-primary:disabled { opacity: .45; cursor: default; }
.gc-secondary { flex: none; height: 28px; padding: 0 12px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.gc-secondary:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.gc-secondary:disabled { opacity: .45; cursor: default; }
.gc-notice { font-size: 11.5px; line-height: 16px; padding: 6px 8px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
.gc-notice.ok { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); color: var(--dsw-alias-state-success-primary); }
.gc-notice.error { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); color: var(--dsw-alias-state-error-primary); }
.gc-hint { font-size: 10.5px; color: var(--dsw-alias-state-idle-primary); }
.gc-syncbtn { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.gc-syncbtn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.gc-syncbtn:disabled { opacity: .45; cursor: default; }
.gc-syncbtn[data-pending='true'] { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent); color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
.gc-badge { display: inline-flex; align-items: center; height: 16px; padding: 0 5px; border-radius: 999px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-weight: 600; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); color: var(--dsw-alias-brand-primary); }
.gc-badge.down { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent); color: var(--dsw-alias-state-warn-primary); }
.gc-conflict { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-block-start: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); }
.gc-conflict-text { flex: 1 1 auto; min-width: 0; font-size: 11.5px; color: var(--dsw-alias-state-error-primary); }
.gc-conflict-files { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.gc-modal-scrim { position: fixed; inset: 0; pointer-events: auto; background: color-mix(in srgb, var(--dsw-alias-bg-base) 66%, transparent); display: flex; align-items: center; justify-content: center; padding: 24px; }
.gc-modal { width: min(460px, 92vw); border-radius: 12px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); box-shadow: 0 12px 32px rgba(0, 0, 0, .28); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.gc-modal-title { font-size: 13.5px; font-weight: 600; line-height: 19px; }
.gc-modal-body { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.gc-modal-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.gc-modal-row .gc-spacer { flex: 1 1 auto; }
.gc-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
.gc-foot { flex: none; padding: 6px 14px; border-block-start: 1px solid var(--dsw-alias-border-l1); font-size: 11px; color: var(--dsw-alias-state-idle-primary); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.gc-foot-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 880px) {
  .gc-col-list { width: 230px; }
  .gc-hint { display: none; }
}
`

		const TRIGGER_CSS = `
.gc-trigger { display: flex; align-items: center; gap: 8px; width: 100%; height: 30px; padding: 0 8px; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; cursor: pointer; text-align: start; }
.gc-trigger:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.gc-trigger:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.gc-trigger[data-open='true'] { color: var(--dsw-alias-label-primary); }
.gc-trigger-glyph { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex: none; }
.gc-trigger-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`

		/** Module-level open state shared by the trigger and the panel. */
		let panelOpen = false
		const openListeners = new Set()

		/**
		 * Publish a new panel visibility value.
		 * @param {boolean} next whether the panel is open.
		 */
		function setPanelOpen(next) {
			if (panelOpen === next) return
			panelOpen = next
			for (const listener of openListeners) listener()
		}

		/**
		 * Subscribe a component to the panel open state.
		 * @returns {boolean} whether the panel is open.
		 */
		function usePanelOpen() {
			const [, force] = React.useReducer(count => count + 1, 0)
			React.useEffect(() => {
				openListeners.add(force)
				return () => { openListeners.delete(force) }
			}, [force])
			return panelOpen
		}

		/**
		 * Read the remembered workspace path.
		 * @returns {string} the path, or an empty string.
		 */
		function readRememberedWorkspace() {
			try {
				return window.localStorage.getItem(WORKSPACE_KEY) ?? ''
			}
			catch {
				return ''
			}
		}

		/**
		 * Remember the workspace the user picked.
		 * @param {string} path workspace path.
		 */
		function rememberWorkspace(path) {
			try {
				window.localStorage.setItem(WORKSPACE_KEY, path)
			}
			catch {
				// A blocked storage area only loses the preference.
			}
		}

		/**
		 * Call the Host route, either as a read or as a JSON write.
		 * @param {string} operation route suffix.
		 * @param {{ params?: Record<string, string | number>, body?: unknown, signal?: AbortSignal }} options request options.
		 * @returns {Promise<Record<string, any>>} the JSON payload.
		 */
		async function request(operation, options) {
			const { params = {}, body, signal } = options ?? {}
			const search = new URLSearchParams()
			for (const [name, value] of Object.entries(params)) search.set(name, String(value))
			const headers = { accept: 'application/json' }
			const init = { method: 'GET', headers, signal, credentials: 'same-origin' }
			if (body !== undefined) {
				init.method = 'POST'
				headers['content-type'] = 'application/json'
				init.body = JSON.stringify(body)
			}
			const base = body === undefined ? API : WRITE_API
			const response = await fetch(`${base}/${operation}?${search.toString()}`, init)
			const text = await response.text()
			let payload
			try {
				payload = text.length > 0 ? JSON.parse(text) : {}
			}
			catch {
				throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`)
			}
			if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`)
			if (payload?.ok !== true) throw new Error(payload?.error ?? 'request rejected')
			return payload
		}

		/**
		 * Describe an error for display.
		 * @param {unknown} error thrown value.
		 * @returns {string} a short message.
		 */
		function messageOf(error) {
			if (error instanceof Error) return error.message
			return String(error)
		}

		/**
		 * Fill one `{n}` placeholder in a dictionary string.
		 * @param {string} template dictionary string.
		 * @param {string | number} value replacement.
		 * @returns {string} the filled string.
		 */
		function fill(template, value) {
			return String(template).replace('{n}', String(value))
		}

		/**
		 * Format an ISO date as local `YYYY-MM-DD HH:mm`.
		 * @param {string} iso ISO timestamp.
		 * @returns {string} the formatted date.
		 */
		function formatDate(iso) {
			const date = new Date(iso)
			if (Number.isNaN(date.getTime())) return iso
			const pad = value => String(value).padStart(2, '0')
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
		}

		/**
		 * Classify one diff line.
		 * @param {string} raw raw line.
		 * @returns {'hunk' | 'meta' | 'add' | 'del' | 'ctx'} the line kind.
		 */
		function lineKind(raw) {
			if (raw.startsWith('@@')) return 'hunk'
			if (raw.startsWith('+')) return raw.startsWith('+++') ? 'meta' : 'add'
			if (raw.startsWith('-')) return raw.startsWith('---') ? 'meta' : 'del'
			if (raw.startsWith('diff ') || raw.startsWith('index ') || raw.startsWith('new file') || raw.startsWith('deleted file') || raw.startsWith('similarity') || raw.startsWith('rename ') || raw.startsWith('Binary files') || raw.startsWith('\\')) return 'meta'
			return 'ctx'
		}

		/**
		 * Split a unified diff into numbered rows.
		 * @param {string} text diff text.
		 * @returns {Array<{ kind: string, text: string, oldNumber: number | null, newNumber: number | null }>} rows.
		 */
		function parseDiff(text) {
			if (text.length === 0) return []
			const raw = text.split('\n')
			if (raw.length > 0 && raw[raw.length - 1] === '') raw.pop()
			const rows = []
			let oldNumber = 0
			let newNumber = 0
			for (const line of raw) {
				const kind = lineKind(line)
				if (kind === 'hunk') {
					const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
					if (match !== null) {
						oldNumber = Number(match[1])
						newNumber = Number(match[2])
					}
					rows.push({ kind, text: line, oldNumber: null, newNumber: null })
					continue
				}
				if (kind === 'add') {
					rows.push({ kind, text: line.slice(1), oldNumber: null, newNumber })
					newNumber += 1
					continue
				}
				if (kind === 'del') {
					rows.push({ kind, text: line.slice(1), oldNumber, newNumber: null })
					oldNumber += 1
					continue
				}
				if (kind === 'meta') {
					rows.push({ kind, text: line, oldNumber: null, newNumber: null })
					continue
				}
				rows.push({ kind, text: line.startsWith(' ') ? line.slice(1) : line, oldNumber, newNumber })
				oldNumber += 1
				newNumber += 1
			}
			return rows
		}

		/**
		 * Map a git status letter to its badge class.
		 * @param {string} status status letter.
		 * @returns {string} the class suffix.
		 */
		function statusClass(status) {
			if (status === 'A' || status === '?') return 'is-add'
			if (status === 'D') return 'is-del'
			if (status === 'R' || status === 'C') return 'is-ren'
			if (status === 'M') return 'is-mod'
			return ''
		}

		/**
		 * The glyph shown inside a status badge.
		 * @param {string} status status letter.
		 * @returns {string} the glyph.
		 */
		function statusGlyph(status) {
			if (status === '?') return 'U'
			return status
		}

		/** A git branch glyph. */
		function BranchIcon() {
			return h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': 'true' },
				h('path', { d: 'M4.5 5.2v5.6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
				h('path', { d: 'M11.5 5.2v2.1a2.7 2.7 0 0 1-2.7 2.7H7.2', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
				h('circle', { cx: 4.5, cy: 3.4, r: 1.9, stroke: 'currentColor', strokeWidth: 1.5 }),
				h('circle', { cx: 11.5, cy: 3.4, r: 1.9, stroke: 'currentColor', strokeWidth: 1.5 }),
				h('circle', { cx: 7.2, cy: 12.6, r: 1.9, stroke: 'currentColor', strokeWidth: 1.5 }))
		}

		/** A refresh glyph. */
		function RefreshIcon() {
			return h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': 'true' },
				h('path', { d: 'M13 8a5 5 0 1 1-1.6-3.7', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
				h('path', { d: 'M13.2 2.4v2.9h-2.9', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
		}

		/** A close glyph. */
		function CloseIcon() {
			return h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': 'true' },
				h('path', { d: 'm4 4 8 8M12 4l-8 8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
		}

		/**
		 * One tab in the panel header.
		 * @param {{ active: boolean, label: string, count?: number | null, onSelect: Function }} props tab props.
		 * @returns {object} the element.
		 */
		function Tab(props) {
			return h('button', {
				type: 'button',
				className: 'gc-tab',
				role: 'tab',
				'aria-selected': props.active ? 'true' : 'false',
				'data-active': props.active ? 'true' : 'false',
				onClick: props.onSelect,
			},
			props.label,
			props.count === null || props.count === undefined ? null : h('span', { className: 'gc-tab-count' }, String(props.count)))
		}

		/**
		 * One commit row.
		 * @param {{ commit: object, active: boolean, onSelect: Function }} props row props.
		 * @returns {object} the element.
		 */
		function CommitRow(props) {
			const { commit, active, onSelect } = props
			return h('button', {
				type: 'button',
				className: 'gc-commit',
				'aria-current': active ? 'true' : 'false',
				onClick: () => onSelect(commit.hash),
			},
			h('span', { className: 'gc-commit-subject' }, commit.subject),
			h('span', { className: 'gc-commit-meta' },
				h('span', { className: 'gc-hash' }, commit.shortHash),
				h('span', null, commit.author),
				h('span', null, formatDate(commit.date))))
		}

		/**
		 * Whether a working-tree row has a meaningful `+n / -n` pair.
		 * @param {object} row working-tree row.
		 * @returns {boolean} whether to render counts.
		 */
		function hasCounts(row) {
			if (row.binary === true) return false
			return row.status !== '?' || row.additions + row.deletions > 0
		}

		/**
		 * One changed-file row of a commit.
		 * @param {{ file: object, active: boolean, onSelect: Function }} props row props.
		 * @returns {object} the element.
		 */
		function FileRow(props) {
			const { file, active, onSelect } = props
			const slash = file.path.lastIndexOf('/')
			const directory = slash === -1 ? '' : file.path.slice(0, slash + 1)
			const name = slash === -1 ? file.path : file.path.slice(slash + 1)
			return h('button', {
				type: 'button',
				className: 'gc-file',
				'aria-current': active ? 'true' : 'false',
				title: file.previousPath === null ? file.path : `${file.previousPath} → ${file.path}`,
				onClick: () => onSelect(file.path),
			},
			h('span', { className: `gc-status ${statusClass(file.status)}` }, statusGlyph(file.status)),
			h('span', { className: 'gc-file-name' },
				directory.length > 0 ? h('span', { className: 'gc-dir' }, directory) : null,
				name),
			file.binary ? h('span', { className: 'gc-num' }, 'bin') : null,
			file.binary ? null : h('span', { className: 'gc-num add' }, `+${file.additions}`),
			file.binary ? null : h('span', { className: 'gc-num del' }, `-${file.deletions}`))
		}

		/**
		 * One working-tree row with its stage toggle.
		 * @param {{ row: object, active: boolean, disabled: boolean, onSelect: Function, onToggle: Function, t: Function }} props row props.
		 * @returns {object} the element.
		 */
		function ChangeRow(props) {
			const { row, active, disabled, onSelect, onToggle } = props
			const slash = row.path.lastIndexOf('/')
			const directory = slash === -1 ? '' : row.path.slice(0, slash + 1)
			const name = slash === -1 ? row.path : row.path.slice(slash + 1)
			return h('div', { className: 'gc-crow' },
				h('button', {
					type: 'button',
					className: 'gc-cfile',
					'aria-current': active ? 'true' : 'false',
					title: row.previousPath === null ? row.path : `${row.previousPath} → ${row.path}`,
					onClick: () => onSelect(row.path),
				},
				h('span', { className: `gc-status ${statusClass(row.status)}` }, statusGlyph(row.status)),
				h('span', { className: 'gc-file-name' },
					directory.length > 0 ? h('span', { className: 'gc-dir' }, directory) : null,
					name),
				row.binary ? h('span', { className: 'gc-num' }, 'bin') : null,
				hasCounts(row) ? h('span', { className: 'gc-num add' }, `+${row.additions}`) : null,
				hasCounts(row) ? h('span', { className: 'gc-num del' }, `-${row.deletions}`) : null),
				h('button', {
					type: 'button',
					className: 'gc-stagebtn',
					disabled,
					title: row.staged ? props.t('unstage') : props.t('stage'),
					'aria-label': row.staged ? props.t('unstage') : props.t('stage'),
					onClick: () => onToggle(row),
				}, row.staged ? '−' : '+'))
		}

		/**
		 * The unified diff of the selected file.
		 * @param {{ diff: { phase: string, text: string, truncated: boolean, error: string }, file: string, t: Function }} props view props.
		 * @returns {object} the element.
		 */
		function DiffView(props) {
			const { diff, file } = props
			const rows = React.useMemo(() => parseDiff(diff.text), [diff.text])
			const visible = rows.length > MAX_DIFF_ROWS ? rows.slice(0, MAX_DIFF_ROWS) : rows
			return h('div', { className: 'gc-diffpane' },
				h('div', { className: 'gc-diffhead' },
					h('span', { className: 'gc-difffile', title: file }, file),
					diff.truncated ? h('span', { className: 'gc-num del' }, props.t('diffTruncated')) : null),
				h('div', { className: 'gc-diffbody' },
					diff.phase === 'loading' ? h('div', { className: 'gc-note' }, props.t('loading')) : null,
					diff.phase === 'error' ? h('div', { className: 'gc-note gc-error' }, diff.error) : null,
					diff.phase === 'ready' && rows.length === 0 ? h('div', { className: 'gc-note' }, props.t('noDiff')) : null,
					visible.map((row, index) => h('div', {
						key: index,
						className: `gc-row${row.kind === 'hunk' ? ' is-hunk' : row.kind === 'add' ? ' is-add' : row.kind === 'del' ? ' is-del' : row.kind === 'meta' ? ' is-meta' : ''}`,
					},
					h('span', { className: 'gc-ln' }, row.oldNumber === null ? '' : String(row.oldNumber)),
					h('span', { className: 'gc-ln' }, row.newNumber === null ? '' : String(row.newNumber)),
					h('span', { className: 'gc-code' }, row.text)))),
				rows.length > MAX_DIFF_ROWS
					? h('div', { className: 'gc-note' }, `${props.t('diffTruncated')} (${MAX_DIFF_ROWS}/${rows.length})`)
					: null)
		}

		/**
		 * The panel: working-tree changes with commit controls, plus the commit history.
		 * @param {{ t: Function }} props slot props.
		 * @returns {object} the element.
		 */
		function GitCommitsPanel(props) {
			const t = props.t
			const [roots, setRoots] = React.useState([])
			const [rootsPhase, setRootsPhase] = React.useState('loading')
			const [rootsError, setRootsError] = React.useState('')
			const [workspacePath, setWorkspacePath] = React.useState('')
			const [view, setView] = React.useState('changes')
			const [reloadToken, setReloadToken] = React.useState(0)

			const [worktree, setWorktree] = React.useState({ phase: 'idle', root: '', branch: '', upstream: '', ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], error: '' })
			const [selectedPath, setSelectedPath] = React.useState('')
			const [workDiff, setWorkDiff] = React.useState({ phase: 'idle', text: '', truncated: false, error: '' })
			const [statusToken, setStatusToken] = React.useState(0)
			const [message, setMessage] = React.useState('')
			const [busy, setBusy] = React.useState('')
			const [notice, setNotice] = React.useState(null)
			const [confirmPush, setConfirmPush] = React.useState(false)
			const [pullMode, setPullMode] = React.useState('rebase')
			const [pullPrompt, setPullPrompt] = React.useState(null)
			const [conflicts, setConflicts] = React.useState([])
			const [incoming, setIncoming] = React.useState([])

			const [history, setHistory] = React.useState({ phase: 'idle', commits: [], hasMore: false, root: '', branch: '', error: '' })
			const [historyHash, setHistoryHash] = React.useState('')
			const [historyFiles, setHistoryFiles] = React.useState({ phase: 'idle', list: [], error: '' })
			const [historyFile, setHistoryFile] = React.useState('')
			const [historyDiff, setHistoryDiff] = React.useState({ phase: 'idle', text: '', truncated: false, error: '' })
			const [historyToken, setHistoryToken] = React.useState(0)
			const [loadingMore, setLoadingMore] = React.useState(false)

			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === 'Escape') setPanelOpen(false)
				}
				document.addEventListener('keydown', onKeyDown)
				return () => { document.removeEventListener('keydown', onKeyDown) }
			}, [])

			React.useEffect(() => {
				if (!confirmPush) return undefined
				const timer = window.setTimeout(() => setConfirmPush(false), 6000)
				return () => { window.clearTimeout(timer) }
			}, [confirmPush])

			React.useEffect(() => {
				const controller = new AbortController()
				let alive = true
				setRootsPhase('loading')
				request('workspaces', { signal: controller.signal }).then((payload) => {
					if (!alive) return
					const list = Array.isArray(payload.workspaces) ? payload.workspaces : []
					setRoots(list)
					setRootsPhase('ready')
					setRootsError(list.length === 0 ? t('noWorkspace') : '')
					if (list.length > 0) {
						setWorkspacePath((current) => {
							if (current.length > 0 && list.some(item => item.path === current)) return current
							const remembered = readRememberedWorkspace()
							const pick = list.find(item => item.path === remembered) ?? list[0]
							return pick.path
						})
					}
				}).catch((error) => {
					if (!alive || error.name === 'AbortError') return
					setRoots([])
					setRootsPhase('error')
					setRootsError(messageOf(error))
				})
				return () => { alive = false; controller.abort() }
			}, [reloadToken, t])

			React.useEffect(() => {
				if (workspacePath.length === 0) return undefined
				rememberWorkspace(workspacePath)
				const controller = new AbortController()
				let alive = true
				setWorktree(current => ({ ...current, phase: 'loading', error: '' }))
				request('status', { params: { path: workspacePath }, signal: controller.signal }).then((payload) => {
					if (!alive) return
					const next = {
						phase: 'ready',
						root: payload.root ?? '',
						branch: payload.branch ?? '',
						upstream: payload.upstream ?? '',
						ahead: Number(payload.ahead ?? 0),
						behind: Number(payload.behind ?? 0),
						conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
						staged: Array.isArray(payload.staged) ? payload.staged : [],
						unstaged: Array.isArray(payload.unstaged) ? payload.unstaged : [],
						untracked: Array.isArray(payload.untracked) ? payload.untracked : [],
						error: '',
					}
					setWorktree(next)
					setSelectedPath((current) => {
						const every = next.staged.concat(next.unstaged, next.untracked)
						if (current.length > 0 && every.some(row => row.path === current)) return current
						return every.length > 0 ? every[0].path : ''
					})
				}).catch((error) => {
					if (!alive || error.name === 'AbortError') return
					setWorktree(current => ({ ...current, phase: 'error', error: messageOf(error) }))
				})
				return () => { alive = false; controller.abort() }
			}, [workspacePath, statusToken, reloadToken])

			const stagedPaths = React.useMemo(() => new Set(worktree.staged.map(row => row.path)), [worktree.staged])
			const unstagedPaths = React.useMemo(() => new Set(worktree.unstaged.concat(worktree.untracked).map(row => row.path)), [worktree.unstaged, worktree.untracked])
			const selectedStaged = selectedPath.length > 0 && stagedPaths.has(selectedPath) && !unstagedPaths.has(selectedPath)

			React.useEffect(() => {
				if (view !== 'changes' || workspacePath.length === 0 || selectedPath.length === 0) return undefined
				const controller = new AbortController()
				let alive = true
				setWorkDiff({ phase: 'loading', text: '', truncated: false, error: '' })
				request('workdiff', {
					params: { path: workspacePath, file: selectedPath, staged: selectedStaged ? 1 : 0 },
					signal: controller.signal,
				}).then((payload) => {
					if (!alive) return
					setWorkDiff({ phase: 'ready', text: String(payload.diff ?? ''), truncated: Boolean(payload.truncated), error: '' })
				}).catch((error) => {
					if (!alive || error.name === 'AbortError') return
					setWorkDiff({ phase: 'error', text: '', truncated: false, error: messageOf(error) })
				})
				return () => { alive = false; controller.abort() }
			}, [view, workspacePath, selectedPath, selectedStaged, statusToken])

			React.useEffect(() => {
				if (view !== 'history' || workspacePath.length === 0) return undefined
				const controller = new AbortController()
				let alive = true
				setHistory({ phase: 'loading', commits: [], hasMore: false, root: '', branch: '', error: '' })
				setHistoryHash('')
				request('log', { params: { path: workspacePath, limit: PAGE_SIZE }, signal: controller.signal }).then((payload) => {
					if (!alive) return
					const commits = Array.isArray(payload.commits) ? payload.commits : []
					setHistory({ phase: 'ready', commits, hasMore: Boolean(payload.hasMore), root: payload.root ?? '', branch: payload.branch ?? '', error: '' })
					setHistoryHash(commits.length > 0 ? commits[0].hash : '')
				}).catch((error) => {
					if (!alive || error.name === 'AbortError') return
					setHistory({ phase: 'error', commits: [], hasMore: false, root: '', branch: '', error: messageOf(error) })
				})
				return () => { alive = false; controller.abort() }
			}, [view, workspacePath, historyToken, reloadToken])

			React.useEffect(() => {
				if (view !== 'history' || historyHash.length === 0 || workspacePath.length === 0) {
					setHistoryFiles({ phase: 'idle', list: [], error: '' })
					setHistoryFile('')
					return undefined
				}
				const controller = new AbortController()
				let alive = true
				setHistoryFiles({ phase: 'loading', list: [], error: '' })
				setHistoryFile('')
				request('files', { params: { path: workspacePath, hash: historyHash }, signal: controller.signal }).then((payload) => {
					if (!alive) return
					const list = Array.isArray(payload.files) ? payload.files : []
					setHistoryFiles({ phase: 'ready', list, error: '' })
					setHistoryFile(list.length > 0 ? list[0].path : '')
				}).catch((error) => {
					if (!alive || error.name === 'AbortError') return
					setHistoryFiles({ phase: 'error', list: [], error: messageOf(error) })
				})
				return () => { alive = false; controller.abort() }
			}, [view, historyHash, workspacePath])

			React.useEffect(() => {
				if (view !== 'history' || historyFile.length === 0 || historyHash.length === 0 || workspacePath.length === 0) {
					setHistoryDiff({ phase: 'idle', text: '', truncated: false, error: '' })
					return undefined
				}
				const controller = new AbortController()
				let alive = true
				setHistoryDiff({ phase: 'loading', text: '', truncated: false, error: '' })
				request('diff', { params: { path: workspacePath, hash: historyHash, file: historyFile }, signal: controller.signal }).then((payload) => {
					if (!alive) return
					setHistoryDiff({ phase: 'ready', text: String(payload.diff ?? ''), truncated: Boolean(payload.truncated), error: '' })
				}).catch((error) => {
					if (!alive || error.name === 'AbortError') return
					setHistoryDiff({ phase: 'error', text: '', truncated: false, error: messageOf(error) })
				})
				return () => { alive = false; controller.abort() }
			}, [view, historyFile, historyHash, workspacePath])

			/**
			 * Run one write operation and report its outcome.
			 * @param {string} operation route suffix.
			 * @param {Record<string, unknown>} body request body.
			 * @param {(payload: Record<string, any>) => string} describe success text.
			 */
			async function runWrite(operation, body, describe) {
				setBusy(operation)
				setNotice(null)
				try {
					const payload = await request(operation, { params: { path: workspacePath }, body })
					const text = describe(payload)
					setNotice(text.length > 0 ? { kind: 'ok', text } : null)
					setConfirmPush(false)
					return payload
				}
				catch (error) {
					setNotice({ kind: 'error', text: messageOf(error) })
					return null
				}
				finally {
					setBusy('')
				}
			}

			/**
			 * Stage or unstage one working-tree row, then keep it selected.
			 * @param {object} row working-tree row.
			 */
			async function toggleRow(row) {
				if (busy.length > 0) return
				const operation = row.staged ? 'unstage' : 'stage'
				const payload = await runWrite(operation, { files: [row.path] }, () => '')
				if (payload === null) return
				setNotice(null)
				setSelectedPath(row.path)
				setStatusToken(token => token + 1)
			}

			/**
			 * Stage everything or clear the whole index.
			 * @param {boolean} staged whether to unstage instead of stage.
			 */
			async function toggleAll(staged) {
				if (busy.length > 0) return
				const payload = await runWrite(staged ? 'unstage' : 'stage', { all: true }, () => '')
				if (payload === null) return
				setNotice(null)
				setStatusToken(token => token + 1)
			}

			/**
			 * Create a commit from the staged changes.
			 */
			async function commit() {
				if (busy.length > 0) return
				if (worktree.staged.length === 0) {
					setNotice({ kind: 'error', text: t('nothingStaged') })
					return
				}
				if (message.trim().length === 0) {
					setNotice({ kind: 'error', text: t('emptyMessage') })
					return
				}
				const payload = await runWrite('commit', { message }, (result) => {
					const first = String(result.output ?? '').split('\n').find(line => line.trim().length > 0) ?? ''
					return `${t('committed')} · ${first}`.trim()
				})
				if (payload === null) return
				setMessage('')
				setStatusToken(token => token + 1)
				setHistoryToken(token => token + 1)
			}

			/**
			 * Push the current branch, asking for one inline confirmation first.
			 */
			async function push() {
				if (busy.length > 0) return
				if (confirmPush === false) {
					setConfirmPush(true)
					return
				}
				const payload = await runWrite('push', {}, (result) => {
					const lines = String(result.output ?? '').split('\n').filter(line => line.trim().length > 0)
					const last = lines.length > 0 ? lines[lines.length - 1] : ''
					return `${t('pushed')} · ${last}`.trim()
				})
				if (payload === null) return
				setStatusToken(token => token + 1)
				setHistoryToken(token => token + 1)
			}

			/**
			 * Fetch the remote and report what is new upstream.
			 */
			async function sync() {
				if (busy.length > 0) return
				setBusy('fetch')
				setNotice(null)
				try {
					const payload = await request('fetch', { params: { path: workspacePath }, body: {} })
					const list = Array.isArray(payload.incoming) ? payload.incoming : []
					setIncoming(list)
					setNotice({
						kind: 'ok',
						text: list.length > 0
							? `${t('incoming').replace('{n}', String(list.length))}${payload.behind > 0 ? ` · ${fill(t('behind'), payload.behind)}` : ''}`
							: t('noIncoming'),
					})
				}
				catch (error) {
					setNotice({ kind: 'error', text: messageOf(error) })
				}
				finally {
					setBusy('')
					setStatusToken(token => token + 1)
				}
			}

			/**
			 * Open the pull confirmation, or run the pull once confirmed.
			 * @param {number} count how many incoming commits will be integrated.
			 */
			async function pull(count) {
				if (busy.length > 0) return
				if (pullPrompt === null) {
					setPullPrompt({ count })
					return
				}
				setPullPrompt(null)
				setBusy('pull')
				setNotice(null)
				try {
					const payload = await request('pull', { params: { path: workspacePath }, body: { mode: pullMode } })
					setConflicts(Array.isArray(payload.conflicts) ? payload.conflicts : [])
					setIncoming([])
					setNotice({ kind: 'ok', text: `${t('pulled')} · ${String(payload.output ?? '').split('\n').filter(line => line.trim().length > 0).slice(-1)[0] ?? ''}`.trim() })
				}
				catch (error) {
					const list = Array.isArray(error?.conflicts) ? error.conflicts : []
					setConflicts(list)
					const detail = typeof error?.output === 'string' && error.output.length > 0 ? error.output : messageOf(error)
					setNotice({ kind: 'error', text: list.length > 0 ? `${t('conflicts').replace('{n}', String(list.length))}\n${detail}` : detail })
				}
				finally {
					setBusy('')
					setStatusToken(token => token + 1)
					setHistoryToken(token => token + 1)
				}
			}

			/**
			 * Abort an in-progress merge, rebase, or cherry-pick.
			 */
			async function abortMerge() {
				if (busy.length > 0) return
				setBusy('abort')
				setNotice(null)
				try {
					await request('abort', { params: { path: workspacePath }, body: {} })
					setConflicts([])
					setNotice({ kind: 'ok', text: t('abortDone') })
				}
				catch (error) {
					setNotice({ kind: 'error', text: messageOf(error) })
				}
				finally {
					setBusy('')
					setStatusToken(token => token + 1)
				}
			}

			/**
			 * Append the next history page to the current list.
			 */
			async function loadMore() {
				if (loadingMore || history.phase !== 'ready' || !history.hasMore) return
				setLoadingMore(true)
				try {
					const payload = await request('log', { params: { path: workspacePath, limit: PAGE_SIZE, skip: history.commits.length } })
					const page = Array.isArray(payload.commits) ? payload.commits : []
					setHistory(current => ({ ...current, commits: current.commits.concat(page), hasMore: Boolean(payload.hasMore) }))
				}
				catch (error) {
					setHistory(current => ({ ...current, error: messageOf(error) }))
				}
				finally {
					setLoadingMore(false)
				}
			}

			const changeCount = worktree.staged.length + worktree.unstaged.length + worktree.untracked.length
			const activeCommit = history.commits.find(entry => entry.hash === historyHash)
			const notRepo = worktree.phase === 'error' && /not a git repository/i.test(worktree.error)
			const selectedRoot = roots.find(item => item.path === workspacePath)
			const selectedRow = worktree.unstaged.find(row => row.path === selectedPath)
				?? worktree.untracked.find(row => row.path === selectedPath)
				?? worktree.staged.find(row => row.path === selectedPath)
			const canCommit = worktree.phase === 'ready' && worktree.staged.length > 0 && message.trim().length > 0
			const canPush = worktree.phase === 'ready' && (worktree.ahead > 0 || worktree.upstream.length === 0)
			const aheadLabel = worktree.upstream.length === 0 && worktree.ahead === 0 ? t('confirmPushNoUpstream') : ''
			const pushLabel = busy === 'push'
				? t('pushing')
				: confirmPush
					? (worktree.ahead > 0 ? fill(t('confirmPush'), worktree.ahead) : aheadLabel || t('confirmPushNoUpstream'))
					: (worktree.ahead > 0 ? fill(t('pushAhead'), worktree.ahead) : t('push'))
			const subtitle = worktree.branch.length > 0
				? `${worktree.branch}${worktree.root.length > 0 ? ` · ${worktree.root}` : ''}`
				: (worktree.root || selectedRoot?.path || '')

			/**
			 * Render one working-tree group.
			 * @param {string} label group label.
			 * @param {Array<object>} rows group rows.
			 * @param {boolean} staged whether the group is the index.
			 * @returns {object} the element.
			 */
			function renderGroup(label, rows, staged) {
				if (rows.length === 0) return null
				return h('div', { key: label },
					h('div', { className: 'gc-group' },
						h('span', null, label),
						h('span', { className: 'gc-count' }, String(rows.length)),
						h('span', { className: 'gc-spacer' }),
						h('button', {
							type: 'button',
							className: 'gc-groupaction',
							disabled: busy.length > 0,
							onClick: () => toggleAll(staged),
						}, staged ? t('unstageAll') : t('stageAll'))),
					rows.map(row => h(ChangeRow, {
						key: `change:${staged ? 's' : 'w'}:${row.path}`,
						row,
						active: row.path === selectedPath,
						disabled: busy.length > 0,
						onSelect: setSelectedPath,
						onToggle: toggleRow,
						t,
					})))
			}

			/** The changes body. */
			function renderChanges() {
				return h('div', { className: 'gc-body' },
					h('section', { className: 'gc-col gc-col-list' },
						h('div', { className: 'gc-col-head' },
							h('span', null, t('changes')),
							h('span', { className: 'gc-count' }, changeCount > 0 ? String(changeCount) : '')),
						h('div', { className: 'gc-scroll' },
							worktree.phase === 'loading' ? h('div', { className: 'gc-note' }, t('loading')) : null,
							worktree.phase === 'error'
								? h('div', { className: 'gc-note gc-error' },
									h('div', null, notRepo ? t('notRepo') : `${t('error')}: ${worktree.error}`),
									h('button', { type: 'button', className: 'gc-linkbtn', onClick: () => setReloadToken(token => token + 1) }, t('retry')))
								: null,
							worktree.phase === 'ready' && changeCount === 0 ? h('div', { className: 'gc-note' }, t('clean')) : null,
							renderGroup(t('staged'), worktree.staged, true),
							renderGroup(t('unstaged'), worktree.unstaged.concat(worktree.untracked), false))),
					h('section', { className: 'gc-detail' },
						h('div', { className: 'gc-detail-head' },
							h('div', { className: 'gc-detail-title' }, selectedRow === undefined ? t('changes') : selectedRow.path),
							h('div', { className: 'gc-detail-line' },
								selectedRow === undefined ? null : h('span', { className: `gc-status ${statusClass(selectedRow.status)}` }, statusGlyph(selectedRow.status)),
								selectedRow === undefined ? null : h('span', null, selectedStaged ? t('staged') : t('unstaged')),
								selectedRow === undefined || !hasCounts(selectedRow) ? null : h('span', { className: 'gc-num add' }, `+${selectedRow.additions}`),
								selectedRow === undefined || !hasCounts(selectedRow) ? null : h('span', { className: 'gc-num del' }, `-${selectedRow.deletions}`),
								h('span', { className: 'gc-spacer' }),
								selectedRow === undefined
									? null
									: h('button', {
										type: 'button',
										className: 'gc-linkbtn',
										disabled: busy.length > 0,
										onClick: () => toggleRow(selectedRow),
									}, selectedStaged ? t('unstage') : t('stage')))),
						selectedPath.length === 0
							? h('div', { className: 'gc-center' }, changeCount === 0 ? t('clean') : t('selectFile'))
							: h(DiffView, { diff: workDiff, file: selectedPath, t })))
			}

			/** The history body. */
			function renderHistory() {
				return h('div', { className: 'gc-body' },
					h('section', { className: 'gc-col gc-col-list' },
						h('div', { className: 'gc-col-head' },
							h('span', null, t('commits')),
							h('span', { className: 'gc-count' }, history.commits.length > 0 ? String(history.commits.length) : '')),
						h('div', { className: 'gc-scroll' },
							history.phase === 'loading' ? h('div', { className: 'gc-note' }, t('loading')) : null,
							history.phase === 'error'
								? h('div', { className: 'gc-note gc-error' },
									h('div', null, t('error')),
									h('div', null, history.error),
									h('button', { type: 'button', className: 'gc-linkbtn', onClick: () => setHistoryToken(token => token + 1) }, t('retry')))
								: null,
							history.phase === 'ready' && history.commits.length === 0 ? h('div', { className: 'gc-note' }, t('noCommits')) : null,
							history.commits.map(entry => h(CommitRow, {
								key: entry.hash,
								commit: entry,
								active: entry.hash === historyHash,
								onSelect: setHistoryHash,
							})),
							history.phase === 'ready' && history.hasMore
								? h('button', { type: 'button', className: 'gc-more', disabled: loadingMore, onClick: loadMore }, loadingMore ? t('loading') : t('loadMore'))
								: null)),
					h('section', { className: 'gc-detail' },
						activeCommit === undefined
							? h('div', { className: 'gc-detail-head' },
								h('div', { className: 'gc-detail-line' }, t('commits')))
							: h('div', { className: 'gc-detail-head' },
								h('div', { className: 'gc-detail-title' }, activeCommit.subject),
								h('div', { className: 'gc-detail-line' },
									h('span', { className: 'gc-hash' }, activeCommit.shortHash),
									h('span', null, activeCommit.author),
									h('span', null, formatDate(activeCommit.date)),
									activeCommit.parents.length > 1 ? h('span', null, `merge · ${activeCommit.parents.length}`) : null)),
						h('div', { className: 'gc-split' },
							h('div', { className: 'gc-col-files' },
								h('div', { className: 'gc-col-head' },
									h('span', null, t('files')),
									h('span', { className: 'gc-count' }, historyFiles.phase === 'ready' ? String(historyFiles.list.length) : '')),
								h('div', { className: 'gc-scroll' },
									historyFiles.phase === 'loading' ? h('div', { className: 'gc-note' }, t('loading')) : null,
									historyFiles.phase === 'error' ? h('div', { className: 'gc-note gc-error' }, `${t('error')}: ${historyFiles.error}`) : null,
									historyFiles.phase === 'ready' && historyFiles.list.length === 0 ? h('div', { className: 'gc-note' }, t('noFiles')) : null,
									historyFiles.list.map(file => h(FileRow, {
										key: `${file.status}:${file.path}`,
										file,
										active: file.path === historyFile,
										onSelect: setHistoryFile,
									}))),
							),
							historyFile.length === 0
								? h('div', { className: 'gc-center' },
									historyFiles.phase === 'ready' ? t('selectFile') : '')
								: h(DiffView, { diff: historyDiff, file: historyFile, t }))))
			}

			return h('div', { className: 'gc-panel-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title') },
				h('style', null, PANEL_CSS),
				h('div', { className: 'gc-scrim', onClick: () => setPanelOpen(false) }),
				h('div', { className: 'gc-panel' },
					h('header', { className: 'gc-head' },
						h('span', { className: 'gc-glyph' }, h(BranchIcon)),
						h('div', { className: 'gc-titles' },
							h('span', { className: 'gc-title' }, t('title')),
							h('span', { className: 'gc-subtitle', title: worktree.root || workspacePath || '' }, subtitle)),
						h('div', { className: 'gc-tabs', role: 'tablist' },
							h(Tab, {
								active: view === 'changes',
								label: t('changes'),
								count: changeCount > 0 ? changeCount : null,
								onSelect: () => setView('changes'),
							}),
							h(Tab, {
								active: view === 'history',
								label: t('history'),
								count: null,
								onSelect: () => setView('history'),
							})),
						h('span', { className: 'gc-spacer' }),
						roots.length > 1
							? h('select', {
								className: 'gc-select',
								value: workspacePath,
								'aria-label': t('workspace'),
								onChange: event => setWorkspacePath(event.target.value),
							}, roots.map(item => h('option', { key: item.path, value: item.path }, item.title)))
							: null,
						worktree.upstream.length > 0
							? h('button', {
								type: 'button',
								className: 'gc-syncbtn',
								'data-pending': worktree.behind > 0 ? 'true' : 'false',
								disabled: busy.length > 0 || worktree.phase !== 'ready',
								title: t('syncTitle'),
								onClick: () => sync(),
							},
							busy === 'fetch' ? t('syncing') : t('sync'),
							worktree.behind > 0 ? h('span', { className: 'gc-badge down' }, fill(t('behind'), worktree.behind)) : null,
							worktree.ahead > 0 ? h('span', { className: 'gc-badge' }, fill(t('ahead'), worktree.ahead)) : null)
							: null,
						worktree.behind > 0
							? h('button', {
								type: 'button',
								className: 'gc-syncbtn',
								'data-pending': 'true',
								disabled: busy.length > 0 || worktree.phase !== 'ready',
								title: t('syncTitle'),
								onClick: () => pull(worktree.behind),
							},
							busy === 'pull' ? t('pulling') : fill(t('pullBehind'), worktree.behind))
							: null,
						h('button', {
							type: 'button',
							className: 'gc-iconbtn',
							'aria-label': t('refresh'),
							title: t('refresh'),
							onClick: () => setReloadToken(token => token + 1),
						}, h(RefreshIcon)),
						h('button', {
							type: 'button',
							className: 'gc-iconbtn',
							'aria-label': t('close'),
							title: t('close'),
							onClick: () => setPanelOpen(false),
						}, h(CloseIcon))),
					view === 'changes' ? renderChanges() : renderHistory(),
					conflicts.length > 0
						? h('div', { className: 'gc-conflict', role: 'alert' },
							h('span', { className: 'gc-conflict-text' },
								fill(t('conflicts'), conflicts.length),
								h('span', { className: 'gc-conflict-files' }, ` · ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ` … +${conflicts.length - 3}` : ''}`)),
							h('button', {
								type: 'button',
								className: 'gc-secondary',
								disabled: busy.length > 0,
								onClick: abortMerge,
							}, t('abortMerge')))
						: null,
					view === 'changes'
						? h('div', { className: 'gc-composer' },
							h('div', { className: 'gc-composer-box' },
								h('textarea', {
									className: 'gc-message',
									value: message,
									rows: 2,
									placeholder: t('messagePlaceholder'),
									'aria-label': t('messagePlaceholder'),
									onChange: event => setMessage(event.target.value),
									onKeyDown: (event) => {
										if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
											event.preventDefault()
											commit()
										}
									},
								}),
								h('div', { className: 'gc-composer-foot' },
									h('span', { className: 'gc-hint' },
										t('messageHint'),
										worktree.ahead > 0 ? ` · ${fill(t('ahead'), worktree.ahead)}` : '',
										worktree.behind > 0 ? ` · ${fill(t('behind'), worktree.behind)}` : ''),
									h('button', {
										type: 'button',
										className: 'gc-secondary',
										disabled: !canPush || busy.length > 0,
										onClick: push,
									}, pushLabel),
									h('button', {
										type: 'button',
										className: 'gc-primary',
										disabled: !canCommit || busy.length > 0,
										onClick: commit,
									}, busy === 'commit'
										? t('committing')
										: worktree.staged.length > 0 ? fill(t('commit'), worktree.staged.length) : t('commitIdle')))),
							notice === null ? null : h('div', { className: `gc-notice ${notice.kind}` }, notice.text))
						: null,
					h('footer', { className: 'gc-foot' },
						h('span', null, t('readOnly')),
						h('span', { className: 'gc-foot-path', title: workspacePath }, worktree.upstream.length > 0 ? `${worktree.upstream}` : workspacePath)),
					pullPrompt === null
						? null
						: h('div', { className: 'gc-modal-scrim', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('confirmPull') },
							h('div', { className: 'gc-modal' },
								h('div', { className: 'gc-modal-title' }, fill(t('confirmPull'), pullPrompt.count)),
								h('div', { className: 'gc-modal-body' }, t('confirmPullTitle')),
								h('div', { className: 'gc-modal-row' },
									h('span', null, t('pullMode')),
									h('span', { className: 'gc-spacer' }),
									h('select', {
										className: 'gc-select',
										value: pullMode,
										'aria-label': t('pullMode'),
										onChange: event => setPullMode(event.target.value),
									},
									h('option', { value: 'rebase' }, t('pullModeRebase')),
									h('option', { value: 'merge' }, t('pullModeMerge')))),
								h('div', { className: 'gc-modal-actions' },
									h('button', {
										type: 'button',
										className: 'gc-secondary',
										onClick: () => setPullPrompt(null),
									}, t('close')),
									h('button', {
										type: 'button',
										className: 'gc-primary',
										disabled: busy.length > 0,
										onClick: () => pull(pullPrompt.count),
									}, busy === 'pull' ? t('pulling') : fill(t('confirmPull'), pullPrompt.count)))))
				)
			)
		}

		/**
		 * The sidebar footer button that opens the panel.
		 * @param {{ wide?: boolean, t: Function }} props slot props.
		 * @returns {object} the element.
		 */
		function GitCommitsTrigger(props) {
			const open = usePanelOpen()
			const t = props.t
			return h(React.Fragment, null,
				h('style', null, TRIGGER_CSS),
				h('button', {
					type: 'button',
					className: 'gc-trigger',
					'data-open': open ? 'true' : 'false',
					'aria-expanded': open,
					'aria-label': t('openPanel'),
					title: t('openPanel'),
					onClick: () => setPanelOpen(!open),
				},
				h('span', { className: 'gc-trigger-glyph' }, h(BranchIcon)),
				props.wide === false ? null : h('span', { className: 'gc-trigger-label' }, t('title'))))
		}

		/**
		 * Mount the panel only while it is open.
		 * @param {{ t: Function }} props slot props.
		 * @returns {object | null} the element or null.
		 */
		function GitCommitsOverlay(props) {
			const open = usePanelOpen()
			return open ? h(GitCommitsPanel, { t: props.t }) : null
		}

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'git-commits: dictionaries')
				const t = ctx.locale.bind(NS)
				ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
					name: 'sidebar.footer.action',
					id: 'git-commits',
					order: 10,
					label: () => t('title'),
				}, props => h(GitCommitsTrigger, { wide: props.wide, t })))
				ctx.slots.inject('shell.overlay', () => ctx.slots.register({
					name: 'shell.overlay',
					id: 'git-commits.panel',
					order: 20,
				}, () => h(GitCommitsOverlay, { t })))
			},
		}
	},
})
