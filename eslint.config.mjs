import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals, ...nextTs, {files:["components/app-shell.tsx"],rules:{"react-hooks/purity":"off"}}, globalIgnores([".next/**","next-env.d.ts"])]);
