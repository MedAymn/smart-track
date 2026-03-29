import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Copy, Check, Users, Trash2, ShieldAlert, RefreshCcw } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigate } from 'react-router-dom';

interface StaffMember {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
}

const Staff = () => {
    const { profile, storeName } = useAuth();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const isAdmin = profile?.role === 'admin';

    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    const storeId = profile?.store_id;

    const loadStaff = async () => {
        if (!storeId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('store_id', storeId)
                .order('role', { ascending: false }); // admins first

            if (error) throw error;

            // Enrich with email from auth.users via a join trick via profiles
            // We just use the profile data — email is not stored in profiles by default
            // So we display what we have
            setStaffList((data || []) as StaffMember[]);
        } catch (error: any) {
            showToast(t('common.error') + ': ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStaff();
    }, [storeId]);

    const handleCopyCode = () => {
        if (!storeId) return;
        navigator.clipboard.writeText(storeId).then(() => {
            setCopied(true);
            showToast(t('nav.copied'), 'success');
            setTimeout(() => setCopied(false), 2500);
        });
    };

    const handleRemoveStaff = async (member: StaffMember) => {
        if (member.id === profile?.id) {
            showToast(t('nav.remove_self_error'), 'error');
            return;
        }
        if (!window.confirm(t('nav.remove_confirm'))) return;

        setRemovingId(member.id);
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', member.id);
            if (error) throw error;
            showToast(t('nav.member_removed'), 'success');
            await loadStaff();
        } catch (error: any) {
            showToast(t('common.error') + ': ' + error.message, 'error');
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Users size={28} style={{ color: 'var(--accent-primary)' }} />
                    {t('nav.staff_management')}
                </h1>
                <button
                    onClick={loadStaff}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                    <RefreshCcw size={16} /> {t('nav.refresh')}
                </button>
            </div>

            {/* Join Code Card */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {t('nav.join_code_title')}
                </h2>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {t('nav.join_code_helper')} {storeName ? `"${storeName}"` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1,
                        minWidth: 200,
                        background: 'var(--bg-tertiary)',
                        border: '1.5px dashed var(--accent-primary)',
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        color: 'var(--accent-primary)',
                        letterSpacing: '0.05em',
                        wordBreak: 'break-all',
                    }}>
                        {storeId || '—'}
                    </div>
                    <button
                        onClick={handleCopyCode}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.25rem',
                            borderRadius: '10px',
                            background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            color: copied ? 'var(--success)' : 'var(--accent-primary)',
                            border: `1.5px solid ${copied ? 'var(--success)' : 'var(--accent-primary)'}`,
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            transition: 'all 0.25s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {copied ? <><Check size={16} /> {t('nav.copied')}</> : <><Copy size={16} /> {t('nav.copy')}</>}
                    </button>
                </div>
            </div>

            {/* Staff List */}
            <div className="glass-panel no-hover" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                        {t('nav.team_members')}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 600 }}>
                        {staffList.length}
                    </span>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
                ) : staffList.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Users size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.4 }} />
                        <p>{t('nav.no_name')}</p>
                    </div>
                ) : (
                    <div>
                        {staffList.map((member, i) => (
                            <div
                                key={member.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1rem 1.5rem',
                                    borderBottom: i < staffList.length - 1 ? '1px solid var(--glass-border)' : 'none',
                                    gap: '1rem',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: member.role === 'admin'
                                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                            : 'linear-gradient(135deg, #374151, #4b5563)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        flexShrink: 0,
                                    }}>
                                        {(member.full_name || '?')[0].toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {member.full_name || t('nav.no_name')}
                                            {member.id === profile?.id && (
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{t('nav.you')}</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                padding: '0.15rem 0.55rem',
                                                borderRadius: '999px',
                                                background: member.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(107,114,128,0.15)',
                                                color: member.role === 'admin' ? '#818cf8' : 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                            }}>
                                                {member.role === 'admin' ? t('nav.admin_badge') : t('nav.staff_badge')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {member.role !== 'admin' && member.id !== profile?.id && (
                                    <button
                                        onClick={() => handleRemoveStaff(member)}
                                        disabled={removingId === member.id}
                                        title="Retirer ce membre"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.45rem 0.85rem',
                                            borderRadius: '8px',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            cursor: removingId === member.id ? 'not-allowed' : 'pointer',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            opacity: removingId === member.id ? 0.6 : 1,
                                            transition: 'all 0.2s',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        {removingId === member.id ? '...' : t('nav.remove_btn')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Note about auth accounts */}
            <div style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
            }}>
                <ShieldAlert size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <span>
                    {t('nav.supabase_note')}
                </span>
            </div>
        </div>
    );
};

export default Staff;
