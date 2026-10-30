type ApiRequest = { method?: string };
type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const yahooUrl =
      "https://query1.finance.yahoo.com/v8/finance/chart/USDKRW%3DX?range=1d&interval=1m";
    const upstream = await fetch(yahooUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; HanaBusinessSuite/1.0)",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return res.status(502).json({
        error: "Yahoo Finance quote request failed",
        upstreamStatus: upstream.status,
      });
    }

    const payload = await upstream.json();
    const result = payload?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    const closes = result?.indicators?.quote?.[0]?.close;
    const lastClose = Array.isArray(closes)
      ? closes.slice().reverse().find(
          (value: unknown) => typeof value === "number" && Number.isFinite(value),
        )
      : undefined;

    if (
      typeof price !== "number" &&
      (typeof lastClose !== "number" || !Number.isFinite(lastClose))
    ) {
      return res.status(502).json({ error: "Yahoo Finance returned no USD/KRW quote" });
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=30");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(payload);
  } catch {
    return res.status(502).json({ error: "Unable to retrieve Yahoo Finance quote" });
  }
}
