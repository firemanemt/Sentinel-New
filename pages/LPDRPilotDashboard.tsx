import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

if (typeof document !== "undefined" && !document.getElementById("leaflet-css")) {
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

type Weather = {
  temp: number;
  wind: number;
  gust: number;
  windDir: number;
  precip: number;
  cloud: number;
  visibilityMi: number;
  weatherCode: number;
  humidity: number;
  isDay: boolean;
};

type Pin = { lat: number; lon: number; label: string };
type ToolMode = "pan" | "pin" | "polygon";

const PASSCODE = "9100";

function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3958.7613;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function polygonAreaSqMeters(points: Pin[]) {
  if (points.length < 3) return 0;
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length * Math.PI / 180;
  const R = 6378137;
  const xy = points.map(p => ({
    x: R * p.lon * Math.PI / 180 * Math.cos(lat0),
    y: R * p.lat * Math.PI / 180,
  }));
  let area = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) area += (xy[j].x + xy[i].x) * (xy[j].y - xy[i].y);
  return Math.abs(area / 2);
}


function generateSearchGrid(points: Pin[], spacingFt: number): Pin[][] {
  if (points.length < 3) return [];
  const minLat = Math.min(...points.map(p => p.lat));
  const maxLat = Math.max(...points.map(p => p.lat));
  const minLon = Math.min(...points.map(p => p.lon));
  const maxLon = Math.max(...points.map(p => p.lon));
  const midLat = (minLat + maxLat) / 2;
  const spacingMi = Math.max(20, spacingFt) / 5280;
  const latStep = spacingMi / 69;
  const lonPad = 0.0002;
  const lines: Pin[][] = [];
  let flip = false;
  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    const a = { lat, lon: minLon - lonPad, label: 'grid' };
    const b = { lat, lon: maxLon + lonPad, label: 'grid' };
    lines.push(flip ? [b, a] : [a, b]);
    flip = !flip;
    if (lines.length > 300) break;
  }
  return lines;
}

function flightCategory(w: Weather | null) {
  if (!w) return { label: "UNKNOWN", color: "#94a3b8", note: "Awaiting weather" };
  if (w.wind >= 22 || w.gust >= 30 || w.visibilityMi < 2 || w.precip > 0.2) return { label: "NO-GO", color: "#ef4444", note: "Wind/visibility/precip risk" };
  if (w.wind >= 15 || w.gust >= 22 || w.visibilityMi < 5 || w.precip > 0.05) return { label: "CAUTION", color: "#f59e0b", note: "Marginal drone conditions" };
  return { label: "GO", color: "#22c55e", note: "Conditions appear suitable" };
}

