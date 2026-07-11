import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nora: "#00c20d",
        gridline: "#130fff",
        both: "#ff0000",
      },
    },
  },
  plugins: [],
};
export default config;
