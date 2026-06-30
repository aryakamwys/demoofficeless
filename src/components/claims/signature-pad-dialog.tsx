"use client";

import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo, Trash2, Check, Loader2 } from "lucide-react";

interface SignaturePadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureData: string) => Promise<void>;
  roleTitle: string;
}

export function SignaturePadDialog({ open, onOpenChange, onSave, roleTitle }: SignaturePadDialogProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle resize and DPI scaling robustly
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const container = containerRef.current;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && sigRef.current) {
          const canvas = sigRef.current.getCanvas();
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          
          // Only resize if the physical size actually changed to avoid clearing unnecessarily
          if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);
            sigRef.current.clear();
          }
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [open]);

  const clear = () => {
    sigRef.current?.clear();
  };

  const undo = () => {
    const data = sigRef.current?.toData();
    if (data && data.length > 0) {
      data.pop();
      sigRef.current?.fromData(data);
    }
  };

  const save = async () => {
    if (sigRef.current?.isEmpty()) {
      return;
    }
    
    setIsSaving(true);
    try {
      const signatureData = sigRef.current?.getTrimmedCanvas().toDataURL("image/png");
      if (signatureData) {
        await onSave(signatureData);
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Draw Signature ({roleTitle})</DialogTitle>
          <DialogDescription>
            Please draw your signature below to approve this document. 
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={containerRef}
          className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 overflow-hidden w-full h-[250px] touch-none"
          style={{
            backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
            backgroundSize: "20px 20px"
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{
              className: "w-full h-full cursor-crosshair touch-none",
              style: { touchAction: "none" }
            }}
          />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between mt-4">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={undo} disabled={isSaving}>
              <Undo className="w-4 h-4 mr-1" />
              Undo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clear} disabled={isSaving}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Save Signature
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
