import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Camera, CheckCircle2, Eraser, PenLine, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ProofCopy = { proof: string; proofDone: string; proofHint: string; signer: string; signerPlaceholder: string; photo: string; signature: string; clear: string; submit: string; submitted: string; photoRequired: string; signatureRequired: string; proofFailed: string };

export function DriverDeliveryProof({ routeId, stopId, customerId, proofId, onSuccess, text }: { routeId: number; stopId: number; customerId: number; proofId?: number | null; onSuccess: () => void; text: ProofCopy }) {
  const [open, setOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const submit = trpc.erp.distribution.driver.submitProof.useMutation({
    onSuccess: () => { setOpen(false); onSuccess(); toast.success(text.submitted); },
    onError: () => toast.error(text.proofFailed),
  });
  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const point = canvasPoint(event);
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath(); ctx.moveTo(point.x, point.y); drawing.current = true;
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = canvasPoint(event);
    ctx.lineTo(point.x, point.y); ctx.stroke(); setHasSignature(true);
  };
  const end = () => { drawing.current = false; };
  const clear = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); setHasSignature(false); } };
  useEffect(() => { if (!open) return; const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) { ctx.strokeStyle = "#1c2430"; ctx.lineWidth = 5; ctx.lineCap = "round"; } }, [open]);
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { toast.error(text.photoRequired); return; }
    const reader = new FileReader(); reader.onload = () => setPhotoDataUrl(String(reader.result)); reader.readAsDataURL(file);
  };
  const save = () => {
    if (!photoDataUrl) { toast.error(text.photoRequired); return; }
    if (!hasSignature || !canvasRef.current) { toast.error(text.signatureRequired); return; }
    submit.mutate({ routeId, stopId, customerId, signerName, signedAt: new Date(), signatureDataUrl: canvasRef.current.toDataURL("image/png"), photoDataUrl });
  };
  if (proofId) return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{text.proofDone}</Badge>;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline" className="gap-2"><PenLine className="h-3.5 w-3.5" />{text.proof}</Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{text.proof}</DialogTitle><DialogDescription>{text.proofHint}</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>{text.signer}</Label><Input value={signerName} onChange={event => setSignerName(event.target.value)} placeholder={text.signerPlaceholder} /></div><div className="space-y-2"><Label>{text.photo}</Label><Input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={event => choosePhoto(event.target.files?.[0])} />{photoDataUrl ? <img src={photoDataUrl} alt="" className="max-h-44 w-full rounded-xl object-cover" /> : <p className="flex items-center gap-2 text-xs text-muted-foreground"><Camera className="h-4 w-4" />{text.photoRequired}</p>}</div><div className="space-y-2"><div className="flex items-center justify-between"><Label>{text.signature}</Label><Button type="button" size="sm" variant="ghost" onClick={clear} className="gap-1"><Eraser className="h-3.5 w-3.5" />{text.clear}</Button></div><canvas ref={canvasRef} width={760} height={270} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} className="h-36 w-full touch-none rounded-xl border border-dashed border-primary/40 bg-muted/30" /></div><Button onClick={save} disabled={submit.isPending || signerName.trim().length < 2} className="w-full gap-2"><Upload className="h-4 w-4" />{text.submit}</Button></div></DialogContent></Dialog>;
}