export default function LPDRPilotDashboard() {
  const [authorized, setAuthorized] = useState(() => localStorage.getItem("lpdr_pilot_auth") === "true");
  const [code, setCode] = useState("");
  const [center, setCenter] = useState<{ lat: number; lon: number }>({ lat: 42.10, lon: -75.91 });
  const [locationLabel, setLocationLabel] = useState("Current Location");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [mode, setMode] = useState<ToolMode>("pan");
  const [pins, setPins] = useState<Pin[]>([]);
  const [polyPoints, setPolyPoints] = useState<Pin[]>([]);
  const [gridSpacingFt, setGridSpacingFt] = useState(100);
  const [gridLines, setGridLines] = useState<Pin[][]>([]);
  const [search, setSearch] = useState("");
  const [radarOn, setRadarOn] = useState(true);
  const [satellite, setSatellite] = useState(true);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ markers?: any; poly?: any; pinLine?: any; grid?: any; radar?: any; base?: any }>({});

  const areaSqM = polygonAreaSqMeters(polyPoints);
  const acres = areaSqM / 4046.8564224;
  const sqMi = areaSqM / 2_589_988.110336;
  const pinDistance = useMemo(() => pins.length >= 2 ? milesBetween(pins[pins.length - 2], pins[pins.length - 1]) : 0, [pins]);
  const totalPinDistance = useMemo(() => pins.slice(1).reduce((sum, p, i) => sum + milesBetween(pins[i], p), 0), [pins]);
  const category = flightCategory(weather);

  const fetchWeather = async (lat: number, lon: number) => {
    const params = new URLSearchParams({
      latitude: String(lat), longitude: String(lon), timezone: "auto",
      temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch",
      current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day",
    });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const d = await r.json();
    const c = d.current;
    setWeather({
      temp: c.temperature_2m, humidity: c.relative_humidity_2m, precip: c.precipitation,
      weatherCode: c.weather_code, cloud: c.cloud_cover, wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m, gust: c.wind_gusts_10m, visibilityMi: (c.visibility ?? 0) / 1609.34,
      isDay: c.is_day === 1,
    });
  };

  const reverseGeo = async (lat: number, lon: number) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      const j = await r.json();
      const a = j.address ?? {};
      setLocationLabel([a.city || a.town || a.village || a.county || j.name, a.state].filter(Boolean).join(", ") || "Current Location");
    } catch {}
  };

  useEffect(() => {
    if (!authorized) return;
    navigator.geolocation?.getCurrentPosition(pos => {
      const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setCenter(c); fetchWeather(c.lat, c.lon); reverseGeo(c.lat, c.lon);
      mapRef.current?.setView([c.lat, c.lon], 15);
    }, () => fetchWeather(center.lat, center.lon), { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized || !mapDiv.current || mapRef.current) return;
    import("leaflet").then(async L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" });
      const map = L.map(mapDiv.current!, { center: [center.lat, center.lon], zoom: 14 });
      mapRef.current = map;
      layersRef.current.base = L.tileLayer(satellite ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", satellite ? { maxZoom: 20, maxNativeZoom: 16, attribution: "Esri" } : { maxZoom: 19, attribution: "OSM" }).addTo(map);
      layersRef.current.markers = L.layerGroup().addTo(map);
      map.on("click", (e: any) => {
        if (mode === "pin") setPins(prev => [...prev, { lat: e.latlng.lat, lon: e.latlng.lng, label: `Pin ${prev.length + 1}` }]);
        if (mode === "polygon") setPolyPoints(prev => [...prev, { lat: e.latlng.lat, lon: e.latlng.lng, label: `P${prev.length + 1}` }]);
      });
    });
  }, [authorized, mode, center.lat, center.lon, satellite]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    import("leaflet").then(L => {
      if (layersRef.current.base) map.removeLayer(layersRef.current.base);
      layersRef.current.base = L.tileLayer(satellite ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", satellite ? { maxZoom: 20, maxNativeZoom: 16 } : { maxZoom: 19 }).addTo(map);
    });
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    import("leaflet").then(async L => {
      layersRef.current.markers?.clearLayers();
      pins.forEach(p => L.marker([p.lat, p.lon]).addTo(layersRef.current.markers!).bindPopup(`${p.label}<br/>${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`));
      polyPoints.forEach(p => L.circleMarker([p.lat, p.lon], { radius: 4, color: "#00d4ff" }).addTo(layersRef.current.markers!));
      if (layersRef.current.poly) map.removeLayer(layersRef.current.poly);
      if (polyPoints.length >= 2) layersRef.current.poly = L.polygon(polyPoints.map(p => [p.lat, p.lon]), { color: "#00d4ff", fillColor: "#00d4ff", fillOpacity: 0.12 }).addTo(map);
      if (layersRef.current.pinLine) map.removeLayer(layersRef.current.pinLine);
      if (pins.length >= 2) layersRef.current.pinLine = L.polyline(pins.map(p => [p.lat, p.lon]), { color: "#ffcc33", dashArray: "5 5" }).addTo(map);
      if (layersRef.current.grid) map.removeLayer(layersRef.current.grid);
      if (gridLines.length) layersRef.current.grid = L.layerGroup(gridLines.map(line => L.polyline(line.map(p => [p.lat, p.lon]), { color: "#ff00aa", weight: 2, opacity: 0.85, dashArray: "8 6" }))).addTo(map);
    });
  }, [pins, polyPoints, gridLines]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    import("leaflet").then(async L => {
      if (layersRef.current.radar) { map.removeLayer(layersRef.current.radar); layersRef.current.radar = undefined; }
      if (!radarOn) return;
      try {
        const r = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const d = await r.json();
        const frame = d.radar?.past?.at(-1);
        if (frame) layersRef.current.radar = L.tileLayer(`https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.55 }).addTo(map);
      } catch {}
    });
  }, [radarOn]);

  useEffect(() => {
    if (!authorized) return;
    const t = setTimeout(() => mapRef.current?.invalidateSize?.(), 250);
    return () => clearTimeout(t);
  }, [authorized, satellite, radarOn, mode]);

  const doSearch = async () => {
    if (!search.trim()) return;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`);
    const j = await r.json();
    if (j[0]) {
      const c = { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) };
      setCenter(c); setLocationLabel(j[0].display_name.split(",").slice(0, 2).join(",")); fetchWeather(c.lat, c.lon);
      mapRef.current?.setView([c.lat, c.lon], 15);
    }
  };

  if (!authorized) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center p-6"><div className="max-w-md w-full border border-cyan-500/30 bg-cyan-500/5 rounded-xl p-6"><h1 className="text-2xl font-bold tracking-widest text-cyan-300">LPDR PILOT DASHBOARD</h1><p className="text-white/50 text-sm mt-2">Lost Pet Drone Recovery operational access.</p><Input className="mt-6 bg-black/40 border-cyan-500/30" type="password" placeholder="Passcode" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && code === PASSCODE) { localStorage.setItem("lpdr_pilot_auth", "true"); setAuthorized(true); } }} /><Button className="w-full mt-3 bg-cyan-500 text-black hover:bg-cyan-400" onClick={() => { if (code === PASSCODE) { localStorage.setItem("lpdr_pilot_auth", "true"); setAuthorized(true); } }}>Unlock</Button></div></div>;
  }

  return <div className="min-h-screen lg:h-screen w-screen bg-[#02070d] text-white grid grid-rows-[auto_1fr] font-mono overflow-hidden">
    <header className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 sm:p-3 border-b border-cyan-500/20 bg-black/80 sticky top-0 z-[1000]">
      <div className="font-bold tracking-[0.22em] sm:tracking-[0.25em] text-cyan-300 text-sm sm:text-base">LPDR PILOT OPS</div>
      <div className="text-white/40 text-[10px] sm:text-xs hidden xs:inline">Lost Pet Drone Recovery</div>
      <div className="flex-1"/>
      <div className="text-[10px] sm:text-xs text-white/50 truncate max-w-[150px] sm:max-w-xs">{locationLabel}</div>
      <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => { localStorage.removeItem("lpdr_pilot_auth"); setAuthorized(false); }}>Lock</Button>
    </header>
    <main className="grid grid-cols-1 lg:grid-cols-[360px_1fr_330px] min-h-0 overflow-y-auto lg:overflow-hidden">
      <aside className="order-2 lg:order-1 p-3 border-r border-cyan-500/20 overflow-visible lg:overflow-auto bg-black/40 space-y-3">
        <Panel title="Weather / Go-No-Go"><div className="flex items-center justify-between"><div className="text-4xl font-bold" style={{ color: category.color }}>{category.label}</div><div className="text-right text-xs text-white/50">{category.note}</div></div>{weather && <div className="grid grid-cols-2 gap-2 mt-4 text-sm"><Metric label="Temp" value={`${Math.round(weather.temp)}°F`} /><Metric label="Wind" value={`${Math.round(weather.wind)} mph`} /><Metric label="Gust" value={`${Math.round(weather.gust)} mph`} /><Metric label="Dir" value={`${Math.round(weather.windDir)}°`} /><Metric label="Visibility" value={`${weather.visibilityMi.toFixed(1)} mi`} /><Metric label="Cloud" value={`${weather.cloud}%`} /><Metric label="Humidity" value={`${weather.humidity}%`} /><Metric label="Precip" value={`${weather.precip.toFixed(2)} in`} /></div>}</Panel>
        <Panel title="Location Search"><div className="flex gap-2"><Input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Address, town, field..." className="bg-black/30 border-cyan-500/30"/><Button onClick={doSearch}>Go</Button></div></Panel>
        <Panel title="Map Tools"><div className="grid grid-cols-2 gap-2"><Tool active={mode==='pan'} onClick={()=>setMode('pan')} label="Pan"/><Tool active={mode==='pin'} onClick={()=>setMode('pin')} label="Drop Pins"/><Tool active={mode==='polygon'} onClick={()=>setMode('polygon')} label="Draw Area"/><Tool active={radarOn} onClick={()=>setRadarOn(!radarOn)} label="Radar"/><Tool active={satellite} onClick={()=>setSatellite(!satellite)} label="Satellite"/><Tool active={false} onClick={()=>{setPins([]);setPolyPoints([]);setGridLines([])}} label="Clear"/></div></Panel>
        <Panel title="Search Grid Generator"><div className="flex gap-2 items-center"><Input type="number" min={20} max={1000} value={gridSpacingFt} onChange={e=>setGridSpacingFt(Number(e.target.value)||100)} className="bg-black/30 border-cyan-500/30"/><span className="text-xs text-white/50">ft spacing</span></div><Button className="w-full mt-2 bg-pink-500/20 border border-pink-400/40 text-pink-200 hover:bg-pink-500/30" disabled={polyPoints.length<3} onClick={()=>setGridLines(generateSearchGrid(polyPoints, gridSpacingFt))}>Generate Lawnmower Grid</Button><div className="text-xs text-white/45 mt-2">Draw an area first, then generate parallel passes for search coverage.</div></Panel>
        <Panel title="Measurements"><Metric label="Last pin distance" value={`${pinDistance.toFixed(2)} mi`} /><Metric label="Total pin path" value={`${totalPinDistance.toFixed(2)} mi`} /><Metric label="Area" value={`${acres.toFixed(2)} acres`} /><Metric label="Square miles" value={`${sqMi.toFixed(4)} sq mi`} /><Metric label="Grid passes" value={`${gridLines.length}`} /></Panel>
      </aside>
      <section className="order-1 lg:order-2 relative h-[46vh] sm:h-[55vh] lg:h-auto min-h-[320px] lg:min-h-0 border-b lg:border-b-0 border-cyan-500/20">
        <div ref={mapDiv} className="absolute inset-0"/>
        <div className="absolute top-2 left-2 right-2 sm:right-auto bg-black/75 border border-cyan-500/30 rounded px-3 py-2 text-[11px] sm:text-xs text-cyan-200 pointer-events-none z-[500]">
          Mode: {mode.toUpperCase()} · {mode==='pin'?'tap map to drop pins':mode==='polygon'?'tap map to add polygon vertices':'drag/pinch map'}
        </div>
      </section>
      <aside className="order-3 lg:order-3 p-3 border-l border-cyan-500/20 overflow-visible lg:overflow-auto bg-black/40 space-y-3 pb-24 lg:pb-3">
        <Panel title="Aviation Briefing"><a className="link" target="_blank" href="https://notams.aim.faa.gov/notamSearch/" rel="noreferrer">FAA NOTAM Search ↗</a><a className="link" target="_blank" href="https://www.1800wxbrief.com/" rel="noreferrer">Leidos 1800WXBrief ↗</a><a className="link" target="_blank" href="https://tfr.faa.gov/tfr2/list.html" rel="noreferrer">FAA TFR List ↗</a><a className="link" target="_blank" href="https://aviationweather.gov/" rel="noreferrer">Aviation Weather Center ↗</a><p className="text-xs text-white/45 mt-3">Always verify NOTAMs/TFRs with official FAA briefing sources before flight.</p></Panel>
        <Panel title="Drone Pilot Checklist"><Check text="Airspace authorization / LAANC checked"/><Check text="NOTAMs and TFRs checked"/><Check text="Wind/gust limits acceptable"/><Check text="Visibility and precipitation acceptable"/><Check text="Battery plan and RTH altitude set"/><Check text="Visual observer / search grid briefed"/><Check text="Owner contact and pet details confirmed"/><Check text="Landing/emergency zones identified"/></Panel>
        <Panel title="Mission Notes"><textarea className="w-full h-40 bg-black/35 border border-cyan-500/25 rounded p-2 text-sm outline-none" placeholder="Pet details, last seen point, behavior, owner notes, hazards..."/></Panel>
      </aside>
    </main>
    <style>{`.leaflet-container{background:#07111d}.leaflet-control-zoom a{width:34px!important;height:34px!important;line-height:34px!important;font-size:20px!important}.link{display:block;color:#67e8f9;border:1px solid rgba(0,212,255,.2);padding:12px 14px;border-radius:8px;margin-bottom:8px;text-decoration:none;background:rgba(0,212,255,.05)}@media (max-width:1023px){.leaflet-control-attribution{font-size:9px!important}.leaflet-control-zoom{margin-bottom:16px!important}}`}</style>
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-cyan-500/20 bg-cyan-500/[0.04] rounded-lg p-3 sm:p-3"><h2 className="text-cyan-300 text-xs tracking-[0.2em] mb-3">{title.toUpperCase()}</h2>{children}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="flex justify-between border-b border-white/10 py-1"><span className="text-white/45">{label}</span><b>{value}</b></div>; }
function Tool({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`border rounded px-2 py-3 sm:py-2 text-xs min-h-[42px] sm:min-h-0 ${active ? "border-cyan-300 text-cyan-200 bg-cyan-400/10" : "border-white/10 text-white/55 bg-white/[0.03]"}`}>{label}</button>; }
function Check({ text }: { text: string }) { const [ok, setOk] = useState(false); return <label className="flex gap-2 items-start text-sm py-1 cursor-pointer"><input type="checkbox" checked={ok} onChange={e=>setOk(e.target.checked)} className="mt-1"/><span className={ok ? "text-green-300" : "text-white/70"}>{text}</span></label>; }
