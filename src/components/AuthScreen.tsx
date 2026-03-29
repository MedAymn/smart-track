import React, { useState } from 'react';
import { Lock, Unlock, AlertCircle, Moon, Sun, Store, Mail, User, ArrowLeft, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthScreenProps {
    onUnlock: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onUnlock }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [storeName, setStoreName] = useState('');
    const [joinStoreId, setJoinStoreId] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) throw error;
            setResetSent(true);
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                onUnlock();
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            store_name: isJoining ? undefined : storeName,
                            full_name: fullName,
                            join_store_id: isJoining && joinStoreId.trim() !== '' ? joinStoreId.trim() : undefined
                        }
                    }
                });
                if (error) throw error;
                
                // Usually Supabase requires email confirmation depending on settings.
                // We will just unlock immediately for smooth UX, but warn if session is null
                const { data } = await supabase.auth.getSession();
                if (data.session) {
                    onUnlock();
                } else {
                    setError(t('auth.check_email'));
                }
            }
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'var(--bg-color)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', color: 'var(--text-main)'
        }}>
            <div style={{
                background: 'var(--bg-secondary)', padding: '2.5rem', borderRadius: '24px',
                boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '420px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                border: '1px solid var(--border-color)', position: 'relative'
            }}>
                <button
                    onClick={toggleTheme}
                    style={{
                        position: 'absolute', top: '1.5rem', right: '1.5rem',
                        padding: '0.6rem', borderRadius: '50%', background: 'var(--bg-tertiary)',
                        color: 'var(--text-main)', border: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-md)'
                    }}
                    title={theme === 'dark' ? t('common.theme_light') : t('common.theme_dark')}
                >
                    {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
                </button>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), #60a5fa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.5)'
                }}>
                    {isLogin ? <Lock size={32} color="white" /> : <Unlock size={32} color="white" />}
                </div>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>
                    {isForgotPassword ? t('auth.forgot_password_title') : isLogin ? t('auth.login') : (isJoining ? t('auth.join_store') : t('auth.create_store'))}
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
                    {isForgotPassword ? t('auth.forgot_password_subtitle') : isLogin ? t('auth.welcome_back') : (isJoining ? t('auth.join_team') : t('auth.welcome_new'))}
                </p>

                {error && (
                    <div style={{
                        width: '100%', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1.5rem',
                        display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, padding: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px'
                    }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {/* ── Forgot Password Form ── */}
                {isForgotPassword && (
                    <div style={{ width: '100%' }}>
                        {resetSent ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
                                <CheckCircle size={48} color="var(--success)" />
                                <p style={{ textAlign: 'center', color: 'var(--text-main)', fontWeight: 500 }}>
                                    {t('auth.reset_sent')}
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="email"
                                        placeholder={t('auth.email')}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-main)', fontSize: '1rem', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', background: 'var(--accent-primary)', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                                >
                                    {loading ? t('common.loading') : t('auth.send_reset_link')}
                                </button>
                            </form>
                        )}
                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setResetSent(false); setError(''); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', marginTop: '1.2rem', width: '100%', textDecoration: 'underline' }}
                        >
                            <ArrowLeft size={14} /> {t('auth.back_to_login')}
                        </button>
                    </div>
                )}

                {!isForgotPassword && (
                <form onSubmit={handleAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    
                    {!isLogin && (
                        <>
                            {/* Toggle Join / Create Mode */}
                            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.2rem', background: 'var(--bg-primary)', borderRadius: '10px', marginBottom: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => { setIsJoining(false); setJoinStoreId(''); }}
                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', background: !isJoining ? 'var(--bg-secondary)' : 'transparent', color: !isJoining ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: !isJoining ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', boxShadow: !isJoining ? 'var(--shadow-sm)' : 'none' }}
                                >
                                    {t('auth.create_store')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsJoining(true); setStoreName(''); }}
                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', background: isJoining ? 'var(--bg-secondary)' : 'transparent', color: isJoining ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: isJoining ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', boxShadow: isJoining ? 'var(--shadow-sm)' : 'none' }}
                                >
                                    {t('auth.join_store')}
                                </button>
                            </div>

                                <div style={{ position: 'relative' }}>
                                    <Store size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder={isJoining ? t('auth.store_code') : t('auth.store_name')}
                                        value={isJoining ? joinStoreId : storeName}
                                        onChange={(e) => isJoining ? setJoinStoreId(e.target.value) : setStoreName(e.target.value)}
                                        required={!isLogin}
                                        style={{
                                            width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '12px',
                                            border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                            color: 'var(--text-main)', fontSize: '1rem'
                                        }}
                                    />
                                </div>

                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder={t('auth.full_name')}
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required={!isLogin}
                                    style={{
                                        width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '12px',
                                        border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                        color: 'var(--text-main)', fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="email"
                            placeholder={t('auth.email')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '12px',
                                border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                color: 'var(--text-main)', fontSize: '1rem'
                            }}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="password"
                            placeholder={t('auth.password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            style={{
                                width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '12px',
                                border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                color: 'var(--text-main)', fontSize: '1rem'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '0.8rem', borderRadius: '12px',
                            background: 'var(--accent-primary)', color: 'white', border: 'none',
                            fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: '0.5rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        {loading ? t('common.loading') : (isLogin ? t('auth.login') : t('auth.signup'))}
                    </button>
                    
                    {isLogin && (
                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(true); setError(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline' }}
                        >
                            {t('auth.forgot_password')}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: '0.9rem', cursor: 'pointer', marginTop: '0.5rem',
                            textDecoration: 'underline'
                        }}
                    >
                        {isLogin ? t('auth.no_account') : t('auth.have_account')}
                    </button>
                </form>
                )}  {/* end !isForgotPassword */}
            </div>
        </div>
    );
};

export default AuthScreen;
