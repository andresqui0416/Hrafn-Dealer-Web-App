"use client";

import { config } from "@fortawesome/fontawesome-svg-core";

// Tell Font Awesome to skip adding the CSS automatically since it's already imported in globals.css
config.autoAddCss = false;

export function FontAwesomeConfig() {
  // This component just ensures the config is set
  return null;
}
