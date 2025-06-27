# 👼エンクリローダー

## ◆概要
Web拡張機能を利用した、エンジェリックリンクの非公式リソースダウンローダー。  
最新は以下から。
- https://github.com/Connect-a/ancl-loader/releases  

RSSでリリースの通知を受けとることできる。
- https://github.com/Connect-a/ancl-loader/releases.atom
- RSSの通知を受け取りたいんなら拡張機能使うだとかしろ。
  - https://chrome.google.com/webstore/detail/rss-feed-reader/pnjaodmkngahhkoihejjehlcdlnohgmp?type=ext&hl=ja-JP
  - ※サインインなしでも使用できる。

## ◆使用上の注意
- キャラクターのダウンロードは実行ごとに数分時間をあけること。
  - 安全に使いたいならダウンロードごとにおよそ5分の間隔を空けること。
- このツールの存在は、あまり広めないほうが良いと思う。対策されたら面倒。
- 知り得たリソースのURLを送信されるので、注意。使いたくない場合は使わないこと。
  - アカウント情報を収集したりはしてない。
  - 不安に思ったらF12からNetworkタブを確認。
- 止むを得ず通信を監視するので、使用しないときは拡張機能の電源を切るのがエコ。
- 拡張機能が使われていることは基本的に検知不能であるはず。というのと、別に不正を働いているわけでもないので怒られないと思う。サーバーへの負荷もあんま無いつくり。
  - 自己責任の下で利用すること。
- データ更新がうまくいかない場合はブラウザを再起動。
- このツールが便利だと思ったらエンジェリックリンクに課金すること。

## ◆開発中ポイント
- シナリオ上でしか登場しないキャラクターが追加された場合、無力。
- 気づいた点があったらgithubのIssueに書き込むこと。
  - https://github.com/Connect-a/ancl-loader/issues
- 作ってほしい機能とかもダメもとでいいんでgithubのIssueに書き込むこと。
- 現状、Chrome系のブラウザでのみ使用可能。
  - FirefoxとSafariは無理だがEdgeとかBraveとかはいける。
  - 各ブラウザを対応する予定はとりあえずない。

## ◆使用法
- Releasesの最新版を落として任意のフォルダに解凍しておく。
  - https://github.com/Connect-a/ancl-loader/releases
  - dist-mainフォルダの名前は変えていい。
  - アップデートがあった場合、解凍したzipの内容を元のフォルダに上書きすること。
    - 上書き保存するとダウンロード履歴が保持される。
- 「chrome://extensions/」を開く。
- 「デベロッパーモード」をON
  - Edgeの場合「開発者モード」
- 「パッケージ化されていない拡張機能を読み込む」
  - Edgeの場合「展開して読み込み」
- manifest.jsonをルートに持つフォルダを選択。
- エンジェリックリンクのサイトを開いて「ゲームスタート」する。
- ブラウザ右上のジグソーパズルマークから拡張機能を起動。

## ◆メモ
- プレイヤー
  - セレクトボックスはアローキーで操作可能。
  - ラベルのクリックでフォーカスをあてられる要素がある。
    - フォーカスを当てるとアローキーで操作可能。
  - ストーリー表示要素の右下で幅を変えられる。
- V413のボイスリスト
  - [molab_left.json](src\repository\molab_left.json)
  - https://ancl.jp/img/game/asset/text/molab/molab_left_[シーズンID].json
    - シーズンID ⇒ 「s50」等
    - https://ancl.jp/game/res/breed_season/[id]
