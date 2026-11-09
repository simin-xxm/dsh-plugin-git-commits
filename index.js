/**
 * Git commits — Host half.
 *
 * Serves read-only repository history and the working-tree state for the
 * workspaces this profile knows about, plus the three write operations the
 * panel offers: stage/unstage, commit, and push. Every query and write is
 * restricted to a registered workspace path, and only `GET` reads and
 * same-origin `POST` writes are accepted.
 */
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, resolve as resolvePath } from 'node:path'

const ROUTE_PATH = '/git-commits-api'
const WRITE_PATH = '/git-commits-write'
const MAX_DIFF_CHARS = 400_000
const MAX_PREVIEW_BYTES = 400_000
const MAX_LOG_LIMIT = 200
const DEFAULT_LOG_LIMIT = 30
const RECORD_SEPARATOR = '\u001e'
const FIELD_SEPARATOR = '\u001f'
const READ_TIMEOUT_MS = 20_000
const WRITE_TIMEOUT_MS = 120_000

export const name = 'git-commits'
export const inject = ['webServer']

/** Absolute `git` binary once a candidate resolved; every later call reuses it. */
let gitBinary
const GIT_CANDIDATES = [
  process.env.DSH_GIT_BINARY,
  'git',
  '/usr/bin/git',
  '/opt/homebrew/bin/git',
  '/usr/local/bin/git',
].filter(candidate => typeof candidate === 'string' && candidate.length > 0)

/**
 * Run one executable and capture its streams without rejecting.
 * @param {string} file executable path or bare name.
 * @param {readonly string[]} args argv without the executable.
 * @param {number} timeoutMs kill the child after this long.
 * @returns {Promise<{ error: (Error & { code?: string }) | null, stdout: string, stderr: string }>}
 */
function run(file, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, args, {
      maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs,
      windowsHide: true,
      env: { ...process.env, GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    }, (error, stdout, stderr) => resolve({
      error: error ?? null,
      stdout: String(stdout ?? ''),
      stderr: String(stderr ?? ''),
    }))
  })
}

/**
 * Turn a failed command's output into a short, readable message.
 * @param {{ stdout: string, stderr: string }} result captured streams.
 * @returns {string} the last meaningful lines.
 */
function failureMessage(result) {
  const text = result.stderr.trim().length > 0 ? result.stderr : result.stdout
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  return lines.slice(-6).join('\n').trim() || 'the git command failed'
}

/**
 * Run `git -C <directory> <args>` and return stdout.
 * @param {string} directory working directory.
 * @param {readonly string[]} args git arguments.
 * @param {number} timeoutMs kill the child after this long.
 * @returns {Promise<string>} stdout.
 */
async function git(directory, args, timeoutMs = READ_TIMEOUT_MS) {
  const argv = ['-C', directory, ...args]
  if (gitBinary !== undefined) {
    const result = await run(gitBinary, argv, timeoutMs)
    if (result.error !== null) throw new Error(failureMessage(result))
    return result.stdout
  }
  for (const candidate of GIT_CANDIDATES) {
    const result = await run(candidate, argv, timeoutMs)
    if (result.error !== null && result.error.code === 'ENOENT') continue
    gitBinary = candidate
    if (result.error !== null) throw new Error(failureMessage(result))
    return result.stdout
  }
  throw new Error('git executable not found; set DSH_GIT_BINARY to its absolute path')
}

/**
 * Build a JSON response.
 * @param {unknown} body payload.
 * @param {number} status HTTP status.
 * @returns {Response} the response.
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Reject a path that could escape the repository or look like an option.
 * @param {unknown} value candidate path.
 * @returns {boolean} whether the path is a plain repository-relative path.
 */
function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.startsWith('/') || value.startsWith('\\') || value.startsWith('-')) return false
  if (/^[a-z]:/i.test(value)) return false
  return !value.split(/[\\/]/).includes('..')
}

