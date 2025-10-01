import { useParams, useNavigate } from "react-router-dom";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import "./css/ServerDetails.css";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useLanguageContext } from "./contexts/LanguageContext";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveIcon from "@mui/icons-material/Save";
import {
  bedrockProxyAPI,
  type Server,
  type Player,
  type ServerStatus,
} from "./API";
import ServerAvatar from "./components/ServerAvatar";

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

type DetailTab = "overview" | "players" | "console" | "operations" | "plugins";

// Note: DETAIL_TABS now uses translation function inside component
// const DETAIL_TABS will be defined inside the component to access t() function

type TabPanelProps = {
  value: DetailTab;
  current: DetailTab;
  children: ReactNode;
};

const TabPanel = ({ value, current, children }: TabPanelProps) => (
  <div
    role="tabpanel"
    hidden={current !== value}
    id={`server-tabpanel-${value}`}
    aria-labelledby={`server-tab-${value}`}
    className="tab-panel"
  >
    {current === value && children}
  </div>
);

function ServerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguageContext();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [server, setServer] = useState<Server | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 状態変数の初期化（hooks はコンポーネント先頭で宣言する必要があります）
  const [tags, setTags] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [consoleInput, setConsoleInput] = useState("");
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [autoScrollConsole, setAutoScrollConsole] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [autoRestart, setAutoRestart] = useState(false);
  const [forwardAddress, setForwardAddress] = useState("");
  const [customForwardAddress, setCustomForwardAddress] = useState("");
  const [blockSameIP, setBlockSameIP] = useState(false);
  // プレイヤーIP表示設定（プライバシー配慮のためデフォルトは false）
  const [showPlayerIPs, setShowPlayerIPs] = useState(false);

  // Track unsaved changes in operations tab
  const [hasUnsavedOperations, setHasUnsavedOperations] = useState(false);
  const [, setSavedOperationsState] = useState({
    autoStart: false,
    autoRestart: false,
    blockSameIP: false,
    forwardAddress: "",
  });

  // Confirmation dialog for unsaved changes
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );

  // Plugin management state
  const [pluginsEnabled, setPluginsEnabled] = useState(false);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<any>(null);
  const [pluginDetailsOpen, setPluginDetailsOpen] = useState(false);

  // Editable basic settings (controlled inputs)
  const [editName, setEditName] = useState<string>("");
  const [editDestIP, setEditDestIP] = useState<string>("");
  const [editDestPort, setEditDestPort] = useState<string>("");
  const [editMaxPlayers, setEditMaxPlayers] = useState<number>(0);
  const [editIconUrl, setEditIconUrl] = useState<string>("");
  // server docs/notes
  const [editDocs, setEditDocs] = useState<string>("");
  // Listen/receiving settings
  const [editListenIP, setEditListenIP] = useState<string>("127.0.0.1");
  const [editListenPort, setEditListenPort] = useState<string>("19133");

  // Snackbar for notifications
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info" | "warning"
  >("info");

  // サーバーデータの読み込み
  const loadServerData = useCallback(async () => {
    if (!id) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Wait for WebSocket connection to be established
      if (!bedrockProxyAPI.isConnected()) {
        console.log("Waiting for WebSocket connection...");
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait

        while (!bedrockProxyAPI.isConnected() && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (!bedrockProxyAPI.isConnected()) {
          throw new Error("WebSocket connection timeout");
        }
      }

      const data = await bedrockProxyAPI.getServerDetails(id);
      setServer(data.server);
      // initialize editable fields
      setEditName(data.server.name || "");
      setEditDestIP(
        data.server.destinationAddress?.split(":")[0] || "127.0.0.1"
      );
      setEditDestPort(data.server.destinationAddress?.split(":")[1] || "19133");
      // initialize listen/receiving address from server.address
      try {
        const parts = (data.server.address || "").split(":");
        setEditListenIP(parts[0] || "127.0.0.1");
        setEditListenPort(parts[1] || "19133");
      } catch (e) {
        setEditListenIP("127.0.0.1");
        setEditListenPort("19133");
      }
      setEditMaxPlayers(data.server.maxPlayers || 0);
      setEditIconUrl(data.server.iconUrl || "");
      setEditDocs(data.server.docs ?? data.server.description ?? "");
      // Load per-server preference for showing player IPs from localStorage
      try {
        const key = `bp_showPlayerIPs_${data.server.id}`;
        const raw = localStorage.getItem(key);
        setShowPlayerIPs(raw === "true");
      } catch (e) {
        // ignore localStorage errors
      }
      setPlayers(data.players);

      // 設定値を初期化
      setTags(data.server.tags ?? []);
      const initialAutoStart = data.server.autoStart ?? false;
      const initialAutoRestart = data.server.autoRestart ?? false;
      const initialForwardAddress = data.server.forwardAddress ?? "";
      const initialBlockSameIP = data.server.blockSameIP ?? false;
      const initialPluginsEnabled = data.server.pluginsEnabled ?? false;

      setAutoStart(initialAutoStart);
      setAutoRestart(initialAutoRestart);
      setForwardAddress(initialForwardAddress);
      setBlockSameIP(initialBlockSameIP);
      setPluginsEnabled(initialPluginsEnabled);

      // Auto-load plugins if plugin tab is active and plugins are enabled
      if (activeTab === "plugins" && initialPluginsEnabled) {
        // Small delay to ensure state is set
        setTimeout(() => loadPluginsData(false), 100);
      }

      // Set saved operations state
      setSavedOperationsState({
        autoStart: initialAutoStart,
        autoRestart: initialAutoRestart,
        blockSameIP: initialBlockSameIP,
        forwardAddress: initialForwardAddress,
      });
      setHasUnsavedOperations(false);

      // コンソールログを取得
      try {
        // WebSocket接続確認
        if (!bedrockProxyAPI.isConnected()) {
          const maxAttempts = 30; // 3秒
          let attempts = 0;
          while (!bedrockProxyAPI.isConnected() && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }
          if (!bedrockProxyAPI.isConnected()) {
            console.error("❌ WebSocket not connected for console loading");
            setConsoleLines([t("console.output")]);
            return;
          }
        }

        const consoleData = await bedrockProxyAPI.getServerConsole(id);
        // backend が返すメッセージがプレースホルダの場合は翻訳キーに置き換える
        if (
          consoleData.lines &&
          consoleData.lines.length === 1 &&
          /no server process running/i.test(consoleData.lines[0])
        ) {
          setConsoleLines([t("console.unavailable")]);
        } else {
          setConsoleLines(consoleData.lines);
        }
      } catch (err) {
        console.error("Failed to load console:", err);
        setConsoleLines([t("console.output")]);
      }
    } catch (err) {
      console.error("❌ Failed to load server details:", err);
      setError(t("server.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  // console output container ref for auto-scroll
  const consoleRef = useRef<HTMLDivElement | null>(null);

  // 安定したイベントハンドラを useCallback で作成
  const handleServerUpdated = useCallback(
    (data: any) => {
      if (data?.server?.id === id) {
        setServer(data.server);
        // Update settings state when server data is updated
        if (data.server.autoStart !== undefined)
          setAutoStart(data.server.autoStart);
        if (data.server.autoRestart !== undefined)
          setAutoRestart(data.server.autoRestart);
        if (data.server.blockSameIP !== undefined)
          setBlockSameIP(data.server.blockSameIP);
        if (data.server.forwardAddress !== undefined)
          setForwardAddress(data.server.forwardAddress);
      }
    },
    [id]
  );

  const handleServerStatusChanged = useCallback(
    (data: any) => {
      if (data?.serverId === id) {
        setServer(data.server);
        // Update settings state when server status changes
        if (data.server) {
          if (data.server.autoStart !== undefined)
            setAutoStart(data.server.autoStart);
          if (data.server.autoRestart !== undefined)
            setAutoRestart(data.server.autoRestart);
          if (data.server.blockSameIP !== undefined)
            setBlockSameIP(data.server.blockSameIP);
          if (data.server.forwardAddress !== undefined)
            setForwardAddress(data.server.forwardAddress);
        }
      }
    },
    [id]
  );

  const handlePlayerJoined = useCallback(
    (data: any) => {
      // Accept multiple shapes: { serverId, player, currentPlayerCount } or { server: { id, players } }
      const sid = data?.serverId ?? data?.server?.id ?? null;
      if (sid === id) {
        const player =
          data.player ??
          data.playerData ??
          (data.server && data.server.player) ??
          null;
        if (player) {
          const normalized = {
            ...player,
            joinTime: player.joinTime ? new Date(player.joinTime) : new Date(),
          } as Player;
          setPlayers((prev) => {
            // avoid duplicates by id or name
            if (
              prev.find(
                (p) => p.id === normalized.id || p.name === normalized.name
              )
            )
              return prev;
            return [...prev, normalized];
          });
        }
        // sync server playersOnline if provided
        if (
          typeof data.currentPlayerCount === "number" ||
          data.server?.playersOnline
        ) {
          setServer((prev) =>
            prev
              ? {
                  ...prev,
                  playersOnline:
                    data.currentPlayerCount ?? data.server.playersOnline,
                }
              : prev
          );
        }
      }
    },
    [id]
  );

  const handlePlayerLeft = useCallback(
    (data: any) => {
      const sid = data?.serverId ?? data?.server?.id ?? null;
      if (sid === id) {
        const playerId =
          data.playerId ?? data.player?.id ?? data.playerId ?? null;
        if (playerId) {
          setPlayers((prev) =>
            prev.filter(
              (p) =>
                p.id !== playerId && p.name !== (data.player?.name ?? undefined)
            )
          );
        }
        if (
          typeof data.currentPlayerCount === "number" ||
          data.server?.playersOnline
        ) {
          setServer((prev) =>
            prev
              ? {
                  ...prev,
                  playersOnline:
                    data.currentPlayerCount ?? data.server.playersOnline,
                }
              : prev
          );
        }
      }
    },
    [id]
  );

  const handleConsoleOutput = useCallback(
    (data: any) => {
      // Support multiple payload shapes: { serverId, line }, { server: { id, ... }, line }, or { serverName }
      const sid = data?.serverId ?? data?.server?.id ?? null;
      const serverName = data?.serverName ?? data?.server?.name ?? null;

      // If serverId available, match by id. Otherwise, if serverName matches current server, accept.
      if (sid && sid !== id) return;
      if (!sid && serverName && server && serverName !== server.name) return;

      const rawLine = data?.line ?? data?.text ?? data?.message ?? "";
      const line = String(rawLine);

      setConsoleLines((prev) => {
        const newLines = [...prev, line];
        if (newLines.length > 1000) newLines.shift();
        return newLines;
      });
    },
    [id, server?.name]
  );

  // Toggle handler for showing player IPs (persist per-server)
  const handleToggleShowPlayerIPs = useCallback(
    (value: boolean) => {
      if (!server) return;
      try {
        const key = `bp_showPlayerIPs_${server.id}`;
        localStorage.setItem(key, value ? "true" : "false");
      } catch (e) {
        // ignore
      }
      setShowPlayerIPs(value);
    },
    [server]
  );

  // 初期化とイベント処理
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      if (isMounted) await loadServerData();
    };

    initializeData();

    // Ensure we are subscribed to key events for this server specifically.
    // This helps if global subscription didn't propagate or was missed.
    (async () => {
      try {
        // WebSocket接続確認
        if (!bedrockProxyAPI.isConnected()) {
          const maxAttempts = 30; // 3秒
          let attempts = 0;
          while (!bedrockProxyAPI.isConnected() && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }
          if (!bedrockProxyAPI.isConnected()) {
            console.error("❌ WebSocket not connected for subscription");
            return;
          }
        }

        await bedrockProxyAPI.subscribe([
          "console.output",
          "player.joined",
          "player.left",
          "server.statusChanged",
        ]);
      } catch (e) {
        console.warn("Failed to subscribe to server events in details view", e);
      }
    })();

    // 登録
    bedrockProxyAPI.on("server.updated", handleServerUpdated);
    bedrockProxyAPI.on("server.statusChanged", handleServerStatusChanged);
    bedrockProxyAPI.on("player.joined", handlePlayerJoined);
    bedrockProxyAPI.on("player.left", handlePlayerLeft);
    bedrockProxyAPI.on("console.output", handleConsoleOutput);
    // server.properties update notifications
    const handlePropsUpdated = (d: any) => {
      if (d?.serverId === id) {
        setSnackbarMessage(
          t("settings.saveSuccess") || "Saved server properties"
        );
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
      }
    };
    const handlePropsFailed = (d: any) => {
      if (d?.serverId === id) {
        setSnackbarMessage(
          t("settings.saveFailed") ||
            `Failed to update server.properties: ${d?.error ?? ""}`
        );
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    };
    bedrockProxyAPI.on("server.properties.updated", handlePropsUpdated);
    bedrockProxyAPI.on("server.properties.updateFailed", handlePropsFailed);

    return () => {
      isMounted = false;
      bedrockProxyAPI.off("server.updated", handleServerUpdated);
      bedrockProxyAPI.off("server.statusChanged", handleServerStatusChanged);
      bedrockProxyAPI.off("player.joined", handlePlayerJoined);
      bedrockProxyAPI.off("player.left", handlePlayerLeft);
      bedrockProxyAPI.off("console.output", handleConsoleOutput);
      bedrockProxyAPI.off("server.properties.updated", handlePropsUpdated);
      bedrockProxyAPI.off("server.properties.updateFailed", handlePropsFailed);
      // Do NOT unsubscribe global event subscriptions here — other components
      // (like ServerList) rely on those subscriptions. Only remove handlers above.
    };
  }, [
    handleServerUpdated,
    handleServerStatusChanged,
    handlePlayerJoined,
    handlePlayerLeft,
    handleConsoleOutput,
    loadServerData,
  ]);

  // 新しいコンソール行が追加されたら自動でスクロール（設定に応じて）
  useEffect(() => {
    if (!autoScrollConsole) return;
    const el = consoleRef.current;
    if (!el) return;
    // 少し遅延して最新行がレンダリングされるのを待つ
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [consoleLines, autoScrollConsole]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !server) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || t("common.error")}</Alert>
        <Box sx={{ mt: 2 }}>
          <IconButton onClick={() => navigate("/")}>
            <ArrowBackRoundedIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

  // 計算値
  const displayedPlayers = players.slice(
    0,
    Math.min(server.playersOnline, players.length)
  );
  const availableSlots = Math.max(server.maxPlayers - server.playersOnline, 0);

  // サーバー操作
  const handleServerAction = async (action: "start" | "stop" | "restart") => {
    try {
      // WebSocket接続確認
      if (!bedrockProxyAPI.isConnected()) {
        const maxAttempts = 30; // 3秒
        let attempts = 0;
        while (!bedrockProxyAPI.isConnected() && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        if (!bedrockProxyAPI.isConnected()) {
          console.error("❌ WebSocket not connected for server action");
          return;
        }
      }

      const updated = await bedrockProxyAPI.performServerAction(
        server.id,
        action
      );
      if (updated) {
        setServer(updated);
      }
    } catch (error) {
      console.error("❌ Server action failed:", error);
    }
  };

  // 設定の自動保存
  const handleSettingChange = async (setting: Partial<Server>) => {
    try {
      // WebSocket接続確認
      if (!bedrockProxyAPI.isConnected()) {
        const maxAttempts = 30; // 3秒
        let attempts = 0;
        while (!bedrockProxyAPI.isConnected() && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        if (!bedrockProxyAPI.isConnected()) {
          console.error("❌ WebSocket not connected for setting change");
          return;
        }
      }

      await bedrockProxyAPI.updateServer(server.id, setting);
    } catch (error) {
      console.error("❌ Setting change failed:", error);
    }
  };

  // Track operations changes without auto-saving
  const handleOperationChange = (field: string, value: any) => {
    setHasUnsavedOperations(true);
    switch (field) {
      case "autoStart":
        setAutoStart(value);
        break;
      case "autoRestart":
        setAutoRestart(value);
        break;
      case "blockSameIP":
        setBlockSameIP(value);
        break;
      case "forwardAddress":
        setForwardAddress(value);
        break;
    }
  };

  // Save operations settings
  const handleSaveOperations = async () => {
    try {
      await bedrockProxyAPI.updateServer(server.id, {
        autoStart,
        autoRestart,
        blockSameIP,
        forwardAddress:
          forwardAddress === "custom" ? customForwardAddress : forwardAddress,
      });

      setSavedOperationsState({
        autoStart,
        autoRestart,
        blockSameIP,
        forwardAddress,
      });
      setHasUnsavedOperations(false);

      setSnackbarMessage(
        t("settings.saveSuccess") || "Operations settings saved successfully!"
      );
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (error) {
      console.error("❌ Failed to save operations settings:", error);
      setSnackbarMessage(
        t("settings.saveFailed") || "Failed to save operations settings"
      );
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // Load plugins function (shared between manual refresh and auto-load)
  const loadPluginsData = useCallback(
    async (showMessages: boolean = true) => {
      if (!server?.id) return;

      console.log("[Plugin Auto-Load] Starting plugin reload...");

      // Wait for WebSocket connection to be established
      if (!bedrockProxyAPI.isConnected()) {
        console.log("[Plugin Auto-Load] Waiting for WebSocket connection...");
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max wait

        while (!bedrockProxyAPI.isConnected() && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (!bedrockProxyAPI.isConnected()) {
          console.warn(
            "[Plugin Auto-Load] WebSocket connection timeout, skipping plugin load"
          );
          return;
        }
      }

      setLoadingPlugins(true);

      try {
        const systemInfo = await bedrockProxyAPI.getSystemInfo();
        console.log(
          "[Plugin Auto-Load] Plugin directory:",
          systemInfo.pluginsDirectory
        );

        // Load plugins from backend
        console.log(
          "[Plugin Auto-Load] Loading plugins for server:",
          server.id
        );
        const loadedPlugins = await bedrockProxyAPI.loadPlugins(server.id);
        console.log("[Plugin Auto-Load] Loaded plugins:", loadedPlugins);

        // Update state so plugins display in UI
        setPlugins(loadedPlugins);

        if (showMessages) {
          setSnackbarMessage(
            `${t("plugins.refreshed") || "プラグインリストを更新しました"} (${
              loadedPlugins.length
            }件)`
          );
          setSnackbarSeverity("success");
          setSnackbarOpen(true);
        }
      } catch (error) {
        console.error("[Plugin Auto-Load] Failed to load plugins:", error);
        if (showMessages) {
          setSnackbarMessage(
            t("plugins.refreshFailed") || "プラグインの読み込みに失敗しました"
          );
          setSnackbarSeverity("error");
          setSnackbarOpen(true);
        }
      } finally {
        setLoadingPlugins(false);
      }
    },
    [server?.id, t]
  );

  // Auto-load plugins when plugins are enabled and plugin tab is active
  useEffect(() => {
    if (
      pluginsEnabled &&
      activeTab === "plugins" &&
      server?.id &&
      plugins.length === 0
    ) {
      loadPluginsData(false);
    }
  }, [pluginsEnabled, activeTab, server?.id, plugins.length, loadPluginsData]);

  // Handle tab change with unsaved check and auto-load plugins
  const handleTabChange = (newTab: DetailTab) => {
    if (activeTab === "operations" && hasUnsavedOperations) {
      setPendingNavigation(newTab);
      setShowUnsavedDialog(true);
    } else {
      setActiveTab(newTab);

      // Auto-load plugins when plugin tab is selected
      if (newTab === "plugins" && pluginsEnabled && server?.id) {
        loadPluginsData(false); // Don't show success messages for auto-load
      }
    }
  };

  // Handle navigation with unsaved check
  const handleNavigateHome = () => {
    if (activeTab === "operations" && hasUnsavedOperations) {
      setPendingNavigation("home");
      setShowUnsavedDialog(true);
    } else {
      navigate("/");
    }
  };

  // Confirm unsaved changes
  const handleConfirmNavigation = async (save: boolean) => {
    if (save) {
      await handleSaveOperations();
    }

    setShowUnsavedDialog(false);

    if (pendingNavigation === "home") {
      navigate("/");
    } else if (pendingNavigation) {
      setActiveTab(pendingNavigation as DetailTab);
    }

    setPendingNavigation(null);
    setHasUnsavedOperations(false);
  };

  // コンソールコマンド送信
  const handleConsoleCommand = async (command: string) => {
    try {
      if (isSendingCommand) return;
      setIsSendingCommand(true);
      await bedrockProxyAPI.sendConsoleCommand(server.id, command);
      // Do NOT locally append `> ${command}` — backend broadcasts an immediate echo (console.output)
    } catch (error) {
      console.error("❌ Console command failed:", error);
    } finally {
      setIsSendingCommand(false);
    }
  };

  const addTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    if (tags.length >= 5) return;

    const newTags = [...tags, trimmed];
    setTags(newTags);
    setNewTagText("");

    try {
      await bedrockProxyAPI.updateServer(server.id, { tags: newTags });
    } catch (error) {
      console.error("❌ Failed to add tag:", error);
      setTags(tags); // ロールバック
    }
  };

  const removeTag = async (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);

    try {
      await bedrockProxyAPI.updateServer(server.id, { tags: newTags });
    } catch (error) {
      console.error("❌ Failed to remove tag:", error);
      setTags(tags); // ロールバック
    }
  };
  // Define tabs and labels using translation function
  const DETAIL_TABS: Array<{ value: DetailTab; label: string }> = [
    { value: "overview", label: t("tab.overview") },
    { value: "players", label: t("tab.players") },
    { value: "console", label: t("tab.console") },
    { value: "operations", label: t("tab.operations") },
    { value: "plugins", label: t("tab.plugins") || "プラグイン" },
  ];

  const statusLabel: Record<ServerStatus, string> = {
    online: t("server.status.online"),
    offline: t("server.status.offline"),
    starting: t("server.status.starting"),
    stopping: t("server.status.stopping"),
    error: t("server.status.error"),
  };

  return (
    <Box component="main" className="app-root server-details">
      <Stack spacing={6} className="content-wrapper">
        <Stack spacing={1.5} className="page-header">
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={handleNavigateHome}>
              <ArrowBackRoundedIcon />
            </IconButton>
            <Typography variant="h5" fontWeight={600}>
              {server.name} {t("server.details")}
            </Typography>
          </Stack>
          <Typography variant="body2" className="page-subtitle muted">
            {t("overview.serverAddress")}: {server.address}
          </Typography>
        </Stack>

        <Card elevation={0} className="mui-card details-card">
          <CardHeader
            className="details-card-header"
            avatar={
              <ServerAvatar
                iconUrl={server.iconUrl}
                fallbackEmoji={pickEmoji(server.id)}
                alt={`${server.name} icon`}
                className="server-avatar"
              />
            }
            title={
              <Stack spacing={1} className="details-header">
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  className="details-title-row"
                >
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    className="server-title"
                  >
                    {server.name}
                  </Typography>
                  <Chip
                    label={statusLabel[server.status]}
                    color={statusColor[server.status]}
                    size="small"
                  />
                </Stack>
                <Typography variant="body2" className="server-subheader">
                  {server.address}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  className="tag-row"
                >
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      className="tag-chip"
                      onDelete={() => removeTag(tag)}
                    />
                  ))}
                  <Chip
                    label={newTagText || t("tags.add")}
                    size="small"
                    color="primary"
                    onClick={() => {
                      if (tags.length >= 5) return;
                      setShowTagInput(true);
                      setTimeout(() => {
                        const el = document.getElementById(
                          "new-tag-input"
                        ) as HTMLInputElement | null;
                        el?.focus();
                      }, 50);
                    }}
                    className={`tag-chip add-tag-chip ${
                      tags.length >= 5 ? "disabled" : ""
                    }`}
                  />
                  {showTagInput && (
                    <input
                      id="new-tag-input"
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      onBlur={() => {
                        // hide input when focus leaves and no text
                        if (!newTagText) setShowTagInput(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(newTagText);
                          setShowTagInput(false);
                        }
                        if (e.key === "Escape") {
                          setNewTagText("");
                          setShowTagInput(false);
                        }
                      }}
                      className={`tag-input-hidden ${
                        tags.length >= 5 ? "disabled" : ""
                      }`}
                      disabled={tags.length >= 5}
                      aria-label={t("tags.newTag")}
                    />
                  )}
                  {tags.length >= 5 && (
                    <Typography
                      variant="caption"
                      className="muted"
                      style={{ marginLeft: 8 }}
                    >
                      {t("tags.limit")}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            }
            subheader={
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                className="details-stats"
              >
                <Box className="stat-block">
                  <Typography variant="caption" className="muted">
                    {t("stats.online")}
                  </Typography>
                  <Typography variant="h6">{server.playersOnline}</Typography>
                </Box>
                <Box className="stat-block">
                  <Typography variant="caption" className="muted">
                    {t("stats.available")}
                  </Typography>
                  <Typography variant="h6">{availableSlots}</Typography>
                </Box>
                <Box className="stat-block">
                  <Typography variant="caption" className="muted">
                    {t("stats.limit")}
                  </Typography>
                  <Typography variant="h6">{server.maxPlayers}</Typography>
                </Box>
              </Stack>
            }
          />

          <Tabs
            value={activeTab}
            onChange={(_, value) => handleTabChange(value as DetailTab)}
            aria-label="サーバー詳細タブ"
            className="details-tabs"
            variant="scrollable"
            allowScrollButtonsMobile
          >
            {DETAIL_TABS.map((tab) => (
              <Tab
                key={tab.value}
                label={tab.label}
                value={tab.value}
                id={`server-tab-${tab.value}`}
                aria-controls={`server-tabpanel-${tab.value}`}
              />
            ))}
          </Tabs>

          <Divider />

          <TabPanel value="overview" current={activeTab}>
            <CardContent className="tab-panel-content">
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" className="section-title">
                  {t("settings.basic")}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={async () => {
                    // Save basic settings: name, destinationAddress, listen address, maxPlayers, iconUrl
                    try {
                      // validate ports
                      const listenPortNum = Number(editListenPort);
                      const destPortNum = Number(editDestPort);
                      if (
                        !Number.isInteger(listenPortNum) ||
                        listenPortNum < 1 ||
                        listenPortNum > 65535
                      ) {
                        setSnackbarMessage(
                          t("settings.invalidPort") || "Invalid listening port"
                        );
                        setSnackbarSeverity("error");
                        setSnackbarOpen(true);
                        return;
                      }
                      if (
                        !Number.isInteger(destPortNum) ||
                        destPortNum < 1 ||
                        destPortNum > 65535
                      ) {
                        setSnackbarMessage(
                          t("settings.invalidPort") ||
                            "Invalid destination port"
                        );
                        setSnackbarSeverity("error");
                        setSnackbarOpen(true);
                        return;
                      }

                      const dest = `${editDestIP}:${editDestPort}`;
                      const address = `${editListenIP}:${editListenPort}`;
                      const updates: any = {
                        name: editName,
                        destinationAddress: dest,
                        address,
                        maxPlayers: editMaxPlayers,
                        iconUrl: editIconUrl || undefined,
                        docs: editDocs || undefined,
                      };
                      await bedrockProxyAPI.updateServer(server.id, updates);
                      setSnackbarMessage(
                        t("settings.saveSuccess") ||
                          "Settings saved successfully!"
                      );
                      setSnackbarSeverity("success");
                      setSnackbarOpen(true);
                    } catch (err) {
                      console.error("Failed to save settings", err);
                      setSnackbarMessage(
                        t("settings.saveFailed") || "Failed to save settings"
                      );
                      setSnackbarSeverity("error");
                      setSnackbarOpen(true);
                    }
                  }}
                >
                  {t("form.save")}
                </Button>
              </Stack>
              <Grid container spacing={3} className="overview-grid">
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={2} className="form-stack">
                    <TextField
                      className="form-field"
                      label={t("form.serverName")}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      fullWidth
                    />

                    <Box className="proxy-config">
                      <Typography variant="subtitle2" gutterBottom>
                        {t("settings.receiving")}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                      >
                        <TextField
                          className="form-field"
                          label={t("settings.receivingIPv4")}
                          value={editListenIP}
                          fullWidth
                          disabled
                          helperText={t("settings.ipv4Fixed")}
                        />
                        <TextField
                          className="form-field"
                          label={t("settings.receivingPort")}
                          value={editListenPort}
                          onChange={(e) => setEditListenPort(e.target.value)}
                          type="number"
                          style={{ minWidth: 120 }}
                          helperText=" "
                        />
                      </Stack>
                    </Box>

                    <Box className="proxy-config">
                      <Typography variant="subtitle2" gutterBottom>
                        {t("form.destinationSettings")}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                      >
                        <TextField
                          className="form-field"
                          label={t("settings.destinationIPv4")}
                          value={editDestIP}
                          onChange={(e) => setEditDestIP(e.target.value)}
                          fullWidth
                        />
                        <TextField
                          className="form-field"
                          label={t("settings.destinationPort")}
                          value={editDestPort}
                          onChange={(e) => setEditDestPort(e.target.value)}
                          type="number"
                          style={{ minWidth: 120 }}
                          helperText=" "
                        />
                      </Stack>
                    </Box>

                    <TextField
                      className="form-field"
                      label={t("form.maxPlayers")}
                      value={String(editMaxPlayers)}
                      onChange={(e) =>
                        setEditMaxPlayers(Number(e.target.value))
                      }
                      type="number"
                      fullWidth
                    />
                    <TextField
                      className="form-field"
                      label={t("form.iconUrl")}
                      value={editIconUrl}
                      onChange={(e) => setEditIconUrl(e.target.value)}
                      fullWidth
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={2} className="overview-secondary">
                    <Box className="info-block">
                      <Typography variant="subtitle2">
                        {t("tags.label")}
                      </Typography>
                      {tags.length > 0 ? (
                        <Stack
                          direction="row"
                          flexWrap="wrap"
                          gap={0.75}
                          className="tag-chip-group"
                        >
                          {tags.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                              className="tag-chip"
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" className="muted">
                          {t("tags.none")}
                        </Typography>
                      )}
                    </Box>
                    <Box className="info-block">
                      <Typography variant="subtitle2">
                        {t("settings.description")}
                      </Typography>
                      <TextField
                        className="form-field"
                        placeholder={t("form.description")}
                        multiline
                        rows={4}
                        fullWidth
                        value={editDocs}
                        onChange={(e) => setEditDocs(e.target.value)}
                      />
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </TabPanel>

          <TabPanel value="players" current={activeTab}>
            <CardContent className="tab-panel-content">
              <Stack spacing={3}>
                <Box className="player-summary-card">
                  <Typography variant="subtitle2" className="section-title">
                    {t("players.overview")}
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    className="player-summary-row"
                  >
                    <Box className="summary-stat">
                      <Typography variant="caption" className="muted">
                        {t("stats.online")}
                      </Typography>
                      <Typography variant="h6">
                        {server.playersOnline}
                      </Typography>
                    </Box>
                    <Box className="summary-stat">
                      <Typography variant="caption" className="muted">
                        {t("stats.available")}
                      </Typography>
                      <Typography variant="h6">{availableSlots}</Typography>
                    </Box>
                    <Box className="summary-stat">
                      <Typography variant="caption" className="muted">
                        {t("stats.limit")}
                      </Typography>
                      <Typography variant="h6">{server.maxPlayers}</Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box className="player-list-wrapper">
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    className="player-list-header"
                  >
                    <Typography variant="subtitle2" className="section-title">
                      {t("players.activeList")}
                    </Typography>
                    <Chip
                      label={`${displayedPlayers.length} ${t("stats.people")}`}
                      size="small"
                    />
                  </Stack>
                  <List dense className="player-list">
                    {displayedPlayers.length > 0 ? (
                      displayedPlayers.map((player, index) => (
                        <ListItem
                          key={player.id ?? player.name}
                          className="player-list-item"
                        >
                          <ListItemText
                            primary={player.name}
                            secondary={
                              <div className="player-secondary-row">
                                <div className="player-secondary-left">
                                  <Typography
                                    variant="caption"
                                    className="muted join-order"
                                  >
                                    {t("players.joinOrder")}: #{index + 1}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    className="muted join-time"
                                  >
                                    •{" "}
                                    {player.joinTime.toLocaleString("ja-JP", {
                                      month: "numeric",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    {t("players.joined")}
                                  </Typography>
                                </div>
                                {showPlayerIPs && player.ipAddress && (
                                  <Typography
                                    variant="caption"
                                    className="muted player-ip"
                                    title={`${player.ipAddress}${
                                      player.port ? `:${player.port}` : ""
                                    }`}
                                  >
                                    {player.ipAddress}
                                    {player.port ? `:${player.port}` : ""}
                                  </Typography>
                                )}
                              </div>
                            }
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem className="player-list-empty">
                        <ListItemText primary={t("players.noOnline")} />
                      </ListItem>
                    )}
                  </List>
                </Box>
              </Stack>
            </CardContent>
          </TabPanel>

          <TabPanel value="console" current={activeTab}>
            <CardContent className="tab-panel-content">
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle2" className="section-title">
                    {t("console.title")}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoScrollConsole}
                          onChange={(e) =>
                            setAutoScrollConsole(e.target.checked)
                          }
                          size="small"
                          color="primary"
                        />
                      }
                      label={
                        <Typography
                          variant="caption"
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          Auto-scroll
                        </Typography>
                      }
                      sx={{ m: 0 }}
                    />
                    <Chip
                      label={
                        server.status === "online" ? "ライブ" : "オフライン"
                      }
                      color={server.status === "online" ? "success" : "default"}
                      size="small"
                    />
                    {server.status === "online" && (
                      <Chip
                        label={`${consoleLines.length} 行`}
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Stack>
                </Stack>

                {/* プロセスが終了している場合は最後の終了コードやスニペットを表示 */}
                {server &&
                  (server as any).lastExit &&
                  server.status !== "online" && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {(server as any).lastExit.code !== null
                        ? `プロセスは終了しました（exit code: ${
                            (server as any).lastExit.code
                          }） - ${new Date(
                            (server as any).lastExit.time
                          ).toLocaleString()}`
                        : `プロセスは終了しました（signal: ${
                            (server as any).lastExit.signal
                          }） - ${new Date(
                            (server as any).lastExit.time
                          ).toLocaleString()}`}
                    </Alert>
                  )}

                {server &&
                  (server as any).lastConsoleSnippet &&
                  (server as any).lastConsoleSnippet.length > 0 &&
                  server.status !== "online" && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        直近のコンソール出力（デバッグ用）
                      </Typography>
                      <Box
                        sx={{
                          mt: 1,
                          p: 1,
                          backgroundColor: "#0f0f0f",
                          color: "#fff",
                          fontFamily: "monospace",
                          fontSize: 12,
                          borderRadius: 1,
                        }}
                      >
                        {((server as any).lastConsoleSnippet as string[]).map(
                          (line, idx) => (
                            <div
                              key={idx}
                              style={{
                                whiteSpace: "pre-wrap",
                                marginBottom: 4,
                              }}
                            >
                              {line}
                            </div>
                          )
                        )}
                      </Box>
                    </Box>
                  )}

                <Box className="console-output-wrapper">
                  <div
                    ref={consoleRef}
                    className="console-output"
                    style={{
                      maxHeight: "400px",
                      overflowY: "auto",
                      backgroundColor: "#1a1a1a",
                      color: "#ffffff",
                      fontFamily: 'Monaco, "Lucida Console", monospace',
                      fontSize: "12px",
                      padding: "12px",
                      borderRadius: "4px",
                      border: "1px solid #333",
                    }}
                  >
                    {consoleLines.length === 0 ? (
                      <div style={{ color: "#666", fontStyle: "italic" }}>
                        {server.status === "online"
                          ? "コンソール出力を待機中..."
                          : "サーバーがオフラインです"}
                      </div>
                    ) : (
                      consoleLines.map((line, i) => (
                        <div
                          key={i}
                          className="console-line"
                          style={{
                            marginBottom: "2px",
                            wordBreak: "break-all",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (consoleInput.trim()) {
                          handleConsoleCommand(consoleInput.trim());
                          setConsoleInput("");
                        }
                      }
                    }}
                    placeholder={
                      server.status === "online"
                        ? t("console.placeholder")
                        : "サーバーがオフラインです"
                    }
                    fullWidth
                    className="console-input"
                    size="small"
                    disabled={server.status !== "online"}
                    sx={{
                      "& .MuiInputBase-input": {
                        fontFamily: 'Monaco, "Lucida Console", monospace',
                        fontSize: "12px",
                      },
                    }}
                  />
                  <IconButton
                    color="primary"
                    onClick={() => {
                      if (!consoleInput.trim()) return;
                      handleConsoleCommand(consoleInput.trim());
                      setConsoleInput("");
                    }}
                    disabled={
                      !consoleInput.trim() || server.status !== "online"
                    }
                    aria-label="send-console"
                  >
                    <PlayArrowRoundedIcon />
                  </IconButton>
                </Stack>

                {server.status !== "online" && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    コンソール機能を使用するにはサーバーをオンラインにしてください
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </TabPanel>

          <TabPanel value="operations" current={activeTab}>
            <CardContent className="tab-panel-content operations-panel">
              <Stack spacing={4}>
                <Box>
                  <Typography variant="subtitle2" className="section-title">
                    {t("operations.title")}
                  </Typography>
                  <Typography variant="body2" className="muted">
                    {t("operations.description")}
                  </Typography>
                </Box>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  className="action-row"
                >
                  <Tooltip title={t("operations.start")}>
                    <span>
                      <IconButton
                        color="primary"
                        size="large"
                        className="action-button"
                        disabled={
                          server.status === "online" ||
                          server.status === "starting"
                        }
                        onClick={() => handleServerAction("start")}
                      >
                        <PlayArrowRoundedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t("operations.stop")}>
                    <span>
                      <IconButton
                        color="primary"
                        size="large"
                        className="action-button"
                        disabled={server.status !== "online"}
                        onClick={() => handleServerAction("stop")}
                      >
                        <StopRoundedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t("operations.restart")}>
                    <IconButton
                      color="primary"
                      size="large"
                      className="action-button"
                      onClick={() => handleServerAction("restart")}
                    >
                      <RestartAltRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" className="section-title">
                    {t("settings.auto")}
                  </Typography>
                  <Stack spacing={3} className="auto-settings">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoStart}
                          onChange={(e) => {
                            handleOperationChange(
                              "autoStart",
                              e.target.checked
                            );
                          }}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t("settings.autoStart")}
                          </Typography>
                          <Typography variant="caption" className="muted">
                            {t("settings.autoStartDesc")}
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoRestart}
                          onChange={(e) => {
                            handleOperationChange(
                              "autoRestart",
                              e.target.checked
                            );
                          }}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t("settings.autoRestart")}
                          </Typography>
                          <Typography variant="caption" className="muted">
                            {t("operations.autoRestartDesc")}
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={blockSameIP}
                          onChange={(e) => {
                            handleOperationChange(
                              "blockSameIP",
                              e.target.checked
                            );
                          }}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t("operations.blockSameIP")}
                          </Typography>
                          <Typography variant="caption" className="muted">
                            {t("operations.blockSameIPDesc")}
                          </Typography>
                        </Box>
                      }
                    />

                    <Box className="forward-settings">
                      <Typography variant="body2" gutterBottom>
                        {t("settings.backupForward")}
                      </Typography>
                      <Typography
                        variant="caption"
                        className="muted"
                        display="block"
                        gutterBottom
                      >
                        {t("operations.forwardDesc")}
                      </Typography>
                      <FormControl
                        fullWidth
                        size="small"
                        className="forward-select"
                      >
                        <InputLabel>
                          {t("settings.backupDestination")}
                        </InputLabel>
                        <Select
                          value={forwardAddress}
                          onChange={(e) => {
                            handleOperationChange(
                              "forwardAddress",
                              e.target.value
                            );
                          }}
                          label={t("settings.backupDestination")}
                        >
                          <MenuItem value="">
                            <em>{t("settings.forwardDisabled")}</em>
                          </MenuItem>
                          <MenuItem value="custom">
                            {t("form.customSettings")}
                          </MenuItem>
                        </Select>
                      </FormControl>

                      {forwardAddress === "custom" && (
                        <TextField
                          value={customForwardAddress}
                          onChange={(e) =>
                            setCustomForwardAddress(e.target.value)
                          }
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            handleSettingChange({ forwardAddress: newValue });
                          }}
                          placeholder={t("form.placeholderAddress")}
                          label={t("form.customForwardAddress")}
                          fullWidth
                          size="small"
                          className="forward-input"
                          style={{ marginTop: 12 }}
                        />
                      )}
                    </Box>
                  </Stack>
                </Box>

                {/* Save Operations Button */}
                <Box
                  sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveOperations}
                    disabled={!hasUnsavedOperations}
                  >
                    {t("form.save")}
                  </Button>
                </Box>

                <Divider />
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" className="section-title">
                    {t("settings.playerList")}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showPlayerIPs}
                        onChange={(e) =>
                          handleToggleShowPlayerIPs(e.target.checked)
                        }
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {t("settings.showPlayerIPs") ||
                            "プレイヤーのIPを表示"}
                        </Typography>
                        <Typography variant="caption" className="muted">
                          {t("settings.showPlayerIPsDesc") ||
                            "プライバシー保護のためデフォルトでは無効。サーバーごとに保存されます。"}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              </Stack>
            </CardContent>
          </TabPanel>

          {/* Plugins Tab */}
          <TabPanel value="plugins" current={activeTab}>
            <CardContent className="tab-panel-content">
              <Stack spacing={4}>
                <Box>
                  <Typography variant="subtitle2" className="section-title">
                    {t("plugins.title") || "プラグイン管理"}
                  </Typography>
                  <Typography variant="body2" className="muted">
                    {t("plugins.description") ||
                      "サーバーの機能を拡張するプラグインを管理します。"}
                  </Typography>
                </Box>

                {/* Enable Plugins Toggle */}
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={pluginsEnabled}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          setPluginsEnabled(newValue);
                          // 即座にサーバー設定を保存
                          try {
                            await bedrockProxyAPI.updateServer(server.id, {
                              pluginsEnabled: newValue,
                              // プラグイン有効化時に plugins オブジェクトを初期化
                              plugins: newValue
                                ? server.plugins || {}
                                : undefined,
                            });
                            setSnackbarMessage(
                              t("settings.saveSuccess") || "設定を保存しました"
                            );
                            setSnackbarSeverity("success");
                            setSnackbarOpen(true);
                          } catch (error) {
                            console.error(
                              "Failed to save pluginsEnabled:",
                              error
                            );
                            setSnackbarMessage(
                              t("settings.saveFailed") ||
                                "設定の保存に失敗しました"
                            );
                            setSnackbarSeverity("error");
                            setSnackbarOpen(true);
                          }
                        }}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {t("plugins.enablePlugins") || "プラグインを有効化"}
                        </Typography>
                        <Typography variant="caption" className="muted">
                          {t("plugins.enableDesc") ||
                            "プラグインシステムを有効にします。Node.jsが必要です。"}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>

                <Divider />

                {/* Plugins List */}
                {pluginsEnabled ? (
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 2 }}
                    >
                      <Typography variant="subtitle2" className="section-title">
                        {t("plugins.installedPlugins") ||
                          "インストール済みプラグイン"}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => loadPluginsData(true)}
                          disabled={loadingPlugins}
                        >
                          {loadingPlugins ? (
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                          ) : null}
                          {t("plugins.refresh") || "更新"}
                        </Button>
                      </Stack>
                    </Stack>

                    {plugins.length === 0 ? (
                      <Alert severity="info">
                        {t("plugins.noPlugins") ||
                          "プラグインが見つかりません。PEXData/plugins/ フォルダにJSファイルを配置してください。"}
                      </Alert>
                    ) : (
                      <Stack spacing={2}>
                        {plugins.map((plugin, index) => (
                          <Card
                            key={index}
                            variant="outlined"
                            sx={{ p: 2, cursor: "pointer" }}
                            onClick={() => {
                              setSelectedPlugin(plugin);
                              setPluginDetailsOpen(true);
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  fontWeight={600}
                                >
                                  {plugin.metadata?.name ||
                                    plugin.name ||
                                    "Unknown Plugin"}
                                </Typography>
                                <Typography variant="caption" className="muted">
                                  v
                                  {plugin.metadata?.version ||
                                    plugin.version ||
                                    "1.0.0"}{" "}
                                  {plugin.metadata?.author
                                    ? `by ${plugin.metadata.author}`
                                    : plugin.author
                                    ? `by ${plugin.author}`
                                    : ""}
                                </Typography>
                                {plugin.metadata?.description && (
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    {plugin.metadata.description}
                                  </Typography>
                                )}
                              </Box>
                              <Switch
                                checked={plugin.enabled || false}
                                onChange={(e) => {
                                  e.stopPropagation(); // Prevent card click when toggling switch
                                  // TODO: Toggle plugin enabled state
                                  const updated = [...plugins];
                                  updated[index].enabled = e.target.checked;
                                  setPlugins(updated);
                                }}
                                color="primary"
                              />
                            </Stack>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Box>
                ) : (
                  <Alert severity="warning">
                    {t("plugins.disabled") ||
                      "プラグインシステムが無効です。有効にしてプラグインを管理してください。"}
                  </Alert>
                )}

                <Box>
                  <Typography
                    variant="caption"
                    className="muted"
                    display="block"
                  >
                    {t("plugins.requirement") ||
                      "注意: プラグインを使用するにはNode.jsがインストールされている必要があります。"}
                  </Typography>
                  <Typography
                    variant="caption"
                    className="muted"
                    display="block"
                    sx={{ mt: 0.5 }}
                  >
                    {t("plugins.folder") ||
                      "プラグインの配置場所: PEXData/plugins/"}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </TabPanel>
        </Card>
      </Stack>

      {/* Unsaved Changes Dialog */}
      <Dialog
        open={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
      >
        <DialogTitle>
          {t("common.unsavedChanges") || "未保存の変更があります"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("common.unsavedChangesMessage") ||
              "操作パネルに未保存の変更があります。保存しますか？"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleConfirmNavigation(false)}
            color="inherit"
          >
            {t("common.cancel") || "キャンセル"}
          </Button>
          <Button
            onClick={() => handleConfirmNavigation(true)}
            color="primary"
            variant="contained"
          >
            {t("common.save") || "保存"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Plugin Details Modal */}
      <Dialog
        open={pluginDetailsOpen}
        onClose={() => setPluginDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedPlugin?.metadata?.name ||
            selectedPlugin?.name ||
            "Plugin Details"}
        </DialogTitle>
        <DialogContent>
          {selectedPlugin && (
            <Stack spacing={3}>
              {/* Basic Info */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  {t("plugins.basicInfo") || "基本情報"}
                </Typography>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Box flex={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.name") || "名前"}
                      </Typography>
                      <Typography variant="body1">
                        {selectedPlugin.metadata?.name ||
                          selectedPlugin.name ||
                          "Unknown"}
                      </Typography>
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.version") || "バージョン"}
                      </Typography>
                      <Typography variant="body1">
                        {selectedPlugin.metadata?.version ||
                          selectedPlugin.version ||
                          "1.0.0"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Box flex={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.author") || "作者"}
                      </Typography>
                      <Typography variant="body1">
                        {selectedPlugin.metadata?.author ||
                          selectedPlugin.author ||
                          "Unknown"}
                      </Typography>
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.license") || "ライセンス"}
                      </Typography>
                      <Typography variant="body1">
                        {selectedPlugin.metadata?.license || "Unknown"}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Box>

              {/* Description */}
              {selectedPlugin.metadata?.description && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t("plugins.description") || "説明"}
                  </Typography>
                  <Typography variant="body1">
                    {selectedPlugin.metadata.description}
                  </Typography>
                </Box>
              )}

              {/* Technical Details */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  {t("plugins.technicalDetails") || "技術詳細"}
                </Typography>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Box flex={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.pluginId") || "プラグインID"}
                      </Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {selectedPlugin.id}
                      </Typography>
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.status") || "状態"}
                      </Typography>
                      <Typography variant="body1">
                        {selectedPlugin.loaded ? (
                          <Chip
                            label={t("plugins.loaded") || "読み込み済み"}
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            label={t("plugins.failed") || "読み込み失敗"}
                            color="error"
                            size="small"
                          />
                        )}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t("plugins.filePath") || "ファイルパス"}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{ wordBreak: "break-all" }}
                    >
                      {selectedPlugin.filePath}
                    </Typography>
                  </Box>
                  {selectedPlugin.pluginPath && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("plugins.pluginPath") || "プラグインパス"}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontFamily="monospace"
                        sx={{ wordBreak: "break-all" }}
                      >
                        {selectedPlugin.pluginPath}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Dependencies */}
              {selectedPlugin.metadata?.dependencies &&
                Object.keys(selectedPlugin.metadata.dependencies).length >
                  0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {t("plugins.dependencies") || "依存関係"}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {Object.entries(selectedPlugin.metadata.dependencies).map(
                        ([name, version]) => (
                          <Chip
                            key={name}
                            label={`${name}@${version}`}
                            size="small"
                            variant="outlined"
                          />
                        )
                      )}
                    </Stack>
                  </Box>
                )}

              {/* Keywords */}
              {selectedPlugin.metadata?.keywords &&
                selectedPlugin.metadata.keywords.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {t("plugins.keywords") || "キーワード"}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {selectedPlugin.metadata.keywords.map(
                        (keyword: string) => (
                          <Chip
                            key={keyword}
                            label={keyword}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )
                      )}
                    </Stack>
                  </Box>
                )}

              {/* Additional Info */}
              {(selectedPlugin.metadata?.homepage ||
                selectedPlugin.metadata?.minBedrockProxyVersion) && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t("plugins.additionalInfo") || "追加情報"}
                  </Typography>
                  <Stack spacing={1}>
                    {selectedPlugin.metadata?.homepage && (
                      <Typography variant="body2">
                        <strong>
                          {t("plugins.homepage") || "ホームページ"}:
                        </strong>{" "}
                        <Link
                          href={selectedPlugin.metadata.homepage}
                          target="_blank"
                          rel="noopener"
                        >
                          {selectedPlugin.metadata.homepage}
                        </Link>
                      </Typography>
                    )}
                    {selectedPlugin.metadata?.minBedrockProxyVersion && (
                      <Typography variant="body2">
                        <strong>
                          {t("plugins.minVersion") ||
                            "最小BedrockProxyバージョン"}
                          :
                        </strong>{" "}
                        {selectedPlugin.metadata.minBedrockProxyVersion}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Error Info */}
              {selectedPlugin.error && (
                <Alert severity="error">
                  <Typography variant="subtitle2" gutterBottom>
                    {t("plugins.loadError") || "読み込みエラー"}
                  </Typography>
                  <Typography variant="body2">
                    {selectedPlugin.error}
                  </Typography>
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPluginDetailsOpen(false)}>
            {t("common.close") || "閉じる"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ServerDetails;
