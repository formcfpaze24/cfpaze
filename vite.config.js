import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Remplacez 'cfpa-ze' par le nom exact de votre dépôt GitHub
const REPO_NAME = "cfpa-ze";

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === "production" ? `/${REPO_NAME}/` : "/",
});
