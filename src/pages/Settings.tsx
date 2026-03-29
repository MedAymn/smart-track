import React, { useState, useEffect } from 'react';
import { User, Store, Lock, Phone, MapPin, Mail, Save, Eye, EyeOff, Copy, Check, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.8rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-main)',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '1.75rem',
    marginBottom: '1.5rem',
};

const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-color)',
};

const Settings: React.FC = () => {
    const { profile, storeDetails, refreshProfile } = useAuth();
    const { t } = useLanguage();
    const { showToast } = useToast();

    const isAdmin = profile?.role === 'admin';

    // Profile state
    const [fullName, setFullName] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // Store state
    const [storeName, setStoreName] = useState('');
    const [storePhone, setStorePhone] = useState('');
    const [storeAddress, setStoreAddress] = useState('');
    const [storeEmail, setStoreEmail] = useState('');
    const [storeLoading, setStoreLoading] = useState(false);

    // Password state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Copy store code
    const [copied, setCopied] = useState(false);

    // Current user email from Supabase auth
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) setUserEmail(session.user.email);
        });
    }, []);

    useEffect(() => {
        if (profile) setFullName(profile.full_name || '');
    }, [profile]);

    useEffect(() => {
        if (storeDetails) {
            setStoreName(storeDetails.name || '');
            setStorePhone(storeDetails.phone || '');
            setStoreAddress(storeDetails.address || '');
            setStoreEmail(storeDetails.email || '');
        }
    }, [storeDetails]);

    const handleProfileSave = async () => {
        if (!profile) return;
        setProfileLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', profile.id);
            if (error) throw error;
            await refreshProfile();
            showToast(t('settings.profile_saved'), 'success');
        } catch (e: any) {
            showToast(e.message || t('common.error'), 'error');
        } finally {
            setProfileLoading(false);
        }
    };

    const handleStoreSave = async () => {
        if (!profile?.store_id) return;
        setStoreLoading(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({ name: storeName, phone: storePhone, address: storeAddress, email: storeEmail })
                .eq('id', profile.store_id);
            if (error) throw error;
            await refreshProfile();
            showToast(t('settings.store_saved'), 'success');
        } catch (e: any) {
            showToast(e.message || t('common.error'), 'error');
        } finally {
            setStoreLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            showToast(t('settings.password_mismatch'), 'error');
            return;
        }
        if (newPassword.length < 6) {
            showToast(t('settings.password_too_short'), 'error');
            return;
        }
        setPasswordLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setNewPassword('');
            setConfirmPassword('');
            showToast(t('settings.password_changed'), 'success');
        } catch (e: any) {
            showToast(e.message || t('common.error'), 'error');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleCopyStoreCode = () => {
        if (!profile?.store_id) return;
        navigator.clipboard.writeText(profile.store_id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const btnPrimary: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.7rem 1.4rem',
        borderRadius: '10px',
        background: 'var(--accent-primary)',
        color: 'white',
        border: 'none',
        fontWeight: 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    };

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0 3rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                {t('settings.title')}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                {profile?.full_name || userEmail}
                {profile?.role === 'admin' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                        Admin
                    </span>
                )}
            </p>

            {/* ── Profile Section ── */}
            <div style={cardStyle}>
                <div style={sectionHeaderStyle}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} color="var(--accent-primary)" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{t('settings.profile_section')}</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {/* Full name */}
                    <div>
                        <label style={labelStyle}>{t('settings.full_name')}</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                style={inputStyle}
                                placeholder={t('settings.full_name')}
                            />
                        </div>
                    </div>

                    {/* Email (read-only) */}
                    <div>
                        <label style={labelStyle}>{t('settings.email_readonly')}</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                value={userEmail}
                                readOnly
                                style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleProfileSave} disabled={profileLoading} style={{ ...btnPrimary, opacity: profileLoading ? 0.7 : 1 }}>
                            <Save size={16} />
                            {profileLoading ? t('common.loading') : t('settings.save_profile')}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Store Section ── */}
            <div style={cardStyle}>
                <div style={sectionHeaderStyle}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Store size={18} color="var(--success)" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{t('settings.store_section')}</h2>
                </div>

                {!isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
                        <ShieldAlert size={16} />
                        {t('settings.admin_only_note')}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {/* Store name */}
                    <div>
                        <label style={labelStyle}>{t('settings.store_name')}</label>
                        <div style={{ position: 'relative' }}>
                            <Store size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                                disabled={!isAdmin}
                                style={{ ...inputStyle, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                            />
                        </div>
                    </div>

                    {/* Store phone */}
                    <div>
                        <label style={labelStyle}>{t('settings.store_phone')}</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="tel"
                                value={storePhone}
                                onChange={(e) => setStorePhone(e.target.value)}
                                disabled={!isAdmin}
                                placeholder={t('settings.phone_placeholder')}
                                style={{ ...inputStyle, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                            />
                        </div>
                    </div>

                    {/* Store address */}
                    <div>
                        <label style={labelStyle}>{t('settings.store_address')}</label>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={storeAddress}
                                onChange={(e) => setStoreAddress(e.target.value)}
                                disabled={!isAdmin}
                                placeholder={t('settings.address_placeholder')}
                                style={{ ...inputStyle, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                            />
                        </div>
                    </div>

                    {/* Store email */}
                    <div>
                        <label style={labelStyle}>{t('settings.store_email')}</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                value={storeEmail}
                                onChange={(e) => setStoreEmail(e.target.value)}
                                disabled={!isAdmin}
                                placeholder="contact@monmagasin.dz"
                                style={{ ...inputStyle, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                            />
                        </div>
                    </div>

                    {/* Store code (read-only) */}
                    <div>
                        <label style={labelStyle}>{t('settings.store_code_label')}</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Store size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={profile?.store_id || ''}
                                    readOnly
                                    style={{ ...inputStyle, opacity: 0.6, cursor: 'default', fontFamily: 'monospace', fontSize: '0.8rem' }}
                                />
                            </div>
                            <button
                                onClick={handleCopyStoreCode}
                                style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: copied ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)', color: copied ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? t('nav.copied') : t('nav.copy')}
                            </button>
                        </div>
                    </div>

                    {isAdmin && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={handleStoreSave} disabled={storeLoading} style={{ ...btnPrimary, opacity: storeLoading ? 0.7 : 1 }}>
                                <Save size={16} />
                                {storeLoading ? t('common.loading') : t('settings.save_store')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Password Section ── */}
            <div style={cardStyle}>
                <div style={sectionHeaderStyle}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={18} color="var(--danger)" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{t('settings.password_section')}</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {/* New password */}
                    <div>
                        <label style={labelStyle}>{t('settings.new_password')}</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ ...inputStyle, paddingRight: '3rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords(!showPasswords)}
                                style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                            >
                                {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm password */}
                    <div>
                        <label style={labelStyle}>{t('settings.confirm_password')}</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    ...inputStyle,
                                    borderColor: confirmPassword && newPassword !== confirmPassword ? 'var(--danger)' : 'var(--border-color)',
                                }}
                            />
                        </div>
                        {confirmPassword && newPassword !== confirmPassword && (
                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--danger)' }}>
                                {t('settings.password_mismatch')}
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handlePasswordChange}
                            disabled={passwordLoading || !newPassword || !confirmPassword}
                            style={{ ...btnPrimary, background: 'var(--danger)', opacity: (passwordLoading || !newPassword || !confirmPassword) ? 0.5 : 1 }}
                        >
                            <Lock size={16} />
                            {passwordLoading ? t('common.loading') : t('settings.change_password')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
