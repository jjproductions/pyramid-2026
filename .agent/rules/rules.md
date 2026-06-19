# Workspace Rules

This file defines project-specific guidelines and automated workflows for the Antigravity IDE agent when working in this repository.

## Automated Git Workflows

### git-bump
If the user starts or ends their message with the keyword combination `[git-bump]` (or `[git-pushme]`):
The agent must:
1. Scan the git history (`git log -n 5`) to find the latest version prefix in the format `Beta 1.0.X` (or similar).
2. Increment the patch version sequentially (e.g. from `Beta 1.0.10` to `Beta 1.0.11`).
3. Generate a concise commit message detailing the currently staged changes.
4. Execute `git commit` and `git push` to the active branch automatically.
