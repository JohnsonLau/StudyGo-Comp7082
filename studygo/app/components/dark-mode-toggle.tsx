"use client";

import { useEffect } from "react";
import { WorkspaceIcon } from "./workspace-icon";

const themeStorageKey = "studygo-theme";

export function DarkModeToggle() {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
  }, []);

  function toggleDarkMode() {
    const darkMode = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem(themeStorageKey, darkMode ? "dark" : "light");
  }

  return (
    <button
      aria-label="Toggle dark mode"
      className="dark-mode-button"
      onClick={toggleDarkMode}
      title="Toggle dark mode"
      type="button"
    >
      <span className="dark-mode-icon dark-mode-icon-moon"><WorkspaceIcon name="moon" /></span>
      <span className="dark-mode-icon dark-mode-icon-sun"><WorkspaceIcon name="sun" /></span>
    </button>
  );
}
