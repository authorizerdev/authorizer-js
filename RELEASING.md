# Release Process

Releases are published to [npm](https://www.npmjs.com/package/@authorizerdev/authorizer-js) automatically via GitHub Actions when a version tag is pushed to `main`.

## Prerequisites

The following secret must be set in the GitHub repo (**Settings → Secrets and variables → Actions**):

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm Automation token with publish access to `@authorizerdev` |
| `REPOCHANGELOG_TOKEN` | GitHub token used to create the release changelog |

To generate an `NPM_TOKEN`: npmjs.com → Account → Access Tokens → Generate New Token → **Automation**.

## Steps

1. **Ensure `main` is clean and up to date**

   ```bash
   git checkout main
   git pull origin main
   git status  # should be clean
   ```

2. **Bump the version in `package.json`**

   Follow [semver](https://semver.org):
   - `patch` (e.g. `3.2.0` → `3.2.1`) — bug fixes, CI/tooling changes
   - `minor` (e.g. `3.2.0` → `3.3.0`) — new backwards-compatible features
   - `major` (e.g. `3.2.0` → `4.0.0`) — breaking changes

   ```bash
   # Edit package.json manually, or use bumpp interactively:
   pnpm bumpp
   ```

   If using `bumpp`, it will prompt for the version, then commit, tag, and push automatically — skip steps 3–5.

3. **Commit the version bump**

   ```bash
   git add package.json
   git commit -m "chore: release v<version>"
   ```

4. **Create the tag**

   ```bash
   git tag v<version>
   ```

5. **Push the commit and tag**

   ```bash
   git push origin main --tags
   ```

## What Happens Next

Pushing the tag triggers the `.github/workflows/release.yml` workflow which:

1. Installs dependencies with pnpm
2. Builds the package (`pnpm build`)
3. Publishes to npm (`pnpm publish`)
4. Creates a GitHub Release with an auto-generated changelog

Monitor the run in the **Actions** tab of the repository.

## Beta / RC Releases

For pre-releases, use a pre-release tag:

```bash
# beta
npm version 3.3.0-beta.1
git push origin main --tags

# Then publish manually with the right tag:
pnpm publish --tag beta
```

> Pre-release versions are not published automatically by the CI workflow — only `v*` tags without a pre-release suffix trigger the full pipeline.
