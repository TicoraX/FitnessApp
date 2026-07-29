import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Escáner de código de barras a pantalla completa / modal HUD.
 * Usa BarcodeDetector nativo de la plataforma (Chrome/Android).
 * Detiene los tracks de la cámara al desmontar para no dejar el sensor prendido.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    let active = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Tu navegador no permite acceso a la cámara. Ingresá el código manualmente.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Si BarcodeDetector nativo está disponible (Chrome/Android)
        if ('BarcodeDetector' in window) {
          const Detector = (window as any).BarcodeDetector;
          const detector = new Detector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
          });

          const scanLoop = async () => {
            if (!active || !videoRef.current) return;
            try {
              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  onDetected(barcodes[0].rawValue);
                  return; // detiene el loop tras detectar
                }
              }
            } catch {
              // Ignorar errores de frame para continuar el loop de detección
            }
            if (active) {
              animationFrameId = requestAnimationFrame(scanLoop);
            }
          };

          animationFrameId = requestAnimationFrame(scanLoop);
        }
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|not allowed|Permission/i.test(msg)) {
          setError('Permiso de cámara denegado. Habilitá la cámara en los ajustes del navegador o ingresá el código manualmente.');
        } else {
          setError('No se pudo acceder a la cámara posterior. Podés ingresar el código manualmente.');
        }
      }
    }

    void startCamera();

    return () => {
      active = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onDetected]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (/^\d{8,14}$/.test(clean)) {
      onDetected(clean);
    } else {
      setError('El código debe tener entre 8 y 14 dígitos numéricos.');
    }
  };

  return (
    <div
      className="barcode-scanner-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.5rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow" style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>
          Escáner Cyber HUD
        </span>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={onClose}
          style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)' }}
        >
          Cerrar ✕
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '360px',
          aspectRatio: '1',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '2px solid var(--color-primary)',
          boxShadow: '0 0 20px oklch(0.82 0.22 145 / 0.3)',
          background: '#000',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Esquinas y laser animado de encuadre HUD */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            border: '2px dashed var(--color-primary)',
            opacity: 0.6,
            borderRadius: 'var(--radius-md)',
            margin: '12px',
          }}
        />
      </div>

      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        {error && (
          <p className="alert" role="alert" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Código de 8 a 14 dígitos"
            aria-label="Código de barras manual"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
          />
          <button type="submit" className="btn">
            Buscar
          </button>
        </form>
      </div>
    </div>
  );
}
