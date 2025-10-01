/// <reference path="../../types/index.d.ts" />

/**
 * 自動アナウンスプラグイン
 * 
 * このプラグインは、設定された間隔でサーバーに自動的にメッセージを送信します。
 * ルールの通知、イベント情報、ヒントなどを定期的に表示するのに便利です。
 * 
 * 機能:
 * - 複数のメッセージをローテーション表示
 * - カスタマイズ可能な送信間隔
 * - メッセージの色やフォーマットのカスタマイズ
 * - ストレージを使った設定の永続化
 * - 動的な設定変更とリロード
 * 
 * インストール方法:
 * 1. このフォルダを C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\ にコピー
 * 2. BedrockProxy UI でプラグインを有効化
 * 3. 必要に応じて設定をカスタマイズ
 */

registerPlugin(() => ({
  metadata: {
    name: '自動アナウンス',
    version: '1.0.0',
    description: 'サーバーに定期的なアナウンスメッセージを自動送信',
    author: 'BedrockProxy Team',
    license: 'MIT'
  },

  async onLoad(context) {
    const { api } = context;
    
    // デフォルト設定
    this.config = {
      enabled: true,
      interval: 300000, // 5分 (ミリ秒)
      messages: [
        '§a[お知らせ] §fサーバールールを守って楽しく遊びましょう！',
        '§b[ヒント] §f/help コマンドで利用可能なコマンドを確認できます',
        '§e[情報] §f定期的にバックアップを取っています',
        '§d[イベント] §f週末には特別イベントを開催予定です！',
        '§6[お願い] §fバグを見つけたら管理者に報告してください'
      ],
      randomOrder: false, // true: ランダム順、false: 順番通り
      showToConsole: true  // コンソールにもログを表示
    };

    // 保存された設定を読み込む
    try {
      const savedConfig = await api.storage.get('config');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
        api.info('保存された設定を読み込みました', this.config);
      }
    } catch (error) {
      api.warn('設定の読み込みに失敗しました。デフォルト設定を使用します', error);
    }

    this.currentMessageIndex = 0;
    this.timerHandle = null;

    api.info('自動アナウンスプラグインがロードされました');
  },

  async onEnable(context) {
    const { api } = context;
    
    if (!this.config.enabled) {
      api.info('自動アナウンスは無効化されています (config.enabled = false)');
      return;
    }

    api.info(`自動アナウンスを開始します (間隔: ${this.config.interval / 1000}秒)`);
    
    // アナウンスタイマーを開始
    this.startAnnouncer(api);

    // カスタムコマンドのリスナーを追加（プラグインの制御用）
    api.on('playerMessage', async (event) => {
      const message = event.message.toLowerCase();
      
      // 管理者用コマンド例
      if (message.startsWith('!announce')) {
        const args = message.split(' ').slice(1);
        
        if (args[0] === 'reload') {
          // 設定をリロード
          await this.reloadConfig(api);
          api.sendMessage(event.player.id, '§a設定をリロードしました');
        } else if (args[0] === 'next') {
          // 次のメッセージを即座に送信
          this.sendNextAnnouncement(api);
          api.sendMessage(event.player.id, '§a次のアナウンスを送信しました');
        } else if (args[0] === 'list') {
          // メッセージリストを表示
          api.sendMessage(event.player.id, '§e--- アナウンスメッセージ一覧 ---');
          this.config.messages.forEach((msg, index) => {
            api.sendMessage(event.player.id, `§7[${index + 1}] §r${msg}`);
          });
        }
      }
    });

    api.info('自動アナウンスプラグインが有効化されました');
  },

  async onDisable(context) {
    const { api } = context;
    
    // タイマーを停止
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
      api.info('アナウンスタイマーを停止しました');
    }

    api.info('自動アナウンスプラグインが無効化されました');
  },

  async onUnload(context) {
    const { api } = context;
    
    // 設定を保存
    try {
      await api.storage.set('config', this.config);
      api.info('設定を保存しました');
    } catch (error) {
      api.error('設定の保存に失敗しました', error);
    }

    api.info('自動アナウンスプラグインがアンロードされました');
  },

  // ========== カスタムメソッド ==========

  /**
   * アナウンスタイマーを開始
   */
  startAnnouncer(api) {
    // 既存のタイマーがあれば停止
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
    }

    // 最初のアナウンスをすぐに送信
    this.sendNextAnnouncement(api);

    // 定期的にアナウンスを送信
    this.timerHandle = setInterval(() => {
      this.sendNextAnnouncement(api);
    }, this.config.interval);

    api.info(`アナウンスタイマーを開始しました (${this.config.interval}ms 間隔)`);
  },

  /**
   * 次のアナウンスメッセージを送信
   */
  sendNextAnnouncement(api) {
    if (!this.config.messages || this.config.messages.length === 0) {
      api.warn('送信するメッセージがありません');
      return;
    }

    let message;

    if (this.config.randomOrder) {
      // ランダムにメッセージを選択
      const randomIndex = Math.floor(Math.random() * this.config.messages.length);
      message = this.config.messages[randomIndex];
    } else {
      // 順番にメッセージを選択
      message = this.config.messages[this.currentMessageIndex];
      this.currentMessageIndex = (this.currentMessageIndex + 1) % this.config.messages.length;
    }

    // サーバーにブロードキャスト
    api.broadcast(message);

    // コンソールにもログ出力（オプション）
    if (this.config.showToConsole) {
      api.info(`アナウンスを送信: ${message}`);
    }
  },

  /**
   * 設定を再読み込み
   */
  async reloadConfig(api) {
    try {
      const savedConfig = await api.storage.get('config');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
        api.info('設定をリロードしました', this.config);
        
        // タイマーを再起動
        this.startAnnouncer(api);
      }
    } catch (error) {
      api.error('設定のリロードに失敗しました', error);
    }
  }
}));

/**
 * 設定のカスタマイズ方法:
 * 
 * 1. プラグインフォルダ内に config.json を作成:
 * {
 *   "enabled": true,
 *   "interval": 180000,
 *   "messages": [
 *     "§aあなたのカスタムメッセージ1",
 *     "§bあなたのカスタムメッセージ2"
 *   ],
 *   "randomOrder": true,
 *   "showToConsole": false
 * }
 * 
 * 2. または、BedrockProxy のストレージ API を通じて動的に設定を変更
 * 
 * 3. 管理者用コマンド:
 *    !announce reload - 設定をリロード
 *    !announce next - 次のメッセージを即座に送信
 *    !announce list - メッセージ一覧を表示
 * 
 * Minecraftの色コード:
 * §0 = 黒, §1 = 濃い青, §2 = 濃い緑, §3 = 濃い水色
 * §4 = 濃い赤, §5 = 濃い紫, §6 = 金色, §7 = 灰色
 * §8 = 濃い灰色, §9 = 青, §a = 緑, §b = 水色
 * §c = 赤, §d = 明るい紫, §e = 黄色, §f = 白
 * §l = 太字, §o = 斜体, §r = リセット
 */
