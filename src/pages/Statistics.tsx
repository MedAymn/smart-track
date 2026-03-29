import { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import type { Sale, Phone, CaisseTransaction } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, AlertTriangle, Activity } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];

export default function Statistics() {
    const { t, language } = useLanguage();
    const [sales, setSales] = useState<Sale[]>([]);
    const [phones, setPhones] = useState<Phone[]>([]);
    const [caisseTransactions, setCaisseTransactions] = useState<CaisseTransaction[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await StorageService.getData();
                setSales(data.sales || []);
                setPhones(data.phones || []);
                setCaisseTransactions(data.caisseTransactions || []);
                setPayments(data.payments || []);
                setSupplierPayments(data.supplierPayments || []);
            } catch (error) {
                console.error('Failed to load data', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const monthlyIncome = useMemo(() => {
        const last6Months = Array.from({ length: 6 }).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return {
                monthInfo: d.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ', { month: 'short', year: '2-digit' }),
                monthRaw: d.getMonth(),
                yearRaw: d.getFullYear(),
                income: 0,
                expenses: 0,
                profit: 0
            };
        }).reverse();

        sales.forEach(sale => {
            const date = new Date(sale.saleDate);
            const entry = last6Months.find(m => m.monthRaw === date.getMonth() && m.yearRaw === date.getFullYear());
            if (entry) {
                entry.income += Number(sale.amountPaid);
            }
        });

        caisseTransactions.forEach(tx => {
            const date = new Date(tx.transactionDate);
            const entry = last6Months.find(m => m.monthRaw === date.getMonth() && m.yearRaw === date.getFullYear());
            if (entry) {
                if (tx.type === 'in') entry.income += Number(tx.amount);
                if (tx.type === 'out') entry.expenses += Number(tx.amount);
            }
        });

        last6Months.forEach(m => {
            m.profit = m.income - m.expenses;
        });

        return last6Months;
    }, [sales, caisseTransactions]);


    const topSales = useMemo(() => {
        const modelCounts: Record<string, number> = {};
        sales.forEach(sale => {
            if (sale.phoneIds) {
                sale.phoneIds.forEach(pId => {
                    const phone = phones.find(p => p.id === pId);
                    if (phone) {
                        modelCounts[phone.model] = (modelCounts[phone.model] || 0) + 1;
                    }
                });
            } else if ((sale as any).phoneId) {
                const phone = phones.find(p => p.id === (sale as any).phoneId);
                if (phone) {
                    modelCounts[phone.model] = (modelCounts[phone.model] || 0) + 1;
                }
            }
        });

        const sorted = Object.entries(modelCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        return sorted;
    }, [sales, phones]);

    const todaySalesValue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return sales.filter(s => s.saleDate.startsWith(today)).reduce((sum, s) => sum + Number(s.salePrice), 0);
    }, [sales]);

    const stockValue = useMemo(() => {
        return phones.filter(p => p.status === 'inventory').reduce((sum, p) => sum + Number(p.purchasePrice), 0);
    }, [phones]);

    const totalUnpaidDebts = useMemo(() => {
        return sales.reduce((sum, s) => {
            const effPrice = Number(s.salePrice);
            const effPaid = Math.min(Number(s.amountPaid), effPrice);
            return sum + Math.max(0, effPrice - effPaid);
        }, 0);
    }, [sales]);

    const globalNetProfit = useMemo(() => {
        const totInCaisse = caisseTransactions.filter(t => t.type === 'in').reduce((sum, t) => sum + Number(t.amount), 0);
        const totOutCaisse = caisseTransactions.filter(t => t.type === 'out').reduce((sum, t) => sum + Number(t.amount), 0);
        const totPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totSupplierPayments = supplierPayments.reduce((sum, sp) => sum + Number(sp.amount), 0);
        const totReturns = phones.filter(p => p.status === 'returned').reduce((sum, p) => sum + Number(p.returnPrice || 0), 0);
        
        return (totInCaisse + totPayments) - (totOutCaisse + totSupplierPayments + totReturns);
    }, [caisseTransactions, payments, supplierPayments, phones]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('common.loading')}...</div>;

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem' }}>{t('statistics.title')}</h1>

            {/* QUICK STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel stat-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 600 }}>{t('statistics.today_sales')}</p>
                        <h3 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--text-main)' }}>
                            {todaySalesValue.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#3b82f6' }}>
                        <TrendingUp size={24} />
                    </div>
                </div>
 
                <div className="glass-panel stat-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 600 }}>{t('statistics.stock_value')}</p>
                        <h3 style={{ fontSize: '1.4rem', margin: 0, color: '#f59e0b' }}>
                            {stockValue.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#f59e0b' }}>
                        <Package size={24} />
                    </div>
                </div>
 
                <div className="glass-panel stat-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 600 }}>{t('statistics.unpaid_debts')}</p>
                        <h3 style={{ fontSize: '1.4rem', margin: 0, color: '#ef4444' }}>
                            {totalUnpaidDebts.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#ef4444' }}>
                        <AlertTriangle size={24} />
                    </div>
                </div>
 
                <div className="glass-panel stat-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 600 }}>{t('statistics.global_caisse')}</p>
                        <h3 style={{ fontSize: '1.4rem', margin: 0, color: globalNetProfit >= 0 ? '#10b981' : '#ef4444' }}>
                            {globalNetProfit.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: globalNetProfit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', color: globalNetProfit >= 0 ? '#10b981' : '#ef4444' }}>
                        <Activity size={24} />
                    </div>
                </div>
            </div>

            <div className="charts-grid-container">
                {/* Cashflow Chart */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{t('statistics.cashflow_chart')}</h2>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <AreaChart data={monthlyIncome}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="monthInfo" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} width={60} />
                                <Tooltip
                                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                                <Area type="monotone" name={`${t('statistics.entrants')} (DA)`} dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                                <Area type="monotone" name={`${t('statistics.sortants')} (DA)`} dataKey="expenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Phones Chart */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{t('statistics.top_models')}</h2>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={topSales}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {topSales.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
