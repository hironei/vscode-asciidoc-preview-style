# AsciiDoc Preview Light 2026 Style

VS Code の AsciiDoc Preview（[Asciidoctor VS Code](https://marketplace.visualstudio.com/items?itemName=asciidoctor.asciidoctor-vscode)）に、VS Code 組み込みテーマ「2026 Light」の配色を適用する CSS 中心の拡張です。VS Code のテーマが Dark でも、AsciiDoc Preview だけをライト配色に固定します。

[vscode-markdown-preview-style](https://github.com/hironei/vscode-markdown-preview-style) と同じ配色を使います。

- レンダリングは Asciidoctor VS Code に任せます。独自のレンダラや常駐プロセスは持ちません。
- Asciidoctor VS Code 4.3.0 は、他の拡張が `contributes["asciidoc.previewStyles"]` で登録したスタイルをプレビュー（Webview）に読み込めません。そのため、この拡張は起動時に、標準スタイルと `style.css` を連結したバンドルを生成し、**ユーザー設定**の `asciidoc.preview.style` をそのファイルに設定します（設定の編集は不要です）。詳細は「適用の仕組みと設定への影響」を参照してください。
- Markdown プレビュー、エディタ、他の Webview には影響しません。

## 前提

| 項目 | 内容 |
| --- | --- |
| VS Code | 1.97 以降（Asciidoctor VS Code 4.2 以降の要求に合わせています） |
| Asciidoctor VS Code | `asciidoctor.asciidoctor-vscode`（拡張の依存関係に指定済み） |

`extensionDependencies` に Asciidoctor VS Code を指定しているため、Marketplace に接続できる環境では、この拡張の導入時に Asciidoctor VS Code も自動で導入されます。自動導入されない場合（オフラインなど）は、先に手動で導入してください。

```text
code --install-extension asciidoctor.asciidoctor-vscode
```

`style.css` は CSS ネスティング（`& ...`）を使います。VS Code 1.97 以降に含まれる Chromium で利用できます。

## ビルドとインストール

Node.js（`npx` を含む）と、PATH 上の `code` コマンドが必要です。

```text
publish.bat
```

`artifact/` に次を生成します。`publish.bat` は `artifact/.staging/` で生成・検証してから `artifact/` の成果物を差し替えます。Git 操作や GitHub への公開は行いません。`publish.bat clean` は `artifact/.staging/` だけを削除し、最新の VSIX と `install.cmd` は保持します。

```text
artifact/
├── vscode-asciidoc-preview-style-vX.Y.Z.vsix
└── install.cmd
```

`artifact/install.cmd` を実行すると、同じフォルダの VSIX を `code --install-extension <file> --force` で導入・更新します。完了後、VS Code のウィンドウを再読み込みしてください。

`install.cmd` は次の場合にエラーメッセージを表示し、終了コード 1 で終了します。

- 同じフォルダに VSIX が 0 件、または 2 件以上ある
- `code` コマンドが PATH にない
- VSIX のインストールに失敗した

`publish.bat` は、`node` / `npx` が見つからない場合、`package.json` を読めない場合、VSIX の生成に失敗した場合に、エラーメッセージを表示して非 0 で終了します。

## 配色

| 要素 | 色 |
| --- | --- |
| 背景 | `#ffffff` |
| 本文 | `#202020` |
| リンク | `#0069cc` |
| コード / 引用の背景 | `#eaeaea` |
| 引用の枠 | `#c8c8cc` |
| 一般の境界線 | `#e2e2e5` |
| 区切り線 | `#eeeeee` |
| 表ヘッダ背景 | `#fafafd` |
| 選択色 | `#0069cc40` |

色は固定値で定義しています。`--vscode-*` テーマ変数には依存しないため、テーマを切り替えても変わりません。

## 適用の仕組みと設定への影響

Asciidoctor VS Code 4.3.0 には、次の2つの制約があります（上流のソースで確認。Webview の失敗レスポンスの実機採取は未実施です）。

- `asciidoc.previewStyles` で提供されたスタイルの場所が、Webview の読み取り許可ルートに追加されない。
- `asciidoc.preview.additionalStyles` に拡張フォルダの CSS を指定しても同様に読み込めない。`asciidoc.preview.style` に**絶対パス**（バックスラッシュ区切りの Windows パス）を指定した場合だけ、そのファイルのフォルダが許可される。

この拡張は、次のように回避します。

1. 起動時（と、Asciidoctor VS Code の更新・関連設定の変更時）に、インストール済みの Asciidoctor VS Code の標準スタイル（`asciidoc.preview.defaultStyle` に対応するもの）と `style.css` を連結した `asciidoc-preview-light-2026.css` を、この拡張のグローバルストレージ（`context.globalStorageUri`）に生成します。保存先は実行時に動的に決まり、ユーザー名・パス・拡張のバージョンに依存しません（Scoop のポータブル構成を含む）。`vscode` 以外の標準スタイルは相対参照するフォントも同じフォルダへコピーします。
2. ユーザー設定の `asciidoc.preview.style` を、そのファイルの絶対パスに設定します。標準スタイルをバンドルに含めるため、`preview.style` による置き換えでも標準の見た目が維持されます。

設定の扱い:

| 状況 | 動作 |
| --- | --- |
| `asciidoc.preview.style` が未設定 | 初回にバンドルを設定する |
| ユーザーが別の値を設定済み | **変更しない**（出力チャンネル「AsciiDoc Preview Style」に記録）。コマンド `AsciiDoc Preview Style: Enable Light 2026` を実行し、置き換えを確認すると適用できる |
| ユーザーが（この拡張が設定した値を）空にした | 以後、自動では再設定しない（`Enable` コマンドで再設定） |
| ワークスペース／フォルダ設定に `asciidoc.preview.style` がある | そちらが優先され、そのワークスペースでは Light 2026 が適用されない（出力チャンネルに記録） |
| `asciidoc.preview.additionalStyles` | 変更しない（バンドルの後に読み込まれる） |
| 文書の `stylesheet` 属性 | **無効になる**。Asciidoctor VS Code は `asciidoc.preview.style` が設定されている間、文書の `stylesheet` 属性を参照しない（上流の仕様。`asciidocPreviewStyle.mode: off` で回避できるが、その間は Light 2026 も適用されない） |
| 標準スタイルの種類 | **ユーザー設定**の `asciidoc.preview.defaultStyle`（空は `vscode`、`useEditorStyle: false` は `asciidoctor`）から決め、設定変更時に再生成する。バンドルは全ウィンドウで1つで、ワークスペース／フォルダ単位の `defaultStyle` や Antora 文書の自動切替は反映されない（制限） |

### 無効化・復元・アンインストール

- 設定 `asciidocPreviewStyle.mode` を `off` にするか、コマンド `AsciiDoc Preview Style: Restore (remove from user settings)` を実行すると、この拡張が設定した `asciidoc.preview.style` を削除します（ユーザーが設定した別の値は削除しません）。
- アンインストール時は、`vscode:uninstall` フックが、アンインストール元と同じインストール（ポータブル構成、または標準配置の VS Code／Insiders／VSCodium のうち拡張フォルダの親が一致するもの）の `settings.json` から、**トップレベルの** `asciidoc.preview.style` のうち、そのインストールのバンドルと**完全に一致する値**だけを削除します。それ以外（別の値、ネスト内の同名キー、別のインストール、場所を特定できない配置）は変更しません。
- **残留リスク**: フックが実行されない場合（設定ファイルの場所が特殊、Settings Sync で他の端末から戻ったなど）は、存在しないファイルを指す `asciidoc.preview.style` が残り、プレビューのスタイルが当たらなくなります。その場合は `settings.json` から `asciidoc.preview.style` を削除してください。
- Settings Sync を使う場合、端末固有の絶対パスが他の端末へ同期され得ます。端末ごとに拡張を導入し、同期しない設定として扱うことを推奨します。

### 上流の修正後

`package.json` の `asciidoc.previewStyles` の登録は残しています。上流が修正されたら、`lib/core.js` の `UPSTREAM_FIXED_VERSION` に修正済みバージョンを設定すると、そのバージョン以上では回避処理が自動的に外れ、この拡張が設定した `asciidoc.preview.style` を削除して通常の `previewStyles` 方式に戻ります（二重適用なし）。それ以前でも `asciidocPreviewStyle.mode: off` で手動で切り替えられます。

## 標準スタイルとの優先順位

生成したバンドルでは `style.css` を標準スタイルの**後**に置きますが、上流が修正されて `previewStyles` 方式に戻った場合は、拡張が提供するスタイルは標準スタイル（`asciidoctor-editor.css` など）より**先に**読み込まれます。同じ詳細度では標準スタイルが勝つため、`style.css` の各ルールは `:not(#l26)` を付けて、基底のスコープとして ID 1 つ分の詳細度を加えています（セレクタによっては、`#toc` のように ID を含むため、最終的な詳細度は ID 2 つ分になります）。`!important` は、標準スタイルが `!important` で色を指定しているコールアウト番号の文字色（`.conum`）にだけ使っています。

- `asciidoc.preview.additionalStyles` で指定したスタイルは、バンドルの**後**に読み込まれます。文書の `stylesheet` 属性は、`asciidoc.preview.style` が設定されている間は使われません（上記の表のとおり）。ただし `style.css` は ID 1 つ分の詳細度を持つため、通常のクラスセレクタで指定した色は `style.css` が優先されます。これらで色を変えたい場合は、対象の ID を含むセレクタ（ID 2 つ分以上）にして詳細度を上げるか、`!important` を使ってください（仕様上の限界です）。この拡張は、指定されたスタイルの読み込み自体を無効化・変更しません。
- `asciidoc.preview.defaultStyle` が `vscode`（既定）以外（`asciidoctor`、`antora`、`github`）の場合も、背景・本文・リンク・コード・表・引用・注記などの主な色は `style.css` で固定します。ただし、標準スタイルの見た目を前提にした細部の調整は、`vscode`（既定）で確認しています。

## 確認手順

任意の `.adoc` ファイルを開き、プレビュー（`Ctrl+K V` または `AsciiDoc: Open Preview to the Side`）を開きます。

1. VS Code の配色テーマを Light と Dark に切り替えても、背景が白、本文が `#202020` のままであることを確認します。
2. フォルダを開かずに `.adoc` ファイルを開いた場合と、複数のワークスペースで、同じ配色であることを確認します。
3. 見出し、リンク、インラインコード、ソース / リテラルブロック、リスト、表（見出し・罫線・縞表示）、引用、サイドバー、Example ブロック、NOTE / TIP / IMPORTANT / WARNING / CAUTION、画像、目次（`:toc:`）が崩れずに表示されることを確認します。
4. 文書を編集してプレビューが自動更新されること、エディタとプレビューのスクロールが同期すること、目次リンクの見出しジャンプ、`include::` が動作することを確認します。
5. Markdown のプレビューやエディタの表示色が変わらないこと、``settings.json` の変更が、ユーザー設定の `asciidoc.preview.style` の1件だけであることを確認します。

## Mermaid / SVG と図の可読性

- この拡張が固定するのは、図の**外側**（`.mermaid`、`.imageblock` 内の SVG など）の背景色だけです。図の内部（ノード、線、矢印、文字）の配色は書き換えません。
- Asciidoctor VS Code は、`vscode`（既定）または `github` の標準プレビュースタイルを使っていて、VS Code が Dark テーマ（または高コントラスト）のとき、Mermaid を **dark テーマ**で描画します。この拡張はライト背景を固定するため、この組み合わせでは、線・矢印・ノード外の文字が明るい色になり、白背景で読みにくくなる場合があります。CSS だけでは Mermaid の内部配色を変えられないため、この拡張では解決できません。
- 回避策として、Dark テーマで Mermaid を使う場合は、`asciidoc.preview.defaultStyle` を `asciidoctor` または `antora` に設定してください。これらは VS Code のテーマに追従せず、Mermaid を default（ライト）テーマで描画します。この設定はユーザーが手動で行うもので、この拡張は設定を変更しません。
- Light テーマでは、Mermaid は default テーマで描画されるため、追加の対応は不要です。
- 画像として埋め込む SVG に透明背景のものがある場合も、外側の背景は白に固定されます。

## 既知の制限

- 配色の対象は AsciiDoc Preview のみです。HTML / PDF エクスポートには適用されません。
- 高コントラストテーマでも配色はライトに固定されます。文字のコントラストは確認しますが、高コントラスト向けのアクセシビリティ対応は含みません。
- 色と読みやすさの調整のみを行います。レイアウト、印刷、スクロール同期、目次リンクなどの振る舞いは変更しません。
- Asciidoctor VS Code の将来のバージョンで DOM やスタイルが変わった場合、見た目が崩れる可能性があります。

## 開発メモ

動作の基準は Asciidoctor VS Code 4.3.0 と VS Code 1.97 です。テストは `npm test`（`node --test`。判定ロジックとバンドル生成、`settings.json` の削除処理を検証）です。VSIX を実機に導入したときの配色・各要素の表示確認は、「確認手順」で行います。実機の最小対応バージョンは、依存 API の実機検証に基づいて確定します。

## ライセンス

[Apache License 2.0](LICENSE)

配色の値は、VS Code 組み込みの「2026 Light」テーマ（`extensions/theme-defaults/themes/2026-light.json`）と、[vscode-markdown-preview-style](https://github.com/hironei/vscode-markdown-preview-style) の `style.css` の値を基準にしています。
