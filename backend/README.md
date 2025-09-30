Windows 向けに Bun のバンドラで単体実行ファイル（exe）を作成する手順

このリポジトリの backend ディレクトリにあるエントリポイント（例: `src/cli.ts` や `server.ts`）を Bun のバンドラでコンパイルして、Bun 実行ファイルを内包した単一の実行ファイルを生成する手順をまとめます。

注意: Bun の `--compile` は生成物に Bun バイナリを含めるため、出力ファイルは比較的大きくなります。Windows 向けにアイコン設定やコンソール表示の抑制オプションも提供されています。

1) 事前準備

- Windows 上で Bun がインストールされていることを確認してください。PowerShell で以下を実行してバージョン確認できます。

```powershell
bun --version
```

- backend のエントリポイントファイルパスを把握します（例: `./src/index.ts`、`./cli.ts` など）。

2) シンプルな exe を作る（CLI 例）

最も単純な例として、エントリポイント `./cli.ts` を単一の実行可能ファイルにするコマンドは次の通りです。

```powershell
bun build --compile --outfile my-backend.exe ./cli.ts
```

オプション解説:
- `--compile` : 単体実行ファイルとしてビルド（Bun バイナリを同梱）。
- `--outfile <name>` : 出力ファイル名。Windows では `.exe` を付けると実行ファイルになります。

3) よく使うオプション（CLI）

- `--production` : NODE_ENV=production を設定し、最適化を有効にします（`--compile` と一緒に使うことが多い）。
- `--windows-hide-console` : Windows で実行時にコンソールウィンドウを表示させたくない場合に付けます（GUI アプリ向け）。
- `--windows-icon=<path>` : Windows 実行ファイルにアイコンを埋め込みます（ico ファイルを指定）。
- `--outdir <dir>` / `--outfile <file>` : 出力先をディレクトリか単一ファイルで指定。
- `--target bun|node|browser` : 実行ターゲット。サーバー向けなら `bun` が推奨されます。

例（アイコンを付けてコンソール非表示でビルド）:

```powershell
bun build --compile --production --outfile my-backend.exe --windows-hide-console --windows-icon=./assets/app.ico ./src/cli.ts
```

4) bun build を使った詳細な例（複数エントリポイントや outdir）

```powershell
# 複数エントリポイントを outdir に出力（単体 exe ではなく通常のバンドル）
bun build --outdir ./dist ./src/server.ts ./src/worker.ts

# サーバーを Bun ターゲットでバンドル（起動用の server.js を生成）
bun build --target=bun --outfile=server.js ./src/server.ts
```

5) JavaScript API を使ってビルド（スクリプト内で呼ぶ場合）

`Bun.build()` を用いたビルドスクリプトの例です。単体 exe を作る場合は CLI の `--compile` が最もシンプルですが、スクリプト内で細かい制御をしたい場合に使います。

```js
// build.mjs
import path from 'path';
await Bun.build({
	entrypoints: ['./src/cli.ts'],
	outdir: './out',
});

console.log('build finished');
```

実行:

```powershell
bun run build.mjs
```

6) 出力物の確認と配布

- `--compile` を使った場合、生成された exe は内部に Bun を含むためファイルサイズが大きくなります。配布前にウイルススキャンやコード署名の検討をおすすめします。
- 生成ファイルを配布する際は、依存するネイティブモジュール（.node）やプラットフォーム固有の挙動に注意してください。

7) トラブルシューティング

- ビルドが失敗する場合は標準出力のログを確認してください。`bun build` は詳細なエラーメッセージを出力します。
- `--format` と `--target` の組み合わせ、`bytecode` オプションなどは一部制約があるため、必要に応じてオプションを調整してください。

8) 参考（公式ドキュメント）

- Bun bundler: https://bun.sh/docs/bundler
- Executables: https://bun.sh/docs/bundler/executables

