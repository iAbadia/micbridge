# Releases built by GitHub

The **Release packages** workflow builds Windows x64, Linux x64, macOS Apple Silicon, and macOS Intel downloads on GitHub runners. It tests each build, bundles license notices, and generates SHA-256 checksums. No personal access token is needed: only the final draft-release job receives repository contents write permission.

## Try the workflow without creating a release

Windows artifacts contain both `*-setup.exe` (installation wizard) and `*-portable.exe` (run without installing). The setup wizard lets users select installation for themselves or all users and choose the destination folder. All-users installation requires administrator approval. It creates desktop and Start menu shortcuts and registers an uninstaller; uninstalling preserves phone pairing, certificates, and other app data.

In GitHub, open **Actions → Release packages → Run workflow**, select `main`, and leave **Create a draft release** unchecked. The four platform downloads appear as workflow artifacts. This is also useful for testing packaging changes before tagging.

## Prepare a new version

1. Update `package.json` and `package-lock.json` together (for example, `npm version 0.3.1 --no-git-tag-version`).
2. Write `docs/RELEASE-v0.3.1.md` with the actual changes, platform validation, and limitations. Without a version-specific file, the workflow uses `docs/RELEASE-NOTES.md`.
3. Commit and push the version change, then create and push the matching tag:

```sh
git tag -a v0.3.1 -m "Micbridge 0.3.1 preview"
git push origin v0.3.1
```

Pushing the tag starts all four builds. Only after all builds pass does GitHub create a **draft prerelease** containing the packages, platform license archives, and a combined `SHA256SUMS.txt`.

Review the downloads and notes under **Releases**, test the relevant platforms, and click **Publish release** when ready. Packaging alone does not verify phone capture or virtual microphone routing on real hardware. The builds are unsigned and the macOS builds are unnotarized; signing is a separate future setup.

## Retry a failed build

Use **Re-run failed jobs** in Actions. For an existing tag that contains this workflow, you can also run the workflow manually, select that tag, and check **Create a draft release**. A retry can update draft assets; it refuses to replace an already published release. Never move a published version tag to another commit.

The existing v0.3.0 release was built locally and predates this workflow. Future version tags include the workflow and use GitHub builds.
