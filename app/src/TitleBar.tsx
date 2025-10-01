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
        background: "linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%)",
        borderBottom: "1px solid #d1d1d6",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitAppRegion: "drag",
        padding: "0 12px",
      }}
    >
      {/* Mac-like window controls on the left */}
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ WebkitAppRegion: "no-drag" }}
      >
        <IconButton
          size="small"
          onClick={handleClose}
          className="titlebar-button mac-button mac-close"
          sx={{
            width: "12px",
            height: "12px",
            minWidth: "12px",
            minHeight: "12px",
            padding: 0,
            borderRadius: "50%",
            backgroundColor: "#ff5f57",
            border: "0.5px solid #e0443e",
            "&:hover": {
              backgroundColor: "#ff3b30",
            },
            "& svg": {
              display: "none",
            },
            "&:hover svg": {
              display: "block",
              fontSize: "10px",
              color: "#7d0e09",
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        <IconButton
          size="small"
          onClick={handleMinimize}
          className="titlebar-button mac-button mac-minimize"
          sx={{
            width: "12px",
            height: "12px",
            minWidth: "12px",
            minHeight: "12px",
            padding: 0,
            borderRadius: "50%",
            backgroundColor: "#ffbd2e",
            border: "0.5px solid #dea123",
            "&:hover": {
              backgroundColor: "#ffab00",
            },
            "& svg": {
              display: "none",
            },
            "&:hover svg": {
              display: "block",
              fontSize: "10px",
              color: "#995700",
            },
          }}
        >
          <MinimizeIcon />
        </IconButton>

        <IconButton
          size="small"
          onClick={handleMaximize}
          className="titlebar-button mac-button mac-maximize"
          sx={{
            width: "12px",
            height: "12px",
            minWidth: "12px",
            minHeight: "12px",
            padding: 0,
            borderRadius: "50%",
            backgroundColor: "#28c840",
            border: "0.5px solid #1fa032",
            "&:hover": {
              backgroundColor: "#20b038",
            },
            "& svg": {
              display: "none",
            },
            "&:hover svg": {
              display: "block",
              fontSize: "10px",
              color: "#006613",
            },
          }}
        >
          <MaximizeIcon />
        </IconButton>
      </Stack>

      {/* Centered title */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: "#1d1d1f",
            fontWeight: 600,
            fontSize: "13px",
            letterSpacing: "0.3px",
          }}
        >
          BedrockProxy
        </Typography>
      </Box>

      {/* Empty space for symmetry */}
      <Box sx={{ width: "60px" }} />
    </Box>
  );
}
