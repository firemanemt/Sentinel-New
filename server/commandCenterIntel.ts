type IntelArticle = {
  title: string;
  url: string;
  domain?: string;
  sourcecountry?: string;
  seendate?: string;
};

type GdeltDocArticle = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  sourceCountry?: string;
  language?: string;
};

function stripXml(text: string) {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function fetchGoogleNews(query: string, limit = 12): Promise<IntelArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "NOVA/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const xml = await r.text();
    const out: IntelArticle[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) && out.length < limit) {
      const block = match[1];
      const titleRaw = (/<title[^>]*>([\s\S]*?)<\/title>/.exec(block)?.[1]) ?? "";
      const link = (/<link>([^<]+)<\/link>/.exec(block)?.[1]) ?? "";
      const pubDate = (/<pubDate>([^<]+)<\/pubDate>/.exec(block)?.[1]) ?? "";
      if (!titleRaw || !link) continue;
      let domain = "news.google.com";
      try { domain = new URL(link).hostname.replace("www.", ""); } catch {}
      out.push({ title: stripXml(titleRaw), url: link.trim(), domain, seendate: pubDate });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchGdeltDocs(query: string, limit = 10): Promise<IntelArticle[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${limit}&sort=HybridRel`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "NOVA/1.0" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const data = await r.json() as { articles?: GdeltDocArticle[] };
    return (data.articles ?? [])
      .filter(a => a.title && a.url)
      .map(a => ({
        title: a.title!,
        url: a.url!,
        domain: a.domain,
        sourcecountry: a.sourceCountry,
        seendate: a.seendate,
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchMilitaryAirCount() {
  try {
    const r = await fetch("https://api.adsb.lol/v2/mil", { headers: { "User-Agent": "NOVA/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json() as { ac?: unknown[]; total?: number };
    return d.total ?? d.ac?.length ?? null;
  } catch {
    return null;
  }
}

async function fetchKp() {
  try {
    const r = await fetch("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const d = await r.json() as Array<{ kp: number; time_tag: string }>;
    const latest = d[d.length - 1];
    return latest ? { kp: Number(latest.kp), time: latest.time_tag } : null;
  } catch {
    return null;
  }
}

async function fetchRecentEarthquakes() {
  try {
    const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/5.0_day.geojson", { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const d = await r.json() as any;
    return (d.features ?? []).slice(0, 8).map((f: any) => ({
      magnitude: f.properties?.mag,
      place: f.properties?.place,
      time: f.properties?.time ? new Date(f.properties.time).toISOString() : null,
      url: f.properties?.url,
    }));
  } catch {
    return [];
  }
}

function estimateRisk(query: string, articles: IntelArticle[], militaryAirCount: number | null, kp: { kp: number } | null) {
  const q = query.toLowerCase();
  let score = 10;
  const highRiskTerms = ["iran", "ukraine", "russia", "israel", "gaza", "palestine", "yemen", "sudan", "syria", "north korea", "taiwan"];
  if (highRiskTerms.some(t => q.includes(t))) score += 35;
  const text = articles.map(a => a.title.toLowerCase()).join(" ");
  const escalatory = ["strike", "airstrike", "missile", "drone", "explosion", "war", "attack", "mobilization", "nuclear", "sanction", "ceasefire", "invasion"];
  score += escalatory.reduce((n, term) => n + (text.includes(term) ? 6 : 0), 0);
  if ((militaryAirCount ?? 0) > 150) score += 8;
  if ((kp?.kp ?? 0) >= 5) score += 4;
  return Math.max(0, Math.min(99, score));
}

export async function getGeopoliticalIntel(input: {
  query: string;
  country?: string;
  maxArticles?: number;
}) {
  const query = input.country
    ? `${input.country} ${input.query || "geopolitical security conflict latest"}`
    : input.query;
  const maxArticles = Math.min(20, Math.max(5, input.maxArticles ?? 12));

  const expandedQuery = `${query} (conflict OR military OR government OR security OR diplomacy OR economy OR sanctions OR OSINT)`;
  const [gdelt, google, militaryAirCount, kp, earthquakes] = await Promise.all([
    fetchGdeltDocs(expandedQuery, maxArticles),
    fetchGoogleNews(expandedQuery, maxArticles),
    fetchMilitaryAirCount(),
    fetchKp(),
    fetchRecentEarthquakes(),
  ]);

  const merged: IntelArticle[] = [];
  for (const a of [...gdelt, ...google]) {
    if (!a.title || merged.some(x => x.title === a.title || x.url === a.url)) continue;
    merged.push(a);
    if (merged.length >= maxArticles) break;
  }

  const riskScore = estimateRisk(query, merged, militaryAirCount, kp);

  return {
    query,
    country: input.country ?? null,
    riskScore,
    riskTier: riskScore >= 75 ? "critical" : riskScore >= 50 ? "elevated" : riskScore >= 25 ? "watch" : "stable",
    signals: {
      articleCount: merged.length,
      militaryAirCount,
      spaceWeatherKp: kp,
      majorEarthquakes24h: earthquakes,
    },
    articles: merged,
    sourceNotes: [
      "GDELT DOC 2.0 article search",
      "Google News RSS public search",
      "ADSB.lol public military aircraft count",
      "NOAA SWPC planetary Kp index",
      "USGS M5+ earthquake feed",
    ],
    generatedAt: new Date().toISOString(),
  };
}
