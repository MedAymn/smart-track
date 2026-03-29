import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Menu, X, Briefcase, Truck, ArrowLeftRight, Moon, Sun, LogOut, Wrench, Activity as ActivityIcon, UserCog, ClipboardList, Bell, CheckCircle, AlertTriangle, Info, XCircle, CheckCheck, Settings } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { NotificationService } from '../services/storage';
import type { Notification } from '../types';
import styles from './Layout.module.css';

const LanguageSwitcher = ({ variant = 'default' }: { variant?: 'default' | 'compact' }) => {
    const { t, language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'fr' ? 'ar' : 'fr');
    };

    if (variant === 'compact') {
        return (
            <button
                onClick={toggleLanguage}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.8rem', borderRadius: '12px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                    color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s'
                }}
                className="hover-lift"
            >
                {language === 'fr' ? 'العربية' : 'Français'}
            </button>
        );
    }

    return (
        <button
            onClick={toggleLanguage}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                padding: '0.7rem 1rem', borderRadius: '10px',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s'
            }}
            className="hover-lift"
        >
            <Smartphone size={16} />
            {language === 'fr' ? t('nav.change_to_ar') : t('nav.change_to_fr')}
        </button>
    );
};

const Layout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const { profile } = useAuth();

    const isAdmin = profile?.role === 'admin';
    const { t, language } = useLanguage();

    const navLinks = [
        { to: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={20} />, show: true },
        { to: '/inventory', label: t('nav.inventory'), icon: <Smartphone size={20} />, show: true },
        { to: '/clients', label: t('nav.clients'), icon: <Briefcase size={20} />, show: true },
        { to: '/suppliers', label: t('nav.suppliers'), icon: <Truck size={20} />, show: true },
        { to: '/debtors', label: t('nav.sales_debt'), icon: <Users size={20} />, show: true },
        { to: '/transactions', label: t('nav.transactions'), icon: <ArrowLeftRight size={20} />, show: true },
        { to: '/repairs', label: t('nav.repairs'), icon: <Wrench size={20} />, show: true },
        { to: '/tasks', label: t('nav.tasks'), icon: <ClipboardList size={20} />, show: true },
        { to: '/statistics', label: t('nav.statistics'), icon: <LayoutDashboard size={20} />, show: isAdmin },
        { to: '/activity', label: t('nav.activity'), icon: <ActivityIcon size={20} />, show: isAdmin },
        { to: '/staff', label: t('nav.staff'), icon: <UserCog size={20} />, show: isAdmin },
        { to: '/settings', label: t('settings.title'), icon: <Settings size={20} />, show: true },
    ].filter(link => link.show);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    useEffect(() => {
        if (profile) {
            NotificationService.getNotifications()
                .then(setNotifications)
                .catch(console.error);

            const subscription = supabase
                .channel('notifications_changes')
                .on('postgres_changes', 
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `store_id=eq.${profile.store_id}` }, 
                    () => {
                        NotificationService.getNotifications()
                            .then(setNotifications)
                            .catch(console.error);
                    }
                )
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [profile]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkAllRead = async () => {
        try {
            await NotificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (e) {
            console.error(e);
        }
    };

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.is_read) {
            try {
                await NotificationService.markAsRead(notif.id);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            } catch (e) {
                console.error(e);
            }
        }
    };

    const renderNotificationBell = () => (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0.6rem', borderRadius: '10px',
                    background: showNotifications ? 'var(--bg-secondary)' : 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                    color: 'var(--text-muted)'
                }}
                className="hover-lift"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className={styles.notificationBadge}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {showNotifications && (
                <>
                    <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                        onClick={() => setShowNotifications(false)} 
                    />
                    <div className={styles.notificationsDropdown} style={{ zIndex: 100 }}>
                        <div className={styles.dropdownHeader}>
                            <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('nav.notifications')}</h3>
                            {unreadCount > 0 && (
                                <button 
                                    onClick={handleMarkAllRead}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    <CheckCheck size={14} /> {t('nav.mark_all_read')}
                                </button>
                            )}
                        </div>
                        <div className={styles.notificationList}>
                            {notifications.length === 0 ? (
                                <div className={styles.emptyState}>{t('nav.no_notifications')}</div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif.id} 
                                        className={`${styles.notificationItem} ${!notif.is_read ? styles.unread : ''}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                            {notif.type === 'success' && <CheckCircle size={18} color="var(--success)" />}
                                            {notif.type === 'error' && <XCircle size={18} color="var(--danger)" />}
                                            {notif.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" />}
                                            {notif.type === 'info' && <Info size={18} color="var(--accent-primary)" />}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>{notif.title}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    {new Date(notif.created_at).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{notif.message}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className={styles.layout}>
            {/* Mobile Header */}
            <div className={styles.mobileHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
                        flexShrink: 0,
                    }}>
                        <Smartphone size={18} color="white" strokeWidth={2.2} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', background: 'linear-gradient(to right, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Smart Track</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LanguageSwitcher variant="compact" />
                    <button
                        onClick={toggleTheme}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: '999px', background: theme === 'dark' ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.07)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.25s' }}
                    >
                        {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
                    </button>
                    <button
                        className={styles.menuButton}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Sidebar Navigation */}
            <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    {/* Logo */}
                    <div style={{
                        width: 48, height: 48, borderRadius: 16,
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #ec4899 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
                        flexShrink: 0,
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 60%)',
                            borderRadius: 'inherit'
                        }} />
                        <Smartphone size={24} color="white" strokeWidth={2.2} />
                    </div>
                    <h2>Smart Track</h2>
                </div>

                <nav className={styles.navigation}>
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) =>
                                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                            }
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom: Notifications + Theme Toggle + Logout */}
                <div style={{ padding: '1.5rem', marginTop: 'auto', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    
                    {/* Language Switcher */}
                    <LanguageSwitcher />

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.6rem',
                            padding: '0.7rem 1rem',
                            borderRadius: '10px',
                            background: theme === 'dark' ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.04)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        className="hover-lift"
                    >
                        {theme === 'dark' ? <><Sun size={16} /> {t('common.theme_light')}</> : <><Moon size={16} /> {t('common.theme_dark')}</>}
                    </button>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="hover-lift"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.8rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <LogOut size={18} />
                        <span>{t('common.logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={styles.mainContent}>
                <div className={styles.desktopTopRight}>
                    <LanguageSwitcher variant="compact" />
                    {renderNotificationBell()}
                </div>
                <div className={styles.contentContainer}>
                    <Outlet />
                </div>
            </main>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
};

export default Layout;
