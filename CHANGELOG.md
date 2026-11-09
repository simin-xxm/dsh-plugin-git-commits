# Changelog

All notable changes to this plugin are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-11-09

### Added

- **Sync** action that runs `git fetch --all --prune` and reports the gap to the upstream with `↑n` / `↓n` badges.
- **Pull** action that integrates incoming commits with rebase (default) or merge, using `--autostash` so uncommitted work survives the pull, and asking for confirmation first.
- Conflict banner listing the conflicted file paths, with an **Abort merge** action (`git rebase --abort` / `merge --abort`).
- `remote` and `conflicts` fields in the status payload.

## [1.0.0] — 2026-11-07

### Added

- Commit history browser with per-commit file lists and unified diffs.
- Changes view with staged / unstaged / untracked groups, per-file staging, and `+n / -n` counts.
- Commit and push actions, both behind an explicit confirmation.
- Workspace selector covering every workspace registered with the host.

[Unreleased]: https://github.com/simin-xxm/dsh-plugin-git-commits/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/simin-xxm/dsh-plugin-git-commits/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/simin-xxm/dsh-plugin-git-commits/releases/tag/v1.0.0
