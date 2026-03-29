import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useLanguage } from './LanguageContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const { dir } = useLanguage();

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3500);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: dir === 'rtl' ? 'auto' : '20px',
                left: dir === 'rtl' ? '20px' : 'auto',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                pointerEvents: 'none'
            }}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={dir === 'rtl' ? 'animate-slide-in-left glass-panel' : 'animate-slide-in-right glass-panel'}
                        style={{
                            pointerEvents: 'auto',
                            minWidth: '300px',
                            maxWidth: '400px',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            backgroundColor: 'var(--bg-secondary)',
                            borderLeft: dir === 'rtl' ? 'none' : `4px solid ${toast.type === 'success' ? 'var(--success)' :
                                toast.type === 'error' ? 'var(--danger)' :
                                    toast.type === 'warning' ? 'var(--warning)' :
                                        'var(--accent-primary)'
                                }`,
                            borderRight: dir === 'rtl' ? `4px solid ${toast.type === 'success' ? 'var(--success)' :
                                toast.type === 'error' ? 'var(--danger)' :
                                    toast.type === 'warning' ? 'var(--warning)' :
                                        'var(--accent-primary)'
                                }` : 'none',
                            boxShadow: 'var(--shadow-lg)'
                        }}
                    >
                        {toast.type === 'success' && <CheckCircle size={20} color="var(--success)" />}
                        {toast.type === 'error' && <XCircle size={20} color="var(--danger)" />}
                        {toast.type === 'warning' && <AlertTriangle size={20} color="var(--warning)" />}
                        {toast.type === 'info' && <Info size={20} color="var(--accent-primary)" />}

                        <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                            {toast.message}
                        </span>

                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{ padding: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