/**
 * Every directory this plugin may read history from: registered workspaces
 * first, then the profile's default working directory when it is not one.
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @returns {Array<{ id: string, title: string, path: string }>} allowed roots.
 */
function listRoots(ctx) {
  const roots = []
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined && typeof registry.list === 'function') {
    for (const workspace of registry.list()) {
      if (workspace === null || typeof workspace.path !== 'string' || workspace.path.length === 0) continue
      const title = typeof workspace.title === 'string' && workspace.title.length > 0
        ? workspace.title
        : basename(workspace.path)
      roots.push({ id: String(workspace.id), title, path: workspace.path })
    }
  }
  const workingDirectory = ctx.get('workingDirectory')
  const fallback = workingDirectory === undefined ? undefined : workingDirectory.defaultDirectory
  if (typeof fallback === 'string' && fallback.length > 0) {
    const known = roots.some(root => resolvePath(root.path) === resolvePath(fallback))
    if (!known) roots.push({ id: 'default', title: basename(fallback), path: fallback })
  }
  return roots
}

/**
 * Parse one `git log` record into a commit entry.
 * @param {string} record one record without separators.
 * @returns {object | null} the entry, or null when malformed.
 */
function parseCommit(record) {
  const fields = record.split(FIELD_SEPARATOR)
  if (fields.length < 6) return null
  return {
    hash: fields[0],
    shortHash: fields[1],
    author: fields[2],
    date: fields[3],
    parents: fields[4].split(' ').filter(Boolean),
    subject: fields[5],
  }
}

/**
 * Run git and return both streams instead of throwing on failure.
 * @param {string} directory working directory.
 * @param {readonly string[]} args git arguments.
 * @param {number} timeoutMs kill the child after this long.
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string }>} the outcome.
 */
async function gitFull(directory, args, timeoutMs = READ_TIMEOUT_MS) {
  const argv = ['-C', directory, ...args]
  if (gitBinary !== undefined) {
    const result = await run(gitBinary, argv, timeoutMs)
    return { ok: result.error === null, stdout: result.stdout, stderr: result.stderr }
  }
  for (const candidate of GIT_CANDIDATES) {
    const result = await run(candidate, argv, timeoutMs)
    if (result.error !== null && result.error.code === 'ENOENT') continue
    gitBinary = candidate
    return { ok: result.error === null, stdout: result.stdout, stderr: result.stderr }
  }
  throw new Error('git executable not found; set DSH_GIT_BINARY to its absolute path')
}

/**
 * Read the upstream tracking ref of the current branch.
 * @param {string} repoRoot repository root.
 * @returns {Promise<string>} the upstream ref, or `''` when the branch has none.
 */
async function readUpstreamName(repoRoot) {
  try {
    return (await git(repoRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])).trim()
  }
  catch {
    return ''
  }
}

/**
 * Count how many commits the branch is ahead of and behind its upstream.
 * @param {string} repoRoot repository root.
 * @returns {Promise<{ ahead: number, behind: number }>} the two counts.
 */
async function readAheadBehind(repoRoot) {
  try {
    const counts = (await git(repoRoot, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])).trim().split(/\s+/)
    return { behind: Number(counts[0] ?? 0) || 0, ahead: Number(counts[1] ?? 0) || 0 }
  }
  catch {
    return { ahead: 0, behind: 0 }
  }
}

/**
 * List the paths git left unmerged after a failed merge or rebase.
 * @param {string} repoRoot repository root.
 * @returns {Promise<string[]>} the conflicted paths.
 */
async function readConflicts(repoRoot) {
  const stdout = await git(repoRoot, ['diff', '--name-only', '--diff-filter=U']).catch(() => '')
  return stdout.split('\n').filter(path => path.length > 0)
}

/**
 * Read the branch name, tolerating a detached HEAD and a missing remote.
 * @param {string} repoRoot repository root.
 * @returns {Promise<string>} the branch, or `''`.
 */
