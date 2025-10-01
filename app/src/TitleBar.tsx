import { Box, IconButton, Stack, Typography } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Minimize";
import MaximizeIcon from "@mui/icons-material/CropSquare";
import CloseIcon from "@mui/icons-material/Close";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import "./css/TitleBar.css";

const appWindow = getCurrentWindow();

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for window state changes
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <Box
      className="titlebar"
      data-tauri-drag-region
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "40px",
        background: "linear-gradient(135deg, #1a73e8 0%, #1565c0 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitAppRegion: "drag",
        padding: "0 8px",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: "white",
            fontWeight: 600,
            fontSize: "14px",
            letterSpacing: "0.5px",
          }}
        >
          BedrockProxy
        </Typography>
      </Stack>

      <Stack
        direction="row"
        spacing={0}
        className="titlebar-buttons"
        sx={{ WebkitAppRegion: "no-drag" }}
      >
        <IconButton
          size="small"
          onClick={handleMinimize}
          className="titlebar-button"
          sx={{
            color: "white",
            borderRadius: 0,
            width: "46px",
            height: "40px",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          <MinimizeIcon fontSize="small" />
        </IconButton>

        <IconButton
          size="small"
          onClick={handleMaximize}
          className="titlebar-button"
          sx={{
            color: "white",
            borderRadius: 0,
            width: "46px",
            height: "40px",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          <MaximizeIcon fontSize="small" />
        </IconButton>

        <IconButton
          size="small"
          onClick={handleClose}
          className="titlebar-button titlebar-close"
          sx={{
            color: "white",
            borderRadius: 0,
            width: "46px",
            height: "40px",
            "&:hover": {
              backgroundColor: "#e81123",
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}
