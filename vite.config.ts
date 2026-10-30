import { createClient } from "@supabase/supabase-js";
import { defineConfig, loadEnv } from "vite";

function localSenderNameApi(env: Record<string, string>) {
  return {
    name: "local-sender-name-api",
    configureServer(server: any) {
      server.middlewares.use("/api/save-sender-name", (req: any, res: any) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "허용되지 않은 요청 방식입니다." }));
          return;
        }

        let rawBody = "";
        req.on("data", (chunk: unknown) => {
          rawBody += String(chunk);
          if (rawBody.length > 4096) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: "요청 크기가 너무 큽니다." }));
            req.destroy();
          }
        });

        req.on("end", async () => {
          let body: any;
          try {
            body = JSON.parse(rawBody);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }));
            return;
          }

          const senderName =
            typeof body?.senderName === "string" ? body.senderName.trim() : "";

          if (!senderName || senderName.length > 70) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "송금인 이름은 1~70자로 입력해 주세요." }));
            return;
          }

          // Support both the preferred server-only names and existing VITE_ names.
          // loadEnv reads these only for this local server middleware.
          const supabaseUrl =
            env.SUPABASE_URL || env.VITE_SUPABASE_URL;
          const supabasePublishableKey =
            env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !supabasePublishableKey) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Supabase 서버 설정이 완료되지 않았습니다." }));
            return;
          }

          try {
            const supabase = createClient(
              supabaseUrl,
              supabasePublishableKey,
              {
                auth: {
                  persistSession: false,
                  autoRefreshToken: false,
                  detectSessionInUrl: false,
                },
              },
            );

            const { error } = await supabase
              .from("input_db")
              .insert({ input: `송금인 이름: ${senderName}` });

            if (error) {
              console.error("Local Supabase sender-name insert failed:", error.message);
              res.statusCode = 502;
              res.end(JSON.stringify({
                error: "송금인 이름 저장에 실패했습니다. Supabase 설정을 확인해 주세요.",
              }));
              return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            console.error("Local Supabase sender-name API failed:", error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "송금인 이름 저장 중 서버 오류가 발생했습니다." }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // No prefix filter here: these values are consumed only by this server-side config.
  // They are never injected into import.meta.env or the browser bundle.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // Do not expose any user-defined environment variables through import.meta.env.
    // Supabase values are consumed exclusively by the server endpoint/middleware.
    envPrefix: [],
    plugins: [localSenderNameApi(env)],
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
  };
});