async function readBranch(repoRoot) {
  try {
    const branch = (await git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    return branch === 'HEAD' ? '' : branch
  }
  catch {
    return ''
  }
}

/**
 * Resolve the first parent of a commit; empty for a root commit.
 * @param {string} repoRoot repository root.
 * @param {string} hash commit hash.
 * @returns {Promise<string>} the first parent, or `''`.
 */
async function readFirstParent(repoRoot, hash) {
  const line = (await git(repoRoot, ['rev-list', '--parents', '-n', '1', hash])).trim()
  const parents = line.split(/\s+/).slice(1).filter(Boolean)
  return parents[0] ?? ''
}

/**
 * List one page of commits.
 * @param {string} root requested directory.
 * @param {number} limit page size.
 * @param {number} skip number of commits to skip.
 * @returns {Promise<object>} the page.
 */
async function readLog(root, limit, skip) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const format = `${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%s`
  const stdout = await git(repoRoot, [
    'log',
    '--date-order',
    `--max-count=${limit + 1}`,
    `--skip=${skip}`,
    `--pretty=format:${format}`,
  ])
  const commits = stdout
    .split(RECORD_SEPARATOR)
    .map(record => record.replace(/^\n+/, ''))
    .filter(record => record.length > 0)
    .map(parseCommit)
    .filter(entry => entry !== null)
  return {
    isRepo: true,
    root: repoRoot,
    branch: await readBranch(repoRoot),
    commits: commits.slice(0, limit),
    hasMore: commits.length > limit,
  }
}

/**
 * Parse `--numstat` output into a path-keyed count map.
 * @param {string} stdout raw numstat output.
 * @returns {Map<string, { additions: number, deletions: number, binary: boolean }>} counts.
 */
function parseNumstat(stdout) {
  const counts = new Map()
  for (const line of stdout.split('\n')) {
    const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line)
    if (match === null) continue
    counts.set(match[3], {
      additions: match[1] === '-' ? 0 : Number(match[1]),
      deletions: match[2] === '-' ? 0 : Number(match[2]),
      binary: match[1] === '-',
    })
  }
  return counts
}

/**
 * List the files one commit changed against its first parent.
 * @param {string} root requested directory.
 * @param {string} hash commit hash.
 * @returns {Promise<object>} the file list.
 */
async function readFiles(root, hash) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const parent = await readFirstParent(repoRoot, hash)
  const base = parent === ''
    ? { status: ['show', '--no-color', '--format=', '-M', '--name-status', hash], numstat: ['show', '--no-color', '--format=', '-M', '--numstat', hash] }
    : { status: ['diff', '--no-color', '-M', '--name-status', parent, hash], numstat: ['diff', '--no-color', '-M', '--numstat', parent, hash] }
  const [statusOutput, numstatOutput] = await Promise.all([
    git(repoRoot, base.status),
    git(repoRoot, base.numstat),
  ])
  const counts = parseNumstat(numstatOutput)
  const files = []
  for (const line of statusOutput.split('\n')) {
    if (line.length === 0) continue
    const parts = line.split('\t')
    const code = parts[0] ?? ''
    if (code.length === 0) continue
    const status = code.charAt(0)
    const renamed = status === 'R' || status === 'C'
    const path = renamed ? parts[2] : parts[1]
    if (path === undefined || path.length === 0) continue
    const previousPath = renamed ? parts[1] : undefined
    const count = counts.get(path)
      ?? (previousPath === undefined ? undefined : counts.get(previousPath))
      ?? { additions: 0, deletions: 0, binary: false }
    files.push({
      path,
      previousPath: previousPath ?? null,
      status,
      additions: count.additions,
      deletions: count.deletions,
      binary: count.binary,
    })
  }
  return { hash, root: repoRoot, parent, files }
}

/**
 * Read the unified diff of one file in one commit.
 * @param {string} root requested directory.
 * @param {string} hash commit hash.
 * @param {string} file repository-relative path.
 * @returns {Promise<object>} the diff.
 */
