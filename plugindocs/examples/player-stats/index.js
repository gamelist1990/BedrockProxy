/// <reference path="../../types/index.d.ts" />

/**
 * プレイヤー統計プラグイン
 * 
 * このプラグインは、プレイヤーの接続履歴や統計情報を記録・表示します。
 * サーバー管理者やプレイヤー自身が統計情報を確認できます。
 * 
 * 機能:
 * - プレイヤーの総接続時間を記録
 * - 初回参加日時の記録
 * - 最終ログイン日時の記録
 * - 接続回数のカウント
 * - ランキングシステム（プレイ時間順）
 * - データの永続化（サーバー再起動後も保持）
 * - プレイヤー向けコマンド（/stats, /ranking）
 * 
 * インストール方法:
 * 1. このフォルダを C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\ にコピー
 * 2. BedrockProxy UI でプラグインを有効化
 * 3. プレイヤーは /stats コマンドで統計を確認可能
 */

registerPlugin(() => ({
  metadata: {
    name: 'プレイヤー統計',
    version: '1.0.0',
    description: 'プレイヤーの接続時間や統計情報を記録・表示',
    author: 'BedrockProxy Team',
    license: 'MIT'
  },

  async onLoad(context) {
    const { api } = context;
    
    // プレイヤー統計データ
    // 構造: { playerName: { stats } }
    this.playerStats = {};
    
    // 現在接続中のプレイヤーのセッション情報
    // 構造: { playerId: { name, joinTime } }
    this.activeSessions = {};

    // 保存された統計データを読み込む
    try {
      const savedStats = await api.storage.get('playerStats');
      if (savedStats) {
        this.playerStats = savedStats;
        api.info(`${Object.keys(this.playerStats).length} 人のプレイヤー統計を読み込みました`);
      }
    } catch (error) {
      api.warn('統計データの読み込みに失敗しました', error);
    }

    api.info('プレイヤー統計プラグインがロードされました');
  },

  async onEnable(context) {
    const { api } = context;

    // ========== プレイヤー参加イベント ==========
    api.on('playerJoin', async (event) => {
      const { player } = event;
      const now = Date.now();

      // セッション開始を記録
      this.activeSessions[player.id] = {
        name: player.name,
        joinTime: now
      };

      // プレイヤー統計を初期化または更新
      if (!this.playerStats[player.name]) {
        // 初回参加
        this.playerStats[player.name] = {
          name: player.name,
          firstJoin: now,
          lastJoin: now,
          totalPlayTime: 0,  // ミリ秒
          joinCount: 1
        };

        api.info(`新規プレイヤー: ${player.name}`);
        
        // ウェルカムメッセージ
        setTimeout(() => {
          api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━');
          api.sendMessage(player.id, `§a${player.name} さん、ようこそ！`);
          api.sendMessage(player.id, '§7このサーバーに初めて参加しました');
          api.sendMessage(player.id, '§7統計情報を確認するには §f/stats §7と入力してください');
          api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━');
        }, 2000);
      } else {
        // 再参加
        this.playerStats[player.name].lastJoin = now;
        this.playerStats[player.name].joinCount++;

        const stats = this.playerStats[player.name];
        const totalHours = Math.floor(stats.totalPlayTime / 3600000);
        const totalMinutes = Math.floor((stats.totalPlayTime % 3600000) / 60000);

        api.info(`プレイヤー再参加: ${player.name} (総プレイ時間: ${totalHours}時間${totalMinutes}分)`);
        
        // おかえりメッセージ
        setTimeout(() => {
          api.sendMessage(player.id, `§aおかえりなさい、${player.name} さん！`);
          api.sendMessage(player.id, `§7総プレイ時間: §f${totalHours}時間 ${totalMinutes}分`);
          api.sendMessage(player.id, `§7接続回数: §f${stats.joinCount}回`);
        }, 2000);
      }

      // データを保存
      await this.saveStats(api);
    });

    // ========== プレイヤー退出イベント ==========
    api.on('playerLeave', async (event) => {
      const { player } = event;
      const session = this.activeSessions[player.id];

      if (session) {
        // プレイ時間を計算
        const playTime = Date.now() - session.joinTime;
        
        // 統計を更新
        if (this.playerStats[session.name]) {
          this.playerStats[session.name].totalPlayTime += playTime;
          
          const minutes = Math.floor(playTime / 60000);
          const seconds = Math.floor((playTime % 60000) / 1000);
          
          api.info(`${session.name} が退出しました (セッション時間: ${minutes}分${seconds}秒)`);
        }

        // セッションを削除
        delete this.activeSessions[player.id];

        // データを保存
        await this.saveStats(api);
      }
    });

    // ========== チャットコマンド処理 ==========
    api.on('playerMessage', async (event) => {
      const message = event.message.toLowerCase();
      const player = event.player;

      // /stats コマンド - 自分の統計を表示
      if (message === '/stats' || message === '!stats') {
        const stats = this.playerStats[player.name];
        
        if (!stats) {
          api.sendMessage(player.id, '§c統計データが見つかりませんでした');
          return;
        }

        // 現在のセッション時間を含める
        let totalTime = stats.totalPlayTime;
        const session = this.activeSessions[player.id];
        if (session) {
          totalTime += Date.now() - session.joinTime;
        }

        // 時間を整形
        const hours = Math.floor(totalTime / 3600000);
        const minutes = Math.floor((totalTime % 3600000) / 60000);
        const firstJoinDate = new Date(stats.firstJoin).toLocaleDateString('ja-JP');
        const lastJoinDate = new Date(stats.lastJoin).toLocaleDateString('ja-JP');

        // 統計を表示
        api.sendMessage(player.id, '§e━━━━━━━ §6あなたの統計 §e━━━━━━━');
        api.sendMessage(player.id, `§7プレイヤー名: §f${player.name}`);
        api.sendMessage(player.id, `§7総プレイ時間: §a${hours}時間 ${minutes}分`);
        api.sendMessage(player.id, `§7接続回数: §b${stats.joinCount}回`);
        api.sendMessage(player.id, `§7初回参加: §f${firstJoinDate}`);
        api.sendMessage(player.id, `§7最終ログイン: §f${lastJoinDate}`);
        api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      // /ranking コマンド - プレイ時間ランキングを表示
      if (message === '/ranking' || message === '!ranking') {
        // プレイ時間順にソート
        const rankings = Object.values(this.playerStats)
          .map(stats => {
            // 現在接続中のプレイヤーの時間を加算
            let totalTime = stats.totalPlayTime;
            const activeSession = Object.values(this.activeSessions)
              .find(s => s.name === stats.name);
            if (activeSession) {
              totalTime += Date.now() - activeSession.joinTime;
            }
            return { ...stats, totalTime };
          })
          .sort((a, b) => b.totalTime - a.totalTime)
          .slice(0, 10);  // 上位10人

        // ランキングを表示
        api.sendMessage(player.id, '§e━━━━ §6プレイ時間ランキング TOP10 §e━━━━');
        rankings.forEach((stats, index) => {
          const hours = Math.floor(stats.totalTime / 3600000);
          const minutes = Math.floor((stats.totalTime % 3600000) / 60000);
          
          let medal = '§7';
          if (index === 0) medal = '§6🥇';
          else if (index === 1) medal = '§f🥈';
          else if (index === 2) medal = '§c🥉';
          else medal = `§7${index + 1}.`;
          
          api.sendMessage(
            player.id,
            `${medal} §f${stats.name} §7- §a${hours}時間${minutes}分`
          );
        });
        api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      // /playtime [プレイヤー名] - 他のプレイヤーの統計を表示（オプション）
      if (message.startsWith('/playtime ') || message.startsWith('!playtime ')) {
        const targetName = message.split(' ')[1];
        const stats = this.playerStats[targetName];

        if (!stats) {
          api.sendMessage(player.id, `§c${targetName} の統計データが見つかりませんでした`);
          return;
        }

        // 時間を整形
        const hours = Math.floor(stats.totalPlayTime / 3600000);
        const minutes = Math.floor((stats.totalPlayTime % 3600000) / 60000);

        api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━');
        api.sendMessage(player.id, `§7プレイヤー: §f${targetName}`);
        api.sendMessage(player.id, `§7総プレイ時間: §a${hours}時間 ${minutes}分`);
        api.sendMessage(player.id, `§7接続回数: §b${stats.joinCount}回`);
        api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━');
      }

      // /statshelp - コマンド一覧を表示
      if (message === '/statshelp' || message === '!statshelp') {
        api.sendMessage(player.id, '§e━━━ §6統計プラグイン コマンド §e━━━');
        api.sendMessage(player.id, '§f/stats §7- 自分の統計を表示');
        api.sendMessage(player.id, '§f/ranking §7- プレイ時間ランキングを表示');
        api.sendMessage(player.id, '§f/playtime <名前> §7- 他プレイヤーの統計を表示');
        api.sendMessage(player.id, '§f/statshelp §7- このヘルプを表示');
        api.sendMessage(player.id, '§e━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    });

    api.info('プレイヤー統計プラグインが有効化されました');
    api.info('利用可能なコマンド: /stats, /ranking, /playtime, /statshelp');
  },

  async onDisable(context) {
    const { api } = context;

    // 現在接続中のセッションを保存
    for (const [playerId, session] of Object.entries(this.activeSessions)) {
      const playTime = Date.now() - session.joinTime;
      if (this.playerStats[session.name]) {
        this.playerStats[session.name].totalPlayTime += playTime;
      }
    }

    // データを保存
    await this.saveStats(api);

    // セッションをクリア
    this.activeSessions = {};

    api.info('プレイヤー統計プラグインが無効化されました');
  },

  async onUnload(context) {
    const { api } = context;
    
    // 最終保存
    await this.saveStats(api);
    
    api.info('プレイヤー統計プラグインがアンロードされました');
  },

  // ========== カスタムメソッド ==========

  /**
   * 統計データを保存
   */
  async saveStats(api) {
    try {
      await api.storage.set('playerStats', this.playerStats);
      api.debug(`統計データを保存しました (${Object.keys(this.playerStats).length} 人)`);
    } catch (error) {
      api.error('統計データの保存に失敗しました', error);
    }
  },

  /**
   * 特定プレイヤーの統計を取得（他のプラグインから呼び出し可能）
   */
  getPlayerStats(playerName) {
    return this.playerStats[playerName] || null;
  },

  /**
   * 全プレイヤーの統計を取得
   */
  getAllStats() {
    return { ...this.playerStats };
  },

  /**
   * 統計をリセット（管理者用）
   */
  async resetStats(api, playerName = null) {
    if (playerName) {
      // 特定プレイヤーの統計をリセット
      delete this.playerStats[playerName];
      api.info(`${playerName} の統計をリセットしました`);
    } else {
      // 全プレイヤーの統計をリセット
      this.playerStats = {};
      api.info('全プレイヤーの統計をリセットしました');
    }
    await this.saveStats(api);
  }
}));

/**
 * 使用方法:
 * 
 * プレイヤー向けコマンド:
 * - /stats または !stats - 自分の統計情報を表示
 * - /ranking または !ranking - プレイ時間ランキングを表示
 * - /playtime <名前> - 他のプレイヤーの統計を表示
 * - /statshelp - コマンド一覧を表示
 * 
 * 記録される情報:
 * - 総プレイ時間（ミリ秒単位で正確に記録）
 * - 初回参加日時
 * - 最終ログイン日時
 * - 接続回数
 * 
 * カスタマイズのヒント:
 * 1. ランキングの表示人数を変更: .slice(0, 10) の数値を変更
 * 2. メッセージの色を変更: § の後の文字を変更
 * 3. 他のプラグインから統計を取得: getPlayerStats() メソッドを使用
 * 
 * 拡張アイデア:
 * - デイリー/ウィークリーランキング
 * - 特定の時間達成時の報酬
 * - Discord への統計送信
 * - Web API での統計表示
 * - 実績システムとの連携
 */
