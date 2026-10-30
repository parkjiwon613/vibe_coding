import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api/exchange-rate": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/v8/finance/chart/USDKRW%3DX?range=1d&interval=1m",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HanaBusinessSuite/1.0)",
        },
      },
    },
  },
});
