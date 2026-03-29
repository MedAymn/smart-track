import { useRef, useState, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { X, Camera, ScanLine } from 'lucide-react';

interface IMEIScannerProps {
    onScanned: (text: string) => void;
    onClose: () => void;
}

const IMEIScanner = ({ onScanned, onClose }: IMEIScannerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<any>(null);

    const [status, setStatus] = useState<'starting' | 'ready' | 'scanning' | 'error'>('starting');
    const [errorMsg, setErrorMsg] = useState('');
    const [detectedNumbers, setDetectedNumbers] = useState('');

    // Start camera + Tesseract worker
    useEffect(() => {
        let stopped = false;
        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                const worker = await createWorker('eng', 1, { logger: () => { } });
                if (stopped) { worker.terminate(); return; }
                workerRef.current = worker;
                setStatus('ready');
            } catch (err: any) {
                if (!stopped) {
                    setErrorMsg(`Impossible d'accéder à la caméra : ${err?.message || err}. Sur iPhone : Réglages → Safari → Caméra → Autoriser.`);
                    setStatus('error');
                }
            }
        };
        start();
        return () => {
            stopped = true;
            workerRef.current?.terminate?.();
            if (videoRef.current?.srcObject)
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        };
    }, []);

    // Manual capture — extract numbers only
    const handleCapture = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !workerRef.current) return;
        setStatus('scanning');
        setDetectedNumbers('');

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Crop to the scan rectangle region (70% wide × 25% tall, centered)
        const cropX = Math.floor(vw * 0.15);
        const cropY = Math.floor(vh * 0.375);
        const cropW = Math.floor(vw * 0.70);
        const cropH = Math.floor(vh * 0.25);
        canvas.width = cropW;
        canvas.height = cropH;
        canvas.getContext('2d')!.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        try {
            const { data: { text } } = await workerRef.current.recognize(canvas);
            // Keep digits only
            const numbersOnly = text.replace(/\D/g, '');
            setDetectedNumbers(numbersOnly.length > 0 ? numbersOnly : '');
        } catch { /* ignore */ }

        setStatus('ready');
    }, []);

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '1rem',
        }}>
            <div style={{ background: 'var(--bg-primary)', borderRadius: '20px', padding: '1.25rem', width: '100%', maxWidth: '440px', boxShadow: '0 30px 70px rgba(0,0,0,0.6)' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Camera size={18} color="var(--accent-primary)" />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Scanner IMEI</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '6px' }}>
                        <X size={20} />
                    </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Cadrez les chiffres dans le rectangle, puis appuyez sur <strong>Capturer</strong>.
                </p>

                {status === 'error' ? (
                    <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '0.82rem', lineHeight: 1.6 }}>
                        ⚠️ {errorMsg}
                    </div>
                ) : (
                    <>
                        {/* Camera preview with rectangle */}
                        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '0.75rem' }}>
                            <video ref={videoRef} autoPlay playsInline muted
                                style={{ width: '100%', display: 'block', maxHeight: '260px', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                <div style={{
                                    width: '70%', height: '25%',
                                    border: '2.5px solid rgba(16,185,129,0.9)',
                                    borderRadius: '8px',
                                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                                }} />
                            </div>
                        </div>

                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Capture button */}
                        <button
                            onClick={handleCapture}
                            disabled={status !== 'ready'}
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: '10px',
                                background: status === 'ready' ? 'var(--accent-primary)' : 'rgba(16,185,129,0.35)',
                                color: 'white', border: 'none',
                                cursor: status === 'ready' ? 'pointer' : 'not-allowed',
                                fontWeight: 600, fontSize: '0.95rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                marginBottom: '0.5rem',
                            }}
                        >
                            <ScanLine size={18} />
                            {status === 'starting' ? 'Démarrage...' : status === 'scanning' ? 'Lecture...' : 'Capturer'}
                        </button>

                        {/* Result + confirm */}
                        {detectedNumbers && (
                            <>
                                <div style={{ padding: '0.65rem 0.9rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', fontSize: '0.9rem', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem', wordBreak: 'break-all' }}>
                                    🔢 {detectedNumbers}
                                </div>
                                <button
                                    onClick={() => onScanned(detectedNumbers)}
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                                >
                                    ✅ Utiliser ce numéro
                                </button>
                            </>
                        )}

                        {status === 'ready' && !detectedNumbers && (
                            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                                Aucun chiffre détecté. Réessayez en vous rapprochant.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default IMEIScanner;
