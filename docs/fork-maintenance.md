# Maintaining the Pimote fork

## Remotes and deployment branch

`origin` is our fork; `upstream` is the source repository. Check `git remote -v` before fetching or pushing, and never push fork work to `upstream`. The fork's `main` branch is the deployment branch and should match the code currently running. Local `main` tracks `origin/main`; do not keep separate maintenance branches.

Keep the fork as a small, long-lived patch series over upstream. Each commit should be narrowly targeted and self-contained, containing only the code, tests, and documentation for one behavior or dependency change. When follow-up work belongs to an existing change, prefer `git commit --fixup=<commit>` and `git rebase -i --autosquash <old-upstream-base>`, or amend the commit when it is the tip. Apply the same discipline to documentation: fold corrections into the owning docs commit instead of accumulating follow-up documentation commits.

Recover changes from the running package into source files; do not patch the generated install in place. Keep machine-specific configuration, credentials, and data out of Git.

## Resynchronizing with upstream

The default base is the latest **Pimote** release tag (`pimote-vX.Y.Z`), not an SDK tag and not `upstream/main`. Use `upstream/main` only when explicitly requested.

1. Start with a clean worktree and fetch both remotes and release tags:
   ```sh
   git fetch origin --prune
   git fetch upstream --tags
   ```
2. Select the highest-version `pimote-v*` tag (the pattern excludes `sdk-v*`):
   ```sh
   git tag --list 'pimote-v*' --sort=-version:refname | head -n 1
   ```
3. Identify and review the old upstream base of the fork-only commit stack. Replay only fork-specific commits; do not carry forward upstream-only commits from an older `main`:
   ```sh
   git log --oneline <old-upstream-base>..main
   git rebase --onto <latest-pimote-release-tag> <old-upstream-base> main
   ```
   If `main` is explicitly requested, substitute `upstream/main` for `<latest-pimote-release-tag>`.
4. Resolve conflicts in favor of intended fork behavior. Run the checks below, deploy from `main`, and verify the new release and service are healthy. Then move the fork branch to the exact running commit:
   ```sh
   git push --force-with-lease origin main
   ```
   Rebasing rewrites history, so use `--force-with-lease` only after fetching and confirming `origin/main`. If the lease rejects the push, inspect remote history; never use an unconditional force push. Do not overwrite fork-only commits that are not present locally.

## Recovering live changes

Before replacing a running install, inspect its service unit, package version, active release, and separate source worktrees. Compare packaged files with source; put each genuine local delta in its own source commit and add regression tests where practical. Preserve configuration and user data outside the release package. Do not commit ignored local files such as `Makefile.local`, service environment files, or Pimote config/state.

## Build, deploy, and verify

Run `make deploy-paths` before deployment and confirm the install root, service, systemd unit, and environment-file paths. Use a local `Makefile.local` for host-specific overrides; it is intentionally ignored. Validate the changes with:

```sh
npm ci
make build
make check
make lint
make test
make format-check
```

Deploy the tested `main` checkout with `make deploy`. It creates a versioned package release, switches the `current` symlink, updates the user systemd unit, and restarts the service. The installer retains the configured number of releases (three by default) and does not replace Pimote's external configuration or session data. Check `make status`, the recent user-service journal, and the expected local/reverse-proxy endpoint. Push `origin/main` only once the deployed commit is confirmed healthy.
