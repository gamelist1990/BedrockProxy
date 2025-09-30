import { useMemo, useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import {
  Alert,
  Snackbar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LanguageIcon from "@mui/icons-material/Language";
import {
  LanguageProvider,
  useLanguageContext,
} from "./contexts/LanguageContext";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AddIcon from "@mui/icons-material/Add";
import { bedrockProxyAPI, type Server, type ServerStatus } from "./API";
import { resourceDir } from '@tauri-apps/api/path';
import { Command } from '@tauri-apps/plugin-shell';
import { listen } from '@tauri-apps/api/event';
import ServerDetails from "./ServerDetails";
import "./css/App.css";
import ServerAvatar from './components/ServerAvatar';

const fallbackEmojis = ["🪵", "🧱", "🧭", "🛡️", "⚙️", "🛠️", "🧊", "🔥"];

const statusColor: Record<ServerStatus, "success" | "error" | "warning"> = {
  online: "success",
  offline: "error",
  starting: "warning",
  stopping: "warning",
  error: "error",
};

const pickEmoji = (serverId: string) => {
  const index = [...serverId].reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  );
  return fallbackEmojis[index % fallbackEmojis.length];
};

function ServerList() {
  const navigate = useNavigate();
  const {
    t,
    availableLanguages,
    currentLang,
    changeLanguage,
    isLoading: langLoading,
  } = useLanguageContext();
  const [langMenuAnchor, setLangMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [servers, setServers] = useState<Server[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  // 新規サーバー追加ダイアログ関連
  const [addServerDialog, setAddServerDialog] = useState(false);
  const [serverExePath, setServerExePath] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedConfig, setDetectedConfig] = useState<any>(null);
  const [newServerData, setNewServerData] = useState({
    name: "",
    address: "127.0.0.1:19133",
    destinationAddress: "127.0.0.1:19132",
    maxPlayers: 10,
    description: "",
    tags: [] as string[],
    iconUrl: "",
    autoRestart: false,
    blockSameIP: false,
    forwardAddress: "",
  });

  // 削除ダイアログ管理
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null);

  // Define status labels using translation function
  const statusLabel: Record<ServerStatus, string> = {
    online: t("server.status.online"),
    offline: t("server.status.offline"),
    starting: t("server.status.starting"),
    stopping: t("server.status.stopping"),
    error: t("server.status.error"),
  };

  const handleLangMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLangMenuAnchor(event.currentTarget);
  };

  const handleLangMenuClose = () => {
    setLangMenuAnchor(null);
  };

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode);
    handleLangMenuClose();
  };

  // WebSocket接続とデータ読み込み
  const connectAndLoadData = useCallback(async () => {
    // prevent concurrent connect attempts
    if ((window as any).__bedrock_connecting) {
      console.log("🔄 Connection already in progress (guard)");
      return;
    }
    (window as any).__bedrock_connecting = true;
    try {
      setIsLoading(true);

      // 接続状態確認して重複接続を防ぐ
      if (bedrockProxyAPI.isConnected()) {
        console.log("🔗 Already connected, loading servers only");
        const serverList = await bedrockProxyAPI.getServers();
        setServers(serverList);
        setIsConnected(true);
        return;
      }

      try {
        await bedrockProxyAPI.connect();
      } catch (err) {
        // If running inside Tauri, try to auto-start backend.exe if present
        try {
          // Use direct imports (Tauri only).
          console.debug("Tauri: checking for backend.exe in resources");
          setLiveLogs((prev) => [
            ...prev,
            "Tauri: checking for backend.exe in resources",
          ]);
          const r = await resourceDir();
          const exePath = r.endsWith("/") || r.endsWith("\\") ? `${r}backend.exe` : `${r}${'\\'}backend.exe`;
          console.debug("Tauri: attempting to spawn backend.exe at", exePath);
          setLiveLogs((prev) => [
            ...prev,
            `Tauri: attempting to spawn backend.exe at ${exePath}`,
          ]);
          const cmd = Command.create(exePath, []);
          const child = await cmd.spawn();
          console.debug("Tauri: spawn returned", child);
          setLiveLogs((prev) => [
            ...prev,
            `Tauri: spawn returned ${child ? JSON.stringify({ pid: child?.pid ?? null }) : 'null'}`,
          ]);
          (window as any).__bp_spawned_backend = { cmd, child } as any;
          // give backend a moment to start
          await new Promise((r) => setTimeout(r, 1000));
          console.debug("Tauri: retrying WebSocket connect after spawn");
          setLiveLogs((prev) => [
            ...prev,
            "Tauri: retrying WebSocket connect after spawn",
          ]);
          await bedrockProxyAPI.connect();
          console.debug("Tauri: connect retry succeeded");
          setLiveLogs((prev) => [...prev, "Tauri: connect retry succeeded"]);
        } catch (tauriErr) {
          console.error("Tauri auto-start failed:", tauriErr);
          const tauriMsg = (tauriErr as any)?.message ?? String(tauriErr);
          setLiveLogs((prev) => [
            ...prev,
            `Tauri auto-start failed: ${tauriMsg}`,
          ]);
          // Re-throw original connect error if auto-start not possible
          throw err;
        }
      }
      setIsConnected(true);

      // イベント購読（一度だけ）
      await bedrockProxyAPI.subscribe(["*"]);

      // サーバー一覧取得
      const serverList = await bedrockProxyAPI.getServers();
      setServers(serverList);

      console.log("✅ Connected and loaded", serverList.length, "servers");
    } catch (error) {
      console.error("❌ Failed to connect or load data:", error);
      setActionMessage(t("connection.failed"));
      setIsConnected(false);
    } finally {
      setIsLoading(false);
      (window as any).__bedrock_connecting = false;
    }
  }, [t]);

  // Ensure backend process we started is only killed when the application is closing.
  // Avoid killing on component unmount / HMR to keep the sidecar running while the app is active.
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const handleAppClose = async () => {
      try {
        const spawned = (window as any).__bp_spawned_backend;
        if (spawned && spawned.child) {
          try {
            spawned.child.kill();
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }
    };

    // Try to listen for Tauri's close-request event (fired when the user closes the app window).
    // If Tauri APIs are not available (non-Tauri runtime), fall back to beforeunload as a best-effort.
    (async () => {
      try {
        const l = await listen('tauri://close-request', async () => {
          await handleAppClose();
        });
        unlisten = l;
      } catch (e) {
        // Fallback for non-Tauri environments
        window.addEventListener('beforeunload', handleAppClose);
      }
    })();

    return () => {
      // Remove listeners but do not kill the backend here; keep it running until a real app close happens.
      if (unlisten) {
        try {
          unlisten();
        } catch (e) {
          /* ignore */
        }
      } else {
        try {
          window.removeEventListener('beforeunload', handleAppClose);
        } catch (e) {
          /* ignore */
        }
      }
    };
  }, []);

  // 初期化
  useEffect(() => {
    let isMounted = true;

    const initializeConnection = async () => {
      if (isMounted) {
        await connectAndLoadData();
      }
    };

    initializeConnection();

    // イベントリスナーの設定
    // 安定したイベントハンドラ
    const handleServerCreated = (data: any) => {
      setServers((prev) => [...prev, data.server]);
      setActionMessage(`${data.server.name} ${t("server.actionCreated")}`);
    };

    const handleServerUpdated = (data: any) => {
      setServers((prev) =>
        prev.map((server) =>
          server.id === data.server.id ? data.server : server
        )
      );
    };

    const handleServerDeleted = (data: any) => {
      setServers((prev) =>
        prev.filter((server) => server.id !== data.serverId)
      );
      setActionMessage(`${data.serverName} ${t("server.actionDeleted")}`);
    };

    const handleServerStatusChanged = (data: any) => {
      setServers((prev) =>
        prev.map((server) =>
          server.id === data.serverId ? data.server : server
        )
      );
      const getStatusText = (status: ServerStatus) => {
        const labels: Record<ServerStatus, string> = {
          online: t("server.status.online"),
          offline: t("server.status.offline"),
          starting: t("server.status.starting"),
          stopping: t("server.status.stopping"),
          error: t("server.status.error"),
        };
        return labels[status] || status;
      };
      const statusText = getStatusText(data.newStatus as ServerStatus);
      setActionMessage(`${data.server.name} ${statusText}`);
    };

    // connection events
    const handleConnectionLatency = (d: any) => {
      setLatency(d.latency ?? null);
    };

    const handleConnectionUpdate = (d: any) => {
      setConnectionState((d && (d.status || d)) ?? null);
    };

    // live console log (for overview)
    const handleConsoleOutput = (data: any) => {
      setLiveLogs((prev) => {
        const lines = [
          ...prev,
          `${data.serverName ?? data.serverId}: ${data.line}`,
        ];
        if (lines.length > 200) lines.shift();
        return lines;
      });
    };

    // Handle backend auto-start result (emitted by frontend logic when sidecar start attempted)
    const handleAutoStartResult = async (data: any) => {
      try {
        console.debug('backend.autoStartResult', data);
        if (data?.success) {
          setLiveLogs((prev) => [...prev, 'Backend auto-start succeeded, refreshing connection and data...']);
        } else {
          setLiveLogs((prev) => [...prev, `Backend auto-start failed: ${data?.error ?? 'unknown'}`]);
        }

        // Try to ensure connection and refresh data
        try {
          await bedrockProxyAPI.connect();
        } catch (e) {
          console.debug('connect after auto-start threw', e);
        }

        setIsLoading(true);
        try {
          const list = await bedrockProxyAPI.getServers();
          setServers(list);
          setIsConnected(bedrockProxyAPI.isConnected());
        } catch (e) {
          console.warn('getServers after auto-start failed, reloading page', e);
          window.location.reload();
        } finally {
          setIsLoading(false);
        }
      } catch (e) {
        console.error('Error handling backend.autoStartResult', e);
      }
    };

    // Refresh servers when a connection is established
    const onConnected = async () => {
      try {
        console.debug('connection.established -> refreshing servers');
        setIsLoading(true);
        const list = await bedrockProxyAPI.getServers();
        setServers(list);
        setIsConnected(true);
      } catch (e) {
        console.warn('getServers after connection established failed', e);
      } finally {
        setIsLoading(false);
      }
    };

    // Update server player counts in real-time when players join/leave
    const handlePlayerJoinedOverview = (data: any) => {
      try {
        const sid = data?.serverId ?? data?.server?.id ?? null;
        if (!sid) return;
        setServers((prev) =>
          prev.map((s) =>
            s.id === sid
              ? { ...s, playersOnline: (s.playersOnline ?? 0) + 1 }
              : s
          )
        );
      } catch (e) {
        console.debug("player.joined handler error", e);
      }
    };

    const handlePlayerLeftOverview = (data: any) => {
      try {
        const sid = data?.serverId ?? data?.server?.id ?? null;
        if (!sid) return;
        setServers((prev) =>
          prev.map((s) =>
            s.id === sid
              ? { ...s, playersOnline: Math.max((s.playersOnline ?? 1) - 1, 0) }
              : s
          )
        );
      } catch (e) {
        console.debug("player.left handler error", e);
      }
    };

    bedrockProxyAPI.on("server.created", handleServerCreated);
    bedrockProxyAPI.on("server.updated", handleServerUpdated);
    bedrockProxyAPI.on("server.deleted", handleServerDeleted);
    bedrockProxyAPI.on("server.statusChanged", handleServerStatusChanged);
    bedrockProxyAPI.on("player.joined", handlePlayerJoinedOverview);
    bedrockProxyAPI.on("player.left", handlePlayerLeftOverview);
    bedrockProxyAPI.onConnection(
      "latencyUpdate",
      handleConnectionLatency as any
    );
    bedrockProxyAPI.onConnection("connected", () =>
      handleConnectionUpdate({ status: "connected" })
    );
    bedrockProxyAPI.onConnection("disconnected", () =>
      handleConnectionUpdate({ status: "disconnected" })
    );
  bedrockProxyAPI.on("console.output", handleConsoleOutput);
  bedrockProxyAPI.on('backend.autoStartResult', handleAutoStartResult as any);
  bedrockProxyAPI.on('connection.established', onConnected as any);

    return () => {
      isMounted = false;
      bedrockProxyAPI.off("server.created", handleServerCreated);
      bedrockProxyAPI.off("server.updated", handleServerUpdated);
      bedrockProxyAPI.off("server.deleted", handleServerDeleted);
      bedrockProxyAPI.off("server.statusChanged", handleServerStatusChanged);
      bedrockProxyAPI.off("player.joined", handlePlayerJoinedOverview);
      bedrockProxyAPI.off("player.left", handlePlayerLeftOverview);
      bedrockProxyAPI.offConnection(
        "latencyUpdate",
        handleConnectionLatency as any
      );
      bedrockProxyAPI.offConnection("connected");
      bedrockProxyAPI.offConnection("disconnected");
    bedrockProxyAPI.off("console.output", handleConsoleOutput);
  bedrockProxyAPI.off('backend.autoStartResult', handleAutoStartResult as any);
  bedrockProxyAPI.off('connection.established', onConnected as any);
      // 接続は維持する（他のコンポーネントも使用する可能性があるため）
    };
  }, [connectAndLoadData, t]);

  const overviewMetrics = useMemo(() => {
    const onlineServers = servers.filter(
      (server) => server.status === "online"
    );
    const totalPlayers = servers.reduce(
      (acc, server) =>
        acc + (server.status === "online" ? server.playersOnline : 0),
      0
    );
    const maxPlayers = servers.reduce(
      (acc, server) =>
        acc + (server.status === "online" ? server.maxPlayers : 0),
      0
    );
    return {
      onlineServers: onlineServers.length,
      totalServers: servers.length,
      totalPlayers,
      maxPlayers,
    };
  }, [servers]);

  const handleAction = async (
    server: Server,
    action: "start" | "stop" | "restart"
  ) => {
    const actionMessages = {
      start: t("server.actionStart"),
      stop: t("server.actionStop"),
      restart: t("server.actionRestart"),
      block: t("server.actionBlock"),
    };

    try {
      setActionMessage(`${server.name} ${actionMessages[action]}`);
      const updated = await bedrockProxyAPI.performServerAction(
        server.id,
        action
      );
      // Immediately reflect the updated server object in the list so UI updates even
      // if the backend event is delayed or missing.
      if (updated) {
        setServers((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setActionMessage(`${updated.name} ${actionMessages[action]}`);
      }
    } catch (error) {
      console.error("❌ Server action failed:", error);
      setActionMessage(t("server.actionFailed"));
    }
  };

  const handleRegister = () => {
    setAddServerDialog(true);
  };

  // ファイル選択処理（Tauri実装）
  const handleBrowseExe = async () => {
    try {
      // @ts-ignore - Tauri plugin import
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Executable Files",
            extensions: ["exe"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setServerExePath(selected);
        setActionMessage("ファイルが選択されました: " + selected);
        // ファイル選択後に自動で検知処理を実行
        setTimeout(() => {
          handleDetectServer();
        }, 500); // 少し遅延させてUI更新を待つ
      }
    } catch (error) {
      console.error("File selection failed:", error);
      // Tauri環境でない場合の暫定対応
      setActionMessage(
        "ファイル選択機能はTauri環境でのみ利用可能です。パスを直接入力してください。"
      );
    }
  };

  // サーバー検知処理
  const handleDetectServer = async () => {
    if (!serverExePath) {
      setActionMessage(t("server.addValidationError"));
      return;
    }

    try {
      setIsDetecting(true);
      const detection = await bedrockProxyAPI.detectMinecraftServer(
        serverExePath
      );
      setDetectedConfig(detection);

      // 検知した情報でフォームを自動入力
      setNewServerData((prev) => ({
        ...prev,
        name: detection.recommendedConfig.name,
        address: detection.recommendedConfig.address,
        destinationAddress: detection.recommendedConfig.destinationAddress,
        maxPlayers: detection.recommendedConfig.maxPlayers,
        description: detection.recommendedConfig.description,
        tags: detection.recommendedConfig.tags,
      }));

      setActionMessage(t("server.detectionSuccess"));
    } catch (error) {
      console.error("❌ Server detection failed:", error);
      setActionMessage(t("server.detectionFailed"));
      setDetectedConfig(null);
    } finally {
      setIsDetecting(false);
    }
  };

  // exeパスが変更された時の自動検知
  useEffect(() => {
    if (serverExePath && serverExePath.endsWith(".exe")) {
      // ファイルパスが変更された時に自動検知（手動入力時）
      const timer = setTimeout(() => {
        handleDetectServer();
      }, 1000); // 1秒の遅延でデバウンス

      return () => clearTimeout(timer);
    }
  }, [serverExePath]);

  const handleAddServer = async () => {
    try {
      if (!serverExePath || !detectedConfig) {
        setActionMessage("exeファイルを指定して検知を実行してください");
        return;
      }

      if (
        !newServerData.name ||
        !newServerData.address ||
        !newServerData.destinationAddress
      ) {
        setActionMessage(t("server.addValidationError"));
        return;
      }

      // 検知情報から追加（exe指定が必須）
      const server = await bedrockProxyAPI.addServerFromDetection(
        detectedConfig.detectedInfo,
        newServerData
      );

      setActionMessage(`${server.name} ${t("server.actionCreated")}`);
      resetAddServerDialog();
    } catch (error) {
      console.error("❌ Add server failed:", error);
      setActionMessage(t("server.addFailed"));
    }
  };

  const resetAddServerDialog = () => {
    setAddServerDialog(false);
    setDetectedConfig(null);
    setServerExePath("");
    setIsDetecting(false);
    setNewServerData({
      name: "",
      address: "127.0.0.1:19133",
      destinationAddress: "127.0.0.1:19132",
      maxPlayers: 10,
      description: "",
      tags: [],
      iconUrl: "",
      autoRestart: false,
      blockSameIP: false,
      forwardAddress: "",
    });
  };

  return (
    <Box component="main" className="app-root">
      {/* connection indicator */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ position: "fixed", top: 12, right: 16, zIndex: 1300 }}
      >
        {/* Show a red chip when disconnected so users don't mistake it for running */}
        <Chip
          label={
            connectionState ?? (isConnected ? "connected" : "disconnected")
          }
          color={
            connectionState === "disconnected" || !isConnected
              ? "error"
              : isConnected
              ? "success"
              : "default"
          }
          size="small"
        />
        <Chip label={latency !== null ? `${latency} ms` : "—"} size="small" />
      </Stack>
      <Stack spacing={6} className="content-wrapper">
        <Stack spacing={3} className="hero-section">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Bedrock Proxy
              </Typography>
            </Stack>

            {/* Language Selector */}
            <Button
              startIcon={<LanguageIcon />}
              onClick={handleLangMenuOpen}
              variant="outlined"
              size="small"
              disabled={langLoading}
              sx={{ minWidth: 120 }}
            >
              {availableLanguages.find((lang) => lang.code === currentLang)
                ?.name || t("lang.select")}
            </Button>

            <Menu
              anchorEl={langMenuAnchor}
              open={Boolean(langMenuAnchor)}
              onClose={handleLangMenuClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
            >
              {availableLanguages.map((lang) => (
                <MenuItem
                  key={lang.code}
                  selected={lang.code === currentLang}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography>{lang.name}</Typography>
                    {lang.isCustom && (
                      <Chip
                        size="small"
                        label="Custom"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Stack>

          {/* Overview Metrics */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack spacing={0.5} className="metric-tile">
                <Typography variant="h4" fontWeight={700}>
                  {overviewMetrics.onlineServers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("server.status.online")} / {overviewMetrics.totalServers}{" "}
                  {t("common.servers")}
                </Typography>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack spacing={0.5} className="metric-tile">
                <Typography variant="h4" fontWeight={700}>
                  {overviewMetrics.totalPlayers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("players.connected")} / {overviewMetrics.maxPlayers}
                </Typography>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack spacing={0.5} className="metric-tile">
                <Typography variant="h4" fontWeight={700}>
                  {
                    servers.filter((server) => server.status === "starting")
                      .length
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("server.startingQueue")}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Stack>

        <Stack spacing={3}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6" fontWeight={600}>
              {t("server.managedServers")}
            </Typography>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleRegister}
              disabled={!isConnected}
            >
              {t("server.addNew")}
            </Button>
          </Stack>

          {isLoading ? (
            <Stack spacing={2}>
              <LinearProgress />
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                {t("common.loading")}
              </Typography>
            </Stack>
          ) : servers.length === 0 ? (
            <Card elevation={0} className="empty-state">
              <CardContent sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="h6" gutterBottom>
                  {t("server.registerFlow")}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  {t("server.registerFlow")}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleRegister}
                  disabled={!isConnected}
                >
                  {t("server.addNew")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {servers.map((server) => (
                <Grid key={server.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Card elevation={0} className="mui-card server-card">
                    <CardHeader
                      avatar={
                        <ServerAvatar
                          iconUrl={server.iconUrl}
                          fallbackEmoji={pickEmoji(server.id)}
                          alt={`${server.name} icon`}
                          className="server-avatar"
                        />
                      }
                      title={
                        <Stack spacing={0.5}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            className="server-title"
                          >
                            {server.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {server.address}
                          </Typography>
                        </Stack>
                      }
                      subheader={
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mt: 1 }}
                        >
                          <Chip
                            label={statusLabel[server.status]}
                            color={statusColor[server.status]}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {server.playersOnline}/{server.maxPlayers}{" "}
                            {t("server.players")}
                          </Typography>
                        </Stack>
                      }
                    />
                    {server.tags && server.tags.length > 0 && (
                      <CardContent sx={{ pt: 0 }}>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {server.tags.slice(0, 3).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                          {server.tags.length > 3 && (
                            <Chip
                              label={`+${server.tags.length - 3}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </CardContent>
                    )}
                    <Divider />
                    <CardActions>
                      <Tooltip title={t("operations.start")}>
                        <span>
                          <IconButton
                            color="primary"
                            disabled={
                              server.status === "online" ||
                              server.status === "starting" ||
                              !isConnected
                            }
                            onClick={() => handleAction(server, "start")}
                          >
                            <PlayArrowRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t("operations.stop")}>
                        <span>
                          <IconButton
                            color="primary"
                            disabled={
                              server.status !== "online" || !isConnected
                            }
                            onClick={() => handleAction(server, "stop")}
                          >
                            <StopRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t("operations.restart")}>
                        <span>
                          <IconButton
                            color="primary"
                            disabled={!isConnected}
                            onClick={() => handleAction(server, "restart")}
                          >
                            <RestartAltRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title={t("server.openSettings")}>
                        <IconButton
                          color="primary"
                          onClick={() => navigate(`/server/${server.id}`)}
                        >
                          <SettingsRoundedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("server.delete")}>
                        <IconButton
                          color="error"
                          onClick={() => {
                            setDeleteTarget(server);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>

        <Snackbar
          open={!!actionMessage}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          autoHideDuration={3500}
          onClose={() => setActionMessage(null)}
          sx={{
            zIndex: 1400,
          }}
        >
          <Alert
            variant="filled"
            severity="info"
            sx={{ minWidth: 320, maxWidth: 400, boxShadow: 3 }}
          >
            {actionMessage}
          </Alert>
        </Snackbar>

        {/* live logs small drawer */}
        <Box
          sx={{
            position: "fixed",
            bottom: 12,
            right: 16,
            width: 320,
            zIndex: 1300,
          }}
        >
          {liveLogs.length > 0 && (
            <Card elevation={6} sx={{ maxHeight: 220, overflow: "auto" }}>
              <CardHeader title={`Live (${liveLogs.length})`} sx={{ p: 1 }} />
              <Divider />
              <CardContent sx={{ p: 1 }}>
                {liveLogs.slice(-8).map((ln, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{ display: "block" }}
                  >
                    {ln}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Add Server Dialog */}
        <Dialog
          open={addServerDialog}
          onClose={resetAddServerDialog}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { minHeight: "70vh" } }}
        >
          <DialogTitle>
            <Typography variant="h6">{t("server.addFromExe")}</Typography>
            <Typography variant="body2" color="text.secondary">
              exeファイルから自動的にサーバー設定を検知して追加します
            </Typography>
          </DialogTitle>

          <DialogContent>
            <Stack spacing={4} sx={{ mt: 2 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("server.autoDetect")}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {t("server.exePathDesc")}
                  </Typography>

                  <Stack direction="row" spacing={2} alignItems="end">
                    <TextField
                      label={t("server.exePath")}
                      value={serverExePath}
                      onChange={(e) => setServerExePath(e.target.value)}
                      fullWidth
                      placeholder="C:\\path\\to\\bedrock_server.exe"
                      helperText="bedrock_server.exe または server.exe を指定（必須）"
                      required
                    />
                    <Button
                      variant="outlined"
                      onClick={handleBrowseExe}
                      sx={{ minWidth: 100 }}
                    >
                      {t("server.browseExe")}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleDetectServer}
                      disabled={!serverExePath || isDetecting}
                      sx={{ minWidth: 120 }}
                    >
                      {isDetecting ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CircularProgress size={16} color="inherit" />
                          <span>{t("server.detecting")}</span>
                        </Stack>
                      ) : (
                        t("server.autoDetect")
                      )}
                    </Button>
                  </Stack>

                  {detectedConfig && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        {t("server.detectionSuccess")}:{" "}
                        {detectedConfig.recommendedConfig.name}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={3}>
                    <Typography variant="subtitle2">
                      {t("settings.basic")}
                    </Typography>

                    <TextField
                      label={t("form.serverName")}
                      value={newServerData.name}
                      onChange={(e) =>
                        setNewServerData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      fullWidth
                      required
                    />

                    <Stack spacing={2}>
                      <Typography variant="body2" color="text.secondary">
                        {t("settings.receiving")}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="IPv4"
                          value={
                            newServerData.address.split(":")[0] || "127.0.0.1"
                          }
                          onChange={(e) => {
                            const port =
                              newServerData.address.split(":")[1] || "19133";
                            setNewServerData((prev) => ({
                              ...prev,
                              address: `${e.target.value}:${port}`,
                            }));
                          }}
                          sx={{ flex: 2 }}
                        />
                        <TextField
                          label={t("form.port")}
                          type="number"
                          value={newServerData.address.split(":")[1] || "19133"}
                          onChange={(e) => {
                            const ip =
                              newServerData.address.split(":")[0] ||
                              "127.0.0.1";
                            setNewServerData((prev) => ({
                              ...prev,
                              address: `${ip}:${e.target.value}`,
                            }));
                          }}
                          sx={{ flex: 1 }}
                          inputProps={{ min: 1, max: 65535 }}
                        />
                      </Stack>
                    </Stack>

                    <Stack spacing={2}>
                      <Typography variant="body2" color="text.secondary">
                        {t("form.destinationSettings")}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="IPv4"
                          value={
                            newServerData.destinationAddress.split(":")[0] ||
                            "127.0.0.1"
                          }
                          onChange={(e) => {
                            const port =
                              newServerData.destinationAddress.split(":")[1] ||
                              "19132";
                            setNewServerData((prev) => ({
                              ...prev,
                              destinationAddress: `${e.target.value}:${port}`,
                            }));
                          }}
                          sx={{ flex: 2 }}
                          required
                        />
                        <TextField
                          label={t("form.port")}
                          type="number"
                          value={
                            newServerData.destinationAddress.split(":")[1] ||
                            "19132"
                          }
                          onChange={(e) => {
                            const ip =
                              newServerData.destinationAddress.split(":")[0] ||
                              "127.0.0.1";
                            setNewServerData((prev) => ({
                              ...prev,
                              destinationAddress: `${ip}:${e.target.value}`,
                            }));
                          }}
                          sx={{ flex: 1 }}
                          inputProps={{ min: 1, max: 65535 }}
                          required
                        />
                      </Stack>
                    </Stack>

                    <TextField
                      label={t("form.maxPlayers")}
                      type="number"
                      value={newServerData.maxPlayers}
                      onChange={(e) =>
                        setNewServerData((prev) => ({
                          ...prev,
                          maxPlayers: parseInt(e.target.value) || 10,
                        }))
                      }
                      fullWidth
                      inputProps={{ min: 1, max: 100 }}
                    />
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={3}>
                    <Typography variant="subtitle2">
                      {t("settings.auto")}
                    </Typography>

                    <TextField
                      label={t("form.iconUrl")}
                      value={newServerData.iconUrl}
                      onChange={(e) =>
                        setNewServerData((prev) => ({
                          ...prev,
                          iconUrl: e.target.value,
                        }))
                      }
                      fullWidth
                      placeholder="https://example.com/server-icon.png"
                    />

                    <TextField
                      label={t("form.description")}
                      value={newServerData.description}
                      onChange={(e) =>
                        setNewServerData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      multiline
                      rows={4}
                      fullWidth
                    />

                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={newServerData.autoRestart}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>
                            ) =>
                              setNewServerData((prev) => ({
                                ...prev,
                                autoRestart: e.target.checked,
                              }))
                            }
                          />
                        }
                        label={t("settings.autoRestart")}
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={newServerData.blockSameIP}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>
                            ) =>
                              setNewServerData((prev) => ({
                                ...prev,
                                blockSameIP: e.target.checked,
                              }))
                            }
                          />
                        }
                        label={t("operations.blockSameIP")}
                      />
                    </Stack>

                    <TextField
                      label={t("settings.backupForward")}
                      value={newServerData.forwardAddress}
                      onChange={(e) =>
                        setNewServerData((prev) => ({
                          ...prev,
                          forwardAddress: e.target.value,
                        }))
                      }
                      fullWidth
                      placeholder="192.168.1.100:19132"
                      helperText={t("operations.forwardDesc")}
                    />
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={resetAddServerDialog}>{t("common.cancel")}</Button>
            <Button
              onClick={handleAddServer}
              variant="contained"
              disabled={
                !serverExePath ||
                !detectedConfig ||
                !newServerData.name ||
                !newServerData.address ||
                !newServerData.destinationAddress
              }
            >
              {t("server.add")}
            </Button>
          </DialogActions>
        </Dialog>

        {/* カスタム削除ダイアログ */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
          }}
        >
          <DialogTitle>{t("server.delete")}</DialogTitle>
          <DialogContent>
            <Typography>{t("server.deleteFlow")}</Typography>
            <Typography sx={{ mt: 2 }}>
              {deleteTarget
                ? `${t("server.delete")}：${deleteTarget.name}`
                : ""}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              {t("server.deleteConfirmNote") ||
                "Note: This will remove the proxy configuration only. The server executable and files will NOT be deleted."}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await bedrockProxyAPI.deleteServer(deleteTarget.id);
                  setServers((prev) =>
                    prev.filter((s) => s.id !== deleteTarget.id)
                  );
                  setActionMessage(
                    `${deleteTarget.name} ${t("server.actionDeleted")}`
                  );
                } catch (err) {
                  console.error("❌ Delete server failed:", err);
                  setActionMessage(t("server.addFailed"));
                } finally {
                  setDeleteDialogOpen(false);
                  setDeleteTarget(null);
                }
              }}
            >
              {t("server.delete")}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<ServerList />} />
        <Route path="/server/:id" element={<ServerDetails />} />
      </Routes>
    </LanguageProvider>
  );
}

export default App;
