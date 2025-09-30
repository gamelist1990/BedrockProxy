// デフォルト日本語翻訳（ソースコードに含まれる）
export const ja_JP = {
  // ページタイトル・ナビゲーション
  "server.details": "サーバーの詳細",
  "server.back": "戻る",
  
  // サーバー状態
  "server.status.online": "オンライン",
  "server.status.offline": "オフライン",
  "server.status.maintenance": "メンテナンス中",
  "server.status.starting": "起動中",
  "server.status.stopping": "停止中",
  "server.status.error": "エラー",
  
  // サーバー統計
  "server.players": "プレイヤー",
  "server.maxPlayers": "最大プレイヤー数",
  "server.uptime": "稼働時間",
  "server.memory": "メモリ使用量",
  
  // タブ
  "tab.overview": "概要",
  "tab.players": "プレイヤー",
  "tab.console": "コンソール",
  "tab.operations": "操作",
  
  // 概要タブ
  "overview.serverInfo": "サーバー情報",
  "overview.serverName": "サーバー名",
  "overview.serverAddress": "サーバーアドレス",
  "overview.serverTags": "サーバータグ",
  "overview.addTag": "タグを追加",
  "overview.tagLimit": "タグは最大5個まで追加できます",
  "overview.autoSettings": "自動設定",
  "overview.autoRestart": "自動再起動",
  "overview.autoRestartDesc": "サーバーがクラッシュした場合に自動的に再起動します",
  "overview.proxyConfig": "プロキシ設定",
  "overview.receivingPort": "受信ポート",
  "overview.receivingPortDesc": "プロキシサーバーがプレイヤー接続を受け付けるポート",
  "overview.destinationPort": "転送先ポート",
  "overview.destinationPortDesc": "実際のゲームサーバーへの転送先アドレスとポート",
  
  // プレイヤータブ
  "players.summary": "プレイヤー概要",
  "players.online": "オンライン",
  "players.peak": "ピーク",
  "players.today": "今日",
  "players.activeList": "アクティブプレイヤー一覧",
  "players.noOnline": "オンラインプレイヤーはいません",
  "players.joinOrder": "参加順",
  "players.joined": "参加",
  
  // コンソールタブ
  "console.output": "コンソール出力",
  "console.input": "コマンドを入力...",
  "console.send": "送信",
  
  // 操作タブ
  "operations.title": "サーバー操作",
  "operations.desc": "サーバーの開始、停止、再起動などの操作を行います",
  "operations.start": "開始",
  "operations.stop": "停止",
  "operations.restart": "再起動",
  "operations.backup": "バックアップ",
  "operations.description": "起動・停止・再起動やセキュリティ操作をこちらから実行できます。",
  "operations.autoRestart": "自動再起動",
  "operations.autoRestartDesc": "サーバーが停止した場合に自動で再起動します",
  "operations.forwardSettings": "転送設定",
  "operations.forwardDesc": "メインサーバーがダウンした際の予備転送先です。復旧後は元のサーバーに戻ります。",
  
  // フォーム関連
  "form.serverName": "サーバー名",
  "form.maxPlayers": "最大プレイヤー数",
  "form.iconUrl": "アイコンURL",
  "form.description": "サーバーの説明メモ...",
  "form.destinationSettings": "宛先設定（転送先サーバー）",
  "form.customSettings": "カスタム設定...",
  "form.customForwardAddress": "カスタム転送先アドレス",
  "form.placeholderAddress": "例: 192.168.1.100:19132",
  "form.receivingPort": "受信ポート",
  "form.destinationPort": "宛先ポート",
  "form.address": "アドレス",
  "form.port": "ポート",
  "form.save": "保存",
  
  // 言語選択
  "lang.select": "言語を選択",
  "lang.ja": "日本語",
  "lang.en": "English",
  "lang.auto": "自動検出",
  
  // 共通
  "common.save": "保存",
  "common.cancel": "キャンセル",
  "common.edit": "編集",
  "common.delete": "削除",
  "common.add": "追加",
  "common.loading": "読み込み中...",
  "common.error": "エラーが発生しました",
  "common.servers": "サーバー",
  
  // サーバーリスト・管理
  "server.managedServers": "管理中のサーバー",
  "server.addNew": "新規サーバーを追加",
  "server.delete": "サーバーを削除",
  "server.deleteFlow": "サーバー削除フローを開始します",
  "server.deleteConfirmNote": "この操作を実行するとサーバーとその設定は完全に削除され、元に戻せません。",
  "server.registerFlow": "新しいサーバー登録フローを開始します",
  "server.startingQueue": "起動待ちキュー",
  "server.address": "アドレス",
  "server.openSettings": "詳細設定を開く",
  
  // サーバーアクション
  "server.actionStart": "に対して「開始」操作を要求しました",
  "server.actionStop": "に対して「停止」操作を要求しました",
  "server.actionRestart": "に対して「再起動」操作を要求しました",
  "server.actionBlock": "に対して「IPブロック」操作を要求しました",
  "server.actionCreated": "が作成されました",
  "server.actionDeleted": "が削除されました",
  "server.actionFailed": "操作に失敗しました",
  "server.loadFailed": "サーバー情報の読み込みに失敗しました",
  
  // プレイヤー関連
  "players.connected": "接続中プレイヤー",
  
  // 操作関連
  "operations.block": "IPブロック",
  "operations.blockSameIP": "同一IPからの接続をブロック",
  "operations.blockSameIPDesc": "同一のIPアドレスからの複数接続を防止します。",
  
  // タグ関連
  "tags.add": "タグを追加",
  "tags.limit": "タグは最大5個までです",
  "tags.newTag": "新しいタグ",
  "tags.label": "タグ",
  "tags.none": "タグは設定されていません",
  
  // 統計・ラベル
  "stats.online": "オンライン",
  "stats.available": "空き枠",
  "stats.limit": "上限",
  "stats.people": "人",
  
  // 設定関連
  "settings.basic": "基本設定",
  "settings.playerList": "プレイヤー一覧",
  "settings.showPlayerIPs": "プレイヤーのIPを表示",
  "settings.showPlayerIPsDesc": "プライバシー保護のためデフォルトでは無効。サーバーごとに保存されます。",
  "settings.receiving": "受信設定（Proxyが受け付けるポート）",
  "settings.receivingIPv4": "受信IPv4",
  "settings.receivingPort": "受信ポート",
  "settings.destinationIPv4": "宛先IPv4",
  "settings.destinationPort": "宛先ポート",
  "settings.ipv4Fixed": "IPv4は固定です",
  "settings.description": "説明メモ",
  "settings.auto": "自動設定",
  "settings.autoRestart": "自動再起動",
  "settings.backupForward": "予備転送設定",
  "settings.backupDestination": "予備転送先",
  "settings.forwardDisabled": "無効（予備転送なし）",
  "settings.saveSuccess": "サーバー設定を保存しました",
  "settings.saveFailed": "サーバー設定の保存に失敗しました",
  "settings.saveTriggered": "保存処理を開始しました",
  
  // プレイヤー関連
  "players.overview": "プレイヤー概要",
  
  // コンソール関連
  "console.title": "コンソール出力",
  "console.recentDebugHeader": "直近のコンソール出力（デバッグ用）",
  "console.processExitedExit": "プロセスは終了しました（exit code: {code}） - {time}",
  "console.processExitedSignal": "プロセスは終了しました（signal: {signal}） - {time}",
  "console.waitingOutput": "コンソール出力を待機中...",
  "console.serverOffline": "サーバーがオフラインです",
  "console.useServerOnline": "コンソール機能を使用するにはサーバーをオンラインにしてください",
  "console.placeholder": "コマンドを入力して Enter で送信",
  
  // 新規サーバー追加
  "server.add": "サーバー追加",
  "server.addDialog": "新規サーバーの追加",
  "server.addManual": "手動で追加",
  "server.addFromExe": "exeファイルから検知",
  "server.exePath": "サーバーexeパス",
  "server.exePathDesc": "bedrock_server.exe または server.exe を選択してください",
  "server.browseExe": "参照...",
  "server.autoDetect": "自動検知",
  "server.detecting": "検知中...",
  "server.detectionSuccess": "サーバー情報を検知しました",
  "server.detectionFailed": "サーバー情報の検知に失敗しました",
  "server.receivingAddress": "受信アドレス",
  "server.destinationAddress": "宛先アドレス",
  "server.addValidationError": "必須項目を入力してください",
  "server.addSuccess": "サーバーを追加しました",
  "server.addFailed": "サーバーの追加に失敗しました",
  
  // 接続関連
  "connection.connecting": "接続中...",
  "connection.failed": "接続に失敗しました",
  "connection.disconnected": "接続が切断されました",
  "console.unavailable": "コンソールは利用できません: サーバープロセスが実行されていません（プロキシ専用または未起動）",
};

export default ja_JP;