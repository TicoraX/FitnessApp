import { useEffect, useRef, useState } from 'react';
import { IconoCerrar } from './IconoCerrar';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Escáner de código de barras a pantalla completa / modal HUD.
 * Soporta BarcodeDetector nativo y fallback con cámara + ZXing polyfill para navegadores de escritorio e iOS.
 * Elevado con zIndex: 100000 para quedar siempre por encima del menú inferior flotante (Dock).
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [sinCamara, setSinCamara] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Cierra con la tecla Escape
  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [onClose]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    let active = true;
    // El tipo sale del import dinámico, que es el que mantiene a ZXing fuera
    // del bundle principal.
    let zxingReader: InstanceType<typeof import('@zxing/library').BrowserMultiFormatReader> | null = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setSinCamara(true);
          setError('Este navegador no puede leer códigos con la cámara. Escribí el código y listo.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (active) setCameraActive(true);
        }

        // 1. Intentar BarcodeDetector nativo si está disponible
        let detector: any = null;
        if ('BarcodeDetector' in window) {
          const Detector = (window as any).BarcodeDetector;
          detector = new Detector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
        } else {
          // 2. Sin BarcodeDetector nativo (iOS, Firefox) cae a ZXing, que se
          // importa acá y no arriba para que no entre al bundle principal:
          // en Chrome Android nunca se descarga.
          const ZXing = await import('@zxing/library').catch(() => null);

          if (ZXing) {
            const lector = new ZXing.BrowserMultiFormatReader();
            zxingReader = lector;
            detector = {
              detect: async (videoEl: HTMLVideoElement) => {
                try {
                  const res = lector.decode(videoEl);
                  if (res && res.getText()) {
                    return [{ rawValue: res.getText() }];
                  }
                } catch {
                  // No barcode in frame
                }
                return [];
              },
            };
          }
        }

        if (!detector) {
          setError('Camára encendida. Si el escáner no detecta automáticamente en este navegador, escribí el código abajo.');
        }

        const scanLoop = async () => {
          if (!active || !videoRef.current) return;
          try {
            if (detector && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                onDetected(barcodes[0].rawValue);
                return;
              }
            }
          } catch {
            // Ignorar errores de frame
          }
          if (active) {
            animationFrameId = requestAnimationFrame(scanLoop);
          }
        };

        animationFrameId = requestAnimationFrame(scanLoop);
      } catch (err) {
        if (!active) return;
        setSinCamara(true);
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|not allowed|Permission/i.test(msg)) {
          setError('Permiso de cámara denegado. Habilitá la cámara en los ajustes del navegador o ingresá el código manualmente.');
        } else {
          setError('No se pudo abrir la cámara. Podés ingresar el código numérico manualmente.');
        }
      }
    }

    void startCamera();

    return () => {
      active = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (zxingReader) {
        try {
          zxingReader.reset();
        } catch {}
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
      role="dialog"
      aria-modal="true"
      aria-label="Escanear código de barras"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--color-primary)', fontSize: '0.8rem' }}>
              Escáner de Código de Barras
            </span>
            <h3 className="card__title" style={{ margin: 0, fontSize: '1.1rem' }}>Escanear Producto</h3>
          </div>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <IconoCerrar size={14} />
              Cerrar
            </span>
          </button>
        </div>

        {!sinCamara && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '320px',
              aspectRatio: '1',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '2px solid var(--color-primary)',
              boxShadow: '0 0 15px oklch(0.82 0.22 145 / 0.3)',
              background: '#000',
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Mirilla animada HUD */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                border: '2px dashed var(--color-primary)',
                opacity: 0.7,
                borderRadius: 'var(--radius-sm)',
                margin: '16px',
              }}
            />
            {cameraActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'var(--color-primary)',
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                ● CÁMARA ACTIVA
              </div>
            )}
          </div>
        )}

        <div style={{ width: '100%', textAlign: 'center' }}>
          {error && (
            <p className="alert" role="alert" style={{ marginBottom: '0.75rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>
              {error}
            </p>
          )}

          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Código EAN/UPC (8 a 14 dígitos)"
              aria-label="Código de barras manual"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}
            />
            <button type="submit" className="btn">
              Buscar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
