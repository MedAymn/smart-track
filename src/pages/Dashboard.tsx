import { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { TrendingUp, Users, Smartphone, DollarSign, Calendar, CreditCard, Eye, EyeOff, ShoppingCart } from 'lucide-react';
import type { AppData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type PeriodFilter = 'today' | 'week' | 'month' | 'custom';

const Dashboard = () => {
    const { profile } = useAuth();
    const { t, language } = useLanguage();
    const [data, setData] = useState<AppData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showMoney, setShowMoney] = useState(true);
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        const loadData = async () => {
            const appData = await StorageService.getData();
            setData(appData);
            setLoading(false);
        };
        loadData();
    }, []);

    if (loading || !data) {
        return <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>{t('dashboard.loading_dashboard')}</div>;
    }

    const formatMoney = (amount: number, suffix = ' DA') => {
        if (!showMoney) return '****' + suffix;
        return amount.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') + suffix;
    };

    // Calculate generic stats
    const totalPhones = data.phones.length;
    const inventoryPhones = data.phones.filter(p => p.status === 'inventory').length;

    // Fix Investissement Total to include the purchase price of ALL phones, even sold or returned ones
    // (Assuming "Investissement Total" means total money spent on buying inventory over time)
    const totalInvestment = data.phones.reduce((sum, phone) => sum + Number(phone.purchasePrice), 0);

    // Calculate total collected (payments from clients + general in transactions)
    const totalEncaissmentsSales = data.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalEncaissmentsCaisse = (data.caisseTransactions || []).filter(t => t.type === 'in').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalCollected = totalEncaissmentsSales + totalEncaissmentsCaisse;

    // Calculate total debt (sales that are pending)
    const totalDebt = data.sales.filter(s => s.status === 'pending').reduce((sum, sale) => {
        let deduction = 0;
        if (sale.phoneIds) {
            sale.phoneIds.forEach(pId => {
                const p = data.phones.find((ph: any) => ph.id === pId);
                if (p && p.status === 'returned') deduction += Number(p.returnPrice || 0);
            });
        } else {
            const p = data.phones.find((ph: any) => ph.id === (sale as any).phoneId);
            if (p && p.status === 'returned') deduction += Number(p.returnPrice || 0);
        }
        const effectiveSalePrice = Math.max(0, Number(sale.salePrice) - deduction);
        return sum + Math.max(0, effectiveSalePrice - Number(sale.amountPaid));
    }, 0);

    // Filter by time for detailed stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Period filter helpers
    const getPeriodRange = (): { from: Date; to: Date; label: string } => {
        const to = new Date(); to.setHours(23, 59, 59, 999);
        if (periodFilter === 'today') {
            const from = new Date(); from.setHours(0, 0, 0, 0);
            return { from, to, label: t('dashboard.today') };
        }
        if (periodFilter === 'week') {
            const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
            return { from, to, label: t('dashboard.this_week') };
        }
        if (periodFilter === 'custom' && customFrom && customTo) {
            const from = new Date(customFrom); from.setHours(0, 0, 0, 0);
            const toCustom = new Date(customTo); toCustom.setHours(23, 59, 59, 999);
            return { from, to: toCustom, label: `${customFrom} → ${customTo}` };
        }
        // month (default)
        const from = new Date(currentYear, currentMonth, 1);
        return { from, to, label: t('dashboard.this_month') };
    };
    const { from: periodFrom, to: periodTo, label: periodLabel } = getPeriodRange();

    const isInPeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= periodFrom && d <= periodTo;
    };

    const getEffectiveSaleValue = (sale: any) => {
        let deduction = 0;
        if (sale.phoneIds) {
            sale.phoneIds.forEach((pId: string) => {
                const p = data.phones.find(ph => ph.id === pId);
                if (p && p.status === 'returned') deduction += Number(p.returnPrice || 0);
            });
        } else if (sale.phoneId) {
            const p = data.phones.find(ph => ph.id === sale.phoneId);
            if (p && p.status === 'returned') deduction += Number(p.returnPrice || 0);
        }
        return Math.max(0, Number(sale.salePrice) - deduction);
    };

    // Bénéfice Net = Prix vente - Prix achat des téléphones vendus
    const calcGrossProfit = (salesToCalc: typeof data.sales) =>
        salesToCalc.reduce((sum, sale) => {
            const salePhones = (sale.phoneIds || []).map((id: string) => data.phones.find(p => p.id === id)).filter(Boolean) as any[];
            const soldPhones = salePhones.filter((p: any) => p.status !== 'returned');
            if (soldPhones.length === 0 && salePhones.length > 0) return sum;

            if (salePhones.length === 0 && (sale as any).phoneId) {
                const p = data.phones.find(ph => ph.id === (sale as any).phoneId);
                if (p && p.status === 'returned') return sum;
                if (p) soldPhones.push(p);
            }

            const totalCost = soldPhones.reduce((c: number, p: any) => c + Number(p.purchasePrice), 0);
            const effectiveSalePrice = getEffectiveSaleValue(sale);
            return sum + (effectiveSalePrice - totalCost);
        }, 0);

    // Dynamic period stats
    const salesInPeriod = data.sales.filter(s => isInPeriod(s.saleDate));
    const revenueInPeriod = salesInPeriod.reduce((sum, s) => sum + getEffectiveSaleValue(s), 0);
    const paymentsInPeriod = data.payments.filter(p => isInPeriod(p.paymentDate)).reduce((sum, p) => sum + Number(p.amount), 0)
        + (data.caisseTransactions || []).filter(t => t.type === 'in' && isInPeriod(t.transactionDate)).reduce((sum, t) => sum + Number(t.amount), 0);
    const profitInPeriod = calcGrossProfit(salesInPeriod);

    const calculateProfit = (salesToCalculate: typeof data.sales, checkMonth?: number, checkYear?: number, checkDayStr?: string) => {
        // Calculate standard Gross Profit (Net de ventes): salePrice - purchasePrice
        const grossProfit = salesToCalculate.reduce((sum, sale) => {
            let totalCostOfSoldPhones = 0;

            if (sale.phoneIds && sale.phoneIds.length > 0) {
                totalCostOfSoldPhones = sale.phoneIds.reduce((cost: number, pId: string) => {
                    const phone = data.phones.find(p => p.id === pId);
                    if (phone && phone.status !== 'returned') {
                        return cost + Number(phone.purchasePrice);
                    }
                    return cost;
                }, 0);
            } else {
                const phone = data.phones.find(p => p.id === (sale as any).phoneId);
                if (phone && phone.status !== 'returned') {
                    totalCostOfSoldPhones = Number(phone.purchasePrice);
                }
            }

            const effectiveRevenue = getEffectiveSaleValue(sale);
            if (effectiveRevenue === 0) return sum;
            return sum + (effectiveRevenue - totalCostOfSoldPhones);
        }, 0);

        // Calculate OUT transactions for the period (Caisse + Supplier Payments)
        let outs = 0;
        if (checkMonth !== undefined && checkYear !== undefined) {
            // General caisse outs
            outs += (data.caisseTransactions || []).filter(t => {
                const d = new Date(t.transactionDate);
                return t.type === 'out' && d.getMonth() === checkMonth && d.getFullYear() === checkYear;
            }).reduce((sum, t) => sum + Number(t.amount), 0);
            // Supplier payments as outs
            outs += ((data as any).supplierPayments || []).filter((p: any) => {
                const d = new Date(p.paymentDate);
                return d.getMonth() === checkMonth && d.getFullYear() === checkYear;
            }).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        } else if (checkDayStr) {
            // Daily view
            outs += (data.caisseTransactions || []).filter(t => t.type === 'out' && t.transactionDate.startsWith(checkDayStr)).reduce((sum, t) => sum + Number(t.amount), 0);
            outs += ((data as any).supplierPayments || []).filter((p: any) => p.paymentDate.startsWith(checkDayStr)).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        }

        // Subtract the returnPrice value of returned phones as a loss of revenue
        const returnedLossInThisPeriod = salesToCalculate.reduce((sum, sale) => {
            let loss = 0;
            if (sale.phoneIds) {
                sale.phoneIds.forEach(pId => {
                    const phone = data.phones.find(p => p.id === pId);
                    if (phone && phone.status === 'returned') {
                        loss += (phone.returnPrice ? Number(phone.returnPrice) : Number(phone.purchasePrice));
                    }
                });
            }
            return sum + loss;
        }, 0);

        return grossProfit - outs - returnedLossInThisPeriod;
    };

    // Calculate historical monthly profits
    const historicalMonths: { label: string, profit: number }[] = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth();
        const y = d.getFullYear();
        const salesForM = data.sales.filter(s => {
            const sd = new Date(s.saleDate);
            return sd.getMonth() === m && sd.getFullYear() === y;
        });
        const mProfit = calculateProfit(salesForM, m, y);
        const monthName = d.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ', { month: 'long', year: 'numeric' });
        historicalMonths.push({ label: monthName.charAt(0).toUpperCase() + monthName.slice(1), profit: mProfit });
    }

    return (
        <div className="animate-fade-in">
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h1 style={{ background: 'linear-gradient(to right, var(--accent-primary), #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                        {t('dashboard.overview')}
                    </h1>
                    {profile && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: isAdmin ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)', color: isAdmin ? 'var(--accent-primary)' : 'var(--success)', border: `1px solid ${isAdmin ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {isAdmin ? t('nav.admin_badge') : t('nav.staff_badge')}
                        </span>
                    )}
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => setShowMoney(!showMoney)}
                    title={showMoney ? t('dashboard.hide_money') : t('dashboard.show_money')}
                    style={{ padding: '0.6rem', borderRadius: '8px' }}
                >
                    {showMoney ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            {/* Period Filter + Stats */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
                        {t('dashboard.period_stats')} — <span style={{ color: 'var(--accent-primary)' }}>{periodLabel}</span>
                    </h2>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {(['today', 'week', 'month', 'custom'] as PeriodFilter[]).map(p => (
                            <button key={p} onClick={() => setPeriodFilter(p)} style={{ padding: '0.35rem 0.9rem', borderRadius: '8px', border: '1.5px solid', borderColor: periodFilter === p ? 'var(--accent-primary)' : 'var(--border-color)', background: periodFilter === p ? 'rgba(59,130,246,0.12)' : 'transparent', color: periodFilter === p ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                                {p === 'today' ? t('dashboard.today') : p === 'week' ? t('dashboard.this_week') : p === 'month' ? t('dashboard.this_month') : t('dashboard.custom')}
                            </button>
                        ))}
                    </div>
                </div>
                {periodFilter === 'custom' && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.875rem' }} />
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.875rem' }} />
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{t('dashboard.sales')}</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{salesInPeriod.length}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{formatMoney(revenueInPeriod)}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{t('dashboard.collected')}</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--success)' }}>{formatMoney(paymentsInPeriod)}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{t('dashboard.net_profit')}</p>
                        {isAdmin ? (
                            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: profitInPeriod >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }}>{profitInPeriod > 0 ? '+' : ''}{formatMoney(profitInPeriod)}</p>
                        ) : (
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><EyeOff size={14} /> {t('dashboard.access_reserved')}</p>
                        )}
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>{t('dashboard.global_stats')}</h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {/* Stat Cards */}
                <div className="glass-panel stat-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div className="icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                        <Smartphone size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('dashboard.total_inventory')}</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{inventoryPhones} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {totalPhones} {t('inventory.total_label')}</span></h3>
                    </div>
                </div>

                <div className="glass-panel stat-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div className="icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('dashboard.total_investment')}</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatMoney(totalInvestment, '')} <span style={{ fontSize: '1rem' }}>DZD</span></h3>
                    </div>
                </div>

                <div className="glass-panel stat-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div className="icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('dashboard.outstanding_debt')}</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--danger)' }}>{formatMoney(totalDebt, '')} <span style={{ fontSize: '1rem' }}>DZD</span></h3>
                    </div>
                </div>

                <div className="glass-panel stat-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div className="icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('dashboard.total_collected')}</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success)' }}>{formatMoney(totalCollected, '')} <span style={{ fontSize: '1rem' }}>DZD</span></h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1.5rem' }}>
                {isAdmin && (
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={20} style={{ color: 'var(--accent-primary)' }} />
                            {t('dashboard.profit_history')}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {historicalMonths.map((m, idx) => (
                                <div key={idx} className="recent-activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <p style={{ fontWeight: '600', fontSize: '0.875rem' }}>{m.label}</p>
                                    <p style={{ fontWeight: '700', color: m.profit >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                                        {m.profit > 0 ? '+' : ''}{formatMoney(m.profit)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="glass-panel" style={{ padding: '1.5rem', gridRow: isAdmin ? 'span 2' : 'auto' }}>
                        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={20} style={{ color: 'var(--success)' }} />
                            {t('dashboard.recent_sales')}
                        </h2>
                        {data.sales.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                                <p style={{ margin: 0 }}>{t('dashboard.no_recent_sales')}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {data.sales.slice().reverse().slice(0, 5).map(sale => {
                                    let devicesString = language === 'ar' ? 'جهاز غير معروف' : 'Appareil Inconnu';
                                    if (sale.phoneIds && sale.phoneIds.length > 0) {
                                        const models = sale.phoneIds.map(id => {
                                            const phone = data.phones.find(p => p.id === id);
                                            return phone ? phone.model : (language === 'ar' ? 'غير معروف' : 'Inconnu');
                                        });
                                        devicesString = models.join(', ');
                                    }
                                    const client = data.clients?.find((c: any) => c.id === sale.clientId);
                                    const clientLabel = client?.name || sale.customerName || t('common.unknown');
                                return (
                                        <div key={sale.id} className="recent-activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                            <div>
                                                <p style={{ fontWeight: '600', fontSize: '0.875rem' }}>{clientLabel}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={devicesString}>{devicesString}</p>
                                            </div>
                                            <div style={{ textAlign: language === 'ar' ? 'left' : 'right' }}>
                                                <p style={{ fontWeight: '700', color: 'var(--success)' }}>+{Number(sale.salePrice).toLocaleString()} DZD</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(sale.saleDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR')}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
    );
};

export default Dashboard;
