import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';

// NOVA Global Intel — custom Three.js OSINT globe
// No external globe tiles. Earth texture is generated client-side from GeoJSON,
// live data overlays are drawn as 3D points/arcs. This avoids Cesium/tile failures.

interface IntelItem { title: string; url: string; domain?: string; sourcecountry?: string; seendate?: string }
interface MarketItem { symbol: string; price: number; change: number; changePct: number; currency: string }
interface KevItem { cveID: string; vulnerabilityName: string; dateAdded: string; shortDescription: string; product: string; vendorProject: string }
interface Launch { id: string; name: string; net: string; status: { name: string }; rocket?: { configuration?: { name: string } }; launch_service_provider?: { name: string } }
interface GdeltPoint { lat: number; lon: number; name?: string; count?: number; status?: string; type?: string; avgGoldstein?: number; trend?: string; country?: string; sources?: string[]; _layer?: string }
interface GlobeArc { lat1: number; lon1: number; lat2: number; lon2: number; goldstein: number; name: string }
interface QuakePoint { lat: number; lon: number; mag: number; place: string; time: number; depth: number; url: string; _layer?: string }
interface NatEvent { lat: number; lon: number; title: string; category: string; categoryId: string; date: string; link: string; id: string; _layer?: string }
interface SatPoint { lat: number; lon: number; name: string; id: string; alt?: number; type?: string; _layer?: string }
interface AircraftPoint { hex: string; callsign: string; type: string; lat: number; lon: number; altitude?: number | null; speed?: number | null; heading?: number | null; squawk?: string | null; seen?: number | null; source?: string; country?: string | null; registration?: string | null; operator?: string | null; description?: string | null; _layer?: string }
interface KpEntry { time_tag: string; kp: number }
interface CryptoItem { id: string; symbol: string; name: string; current_price: number; price_change_percentage_24h: number }
interface PolyMarket { question: string; volume?: number; liquidity?: number; endDate?: string }
interface CountrySelection { feature: any; lat: number; lon: number; name: string; iso3?: string; region?: string; subregion?: string; population?: number; gdp?: number; area?: number; threat: number; localConflicts: GdeltPoint[] }

type Panel = 'intel' | 'markets' | 'cyber' | 'space' | 'weather' | 'events' | null;
type LayerKey = 'borders' | 'admin1' | 'pois' | 'conflicts' | 'arcs' | 'quakes' | 'events' | 'satellites' | 'aircraft';

const LAYER_LABELS: Record<LayerKey, string> = {
  borders: 'BORDERS', admin1: 'ADMIN-1', pois: 'POIS', conflicts: 'CONFLICTS', arcs: 'ARCS', quakes: 'QUAKES', events: 'EVENTS', satellites: 'SAT', aircraft: 'MIL AIR',
};

const CITY_LIGHTS = [
  [40.7,-74.0], [34.0,-118.2], [41.9,-87.6], [51.5,-0.1], [48.9,2.3], [52.5,13.4], [41.0,28.9],
  [50.5,30.5], [55.8,37.6], [30.0,31.2], [32.1,34.8], [24.7,46.7], [25.2,55.3], [35.7,51.4],
  [19.1,72.9], [28.6,77.2], [31.2,121.5], [35.7,139.7], [37.6,127.0], [1.35,103.8], [-33.9,151.2],
  [-23.5,-46.6], [-34.6,-58.4], [19.4,-99.1], [6.5,3.4], [-1.3,36.8], [14.7,-17.4], [33.3,44.4]
];

const EVENT_COLORS: Record<string, string> = {
  Wildfires: '#ff6a00', Volcanoes: '#ff3300', 'Severe Storms': '#ffcc00', Floods: '#00aaff', Earthquakes: '#ffaa00', default: '#55aaff',
};

