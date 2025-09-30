import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { dirname } from "path";
import { APIError } from "../types/index.js";

// プロセス情報を管理するインターフェース
export interface ManagedProcess {
  id: string;
  serverId: string;
  executablePath: string;
  workingDirectory: string;
  process: ChildProcess | null;
  status: "stopped" | "starting" | "running" | "stopping" | "error";
  startTime?: Date;
  pid?: number;
  consoleBuffer: string[];
  maxConsoleLines: number;
}

// コンソールイベントの型
export interface ConsoleEvent {
  serverId: string;
  line: string;
  timestamp: Date;
  type: "stdout" | "stderr";
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ManagedProcess>();
  private readonly maxConsoleBufferSize = 1000;

  constructor() {
    super();
  }

  // プロセスを開始
  public async startProcess(
    serverId: string, 
    executablePath: string, 
    args: string[] = []
  ): Promise<void> {
    // 既存のプロセスチェック
    const existingProcess = this.processes.get(serverId);
    if (existingProcess?.status === "running" || existingProcess?.status === "starting") {
      throw new APIError(
        `Server ${serverId} is already running or starting`,
        "PROCESS_ALREADY_RUNNING",
        400
      );
    }

    const workingDirectory = dirname(executablePath);
    
    // プロセス情報を初期化
    const managedProcess: ManagedProcess = {
      id: `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      serverId,
      executablePath,
      workingDirectory,
      process: null,
      status: "starting",
      consoleBuffer: [],
      maxConsoleLines: this.maxConsoleBufferSize,
    };

    this.processes.set(serverId, managedProcess);
    
    try {
      console.log(`🚀 Starting server process: ${executablePath}`);
      console.log(`📁 Working directory: ${workingDirectory}`);
      console.log(`📋 Arguments:`, args);

      // プロセスを起動
      const childProcess = spawn(executablePath, args, {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        windowsHide: false, // Windowsで新しいウィンドウを表示しない
      });

      managedProcess.process = childProcess;
      managedProcess.pid = childProcess.pid;
      managedProcess.startTime = new Date();

      // プロセスイベントハンドラーの設定
      this.setupProcessEventHandlers(managedProcess);

      console.log(`✅ Server process started: PID ${childProcess.pid}`);
      
    } catch (error) {
      console.error(`❌ Failed to start server process:`, error);
      managedProcess.status = "error";
      this.emit('processStatusChanged', {
        serverId,
        status: managedProcess.status,
        error: String(error)
      });
      
      throw new APIError(
        `Failed to start server process: ${error}`,
        "PROCESS_START_FAILED",
        500
      );
    }
  }

  // プロセスイベントハンドラーの設定
  private setupProcessEventHandlers(managedProcess: ManagedProcess): void {
    const { serverId, process: childProcess } = managedProcess;
    
    if (!childProcess) return;

    // プロセス開始完了
    childProcess.on('spawn', () => {
      managedProcess.status = "running";
      console.log(`📡 Server process spawned: ${serverId}`);
      
      this.emit('processStatusChanged', {
        serverId,
        status: managedProcess.status,
        pid: managedProcess.pid
      });
    });

    // 標準出力の処理
    childProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.addConsoleOutput(managedProcess, line, 'stdout');
      });
    });

    // エラー出力の処理
    childProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.addConsoleOutput(managedProcess, line, 'stderr');
      });
    });

    // プロセス終了処理
    childProcess.on('exit', (code, signal) => {
      console.log(`🔚 Server process exited: ${serverId}, code: ${code}, signal: ${signal}`);

      // If we were already stopping the process, treat the exit as stopped (graceful stop).
      // Otherwise only treat as stopped when exit code === 0.
      const wasStopping = managedProcess.status === "stopping";
      if (wasStopping || code === 0) {
        managedProcess.status = "stopped";
      } else {
        managedProcess.status = "error";
      }

      managedProcess.process = null;
      managedProcess.pid = undefined;

      this.emit('processStatusChanged', {
        serverId,
        status: managedProcess.status,
        exitCode: code,
        signal
      });
    });

    // プロセスエラー処理
    childProcess.on('error', (error) => {
      console.error(`❌ Server process error: ${serverId}`, error);
      
      managedProcess.status = "error";
      this.addConsoleOutput(managedProcess, `Process error: ${error.message}`, 'stderr');
      
      this.emit('processStatusChanged', {
        serverId,
        status: managedProcess.status,
        error: error.message
      });
    });
  }

  // コンソール出力をバッファに追加
  private addConsoleOutput(
    managedProcess: ManagedProcess,
    line: string,
    type: "stdout" | "stderr"
  ): void {
    const timestamp = new Date();
    const formattedLine = `[${timestamp.toLocaleTimeString()}] ${line}`;
    
    // バッファサイズを制限
    if (managedProcess.consoleBuffer.length >= managedProcess.maxConsoleLines) {
      managedProcess.consoleBuffer.shift();
    }
    
    managedProcess.consoleBuffer.push(formattedLine);
    
    // リアルタイムでコンソールイベントを発行
    this.emit('consoleOutput', {
      serverId: managedProcess.serverId,
      line: formattedLine,
      timestamp,
      type
    } as ConsoleEvent);
  }

  // プロセスを停止
  public async stopProcess(serverId: string, force: boolean = false): Promise<void> {
    const managedProcess = this.processes.get(serverId);
    
    if (!managedProcess || !managedProcess.process) {
      throw new APIError(
        `No running process found for server ${serverId}`,
        "PROCESS_NOT_FOUND",
        404
      );
    }

    if (managedProcess.status === "stopping") {
      console.log(`⏳ Server ${serverId} is already stopping`);
      return;
    }

    managedProcess.status = "stopping";
    console.log(`🛑 Stopping server process: ${serverId} (PID: ${managedProcess.pid})`);
    
    this.emit('processStatusChanged', {
      serverId,
      status: managedProcess.status
    });

    try {
      if (force) {
        // 強制終了
        managedProcess.process.kill('SIGKILL');
      } else {
        // 通常の終了シグナル
        managedProcess.process.kill('SIGTERM');
        
        // 一定時間後に強制終了
        setTimeout(() => {
          if (managedProcess.process && managedProcess.status === "stopping") {
            console.log(`⚡ Force killing process ${serverId} after timeout`);
            managedProcess.process.kill('SIGKILL');
          }
        }, 10000); // 10秒のタイムアウト
      }
    } catch (error) {
      console.error(`❌ Failed to stop process ${serverId}:`, error);
      managedProcess.status = "error";
      
      this.emit('processStatusChanged', {
        serverId,
        status: managedProcess.status,
        error: String(error)
      });
      
      throw new APIError(
        `Failed to stop server process: ${error}`,
        "PROCESS_STOP_FAILED",
        500
      );
    }
  }

  // プロセスを再起動
  public async restartProcess(
    serverId: string, 
    executablePath: string, 
    args: string[] = []
  ): Promise<void> {
    console.log(`🔄 Restarting server process: ${serverId}`);
    
    try {
      // まず停止を試行
      if (this.isProcessRunning(serverId)) {
        await this.stopProcess(serverId);
        
        // 停止完了を待つ
        await this.waitForProcessStop(serverId, 15000); // 15秒のタイムアウト
      }
      
      // 再起動
      await this.startProcess(serverId, executablePath, args);
      
    } catch (error) {
      console.error(`❌ Failed to restart process ${serverId}:`, error);
      throw error;
    }
  }

  // プロセス停止完了を待つ
  private waitForProcessStop(serverId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = 100; // 100ms間隔でチェック
      let elapsed = 0;
      
      const intervalId = setInterval(() => {
        const managedProcess = this.processes.get(serverId);
        
        if (!managedProcess || managedProcess.status === "stopped" || managedProcess.status === "error") {
          clearInterval(intervalId);
          resolve();
          return;
        }
        
        elapsed += checkInterval;
        if (elapsed >= timeoutMs) {
          clearInterval(intervalId);
          reject(new Error(`Process ${serverId} did not stop within ${timeoutMs}ms`));
        }
      }, checkInterval);
    });
  }

  // コンソールコマンドを送信
  public sendCommand(serverId: string, command: string): void {
    const managedProcess = this.processes.get(serverId);
    
    if (!managedProcess || !managedProcess.process || managedProcess.status !== "running") {
      // より詳細なエラー情報を含めず、呼び出し元にユーザー向けメッセージを返せるようにする
      throw new APIError(
        `No running process found for server ${serverId}`,
        "PROCESS_NOT_RUNNING",
        400
      );
    }

    try {
      console.log(`📤 Sending command to ${serverId}: ${command}`);
      
      // コマンドをプロセスの標準入力に送信
      managedProcess.process.stdin?.write(`${command}\n`);
      
      // コンソールバッファにコマンド履歴を追加
      this.addConsoleOutput(managedProcess, `> ${command}`, 'stdout');
      
    } catch (error) {
      console.error(`❌ Failed to send command to ${serverId}:`, error);
      throw new APIError(
        `Failed to send command: ${error}`,
        "COMMAND_SEND_FAILED",
        500
      );
    }
  }

  // コンソールログを取得
  public getConsoleOutput(serverId: string, lineCount?: number): string[] {
    const managedProcess = this.processes.get(serverId);
    
    if (!managedProcess) {
      throw new APIError(
        `No process found for server ${serverId}`,
        "PROCESS_NOT_FOUND",
        404
      );
    }

    const buffer = managedProcess.consoleBuffer;
    
    if (lineCount && lineCount > 0) {
      return buffer.slice(-lineCount);
    }
    
    return [...buffer]; // コピーを返す
  }

  // プロセスの実行状況を取得
  public getProcessInfo(serverId: string): Omit<ManagedProcess, 'process'> | null {
    const managedProcess = this.processes.get(serverId);
    
    if (!managedProcess) {
      return null;
    }

    // プロセスオブジェクトを除外してコピーを返す
    const { process, ...info } = managedProcess;
    return info;
  }

  // プロセスが実行中かどうかを確認
  public isProcessRunning(serverId: string): boolean {
    const managedProcess = this.processes.get(serverId);
    return managedProcess?.status === "running" || managedProcess?.status === "starting";
  }

  // プロセス状況をクリーンアップ
  public cleanupProcess(serverId: string): void {
    const managedProcess = this.processes.get(serverId);
    
    if (managedProcess?.process) {
      try {
        managedProcess.process.kill('SIGKILL');
      } catch (error) {
        console.warn(`Failed to cleanup process ${serverId}:`, error);
      }
    }
    
    this.processes.delete(serverId);
    console.log(`🧹 Cleaned up process for server: ${serverId}`);
  }

  // 全プロセスをクリーンアップ
  public cleanupAllProcesses(): void {
    console.log(`🧹 Cleaning up all processes...`);
    
    for (const [serverId] of this.processes) {
      this.cleanupProcess(serverId);
    }
    
    console.log(`✅ All processes cleaned up`);
  }

  // 実行中のプロセス一覧を取得
  public getRunningProcesses(): Array<Omit<ManagedProcess, 'process'>> {
    return Array.from(this.processes.values()).map(({ process, ...info }) => info);
  }
}

// シングルトンインスタンス
export const processManager = new ProcessManager();