# CI / リリース

## CI (検証)

`.github/workflows/ci.yml` — `master` への push と全 Pull Request で実行。

- `npm run check:ci` … ESLint・型チェック (vue-tsc)・Prettier を **検査のみ**で実行 (書き換えなし)
- `npm run build` … 本番ビルドが通るかを確認

ローカルでは用途で使い分ける:

- `npm run check` … 自動修正あり (`eslint --fix` / `prettier --write`)
- `npm run check:ci` … 検査のみ (CI と同じ)

## リリース (タグ駆動)

リリースは **`v*` タグの push** で発火する。`master` への push やマージ単体ではリリースされない。

- `.github/workflows/release.stable.yml` — `v*` タグ → ビルドして **draft の GitHub Release** を作成
- `.github/workflows/release.prerelease.yml` — `v*alpha*` / `v*beta*` / `v*rc*` タグ → **draft prerelease** を作成

いずれも `draft: true`。ワークフローが作るのは下書きまでで、**公開は GitHub の Releases 画面で手動**で行う。成果物は `npm run zip` (`wxt zip`) が生成する `.output/ancl-loader-<version>-chrome.zip` (manifest がルートに来るストア向け zip)。

### 手順

1. `master` に変更をマージする (CI が検証)。
2. 版数を上げる: `package.json` の `version` を更新してコミット。
3. そのコミットにタグを打つ: `git tag v3.0.0`
4. タグを push: `git push origin v3.0.0`
5. Actions がビルドして draft Release を作成 → Releases 画面で内容を確認して **Publish**。

> タグはコミットではなく特定コミットを指すポインタ。`master` 上のリリースしたいコミットにタグを打って push する。

### 注意

- 安定版/プレリリースの判定はタグ名で行う。`v3.0.0-alpha.1` のように alpha/beta/rc を含むタグは prerelease に加え stable の `v*` パターンにも一致するため、**両方のワークフローが発火する**。安定版とプレリリースを厳密に分けたい場合は stable 側のパターンを調整する。