export default function CommandCenter() {
  const mountRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<any>(null);
  const overlayGroupRef = useRef<any>(null);
  const autoRotateRef = useRef(true);
  const countriesLoadedRef = useRef(false);
  const adminLoadedRef = useRef(false);

  const [now, setNow] = useState(new Date());
  const [engineState, setEngineState] = useState<'booting' | 'online' | 'failed'>('booting');
  const [activePanel, setActivePanel] = useState<Panel>('intel');
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ borders: true, admin1: true, pois: true, conflicts: true, arcs: true, quakes: true, events: false, satellites: true, aircraft: true });
  const [autoRotate, setAutoRotate] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountrySelection | null>(null);
  const [countryNews, setCountryNews] = useState<IntelItem[]>([]);

  const [intel, setIntel] = useState<IntelItem[]>([]);
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [crypto, setCrypto] = useState<CryptoItem[]>([]);
  const [polymarkets, setPolymarkets] = useState<PolyMarket[]>([]);
  const [kev, setKev] = useState<KevItem[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [conflicts, setConflicts] = useState<GdeltPoint[]>([]);
  const [arcs, setArcs] = useState<GlobeArc[]>([]);
  const [quakes, setQuakes] = useState<QuakePoint[]>([]);
  const [events, setEvents] = useState<NatEvent[]>([]);
  const [satellites, setSatellites] = useState<SatPoint[]>([]);
  const [aircraft, setAircraft] = useState<AircraftPoint[]>([]);
  const [kp, setKp] = useState<number | null>(null);
  const [milFlights, setMilFlights] = useState<number | null>(null);
  const [countriesGeo, setCountriesGeo] = useState<any>(null);
  const [adminGeo, setAdminGeo] = useState<any>(null);

  const threatScore = useMemo(() => {
    const conflictWeight = conflicts.reduce((sum, c) => sum + Math.min(8, c.count || 1), 0);
    const quakeWeight = quakes.filter(q => q.mag >= 5).length * 4;
    const kpWeight = kp != null && kp >= 5 ? 10 : kp != null && kp >= 3 ? 4 : 0;
    return Math.min(99, Math.round(conflictWeight + quakeWeight + kpWeight));
  }, [conflicts, quakes, kp]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const getJson = useCallback(async <T,>(url: string, fallback: T): Promise<T> => {
    try { const r = await fetch(url); if (!r.ok) return fallback; return await r.json(); } catch { return fallback; }
  }, []);

  const refreshData = useCallback(async () => {
    const [news, mkt, gdelt, eq, nat, cisa, launchesData, kpData, mil, sats, cryptoData, polyData, countries, admin1] = await Promise.all([
      getJson<{ articles?: IntelItem[] }>('/api/command-center/gdelt-news', {}),
      getJson<{ markets?: MarketItem[] }>('/api/command-center/markets', {}),
      getJson<any>('/api/command-center/gdelt-24h', {}),
      getJson<{ features?: QuakePoint[] }>('/api/command-center/earthquakes', {}),
      getJson<{ events?: NatEvent[] }>('/api/command-center/natural-events', {}),
      getJson<{ vulnerabilities?: KevItem[] }>('/api/command-center/cisa-kev', {}),
      getJson<{ results?: Launch[] }>('/api/command-center/launches', {}),
      getJson<KpEntry[]>('/api/command-center/kp', []),
      getJson<{ count?: number; aircraft?: AircraftPoint[] }>('/api/command-center/mil-flights', {}),
      getJson<{ count?: number; satellites?: SatPoint[] }>('/api/command-center/satellites', {}),
      getJson<CryptoItem[]>('/api/command-center/crypto', []),
      getJson<{ markets?: PolyMarket[] }>('/api/command-center/polymarket', {}),
      getJson<any>('/api/command-center/boundaries/countries', null),
      getJson<any>('/api/command-center/boundaries/states', null),
    ]);
    setIntel(news.articles || []);
    setMarkets(mkt.markets || []);
    setCrypto(Array.isArray(cryptoData) ? cryptoData : []);
    setPolymarkets(polyData.markets || []);
    setKev(cisa.vulnerabilities || []);
    setLaunches(launchesData.results || []);
    setQuakes(eq.features || []);
    setEvents(nat.events || []);
    setMilFlights(mil.count ?? null);
    setAircraft((mil.aircraft || []).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon)));
    if (Array.isArray(kpData) && kpData.length) setKp(parseFloat(String(kpData[kpData.length - 1].kp)));
    setSatellites((sats.satellites || []).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon)));
    if (countries?.features && !countriesLoadedRef.current) { countriesLoadedRef.current = true; setCountriesGeo(countries); }
    if (admin1?.features && !adminLoadedRef.current) { adminLoadedRef.current = true; setAdminGeo(admin1); }
    const pts: GdeltPoint[] = (gdelt.features || []).map((f: any) => ({
      lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0], name: f.properties?.name,
      count: f.properties?.count || f.properties?.count24h, status: f.properties?.status, type: f.properties?.type,
      avgGoldstein: f.properties?.avgGoldstein, trend: f.properties?.trend, country: f.properties?.country, sources: f.properties?.sources,
    })).filter((p: GdeltPoint) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    setConflicts(pts);
    setArcs(gdelt.arcs || []);
  }, [getJson]);

  useEffect(() => { refreshData(); const t = setInterval(refreshData, 90_000); return () => clearInterval(t); }, [refreshData]);

  useEffect(() => {
    if (!selectedCountry?.name) { setCountryNews([]); return; }
    getJson<{ articles?: IntelItem[] }>(`/api/command-center/country-news?country=${encodeURIComponent(selectedCountry.name)}`, {})
      .then(d => setCountryNews(d.articles || []));
  }, [selectedCountry?.name, getJson]);

  // Three.js globe engine — self-contained texture, no tile dependencies.
  useEffect(() => {
    if (!mountRef.current) return;
    let disposed = false;
    let frame = 0;
    (async () => {
      try {
        const THREE = await import('three');
        if (disposed || !mountRef.current) return;
        const mount = mountRef.current;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(0, 0.48, 4.2);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const root = new THREE.Group();
        // Lift globe slightly so it is visually centered above the bottom toolbar/ticker.
        root.position.y = 0.24;
        root.rotation.y = -0.55;
        root.rotation.x = -0.18;
        scene.add(root);
        const overlay = new THREE.Group();
        overlayGroupRef.current = overlay;
        root.add(overlay);

        const tex = makeEarthTexture(THREE, countriesGeo, conflicts, adminGeo, layers);
        const globe = new THREE.Mesh(
          new THREE.SphereGeometry(1.52, 96, 96),
          new THREE.MeshStandardMaterial({ map: tex, color: '#88aacc', roughness: 0.9, metalness: 0.02, emissive: '#07101a', emissiveIntensity: 0.18 })
        );
        root.add(globe);

        // Soft atmospheric shells
        const atmo1 = new THREE.Mesh(new THREE.SphereGeometry(1.56, 96, 96), new THREE.MeshBasicMaterial({ color: '#69bfff', transparent: true, opacity: 0.105, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
        const atmo2 = new THREE.Mesh(new THREE.SphereGeometry(1.64, 96, 96), new THREE.MeshBasicMaterial({ color: '#a7d8ff', transparent: true, opacity: 0.055, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
        root.add(atmo1, atmo2);

        // Star field
        const starGeo = new THREE.BufferGeometry();
        const starPos: number[] = [];
        for (let i = 0; i < 1300; i++) {
          const r = 38 + Math.random() * 35, a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1);
          starPos.push(r * Math.sin(b) * Math.cos(a), r * Math.sin(b) * Math.sin(a), r * Math.cos(b));
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#9ccfff', size: 0.035, transparent: true, opacity: 0.65 })));

        const light = new THREE.DirectionalLight('#d8f0ff', 2.2);
        light.position.set(-3, 2.5, 4);
        scene.add(light, new THREE.AmbientLight('#6c9fe8', 0.65));

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const clickables: any[] = [];
        threeRef.current = { THREE, scene, camera, renderer, root, globe, overlay, clickables };

        // Manual orbit controls: drag rotates, wheel zooms. This avoids extra control dependencies.
        let dragging = false;
        let moved = false;
        let lastX = 0;
        let lastY = 0;
        const pointerDown = (e: PointerEvent) => {
          dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
          renderer.domElement.setPointerCapture?.(e.pointerId);
        };
        const pointerMove = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          lastX = e.clientX; lastY = e.clientY;
          root.rotation.y += dx * 0.0052;
          root.rotation.x += dy * 0.0038;
          root.rotation.x = Math.max(-1.15, Math.min(1.15, root.rotation.x));
          setAutoRotate(false);
        };
        const pointerUp = (e: PointerEvent) => {
          dragging = false;
          renderer.domElement.releasePointerCapture?.(e.pointerId);
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          camera.position.z += e.deltaY * 0.0035;
          camera.position.z = Math.max(2.25, Math.min(8.2, camera.position.z));
          setAutoRotate(false);
        };
        const onClick = (e: MouseEvent) => {
          if (moved) return;
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          const hits = raycaster.intersectObjects(clickables, false);
          const payload = hits.find(h => h.object?.userData?.payload)?.object.userData.payload;
          if (payload) { setSelected(payload); setSelectedCountry(null); setAutoRotate(false); return; }
          // Country click fallback: raycast the globe surface, convert point to lat/lon, then lookup GeoJSON polygon.
          const globeHits = raycaster.intersectObject(globe, false);
          const gh = globeHits[0];
          if (gh && countriesGeo?.features?.length) {
            const local = globe.worldToLocal(gh.point.clone());
            const ll = vecToLatLon(local);
            const country = findCountryAtLatLon(countriesGeo, ll.lat, ll.lon);
            if (country) {
              const props = country.properties || {};
              const countryName = props.NAME || props.ADMIN || props.NAME_EN || 'Unknown';
              const iso2 = props.ISO_A2 || props.WB_A2 || '';
              const iso3 = props.ISO_A3 || props.ADM0_A3 || '';
              const localConflicts = conflicts.filter(c =>
                countryCodeMatches(c.country, iso2, iso3) ||
                String(c.name || '').toLowerCase().includes(String(countryName).toLowerCase()) ||
                haversineKm(ll.lat, ll.lon, c.lat, c.lon) < 850
              );
              const threat = computeCountryThreat(localConflicts, quakes, events, ll.lat, ll.lon, countryName, iso2, iso3);
              setSelected(null);
              setSelectedCountry({
                feature: country, lat: ll.lat, lon: ll.lon,
                name: countryName,
                iso3,
                region: props.REGION_UN || props.CONTINENT,
                subregion: props.SUBREGION || props.REGION_WB,
                population: props.POP_EST,
                gdp: props.GDP_MD,
                area: props.AREA_KM2,
                threat,
                localConflicts,
              });
              setActivePanel(null);
              setAutoRotate(false);
            }
          }
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointermove', pointerMove);
        renderer.domElement.addEventListener('pointerup', pointerUp);
        renderer.domElement.addEventListener('pointercancel', pointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
        renderer.domElement.addEventListener('click', onClick);
        const resize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
        window.addEventListener('resize', resize);
        const animate = () => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          if (autoRotateRef.current) root.rotation.y += 0.0012;
          const t = performance.now() * 0.003;
          const zoomScale = Math.max(0.42, Math.min(1.15, camera.position.z / 4.2));
          overlay.children.forEach((obj: any) => {
            if (obj.userData?.markerRoot) obj.scale.setScalar(zoomScale);
            if (obj.userData?.pulse) {
              const s = (obj.userData.baseScale || 1) * (1 + Math.sin(t + obj.userData.phase) * obj.userData.pulse);
              obj.scale.setScalar(s);
            }
          });
          renderer.render(scene, camera);
        };
        animate();
        setEngineState('online');
        return () => {
          renderer.domElement.removeEventListener('pointerdown', pointerDown);
          renderer.domElement.removeEventListener('pointermove', pointerMove);
          renderer.domElement.removeEventListener('pointerup', pointerUp);
          renderer.domElement.removeEventListener('pointercancel', pointerUp);
          renderer.domElement.removeEventListener('wheel', onWheel);
          renderer.domElement.removeEventListener('click', onClick);
          window.removeEventListener('resize', resize);
        };
      } catch (err) { console.error(err); setEngineState('failed'); }
    })();
    return () => { disposed = true; cancelAnimationFrame(frame); try { threeRef.current?.renderer?.dispose?.(); } catch {} };
  }, [countriesGeo]);

  // Update threat-shaded country/admin texture without rebuilding the whole globe.
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx?.globe || !ctx.THREE || !countriesGeo) return;
    const nextTex = makeEarthTexture(ctx.THREE, countriesGeo, conflicts, adminGeo, layers);
    try { ctx.globe.material.map?.dispose?.(); } catch {}
    ctx.globe.material.map = nextTex;
    ctx.globe.material.needsUpdate = true;
  }, [countriesGeo, adminGeo, conflicts, layers.borders, layers.admin1]);

  // overlay sync
  useEffect(() => {
    const ctx = threeRef.current; if (!ctx) return;
    const { THREE, overlay, clickables } = ctx;
    overlay.clear(); clickables.length = 0;
    const addPoint = (p: any, layer: string, color: string, size = 0.035) => {
      const pos = latLonToVec(THREE, p.lat, p.lon, 1.575);
      const normal = pos.clone().normalize();
      const group = new THREE.Group();
      group.userData.markerRoot = true;
      group.position.copy(pos);
      group.lookAt(pos.clone().multiplyScalar(2));
      overlay.add(group);

      const payload = { ...p, _layer: layer };
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false });
      let core: any;
      if (layer === 'aircraft') {
        // Tactical aircraft silhouette, drawn in the local tangent plane.
        // Nose points north by default and rotates to ADS-B heading when available.
        const plane = new THREE.Shape();
        plane.moveTo(0, size * 1.65);                  // nose
        plane.lineTo(size * 0.42, size * 0.55);       // right fuselage
        plane.lineTo(size * 1.65, size * 0.02);       // right wingtip
        plane.lineTo(size * 0.46, -size * 0.34);      // right wing root
        plane.lineTo(size * 0.82, -size * 1.35);      // right tail
        plane.lineTo(0, -size * 1.16);                // tail center
        plane.lineTo(-size * 0.82, -size * 1.35);     // left tail
        plane.lineTo(-size * 0.46, -size * 0.34);     // left wing root
        plane.lineTo(-size * 1.65, size * 0.02);      // left wingtip
        plane.lineTo(-size * 0.42, size * 0.55);      // left fuselage
        plane.closePath();
        core = new THREE.Mesh(new THREE.ShapeGeometry(plane), material);
        if (p.heading != null) core.rotation.z = -Number(p.heading) * Math.PI / 180;
      } else {
        const coreGeo = layer === 'satellite'
          ? new THREE.TetrahedronGeometry(size * 1.15, 0)
          : new THREE.SphereGeometry(size * 0.72, 16, 16);
        core = new THREE.Mesh(coreGeo, material);
      }
      core.userData.payload = payload;
      group.add(core);
      clickables.push(core);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * (layer === 'conflict' ? 2.35 : 1.85), size * 0.105, 8, 42),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: layer === 'conflict' ? 0.58 : 0.42, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.userData.pulse = layer === 'aircraft' ? 0.06 : 0.14;
      ring.userData.baseScale = 1;
      ring.userData.phase = Math.random() * 10;
      if (layer === 'aircraft') ring.scale.set(1.35, 0.82, 1);
      group.add(ring);

      if (layer === 'aircraft' && p.heading != null) {
        const heading = Number(p.heading) * Math.PI / 180;
        const dirLen = size * 3.2;
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(heading) * dirLen, Math.cos(heading) * dirLen, 0)];
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }));
        group.add(line);
      }

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 2.8, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      glow.userData.pulse = 0.10;
      glow.userData.baseScale = 1;
      glow.userData.phase = Math.random() * 10;
      group.add(glow);
      group.userData.normal = normal;
    };
    if (layers.pois && countriesGeo?.features) countryPOIs(countriesGeo).slice(0, 220).forEach(p => addPoint(p, 'poi', '#ffe16a', 0.008));
    if (layers.conflicts) conflicts.forEach(p => addPoint(p, 'conflict', p.status === 'CRITICAL' ? '#ff2020' : '#ff6a39', Math.min(0.030, 0.012 + (p.count || 1) * 0.00075)));
    if (layers.quakes) quakes.forEach(q => addPoint(q, 'quake', magColor(q.mag), Math.max(0.012, (q.mag || 3) * 0.0038)));
    if (layers.events) events.forEach(e => addPoint(e, 'event', EVENT_COLORS[e.category] || EVENT_COLORS.default, 0.014));
    if (layers.satellites) satellites.forEach(s => addPoint(s, 'satellite', '#55f5ff', 0.015));
    if (layers.aircraft) aircraft.forEach(a => addPoint(a, 'aircraft', '#55f5ff', 0.011));
    if (layers.arcs) {
      [...arcs.slice(0, 60), ...makeCinematicArcs()].forEach((a: any) => {
        const curve = new THREE.QuadraticBezierCurve3(latLonToVec(THREE, a.lat1, a.lon1, 1.59), latLonMidVec(THREE, a.lat1, a.lon1, a.lat2, a.lon2, 2.15), latLonToVec(THREE, a.lat2, a.lon2, 1.59));
        const pts = curve.getPoints(40);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: (a.goldstein || 0) < -5 ? '#ff6a39' : '#b8dcff', transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending }));
        overlay.add(line);
      });
    }
  }, [layers, conflicts, quakes, events, satellites, aircraft, arcs]);

  const toggleLayer = (k: LayerKey) => setLayers(prev => ({ ...prev, [k]: !prev[k] }));

  return <div className="cc-root">
    <div className="cc-top"><Link href="/" className="cc-brand"><img src="/nova-icon.svg" alt="NOVA" className="cc-logo" />NOVA <b>GLOBAL INTEL</b></Link><Metric label="TIME" value={now.toLocaleTimeString('en-US',{hour12:false})} sub={now.toLocaleDateString('en-US',{month:'short',day:'2-digit'}).toUpperCase()} /><Metric label="THREAT" value={String(threatScore)} sub="PATTERN" hot={threatScore>40}/><Metric label="CONFLICTS" value={String(conflicts.length)} sub="GDELT" hot/><Metric label="KP" value={kp==null?'—':kp.toFixed(1)} sub={kp&&kp>=5?'STORM':'QUIET'} hot={!!kp&&kp>=5}/><Metric label="MIL AIR" value={milFlights==null?'—':String(milFlights)} sub="TRACKED"/><div className="cc-spacer"/><button className="cc-live" onClick={()=>setActivePanel('intel')}>● LIVE NEWS</button></div>
    <main className="cc-stage"><div className="cc-stars"/><div ref={mountRef} className="cc-globe"/><div className="cc-vignette"/>{engineState!=='online'&&<div className="cc-loader">{engineState==='failed'?'3D ENGINE FAILED':'INITIALISING 3D ENGINE'}</div>}<LayerLegend layers={layers} counts={{ borders:countriesGeo?.features?.length||0, admin1:adminGeo?.features?.length||0, pois:countryPOIs(countriesGeo).length, conflicts:conflicts.length, arcs:arcs.length, quakes:quakes.length, events:events.length, satellites:satellites.length, aircraft:aircraft.length }}/>{selected && (selected._layer==='aircraft'?<AircraftCard aircraft={selected} onClose={()=>{setSelected(null);setAutoRotate(true)}}/>:<PointCard point={selected} onClose={()=>{setSelected(null);setAutoRotate(true)}}/>)}{selectedCountry&&<CountryDossier country={selectedCountry} news={countryNews} onClose={()=>{setSelectedCountry(null);setAutoRotate(true)}}/>}{activePanel&& !selectedCountry && <IntelPanel panel={activePanel} setPanel={setActivePanel} intel={intel} markets={markets} crypto={crypto} polymarkets={polymarkets} kev={kev} launches={launches} quakes={quakes} events={events}/>}</main>
    <div className="cc-toolbar">{(['borders','admin1','pois','conflicts','arcs','quakes','events','satellites','aircraft'] as LayerKey[]).map(k=><button key={k} className={layers[k]?'on':''} onClick={()=>toggleLayer(k)}>{LAYER_LABELS[k]}</button>)}<span className="grow"/>{(['intel','markets','cyber','space','weather','events'] as Panel[]).map(p=><button key={p} className={activePanel===p?'on':''} onClick={()=>setActivePanel(activePanel===p?null:p)}>{String(p).toUpperCase()}</button>)}</div>
    <div className="cc-ticker"><b>LIVE</b><span>{intel.concat(intel).map((i,n)=><a key={n} href={i.url} target="_blank" rel="noreferrer">[{i.sourcecountry||i.domain||'OSINT'}] {i.title}</a>)}</span></div><style>{css}</style>
  </div>;
}

