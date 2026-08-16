import { useAuth } from "@/_core/hooks/useAuth";
import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { CircleAlert, Crosshair, LocateFixed, MapPinned, Navigation, Pause, Play, Route, ShieldCheck, Truck } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const copy = {
  ar: { eyebrow: "واجهة السائق", title: "جولتي الميدانية", subtitle: "المسار والمحطات ومشاركة الموقع لا تظهر إلا ضمن الجولات المسندة إليك.", back: "مركز العمليات", tracking: "تتبع الموقع", trackingHint: "يُستخدم الموقع لتسجيل تقدم الجولة فقط، ويمكن إيقافه في أي وقت.", consent: "أوافق على مشاركة موقعي أثناء الجولة النشطة.", startTracking: "بدء مشاركة الموقع", stopTracking: "إيقاف مشاركة الموقع", trackingOn: "الموقع قيد المشاركة", trackingOff: "الموقع متوقف", gpsUnavailable: "لا يدعم هذا الجهاز تحديد الموقع أو تم رفض الإذن.", gpsError: "تعذر تحديث الموقع حالياً.", activeRoute: "الجولة الحالية", noRoute: "لا توجد جولة مسندة ونشطة حالياً.", noRouteHint: "تظهر الجولات عندما يربطها مدير التوزيع بعضويتك.", stops: "محطات التسليم", stop: "المحطة", navigate: "فتح الملاحة", arrived: "تأكيد الوصول", arrivedDone: "تم تسجيل الوصول للمحطة.", startDelivery: "بدء التنفيذ", returning: "بدء العودة", vehicle: "المركبة", routeDate: "التاريخ", status: "الحالة", map: "خريطة المسار", mapHint: "تظهر المحطات ذات الإحداثيات المسجلة فقط.", privacy: "خصوصية الموقع", privacyHint: "لا يبدأ التتبع في الخلفية ولا يُرسل أي موقع قبل موافقتك الصريحة.", locationUpdated: "تم تحديث موقعك ضمن الجولة.", routeUpdateFailed: "تعذر تحديث حالة الجولة.", positionUnknown: "الموقع الحالي غير متاح بعد.", destinationMissing: "لا تتوفر إحداثيات لهذه المحطة.", arrivalState: "تم الوصول", pendingState: "بانتظار الوصول" },
  fr: { eyebrow: "Espace conducteur", title: "Ma tournée terrain", subtitle: "L’itinéraire, les arrêts et la localisation n’apparaissent que pour les tournées qui vous sont attribuées.", back: "Centre d’opérations", tracking: "Suivi de position", trackingHint: "La position sert uniquement au suivi de la tournée et peut être arrêtée à tout moment.", consent: "J’accepte le partage de ma position pendant la tournée active.", startTracking: "Démarrer le partage", stopTracking: "Arrêter le partage", trackingOn: "Position partagée", trackingOff: "Position arrêtée", gpsUnavailable: "Cet appareil ne prend pas en charge la géolocalisation ou l’autorisation a été refusée.", gpsError: "Impossible d’actualiser la position.", activeRoute: "Tournée actuelle", noRoute: "Aucune tournée active ne vous est attribuée.", noRouteHint: "Les tournées s’affichent lorsque le responsable les attribue à votre adhésion.", stops: "Arrêts de livraison", stop: "Arrêt", navigate: "Ouvrir la navigation", arrived: "Confirmer l’arrivée", arrivedDone: "L’arrivée à l’arrêt a été enregistrée.", startDelivery: "Démarrer l’exécution", returning: "Commencer le retour", vehicle: "Véhicule", routeDate: "Date", status: "Statut", map: "Carte de l’itinéraire", mapHint: "Seuls les arrêts ayant des coordonnées sont affichés.", privacy: "Confidentialité", privacyHint: "Aucun suivi en arrière-plan ni envoi de position avant votre accord explicite.", locationUpdated: "Votre position a été actualisée pour la tournée.", routeUpdateFailed: "Impossible d’actualiser la tournée.", positionUnknown: "La position actuelle n’est pas encore disponible.", destinationMissing: "Les coordonnées de cet arrêt sont indisponibles.", arrivalState: "Arrivé", pendingState: "En attente" },
  en: { eyebrow: "Driver workspace", title: "My field route", subtitle: "Route, stops, and location are shown only for routes assigned to you.", back: "Operations center", tracking: "Location tracking", trackingHint: "Location is used only to progress the route and can be stopped at any time.", consent: "I agree to share my location during the active route.", startTracking: "Start sharing location", stopTracking: "Stop sharing location", trackingOn: "Location is shared", trackingOff: "Location is stopped", gpsUnavailable: "This device does not support geolocation or permission was denied.", gpsError: "Location could not be updated.", activeRoute: "Current route", noRoute: "No active route is assigned to you.", noRouteHint: "Routes appear after the distribution manager assigns them to your membership.", stops: "Delivery stops", stop: "Stop", navigate: "Open navigation", arrived: "Confirm arrival", arrivedDone: "Arrival has been recorded.", startDelivery: "Start execution", returning: "Start return", vehicle: "Vehicle", routeDate: "Date", status: "Status", map: "Route map", mapHint: "Only stops with saved coordinates are shown.", privacy: "Location privacy", privacyHint: "No background tracking or location is sent before your explicit consent.", locationUpdated: "Your location was updated for the route.", routeUpdateFailed: "Route status could not be updated.", positionUnknown: "Current location is not available yet.", destinationMissing: "Coordinates are not available for this stop.", arrivalState: "Arrived", pendingState: "Awaiting arrival" },
} as const;

