import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext";
import { AccessibilityProvider } from "./context/AccessibilityContext";

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <AccessibilityProvider>
      <App />
    </AccessibilityProvider>
  </ThemeProvider>
);