function makeEarthTexture(THREE: any, countriesGeo: any, conflicts: GdeltPoint[] = [], adminGeo: any = null, layers?: Record<LayerKey, boolean>) {
  const w = 4096, h = 2048;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0,0,w,h);
  grad.addColorStop(0,'#02050c'); grad.addColorStop(.45,'#07111d'); grad.addColorStop(1,'#00030a');
  ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
  const project=(lon:number,lat:number)=>[(lon+180)/360*w,(90-lat)/180*h];
  const threatFor = (props:any) => {
    const iso2=props.ISO_A2||props.WB_A2||'', iso3=props.ISO_A3||props.ADM0_A3||'', name=String(props.NAME||props.ADMIN||'').toLowerCase();
    const local=conflicts.filter(c=>countryCodeMatches(c.country, iso2, iso3)||String(c.name||'').toLowerCase().includes(name));
    return computeCountryThreat(local, [], [], Number(props.LABEL_Y)||0, Number(props.LABEL_X)||0, props.NAME || props.ADMIN || '', props.ISO_A2 || props.WB_A2 || '', props.ISO_A3 || props.ADM0_A3 || '');
  };
  const fillFor = (score:number) => score>=75?'rgba(180,34,42,.72)':score>=50?'rgba(210,88,32,.62)':score>=30?'rgba(170,135,26,.55)':'rgba(12,45,58,.76)';
  const strokeFor = (score:number) => score>=75?'rgba(255,92,80,.85)':score>=50?'rgba(255,160,60,.78)':score>=30?'rgba(255,210,80,.66)':'rgba(72,190,255,.34)';
  const drawRing=(ring:any[], fill:string, stroke:string, width=1.0)=>{
    ctx.beginPath(); ring.forEach((pt,i)=>{const [x,y]=project(pt[0],pt[1]); if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y);});
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=width; ctx.stroke();
  };
  if (layers?.borders !== false) {
    try { (countriesGeo?.features||[]).forEach((f:any)=>{const score=threatFor(f.properties||{}); const fill=fillFor(score), stroke=strokeFor(score); const g=f.geometry; if(g?.type==='Polygon') g.coordinates.forEach((r:any)=>drawRing(r,fill,stroke,1.15)); if(g?.type==='MultiPolygon') g.coordinates.forEach((poly:any)=>poly.forEach((r:any)=>drawRing(r,fill,stroke,1.15)));}); } catch {}
  }
  if (layers?.admin1 && adminGeo?.features) {
    ctx.strokeStyle='rgba(255,170,70,.36)'; ctx.lineWidth=0.55;
    const strokeRing=(ring:any[])=>{ctx.beginPath(); ring.forEach((pt,i)=>{const [x,y]=project(pt[0],pt[1]); if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y);}); ctx.stroke();};
    try { adminGeo.features.forEach((f:any)=>{const g=f.geometry; if(g?.type==='Polygon') g.coordinates.forEach(strokeRing); if(g?.type==='MultiPolygon') g.coordinates.forEach((poly:any)=>poly.forEach(strokeRing));}); } catch {}
  }
  // City/capital lights
  CITY_LIGHTS.forEach(([lat,lon])=>{const [x,y]=project(lon,lat); const r=8+Math.random()*10; const grd=ctx.createRadialGradient(x,y,0,x,y,r); grd.addColorStop(0,'rgba(255,255,220,.9)'); grd.addColorStop(.35,'rgba(150,210,255,.45)'); grd.addColorStop(1,'rgba(80,160,255,0)'); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();});
  const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
}
function latLonToVec(THREE:any, lat:number, lon:number, r:number){const phi=(90-lat)*Math.PI/180, theta=(lon+180)*Math.PI/180; return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta));}
function latLonMidVec(THREE:any, lat1:number, lon1:number, lat2:number, lon2:number, r:number){return latLonToVec(THREE,(lat1+lat2)/2,(lon1+lon2)/2,r);}
function makeCinematicArcs(){return [[40.7,-74,51.5,-.1],[51.5,-.1,25.2,55.3],[25.2,55.3,35.7,51.4],[51.5,-.1,50.5,30.5],[30,31.2,32.1,34.8],[25.2,55.3,19.1,72.9],[19.1,72.9,1.35,103.8],[1.35,103.8,35.7,139.7]].map(([lat1,lon1,lat2,lon2])=>({lat1,lon1,lat2,lon2,goldstein:0,name:'fabric'}));}