type Coordinates = { latitude: number; longitude: number; accuracy?: number };
const asNumber = (value: unknown) => value === null || value === undefined ? null : Number(value);
const distanceMeters = (from: Coordinates, lat: number, lng: number) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earth = 6371000;
  const dLat = radians(lat - from.latitude);
  const dLng = radians(lng - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
};

function DriverRouteMap({ stops, current }: { stops: Array<{ id: number; sequence: number; customerName: string; customerLatitude: unknown; customerLongitude: unknown }>; current: Coordinates | null }) {
  const points = useMemo(() => stops.map(stop => ({ ...stop, lat: asNumber(stop.customerLatitude), lng: asNumber(stop.customerLongitude) })).filter((stop): stop is typeof stop & { lat: number; lng: number } => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)), [stops]);
  const initial = current ? { lat: current.latitude, lng: current.longitude } : points[0] ? { lat: points[0].lat, lng: points[0].lng } : { lat: 36.7538, lng: 3.0588 };
  return <MapView initialCenter={initial} initialZoom={points.length ? 12 : 6} className="h-[310px] overflow-hidden rounded-2xl" onMapReady={map => {
    const bounds = new window.google.maps.LatLngBounds();
    if (current) { new window.google.maps.marker.AdvancedMarkerElement({ map, position: { lat: current.latitude, lng: current.longitude }, title: "Current position" }); bounds.extend({ lat: current.latitude, lng: current.longitude }); }
    points.forEach(point => { new window.google.maps.marker.AdvancedMarkerElement({ map, position: { lat: point.lat, lng: point.lng }, title: `${point.sequence}. ${point.customerName}` }); bounds.extend({ lat: point.lat, lng: point.lng }); });
    if (points.length > 1) new window.google.maps.Polyline({ map, path: points.map(point => ({ lat: point.lat, lng: point.lng })), strokeColor: "#d9b46b", strokeOpacity: .9, strokeWeight: 4 });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
  }} />;
}

