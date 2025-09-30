import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme, responsiveFontSizes } from "@mui/material";
import App from "./App";

const baseTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#039be5",
    },
    background: {
      default: "#f3f6fb",
      paper: "rgba(255,255,255,0.92)",
    },
  },
  typography: {
    fontFamily: '"Noto Sans JP", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h3: {
      fontFamily: '"Montserrat", "Noto Sans JP", sans-serif',
    },
    h4: {
      fontFamily: '"Montserrat", "Noto Sans JP", sans-serif',
    },
    button: {
      borderRadius: 999,
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 18,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          paddingBlock: 12,
          paddingInline: 22,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: 0.2,
        },
      },
    },
  },
});

const theme = responsiveFontSizes(baseTheme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