function countryPOIs(geo: any) {
  return (geo?.features || []).map((f: any) => {
    const p = f.properties || {};
    const lat = Number(p.LABEL_Y ?? p.LATITUDE ?? p.latitude);
    const lon = Number(p.LABEL_X ?? p.LONGITUDE ?? p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, name: p.ADM0CAP || p.CAPITAL || p.NAME || p.ADMIN || 'POI', country: p.ISO_A3 || p.ADM0_A3, type: 'Capital / POI' };
  }).filter(Boolean);
}

function vecToLatLon(v: any) {
  const r = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) || 1;
  const lat = 90 - Math.acos(v.y / r) * 180 / Math.PI;
  let lon = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat, lon };
}
function findCountryAtLatLon(geo: any, lat: number, lon: number) {
  const features = geo?.features || [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon' && polygonContains(g.coordinates, lon, lat)) return f;
    if (g.type === 'MultiPolygon' && g.coordinates.some((poly: any) => polygonContains(poly, lon, lat))) return f;
  }
  return null;
}
function polygonContains(poly: any[], lon: number, lat: number) {
  if (!poly?.[0]) return false;
  if (!pointInRing(poly[0], lon, lat)) return false;
  // holes
  for (let i = 1; i < poly.length; i++) if (pointInRing(poly[i], lon, lat)) return false;
  return true;
}
function pointInRing(ring: any[], lon: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function haversineKm(lat1:number, lon1:number, lat2:number, lon2:number) {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function countryCodeMatches(gdeltCode?: string, iso2?: string, iso3?: string) {
  if (!gdeltCode) return false;
  const c = gdeltCode.toUpperCase();
  const map: Record<string,string> = { UP:'UA', UK:'GB', IS:'IL', IR:'IR', SY:'SY', YM:'YE', SU:'SD', BM:'MM', KN:'KP', KS:'KR', CH:'CN', RS:'RU', US:'US', AF:'AF', IZ:'IQ', LE:'LB', SA:'SA', PK:'PK', IN:'IN', TW:'TW' };
  return c === iso2 || c === iso3 || map[c] === iso2;
}
function structuralThreatFloor(name?: string, iso2?: string, iso3?: string) {
  const n = String(name || '').toLowerCase();
  const c2 = String(iso2 || '').toUpperCase();
  const c3 = String(iso3 || '').toUpperCase();
  const code = c3 || c2;
  const floors: Record<string, number> = {
    IRN: 88, IR: 88,       // Iran — active-war / regional escalation floor
    ISR: 78, IL: 78,       // Israel
    PSE: 82, PS: 82,       // Palestine / Gaza
    RUS: 82, RU: 82,       // Russia
    UKR: 86, UA: 86,       // Ukraine
    YEM: 72, YE: 72,       // Yemen
    SDN: 76, SD: 76,       // Sudan
    SYR: 70, SY: 70,       // Syria
    LBN: 58, LB: 58,       // Lebanon
    PRK: 64, KP: 64,       // North Korea
    IRQ: 56, IQ: 56,       // Iraq
    MMR: 60, MM: 60,       // Myanmar
    AFG: 54, AF: 54,       // Afghanistan
    SOM: 52, SO: 52,       // Somalia
    HTI: 50, HT: 50,       // Haiti
    CHN: 42, CN: 42,       // China baseline strategic tension
    USA: 28, US: 28,       // US baseline major-power involvement
  };
  let base = floors[code] ?? floors[c2] ?? 4;
  if (n.includes('iran')) base = Math.max(base, 88);
  if (n.includes('ukraine')) base = Math.max(base, 86);
  if (n.includes('russia')) base = Math.max(base, 82);
  if (n.includes('israel')) base = Math.max(base, 78);
  if (n.includes('palestine') || n.includes('gaza')) base = Math.max(base, 82);
  if (n.includes('yemen')) base = Math.max(base, 72);
  if (n.includes('sudan')) base = Math.max(base, 76);
  return base;
}
function computeCountryThreat(localConflicts: GdeltPoint[], quakes: QuakePoint[], events: NatEvent[], lat: number, lon: number, name?: string, iso2?: string, iso3?: string) {
  const floor = structuralThreatFloor(name, iso2, iso3);
  const conflictLoad = localConflicts.reduce((sum, c) => sum + Math.min(18, (c.count || 1) * 1.6), 0);
  const goldstein = localConflicts.reduce((sum, c) => sum + Math.max(0, -(c.avgGoldstein || 0)) * 1.8, 0);
  const escalation = localConflicts.filter(c => c.trend === 'ESCALATING' || c.status === 'CRITICAL' || c.status === 'ACTIVE').length * 4;
  const severeQuakes = quakes.filter(q => q.mag >= 5 && haversineKm(lat, lon, q.lat, q.lon) < 900).length * 5;
  const naturalEvents = events.filter(e => haversineKm(lat, lon, e.lat, e.lon) < 900).length * 2;
  // Live signals add to the structural floor, but with diminishing returns so the scale remains readable.
  const live = Math.sqrt(Math.max(0, conflictLoad + goldstein + escalation)) * 3.4 + severeQuakes + naturalEvents;
  return Math.max(4, Math.min(99, Math.round(floor + live)));
}

function formatNumber(n?: number) { return n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

function magColor(mag:number){return mag>=7?'#ff0000':mag>=6?'#ff3300':mag>=5?'#ff8800':'#ffcc44'}
function Metric({label,value,sub,hot}:{label:string;value:string;sub:string;hot?:boolean}){return <div className="metric"><small>{label}</small><strong className={hot?'hot':''}>{value}</strong><em>{sub}</em></div>}
function LayerLegend({layers,counts}:{layers:Record<LayerKey,boolean>;counts:Record<string,number>}){
  const meta: Record<string,{icon:string;color:string}> = {
    borders:{icon:'▰',color:'#ffaa33'}, admin1:{icon:'╋',color:'#d99a38'}, pois:{icon:'◆',color:'#ffe16a'},
    conflicts:{icon:'●',color:'#ff5a45'}, arcs:{icon:'⌁',color:'#b8dcff'}, quakes:{icon:'◎',color:'#ffcc44'},
    events:{icon:'◆',color:'#ff8a33'}, satellites:{icon:'◇',color:'#55f5ff'}, aircraft:{icon:'✈',color:'#55f5ff'},
  };
  return <div className="legend">{Object.entries(layers).filter(([,v])=>v).map(([k])=>{
    const m=meta[k]||{icon:'●',color:'#9fcaff'};
    return <div key={k} style={{color:m.color}}><span className="legend-icon">{m.icon}</span>{LAYER_LABELS[k as LayerKey]} {counts[k]?`(${counts[k]})`:''}</div>;
  })}</div>
}

function CountryDossier({ country, news, onClose }: { country: CountrySelection; news: IntelItem[]; onClose: () => void }) {
  const threatLabel = country.threat >= 75 ? 'ACTIVE WAR' : country.threat >= 45 ? 'ELEVATED' : country.threat >= 25 ? 'WATCH' : 'STABLE';
  return <aside className="country-card">
    <header><div><small>{country.iso3 || 'UNK'} ▲ {threatLabel}</small><h2>{country.name}</h2><p>{country.region || 'Unknown region'} / {country.subregion || 'Unknown subregion'}</p></div><button onClick={onClose}>×</button></header>
    <section>
      <div className="threat"><strong>{country.threat}</strong><span>THREAT SCORE</span><i style={{width:`${country.threat}%`}} /></div>
      <div className="dossier-grid">
        <label>CAPITAL</label><b>{country.feature?.properties?.ADM0CAP || country.feature?.properties?.CAPITAL || '—'}</b>
        <label>POPULATION</label><b>{formatNumber(country.population)}</b>
        <label>GDP</label><b>{country.gdp ? `$${formatNumber(country.gdp)} M` : '—'}</b>
        <label>AREA</label><b>{country.area ? `${formatNumber(country.area)} km²` : '—'}</b>
        <label>LOCAL CONFLICTS</label><b>{country.localConflicts.length}</b>
      </div>
      {country.localConflicts.length > 0 && <><h4>LOCAL SIGNALS</h4>{country.localConflicts.slice(0,5).map((c,i)=><div className="mini-row" key={i}><b>{c.status || 'SIGNAL'}</b><span>{c.name || c.type || 'Conflict event'} · {c.count || 1} events</span></div>)}</>}
      <h4>LATEST NEWS</h4>
      {news.length === 0 && <div className="mini-row"><b>LOADING</b><span>Fetching country intelligence...</span></div>}
      {news.slice(0,8).map((n,i)=><a className="mini-row" href={n.url} target="_blank" rel="noreferrer" key={i}><b>{n.sourcecountry || n.domain || 'NEWS'}</b><span>{n.title}</span></a>)}
    </section>
  </aside>;
}

function AircraftCard({aircraft,onClose}:{aircraft:AircraftPoint;onClose:()=>void}){return <aside className="aircraft-card"><header><div><small>{aircraft.callsign||'UNKNOWN'} · {aircraft.country||'MIL'}</small><h2>{aircraft.hex?.toUpperCase()}</h2><p>{aircraft.type||aircraft.description||'Military Aircraft'}</p></div><button onClick={onClose}>×</button></header><section><h4>CURRENT POSITION</h4><dl><dt>ALTITUDE</dt><dd>{aircraft.altitude?`${Number(aircraft.altitude).toLocaleString()} ft`:'UNKNOWN'}</dd><dt>SPEED</dt><dd>{aircraft.speed?`${Math.round(Number(aircraft.speed))} kts`:'UNKNOWN'}</dd><dt>HEADING</dt><dd>{aircraft.heading!=null?`${Math.round(Number(aircraft.heading))}°`:'UNKNOWN'}</dd><dt>STATUS</dt><dd className="green">{aircraft.altitude===0?'GROUND':'AIRBORNE'}</dd><dt>LAT</dt><dd>{aircraft.lat?.toFixed(4)}°</dd><dt>LNG</dt><dd>{aircraft.lon?.toFixed(4)}°</dd><dt>SQUAWK</dt><dd>{aircraft.squawk||'—'}</dd><dt>SOURCE</dt><dd>{aircraft.source||'ADS-B'}</dd></dl><div className="unit"><b>LIKELY</b><strong>Military Aircraft</strong><span>Public ADS-B / MLAT position. Some aircraft may suppress or spoof transponder data.</span></div></section></aside>}
function PointCard({point,onClose}:{point:any;onClose:()=>void}){
  const layer = point._layer || 'signal';
  const title = point.name || point.title || point.place || point.callsign || 'LIVE SIGNAL';
  const rows: Array<[string,string]> = [];
  let accent = '#6bb6ff';
  let subtitle = layer.toUpperCase();
  let actionUrl: string | undefined;

  if (layer === 'quake') {
    accent = magColor(point.mag || 0);
    subtitle = `EARTHQUAKE · M${Number(point.mag || 0).toFixed(1)}`;
    rows.push(['Magnitude', `M${Number(point.mag || 0).toFixed(1)}`]);
    rows.push(['Depth', point.depth != null ? `${Number(point.depth).toFixed(1)} km / ${(Number(point.depth)*0.621).toFixed(1)} mi` : 'Unknown']);
    rows.push(['Time', point.time ? new Date(point.time).toLocaleString() : 'Unknown']);
    rows.push(['Coordinates', `${Number(point.lat).toFixed(3)}, ${Number(point.lon).toFixed(3)}`]);
    actionUrl = point.url;
  } else if (layer === 'event') {
    accent = EVENT_COLORS[point.category] || EVENT_COLORS.default;
    subtitle = `${point.category || 'NATURAL EVENT'}`;
    rows.push(['Category', point.category || 'Unknown']);
    rows.push(['Date', point.date ? new Date(point.date).toLocaleString() : 'Unknown']);
    rows.push(['Coordinates', `${Number(point.lat).toFixed(3)}, ${Number(point.lon).toFixed(3)}`]);
    actionUrl = point.link;
  } else if (layer === 'satellite') {
    accent = '#55f5ff';
    subtitle = `${point.type || 'SATELLITE'} · LIVE ORBIT`;
    rows.push(['Catalog ID', point.id || 'Unknown']);
    rows.push(['Type', point.type || 'Satellite']);
    rows.push(['Altitude', point.alt != null ? `${Number(point.alt).toLocaleString()} km / ${Math.round(Number(point.alt)*0.621).toLocaleString()} mi` : 'Unknown']);
    rows.push(['Position', `${Number(point.lat).toFixed(3)}, ${Number(point.lon).toFixed(3)}`]);
  } else if (layer === 'conflict') {
    accent = point.status === 'CRITICAL' ? '#ff3030' : '#ff7a35';
    subtitle = `${point.status || 'CONFLICT'} · ${point.trend || 'LIVE SIGNAL'}`;
    rows.push(['Status', point.status || 'Unknown']);
    rows.push(['Trend', point.trend || 'Unknown']);
    rows.push(['Events', String(point.count || 1)]);
    rows.push(['Goldstein', point.avgGoldstein != null ? String(point.avgGoldstein) : 'Unknown']);
    rows.push(['Coordinates', `${Number(point.lat).toFixed(3)}, ${Number(point.lon).toFixed(3)}`]);
    actionUrl = point.sources?.[0];
  } else if (layer === 'poi') {
    accent = '#ffe16a';
    subtitle = point.type || 'POINT OF INTEREST';
    rows.push(['Country', point.country || 'Unknown']);
    rows.push(['Type', point.type || 'POI']);
    rows.push(['Coordinates', `${Number(point.lat).toFixed(3)}, ${Number(point.lon).toFixed(3)}`]);
  } else {
    rows.push(['Layer', String(layer).toUpperCase()]);
    if (point.lat != null && point.lon != null) rows.push(['Coordinates', `${Number(point.lat).toFixed(3)}, ${Number(point.lon).toFixed(3)}`]);
  }

  return <div className="point-card clean-card" style={{borderColor: `${accent}66`, boxShadow: `0 0 80px ${accent}22`}}>
    <button onClick={onClose}>×</button>
    <div className="signal-kicker" style={{color:accent}}>● {subtitle}</div>
    <h3>{title}</h3>
    <div className="signal-table">
      {rows.map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}
    </div>
    {actionUrl && <a className="signal-action" href={actionUrl} target="_blank" rel="noreferrer" style={{borderColor:`${accent}66`, color:accent}}>OPEN SOURCE ↗</a>}
  </div>;
}
function IntelPanel({panel,setPanel,intel,markets,crypto,polymarkets,kev,launches,quakes,events}:any){return <aside className="panel"><header><b>{panel.toUpperCase()}</b><button onClick={()=>setPanel(null)}>×</button></header><div className="panel-body">{panel==='intel'&&intel.map((i:IntelItem,n:number)=><a className="row" key={n} href={i.url} target="_blank" rel="noreferrer"><b>{i.sourcecountry||i.domain||'OSINT'}</b><span>{i.title}</span></a>)}{panel==='markets'&&<>{markets.map((m:MarketItem)=><div className="row" key={m.symbol}><b>{m.symbol}</b><span>{m.price?.toLocaleString()} <em className={m.changePct>=0?'up':'down'}>{m.changePct?.toFixed(2)}%</em></span></div>)}{crypto.map((c:CryptoItem)=><div className="row" key={c.id}><b>{c.symbol.toUpperCase()}</b><span>${c.current_price?.toLocaleString()} <em className={c.price_change_percentage_24h>=0?'up':'down'}>{c.price_change_percentage_24h?.toFixed(2)}%</em></span></div>)}{polymarkets.slice(0,8).map((p:PolyMarket,i:number)=><div className="row" key={i}><b>POLY</b><span>{p.question}</span></div>)}</>}{panel==='cyber'&&kev.map((k:KevItem)=><div className="row" key={k.cveID}><b>{k.cveID}</b><span>{k.vulnerabilityName}</span></div>)}{panel==='space'&&launches.map((l:Launch)=><div className="row" key={l.id}><b>{l.status?.name}</b><span>{l.name}<em>{new Date(l.net).toLocaleString()}</em></span></div>)}{panel==='weather'&&quakes.map((q:QuakePoint)=><div className="row" key={q.time}><b>M{q.mag}</b><span>{q.place}</span></div>)}{panel==='events'&&events.map((e:NatEvent)=><div className="row" key={e.id}><b>{e.category}</b><span>{e.title}</span></div>)}</div></aside>}

const css=`@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700;800&display=swap');.cc-root{position:fixed;inset:0;background:#000;color:#dcecff;font-family:'Roboto Mono',monospace;overflow:hidden;display:flex;flex-direction:column}.cc-top{height:48px;background:linear-gradient(180deg,rgba(5,10,18,.95),rgba(0,0,0,.72));border-bottom:1px solid rgba(100,170,255,.22);display:flex;align-items:center;padding:0 16px;gap:16px;z-index:10}.cc-brand{color:#fff;text-decoration:none;font-weight:800;letter-spacing:3px;display:flex;align-items:center;gap:10px}.cc-logo{width:24px;height:24px;border-radius:7px;filter:drop-shadow(0 0 10px rgba(0,212,255,.45))}.cc-brand b{color:#6680a8;font-size:10px;margin-left:8px}.cc-pulse{display:inline-block;width:8px;height:8px;background:#66b5ff;border-radius:50%;box-shadow:0 0 12px #66b5ff;margin-right:8px;animation:pulse 2s infinite}.metric{min-width:72px;text-align:center;border-left:1px solid rgba(100,170,255,.14);padding-left:14px}.metric small,.metric em{display:block;color:#607090;font-size:9px;font-style:normal}.metric strong{display:block;color:#9fcaff;font-size:14px}.metric strong.hot{color:#ff5a45}.cc-spacer,.grow{flex:1}.cc-live{background:rgba(255,60,50,.12);border:1px solid rgba(255,60,50,.35);color:#ff665a;padding:7px 12px;font-family:inherit;letter-spacing:2px}.cc-stage{position:relative;flex:1;overflow:hidden;background:radial-gradient(circle at 50% 45%,#07111f,#01040a 48%,#000)}.cc-globe{position:absolute;inset:0;z-index:2;cursor:grab;touch-action:none}.cc-globe:active{cursor:grabbing}.cc-stars{position:absolute;inset:0;opacity:.9;background-image:radial-gradient(circle at 20% 30%,#8dbdff 0 1px,transparent 1px),radial-gradient(circle at 80% 60%,#fff 0 1px,transparent 1px);background-size:180px 180px,320px 320px}.cc-vignette{position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(circle at 41% 43%,rgba(170,215,255,.13) 0 1%,transparent 22%,transparent 58%,rgba(0,0,0,.2))}.cc-loader{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;letter-spacing:4px;color:#7db8ff;background:rgba(0,0,0,.65)}.legend{position:absolute;top:16px;left:16px;z-index:4;color:#9fcaff;font-size:10px;letter-spacing:2px}.legend div{margin:5px 0;text-shadow:0 0 8px currentColor}.legend i{display:none}.legend-icon{display:inline-block;width:16px;margin-right:7px;text-align:center;font-size:12px}.panel{position:absolute;top:0;right:0;bottom:0;width:410px;z-index:6;background:linear-gradient(180deg,rgba(5,10,18,.96),rgba(0,0,0,.98));border-left:1px solid rgba(100,170,255,.24);box-shadow:-28px 0 90px rgba(0,0,0,.65);backdrop-filter:blur(18px)}.panel header{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid rgba(100,170,255,.18);letter-spacing:3px}.panel button,.point-card button{background:transparent;border:1px solid #263449;color:#93b9e8}.panel-body{height:calc(100% - 46px);overflow:auto;padding:12px}.row{display:block;color:#dcecff;text-decoration:none;padding:10px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);margin-bottom:8px}.row b{display:block;color:#6bb6ff;font-size:10px;letter-spacing:2px}.row span{display:block;font-size:12px;line-height:1.4}.row em{display:block;color:#6d7890;font-size:10px;margin-top:4px}.up{color:#20ff88!important}.down{color:#ff564a!important}.cc-toolbar{height:54px;background:linear-gradient(0deg,rgba(2,6,12,.96),rgba(0,0,0,.78));border-top:1px solid rgba(100,170,255,.2);display:flex;align-items:center;gap:6px;padding:0 10px;z-index:10}.cc-toolbar button{background:transparent;border:1px solid #1d2a3d;color:#607090;font-family:inherit;font-size:10px;letter-spacing:1px;padding:7px 10px}.cc-toolbar button.on{color:#9fcaff;border-color:#458ee8;background:rgba(80,160,255,.12)}.cc-ticker{height:30px;background:#000;border-top:1px solid rgba(255,50,50,.24);display:flex;align-items:center;z-index:10;overflow:hidden}.cc-ticker b{color:#ff4b3d;padding:0 14px;border-right:1px solid rgba(255,50,50,.22)}.cc-ticker span{display:flex;gap:90px;white-space:nowrap;animation:ticker 260s linear infinite;will-change:transform}.cc-ticker:hover span{animation-play-state:paused}.cc-ticker a{color:#dcecff;text-decoration:none;font-size:12px;letter-spacing:.04em;line-height:30px}.cc-ticker a:before{content:'◆';color:#ff4b3d;margin-right:10px}.country-card{position:absolute;right:0;top:0;bottom:0;width:430px;z-index:25;background:linear-gradient(180deg,rgba(4,9,16,.98),rgba(0,0,0,.98));border-left:2px solid #33d8ff;box-shadow:-28px 0 90px rgba(0,0,0,.75);backdrop-filter:blur(18px);overflow:hidden}.country-card header{display:flex;justify-content:space-between;padding:22px 24px;border-bottom:1px solid rgba(80,220,255,.22)}.country-card small{color:#ff5a5a;font-size:10px;letter-spacing:3px}.country-card h2{font-size:20px;margin:8px 0 6px;color:#fff}.country-card p{color:#8fb9ec;margin:0;font-size:12px}.country-card button{background:transparent;border:1px solid #26506a;color:#7ee8ff}.country-card section{height:calc(100% - 112px);overflow:auto;padding:20px 24px}.country-card .threat{display:grid;grid-template-columns:90px 1fr;align-items:center;gap:10px;margin-bottom:22px}.country-card .threat strong{font-size:44px;color:#ff5a5a}.country-card .threat span{font-size:10px;letter-spacing:3px;color:#fff}.country-card .threat i{grid-column:1/3;height:6px;background:linear-gradient(90deg,#ff9f1a,#ff3030);border-radius:6px;display:block}.dossier-grid{display:grid;grid-template-columns:130px 1fr;gap:14px 12px;border:1px solid rgba(255,255,255,.08);padding:18px;margin-bottom:22px}.dossier-grid label{color:#9fb0ca;font-size:10px;letter-spacing:3px}.dossier-grid b{color:#6ff1ff;text-align:right}.country-card h4{font-size:11px;letter-spacing:4px;color:#25d8ff;margin:22px 0 10px}.mini-row{display:block;text-decoration:none;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);padding:10px;margin-bottom:8px}.mini-row b{display:block;color:#ffcc55;font-size:10px;letter-spacing:2px}.mini-row span{display:block;color:#dcecff;font-size:12px;line-height:1.4;margin-top:4px}.aircraft-card{position:absolute;left:16px;top:56px;bottom:92px;width:360px;z-index:24;background:rgba(4,9,16,.96);border:1px solid rgba(220,240,255,.75);box-shadow:0 0 70px rgba(0,0,0,.65);backdrop-filter:blur(18px);color:#dcecff;overflow:hidden}.aircraft-card header{display:flex;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.16)}.aircraft-card small{display:block;color:#aab7ca;font-size:10px;letter-spacing:3px}.aircraft-card h2{font-size:16px;margin:6px 0 4px}.aircraft-card p{margin:0;color:#9aa8bd;font-size:12px}.aircraft-card button{background:transparent;border:1px solid rgba(220,240,255,.5);color:#dcecff}.aircraft-card section{height:calc(100% - 92px);overflow:auto;padding:18px 20px}.aircraft-card h4{font-size:10px;letter-spacing:3px;color:#7d8ca3;margin:0 0 12px}.aircraft-card dl{display:grid;grid-template-columns:110px 1fr;gap:8px 10px;font-size:12px}.aircraft-card dt{color:#7d8ca3;letter-spacing:2px}.aircraft-card dd{margin:0;color:#e7f2ff}.aircraft-card .green{color:#20ff88;font-weight:bold}.aircraft-card .unit{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);padding:14px;margin-top:14px}.aircraft-card .unit b{background:#a48a00;color:#ffea61;font-size:10px;padding:4px 10px}.aircraft-card .unit strong{display:block;margin-top:12px}.aircraft-card .unit span{display:block;color:#93a2b8;font-size:11px;margin-top:8px;line-height:1.5}.point-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;width:430px;max-width:90vw;background:rgba(4,8,14,.97);border:1px solid rgba(100,170,255,.28);box-shadow:0 0 80px rgba(60,130,255,.18);padding:18px}.point-card button{position:absolute;right:12px;top:12px}.clean-card h3{font-size:22px;line-height:1.2;margin:18px 36px 16px 0;color:#fff}.signal-kicker{font-size:11px;letter-spacing:3px;text-transform:uppercase}.signal-table{border-top:1px solid rgba(255,255,255,.08);margin-top:10px}.signal-table div{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07)}.signal-table span{color:#7f91aa;font-size:10px;letter-spacing:2px;text-transform:uppercase}.signal-table b{color:#dcecff;font-size:13px;text-align:right;word-break:break-word}.signal-action{display:block;margin-top:16px;text-align:center;text-decoration:none;border:1px solid rgba(100,170,255,.4);padding:9px 12px;font-size:11px;letter-spacing:2px;font-weight:800}@keyframes pulse{50%{opacity:.35}}@keyframes ticker{to{transform:translateX(-50%)}}`;
