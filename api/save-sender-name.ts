import { createClient } from "@supabase/supabase-js";

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Safe health check: reports configuration presence only, never returns key values.
  if (req.method === "GET") {
    return res.status(200).json({
      endpoint: "save-sender-name",
      ready: Boolean(supabaseUrl && supabasePublishableKey),
      message: supabaseUrl && supabasePublishableKey
        ? "Supabase server configuration is present."
        : "Supabase server environment variables are missing.",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "허용되지 않은 요청 방식입니다." });
  }

  const body =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body) as unknown;
          } catch {
            return null;
          }
        })()
      : req.body;

  const senderName =
    body && typeof body === "object" && "senderName" in body &&
    typeof (body as { senderName?: unknown }).senderName === "string"
      ? (body as { senderName: string }).senderName.trim()
      : "";

  if (!senderName || senderName.length > 70) {
    return res.status(400).json({
      error: "송금인 이름은 1~70자로 입력해 주세요.",
    });
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    console.error("Server-side Supabase environment variables are missing.");
    return res.status(500).json({
      error: "Supabase 서버 설정이 완료되지 않았습니다.",
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error } = await supabase
      .from("input_db")
      .insert({ input: `송금인 이름: ${senderName}` });

    if (error) {
      console.error("Supabase sender-name insert failed:", error.message);
      return res.status(502).json({
        error: "송금인 이름 저장에 실패했습니다. Supabase 설정을 확인해 주세요.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Supabase sender-name API failed:", error);
    return res.status(500).json({
      error: "송금인 이름 저장 중 서버 오류가 발생했습니다.",
    });
  }
}
