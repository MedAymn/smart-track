import { useEffect, useState } from 'react';
import { ShieldAlert, Clock, User, Activity as ActivityIcon, Phone, ShoppingCart, Banknote, PenTool } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface LogEntry {
  id: string;
  action_type: string;
  target_type: string;
  details: any;
  created_at: string;
  profiles: {
    full_name: string;
    role: string;
  };
}

const Activity = () => {
    const { profile } = useAuth();
    const { showToast } = useToast();
    const { t, language } = useLanguage();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.role === 'admin') {
            fetchLogs();
        } else {
            setLoading(false);
        }
    }, [profile]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('audit_logs')
                .select(`
                    *,
                    profiles:user_id (full_name, role)
                `)
                .eq('store_id', profile!.store_id)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setLogs(data as any || []);
        } catch (error: any) {
            console.error('Error fetching logs:', error);
            showToast(t('common.error') + ': ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (profile?.role !== 'admin') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <ShieldAlert size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h2 style={{ marginBottom: '0.5rem' }}>{t('activity.access_denied')}</h2>
                <p>{t('activity.admin_only')}</p>
            </div>
        );
    }

    const getActionIcon = (target: string) => {
        switch (target) {
            case 'phones': return <Phone size={18} />;
            case 'sales': return <ShoppingCart size={18} />;
            case 'caisse': return <Banknote size={18} />;
            case 'repairs': return <PenTool size={18} />;
            default: return <ActivityIcon size={18} />;
        }
    };

    const formatAction = (log: LogEntry) => {
        let text = '';
        if (log.action_type === 'CREATE') text += ` ${t('activity.action_added')} `;
        if (log.action_type === 'SALE') text += ` ${t('activity.action_sold')} `;
        if (log.action_type === 'PAYMENT') text += ` ${t('activity.action_payment')} `;

        if (log.target_type === 'phones') text += `${t('activity.target_phone')} : ${log.details?.model || t('activity.unknown_device')}`;
        if (log.target_type === 'sales') text += `${t('activity.target_sale')} ${log.details?.price?.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') || 0} DA`;
        if (log.target_type === 'caisse') text += `${t('activity.target_transaction')} (${log.details?.type === 'in' ? t('activity.type_in') : t('activity.type_out')}) ${t('activity.target_sale')} ${log.details?.amount?.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA`;
        if (log.target_type === 'repairs') text += `${t('activity.target_repair')} (${log.details?.device})`;

        return text;
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ActivityIcon size={36} color="var(--accent-primary)" />
                        {t('activity.title')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                        {t('activity.subtitle')}
                    </p>
                </div>
                <button onClick={fetchLogs} className="btn-secondary">
                    {t('nav.refresh')}
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}...</div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('activity.no_activity')}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {logs.map((log) => (
                            <div key={log.id} style={{ 
                                display: 'flex', 
                                alignItems: 'center', gap: '1.5rem', 
                                padding: '1.25rem 2rem',
                                borderBottom: '1px solid var(--border-light)',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ 
                                    width: '45px', height: '45px', 
                                    borderRadius: '12px', 
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--accent-primary)'
                                }}>
                                    {getActionIcon(log.target_type)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>
                                        <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <User size={14} /> {log.profiles?.full_name || t('activity.unknown_user')}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)' }}> {formatAction(log)}</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Clock size={12} />
                                        {new Date(log.created_at).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-color)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {log.action_type}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Activity;