async function readDiff(root, hash, file) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const parent = await readFirstParent(repoRoot, hash)
  const args = parent === ''
    ? ['show', '--no-color', '--format=', '-M', hash, '--', file]
    : ['diff', '--no-color', '-M', parent, hash, '--', file]
  const stdout = await git(repoRoot, args)
  const truncated = stdout.length > MAX_DIFF_CHARS
  return {
    hash,
    file,
    diff: truncated ? stdout.slice(0, MAX_DIFF_CHARS) : stdout,
    truncated,
  }
}

/**
 * Parse `git status --porcelain=v1 -z` into staged, unstaged and untracked rows.
 * @param {string} stdout NUL-separated status output.
 * @returns {{ staged: Array<object>, unstaged: Array<object>, untracked: Array<object> }} grouped rows.
 */
function parseStatus(stdout) {
  const parts = stdout.split('\u0000')
  const entries = []
  let index = 0
  while (index < parts.length) {
    const token = parts[index]
    index += 1
    if (token.length < 4) continue
    const indexStatus = token[0]
    const worktreeStatus = token[1]
    const path = token.slice(3)
    let previousPath = null
    if (indexStatus === 'R' || indexStatus === 'C' || worktreeStatus === 'R' || worktreeStatus === 'C') {
      previousPath = parts[index] ?? null
      index += 1
    }
    if (path.length === 0) continue
    entries.push({ path, previousPath, indexStatus, worktreeStatus })
  }
  const staged = []
  const unstaged = []
  const untracked = []
  for (const entry of entries) {
    if (entry.indexStatus === '?') {
      untracked.push({ path: entry.path, previousPath: null, status: '?', staged: false, additions: 0, deletions: 0, binary: false })
      continue
    }
    if (entry.indexStatus !== ' ') {
      staged.push({ path: entry.path, previousPath: entry.previousPath, status: entry.indexStatus, staged: true, additions: 0, deletions: 0, binary: false })
    }
    if (entry.worktreeStatus !== ' ') {
      unstaged.push({ path: entry.path, previousPath: entry.previousPath, status: entry.worktreeStatus, staged: false, additions: 0, deletions: 0, binary: false })
    }
  }
  return { staged, unstaged, untracked }
}

/**
 * Attach `+n / -n` counts to status rows from one numstat map.
 * @param {Array<object>} rows status rows.
 * @param {Map<string, { additions: number, deletions: number, binary: boolean }>} counts counts by path.
 */
function applyCounts(rows, counts) {
  for (const row of rows) {
    const count = counts.get(row.path)
      ?? (row.previousPath === null ? undefined : counts.get(row.previousPath))
    if (count === undefined) continue
    row.additions = count.additions
    row.deletions = count.deletions
    row.binary = count.binary
  }
}

/**
 * Read the working-tree state, its staged/unstaged counts, and the upstream gap.
 * @param {string} root requested directory.
 * @returns {Promise<object>} the status payload.
 */
async function readStatus(root) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const [statusOutput, stagedNumstat, unstagedNumstat] = await Promise.all([
    git(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(repoRoot, ['diff', '--numstat', '--cached']).catch(() => ''),
    git(repoRoot, ['diff', '--numstat']).catch(() => ''),
  ])
  const groups = parseStatus(statusOutput)
  applyCounts(groups.staged, parseNumstat(stagedNumstat))
  applyCounts(groups.unstaged, parseNumstat(unstagedNumstat))

  const upstream = await readUpstreamName(repoRoot)
  const { ahead, behind } = upstream.length > 0 ? await readAheadBehind(repoRoot) : { ahead: 0, behind: 0 }
  const remote = upstream.includes('/') ? upstream.slice(0, upstream.indexOf('/')) : ''
  return {
    root: repoRoot,
    branch: await readBranch(repoRoot),
    upstream,
    remote,
    ahead,
    behind,
    conflicts: await readConflicts(repoRoot),
    staged: groups.staged,
    unstaged: groups.unstaged,
    untracked: groups.untracked,
  }
}