export default function Driver() {
  const { language, direction, formatDate } = useLanguage();
  const text = copy[language];
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const routes = trpc.erp.distribution.driver.myRoutes.useQuery();
  const transition = trpc.erp.distribution.driver.transition.useMutation({ onSuccess: () => void routes.refetch(), onError: () => toast.error(text.routeUpdateFailed) });
  const reportLocation = trpc.erp.distribution.tracking.location.useMutation();
  const geofence = trpc.erp.distribution.tracking.geofence.useMutation({ onSuccess: () => { void routes.refetch(); toast.success(text.arrivedDone); }, onError: () => toast.error(text.gpsError) });
  const route = routes.data?.[0];
  const [consent, setConsent] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const watchId = useRef<number | null>(null);
  const routeRef = useRef(route);
  useEffect(() => { routeRef.current = route; }, [route]);
  const stopTracking = () => { if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current); watchId.current = null; setTracking(false); };
  useEffect(() => () => stopTracking(), []);
  const startTracking = () => {
    if (!consent || !route || !route.vehicleId || !navigator.geolocation) { toast.error(text.gpsUnavailable); return; }
    watchId.current = navigator.geolocation.watchPosition(next => {
      const currentRoute = routeRef.current;
      if (!currentRoute?.vehicleId) return;
      const point = { latitude: next.coords.latitude, longitude: next.coords.longitude, accuracy: next.coords.accuracy };
      setPosition(point);
      reportLocation.mutate({ vehicleId: currentRoute.vehicleId, routeId: currentRoute.id, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, recordedAt: new Date(), source: "driver_app" }, { onSuccess: () => toast.success(text.locationUpdated), onError: () => toast.error(text.gpsError) });
    }, () => { stopTracking(); toast.error(text.gpsUnavailable); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    setTracking(true);
  };
  const markArrival = (stop: NonNullable<typeof route>["stops"][number]) => {
    if (!route?.vehicleId || !position) { toast.error(text.positionUnknown); return; }
    const latitude = asNumber(stop.customerLatitude); const longitude = asNumber(stop.customerLongitude);
    if (latitude === null || longitude === null) { toast.error(text.destinationMissing); return; }
    geofence.mutate({ routeId: route.id, stopId: stop.id, vehicleId: route.vehicleId, eventType: "arrival", distanceMeters: distanceMeters(position, latitude, longitude), recordedAt: new Date() });
  };
  const statusVariant = route?.status === "in_progress" ? "default" : "secondary";

  return <main dir={direction} className="min-h-screen w-screen max-w-full overflow-x-hidden bg-background text-foreground"><div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6"><header className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setLocation("/distribution")} className="gap-2"><Route className="h-4 w-4" />{text.back}</Button><p className="text-sm text-muted-foreground">{user?.name ?? ""}</p></header><section className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-6"><p className="text-xs font-semibold tracking-[.16em] text-primary">{text.eyebrow}</p><h1 className="mt-2 text-3xl font-bold">{text.title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{text.subtitle}</p></section>
  {routes.isLoading ? <div className="space-y-4"><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-60 rounded-3xl" /></div> : routes.isError ? <Card className="border-destructive/30"><CardContent className="flex gap-3 p-5 text-destructive"><CircleAlert className="h-5 w-5" />{text.routeUpdateFailed}</CardContent></Card> : !route ? <Card><CardContent className="p-8 text-center"><Truck className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-3 font-bold">{text.noRoute}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text.noRouteHint}</p></CardContent></Card> : <><Card className="border-primary/20"><CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-primary">{text.activeRoute}</p><CardTitle className="mt-1">{route.routeNumber}</CardTitle><CardDescription>{text.routeDate}: {formatDate(route.routeDate)} · {text.vehicle}: {route.vehicleCode ?? "—"}</CardDescription></div><Badge variant={statusVariant}>{route.status}</Badge></div></CardHeader><CardContent className="flex flex-wrap gap-2">{route.status === "started" ? <Button onClick={() => transition.mutate({ routeId: route.id, status: "in_progress" })} disabled={transition.isPending} className="gap-2"><Play className="h-4 w-4" />{text.startDelivery}</Button> : null}{route.status === "in_progress" ? <Button variant="outline" onClick={() => transition.mutate({ routeId: route.id, status: "returning" })} disabled={transition.isPending} className="gap-2"><Pause className="h-4 w-4" />{text.returning}</Button> : null}</CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><LocateFixed className="h-5 w-5 text-primary" />{text.tracking}</CardTitle><CardDescription>{text.trackingHint}</CardDescription></CardHeader><CardContent className="space-y-4"><label className="flex items-start gap-3 rounded-2xl border border-border/70 p-3 text-sm"><Checkbox checked={consent} onCheckedChange={checked => setConsent(checked === true)} /><span>{text.consent}</span></label><div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3"><span className="text-sm">{tracking ? text.trackingOn : text.trackingOff}</span><Button onClick={tracking ? stopTracking : startTracking} disabled={!tracking && !consent} variant={tracking ? "outline" : "default"} className="gap-2">{tracking ? <Pause className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}{tracking ? text.stopTracking : text.startTracking}</Button></div><div className="rounded-2xl border border-primary/15 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" />{text.privacy}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.privacyHint}</p></div></CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" />{text.map}</CardTitle><CardDescription>{text.mapHint}</CardDescription></CardHeader><CardContent><DriverRouteMap stops={route.stops} current={position} /></CardContent></Card>
  <Card><CardHeader><CardTitle>{text.stops}</CardTitle></CardHeader><CardContent className="space-y-3">{route.stops.map(stop => { const latitude = asNumber(stop.customerLatitude); const longitude = asNumber(stop.customerLongitude); const arrived = stop.deliveryStatus === "arrived" || Boolean(stop.arrivedAt); const navigationUrl = latitude === null || longitude === null ? null : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`; return <article key={stop.id} className="rounded-2xl border border-border/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-primary">{stop.sequence}. {text.stop}</p><h3 className="mt-1 font-bold">{stop.customerName}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{stop.customerAddress ?? stop.deliveryNotes ?? text.destinationMissing}</p>{stop.receivingHours ? <p className="mt-1 text-xs text-muted-foreground">{stop.receivingHours}</p> : null}</div><Badge variant={arrived ? "default" : "outline"}>{arrived ? text.arrivalState : text.pendingState}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{navigationUrl ? <Button asChild variant="outline" size="sm"><a href={navigationUrl} target="_blank" rel="noreferrer" className="gap-2"><Navigation className="h-3.5 w-3.5" />{text.navigate}</a></Button> : null}{!arrived ? <Button size="sm" onClick={() => markArrival(stop)} disabled={geofence.isPending} className="gap-2"><MapPinned className="h-3.5 w-3.5" />{text.arrived}</Button> : null}</div></article>; })}</CardContent></Card></>}
  </div></main>;
}
