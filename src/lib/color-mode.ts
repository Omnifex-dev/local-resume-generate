/** Light/dark mode: the choice is kept in localStorage; <html class="dark"> applies it. */
export type ColorMode = "light" | "dark";

export const COLOR_MODE_KEY = "color-mode";

/**
 * Runs in <head> before the page paints, so there is no flash of the wrong mode.
 * No saved choice → dark (the original look).
 */
export const colorModeScript = `(function(){try{var m=localStorage.getItem("${COLOR_MODE_KEY}");}catch(e){}var d=m!=="light";var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";})();`;

export function applyColorMode(mode: ColorMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  try {
    localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    /* private window: the choice lasts for this page only */
  }
}