/**
 * Render an untracked file as an all-added diff, so the panel can show it.
 * @param {string} repoRoot repository root.
 * @param {string} file repository-relative path.
 * @returns {Promise<string>} a diff, or `''` when the file cannot be read.
 */
async function readUntrackedDiff(repoRoot, file) {
  const absolute = resolvePath(repoRoot, file)
  if (!absolute.startsWith(`${repoRoot}/`) && absolute !== repoRoot) return ''
  let buffer
  try {
    buffer = await readFile(absolute)
  }
  catch {
    return ''
  }
  const sample = buffer.subarray(0, 8000)
  if (sample.includes(0)) {
    return `diff --git a/${file} b/${file}\nnew file mode 100644\nBinary files /dev/null and b/${file} differ\n`
  }
  const body = buffer.toString('utf8').slice(0, MAX_PREVIEW_BYTES)
  const lines = body.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const rendered = lines.map(line => `+${line}`).join('\n')
  return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${rendered}\n`
}

/**
 * Read one file's working-tree diff against the index or against HEAD.
 * @param {string} root requested directory.
 * @param {string} file repository-relative path.
 * @param {boolean} staged compare the index against HEAD instead of the worktree.
 * @returns {Promise<object>} the diff.
 */
async function readWorkdiff(root, file, staged) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const args = staged
    ? ['diff', '--no-color', '-M', '--cached', '--', file]
    : ['diff', '--no-color', '-M', '--', file]
  let stdout = await git(repoRoot, args)
  if (stdout.length === 0 && !staged) stdout = await readUntrackedDiff(repoRoot, file)
  const truncated = stdout.length > MAX_DIFF_CHARS
  return {
    root: repoRoot,
    file,
    staged,
    diff: truncated ? stdout.slice(0, MAX_DIFF_CHARS) : stdout,
    truncated,
  }
}

/**
 * Stage one path set or everything.
 * @param {string} root requested directory.
 * @param {string[]} files repository-relative paths.
 * @param {boolean} all stage the whole working tree.
 * @returns {Promise<object>} the command report.
 */
async function stageFiles(root, files, all) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const args = all ? ['add', '-A', '--', '.'] : ['add', '--', ...files]
  await git(repoRoot, args, WRITE_TIMEOUT_MS)
  return { root: repoRoot, command: `git ${args.join(' ')}` }
}

/**
 * Unstage one path set or everything.
 * @param {string} root requested directory.
 * @param {string[]} files repository-relative paths.
 * @param {boolean} all unstage the whole index.
 * @returns {Promise<object>} the command report.
 */
async function unstageFiles(root, files, all) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const pathspec = all ? ['.'] : files
  try {
    await git(repoRoot, ['reset', '-q', 'HEAD', '--', ...pathspec], WRITE_TIMEOUT_MS)
    return { root: repoRoot, command: `git reset -q HEAD -- ${pathspec.join(' ')}` }
  }
  catch (error) {
    // A repository without any commit has no HEAD to reset against.
    if (!/ambiguous argument 'HEAD'|unknown revision|does not have any commits yet/i.test(String(error?.message ?? ''))) throw error
    await git(repoRoot, ['rm', '-r', '-q', '--cached', '--', ...pathspec], WRITE_TIMEOUT_MS)
    return { root: repoRoot, command: `git rm -r -q --cached -- ${pathspec.join(' ')}` }
  }
}

/**
 * Create one commit from the staged changes.
 * @param {string} root requested directory.
 * @param {string} message commit message.
 * @returns {Promise<object>} the command report.
 */
async function createCommit(root, message) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const staged = (await git(repoRoot, ['diff', '--cached', '--name-only'])).trim()
  if (staged.length === 0) throw new Error('nothing staged to commit')
  const stdout = await git(repoRoot, ['commit', '-m', message], WRITE_TIMEOUT_MS)
  return { root: repoRoot, output: stdout.trim(), command: 'git commit' }
}

/**
 * Push the current branch, setting its upstream on the first push.
 * @param {string} root requested directory.
 * @returns {Promise<object>} the command report.
 */
async function pushBranch(root) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  let upstream = ''
  try {
    upstream = (await git(repoRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])).trim()
  }
  catch {
    upstream = ''
  }
  const args = upstream.length > 0 ? ['push'] : ['push', '-u', 'origin', 'HEAD']
  const stdout = await git(repoRoot, args, WRITE_TIMEOUT_MS)
  return {
    root: repoRoot,
    output: stdout.trim(),
    command: `git ${args.join(' ')}`,
    upstreamSet: upstream.length === 0,
  }
}

/**
 * List the commits the upstream has that the local branch does not.
 * @param {string} repoRoot repository root.
 * @param {number} limit how many commits to list.
 * @returns {Promise<Array<object>>} the incoming commits.
 */
async function readIncoming(repoRoot, limit = 20) {
  const stdout = await git(repoRoot, [
    'log',
    '--no-merges',
    `--max-count=${limit}`,
    '--pretty=format:%H%x1f%h%x1f%an%x1f%s',
    'HEAD..@{upstream}',
  ]).catch(() => '')
  const commits = []
  for (const line of stdout.split('\n')) {
    const fields = line.split('\u001f')
    if (fields.length < 4) continue
    commits.push({ hash: fields[0], shortHash: fields[1], author: fields[2], subject: fields[3] })
  }
  return commits
}

/**
 * Fetch every remote and prune deleted refs, then report the new gap.
 * @param {string} root requested directory.
 * @returns {Promise<object>} the command report.
 */
async function fetchRemote(root) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const result = await gitFull(repoRoot, ['fetch', '--all', '--prune'], WRITE_TIMEOUT_MS)
  if (!result.ok) throw new Error(failureMessage(result))
  const upstream = await readUpstreamName(repoRoot)
  const { ahead, behind } = upstream.length > 0 ? await readAheadBehind(repoRoot) : { ahead: 0, behind: 0 }
  return {
    root: repoRoot,
    output: (result.stderr.trim().length > 0 ? result.stderr : result.stdout).trim(),
    upstream,
    ahead,
    behind,
    incoming: await readIncoming(repoRoot),
  }
}

/**
 * Pull the upstream into the current branch, stashing local edits first.
 * @param {string} root requested directory.
 * @param {'rebase' | 'merge'} mode how to integrate the upstream.
 * @returns {Promise<object>} the command report.
 */
async function pullBranch(root, mode) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  const upstream = await readUpstreamName(repoRoot)
  if (upstream.length === 0) throw new Error('no-upstream')
  const args = mode === 'merge'
    ? ['pull', '--no-rebase', '--autostash']
    : ['pull', '--rebase', '--autostash']
  const result = await gitFull(repoRoot, args, WRITE_TIMEOUT_MS)
  const conflicts = await readConflicts(repoRoot)
  const { ahead, behind } = await readAheadBehind(repoRoot)
  if (!result.ok) {
    const error = new Error(failureMessage(result))
    error.conflicts = conflicts
    error.output = (result.stderr.trim().length > 0 ? result.stderr : result.stdout).trim()
    throw error
  }
  return {
    root: repoRoot,
    output: (result.stdout.trim().length > 0 ? result.stdout : result.stderr).trim(),
    upstream,
    ahead,
    behind,
    conflicts,
    mode,
  }
}

/**
 * Abort an in-progress merge, rebase, or cherry-pick.
 * @param {string} root requested directory.
 * @returns {Promise<object>} the command report.
 */
async function abortOperation(root) {
  const repoRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim()
  for (const args of [['rebase', '--abort'], ['merge', '--abort'], ['cherry-pick', '--abort']]) {
    const result = await gitFull(repoRoot, args, WRITE_TIMEOUT_MS)
    if (result.ok) return { root: repoRoot, command: `git ${args.join(' ')}` }
  }
  throw new Error('nothing-to-abort')
}

/**
 * Bound a numeric query parameter.
 * @param {URLSearchParams} params query parameters.
 * @param {string} name parameter name.
 * @param {number} fallback default when absent or unparsable.
 * @param {number} min lower bound.
 * @param {number} max upper bound.
 * @returns {number} the bounded value.
 */
function readNumber(params, name, fallback, min, max) {
  const raw = Number(params.get(name))
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(raw)))
}

/**
 * Answer one read request.
 * @param {URL} url request URL.
 * @param {{ path: string }} root allowed workspace.
 * @returns {Promise<Response>} the response.
 */
async function handleRead(url, root) {
  const operation = url.pathname.slice(ROUTE_PATH.length).replace(/^\/+|\/+$/g, '')
  if (operation === 'log') {
    const limit = readNumber(url.searchParams, 'limit', DEFAULT_LOG_LIMIT, 1, MAX_LOG_LIMIT)
    const skip = readNumber(url.searchParams, 'skip', 0, 0, 100_000)
    return jsonResponse({ ok: true, ...(await readLog(root.path, limit, skip)) })
  }
  if (operation === 'status') return jsonResponse({ ok: true, ...(await readStatus(root.path)) })
  if (operation === 'files') {
    const hash = url.searchParams.get('hash') ?? ''
    if (!/^[0-9a-f]{4,64}$/i.test(hash)) return jsonResponse({ ok: false, error: 'invalid-hash' }, 400)
    return jsonResponse({ ok: true, ...(await readFiles(root.path, hash)) })
  }
  if (operation === 'diff') {
    const hash = url.searchParams.get('hash') ?? ''
    const file = url.searchParams.get('file') ?? ''
    if (!/^[0-9a-f]{4,64}$/i.test(hash)) return jsonResponse({ ok: false, error: 'invalid-hash' }, 400)
    if (!isSafeRelativePath(file)) return jsonResponse({ ok: false, error: 'invalid-file' }, 400)
    return jsonResponse({ ok: true, ...(await readDiff(root.path, hash, file)) })
  }
  if (operation === 'workdiff') {
    const file = url.searchParams.get('file') ?? ''
    if (!isSafeRelativePath(file)) return jsonResponse({ ok: false, error: 'invalid-file' }, 400)
    const staged = url.searchParams.get('staged') === '1'
    return jsonResponse({ ok: true, ...(await readWorkdiff(root.path, file, staged)) })
  }
  return jsonResponse({ ok: false, error: 'unknown-operation' }, 404)
}

/**
 * Answer one write operation.
 * @param {string} operation route suffix.
 * @param {{ path: string }} root allowed workspace.
 * @param {Record<string, unknown>} body parsed request body.
 * @returns {Promise<{ status: number, body: object }>} the response.
 */
async function handleWrite(operation, root, body) {
  try {
    if (operation === 'stage' || operation === 'unstage') {
      const all = body.all === true
      const files = Array.isArray(body.files) ? body.files.filter(isSafeRelativePath) : []
      if (!all && files.length === 0) return { status: 400, body: { ok: false, error: 'no-files' } }
      const report = operation === 'stage'
        ? await stageFiles(root.path, files, all)
        : await unstageFiles(root.path, files, all)
      return { status: 200, body: { ok: true, ...report } }
    }
    if (operation === 'commit') {
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (message.length === 0) return { status: 400, body: { ok: false, error: 'empty-message' } }
      if (message.length > 5000) return { status: 400, body: { ok: false, error: 'message-too-long' } }
      return { status: 200, body: { ok: true, ...(await createCommit(root.path, message)) } }
    }
    if (operation === 'push') {
      return { status: 200, body: { ok: true, ...(await pushBranch(root.path)) } }
    }
    if (operation === 'fetch') {
      return { status: 200, body: { ok: true, ...(await fetchRemote(root.path)) } }
    }
    if (operation === 'pull') {
      const mode = body.mode === 'merge' ? 'merge' : 'rebase'
      return { status: 200, body: { ok: true, ...(await pullBranch(root.path, mode)) } }
    }
    if (operation === 'abort') {
      return { status: 200, body: { ok: true, ...(await abortOperation(root.path)) } }
    }
    return { status: 404, body: { ok: false, error: 'unknown-operation' } }
  }
  catch (error) {
    const body = { ok: false, error: error instanceof Error ? error.message : String(error) }
    if (Array.isArray(error?.conflicts)) body.conflicts = error.conflicts
    if (typeof error?.output === 'string') body.output = error.output
    return { status: 200, body }
  }
}

/**
 * Write one JSON response to a raw HTTP response.
 * @param {import('node:http').ServerResponse} res response to complete.
 * @param {number} status HTTP status.
 * @param {unknown} body payload.
 */
function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

/**
 * Read a small request body.
 * @param {import('node:http').IncomingMessage} req request stream.
 * @returns {Promise<string>} the body text.
 */
async function readRequestBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) throw new Error('body-too-large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Answer one write over HTTP. The read side is a resource route, which only
 * serves GET/HEAD, so writes get their own raw route.
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {import('node:http').IncomingMessage} req incoming request.
 * @param {import('node:http').ServerResponse} res outgoing response.
 */
async function handleWriteRequest(ctx, req, res) {
  try {
    const method = String(req.method ?? 'GET').toUpperCase()
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      return
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const origin = req.headers.origin
    const host = req.headers.host
    if (origin !== undefined && host !== undefined) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      }
      catch {
        originHost = ''
      }
      if (originHost !== host) {
        sendJson(res, 403, { ok: false, error: 'cross-origin-write' })
        return
      }
    }
    const text = await readRequestBody(req)
    let body = {}
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text)
      }
      catch {
        sendJson(res, 400, { ok: false, error: 'invalid-body' })
        return
      }
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, { ok: false, error: 'invalid-body' })
      return
    }
    const operation = url.pathname.slice(WRITE_PATH.length).replace(/^\/+|\/+$/g, '')
    const requested = url.searchParams.get('path') ?? ''
    if (requested.length === 0) {
      sendJson(res, 400, { ok: false, error: 'missing-path' })
      return
    }
    const root = listRoots(ctx).find(item => item.path === requested || resolvePath(item.path) === resolvePath(requested))
    if (root === undefined) {
      sendJson(res, 403, { ok: false, error: 'unknown-workspace' })
      return
    }
    const result = await handleWrite(operation, root, body)
    sendJson(res, result.status, result.body)
  }
  catch (error) {
    try {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
    catch {
      // The socket is already gone; nothing left to report.
    }
  }
}

/**
 * Answer one read request over the resource route.
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {Request} request incoming request.
 * @returns {Promise<Response>} the response.
 */
async function handleRequest(ctx, request) {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({ ok: false, error: 'method-not-allowed' }, 405)
    }
    const url = new URL(request.url)
    const operation = url.pathname.slice(ROUTE_PATH.length).replace(/^\/+|\/+$/g, '')
    const roots = listRoots(ctx)
    if (operation === 'workspaces') return jsonResponse({ ok: true, workspaces: roots })

    const requested = url.searchParams.get('path') ?? ''
    if (requested.length === 0) return jsonResponse({ ok: false, error: 'missing-path' }, 400)
    const root = roots.find(item => item.path === requested || resolvePath(item.path) === resolvePath(requested))
    if (root === undefined) return jsonResponse({ ok: false, error: 'unknown-workspace' }, 403)

    return await handleRead(url, root)
  }
  catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Register the history route and the write route.
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_PATH,
    resource: request => handleRequest(ctx, request),
  }), 'git-commits: repository reads')
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: WRITE_PATH,
    handler: (req, res) => {
      handleWriteRequest(ctx, req, res)
    },
  }), 'git-commits: repository writes')
}
