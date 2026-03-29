import { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import type { Phone, Sale, Client } from '../types';
import { ShoppingCart, DollarSign, CheckCircle, AlertTriangle, RefreshCcw, Edit, Trash2, Printer, Camera, TrendingUp } from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { generateSaleWhatsAppLink } from '../utils/whatsapp.ts';
import IMEIScanner from '../components/IMEIScanner';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const Debtors = () => {
    const { profile, storeName } = useAuth();
    const { t, language } = useLanguage();
    const isAdmin = profile?.role === 'admin';
    const { showToast } = useToast();
    const [sales, setSales] = useState<Sale[]>([]);
    const [availablePhones, setAvailablePhones] = useState<Phone[]>([]);
    const [allPhones, setAllPhones] = useState<Phone[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    // Modals
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

    // Edit Sale Modal
    const [isEditSaleModalOpen, setIsEditSaleModalOpen] = useState(false);
    const [editSaleId, setEditSaleId] = useState<string | null>(null);
    const [editClientId, setEditClientId] = useState('');
    const [editSalePrice, setEditSalePrice] = useState('');
    const [editSaleDate, setEditSaleDate] = useState('');

    // New Sale Form
    const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
    const [clientId, setClientId] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [initialPayment, setInitialPayment] = useState('0');
    const [salePaymentMethod, setSalePaymentMethod] = useState<'cash' | 'edahabia' | 'bank_transfer'>('cash');
    const [saleDueDate, setSaleDueDate] = useState(''); // NEW

    // New Payment Form
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'edahabia' | 'bank_transfer'>('cash');

    const [scannerInput, setScannerInput] = useState('');
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const [isSubmittingSale, setIsSubmittingSale] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsSaleModalOpen(false);
                setIsPaymentModalOpen(false);
                setIsEditSaleModalOpen(false);
            }
        };
        const anyOpen = isSaleModalOpen || isPaymentModalOpen || isEditSaleModalOpen;
        if (anyOpen) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSaleModalOpen, isPaymentModalOpen, isEditSaleModalOpen]);

    const loadData = async () => {
        const data = await StorageService.getData();
        setSales(data.sales);
        setAllPhones(data.phones);
        setAvailablePhones(data.phones.filter(p => p.status === 'inventory'));
        setClients(data.clients);
    };

    const handleAddSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPhoneIds.length === 0 || !clientId || !salePrice) return;
        if (isSubmittingSale) return;
        setIsSubmittingSale(true);

        const _salePrice = parseFloat(salePrice);
        const _initialPayment = parseFloat(initialPayment) || 0;

        try {
            const newSale = await StorageService.addSale({
                phoneIds: selectedPhoneIds,
                clientId,
                salePrice: _salePrice,
                amountPaid: 0,
                saleDate: new Date().toISOString(),
                dueDate: (_initialPayment < _salePrice && saleDueDate) ? new Date(saleDueDate).toISOString() : undefined,
                status: _initialPayment >= _salePrice ? 'paid' : 'pending'
            });

            if (_initialPayment > 0) {
                await StorageService.addPayment({
                    saleId: newSale.id,
                    amount: _initialPayment,
                    method: salePaymentMethod,
                    paymentDate: new Date().toISOString()
                });
            }

            // Reset and close
            setSelectedPhoneIds([]);
            setClientId('');
            setSalePrice('');
            setInitialPayment('0');
            setSaleDueDate('');
            setIsSaleModalOpen(false);
            await loadData();
            showToast(t('debtors.sale_recorded'), 'success');
        } catch (error: any) {
            console.error('Add Sale Error:', error);
            showToast(error.message || t('common.error'), 'error');
        } finally {
            setIsSubmittingSale(false);
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSaleId || !paymentAmount) return;

        await StorageService.addPayment({
            saleId: selectedSaleId,
            amount: parseFloat(paymentAmount),
            method: paymentMethod,
            paymentDate: new Date().toISOString()
        });

        setPaymentAmount('');
        setSelectedSaleId(null);
        setIsPaymentModalOpen(false);
        await loadData();
    };

    const openPaymentModal = (saleId: string) => {
        setSelectedSaleId(saleId);
        setIsPaymentModalOpen(true);
    };

    const openEditSaleModal = (sale: Sale) => {
        setEditSaleId(sale.id);
        setEditClientId(sale.clientId || '');
        setEditSalePrice(sale.salePrice.toString());
        setEditSaleDate(new Date(sale.saleDate).toISOString().split('T')[0]);
        setIsEditSaleModalOpen(true);
    };

    const handleEditSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editSaleId) return;

        try {
            await StorageService.updateSale(editSaleId, {
                clientId: editClientId,
                salePrice: parseFloat(editSalePrice),
                saleDate: new Date(editSaleDate).toISOString()
            });
            setIsEditSaleModalOpen(false);
            showToast(t('common.save'), 'success');
            await loadData();
        } catch (error: any) {
            showToast(t('common.error') + " : " + error.message, 'error');
        }
    };

    const handleDeleteSale = async (sale: Sale) => {
        if (window.confirm(t('debtors.delete_confirm'))) {
            try {
                await StorageService.deleteSale(sale.id);
                showToast(t('common.delete'), 'success');
                await loadData();
            } catch (error: any) {
                showToast(t('common.error') + " : " + error.message, 'error');
            }
        }
    };

    const getEffectiveSaleValue = (sale: Sale) => {
        return Number(sale.salePrice);
    };

    const getEffectiveAmountPaid = (sale: Sale) => {
        const effPrice = getEffectiveSaleValue(sale);
        return Math.min(Number(sale.amountPaid), effPrice);
    };

    const renderPhoneModels = (pIds: string[] | undefined) => {
        if (!pIds || pIds.length === 0) return <span>{t('inventory.empty_state_search')}</span>;
        return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {pIds.map((id, index) => {
                    const p = allPhones.find(ph => ph.id === id);
                    if (!p) return <span key={index}>{t('common.error')}{index < pIds.length - 1 ? ',' : ''}</span>;

                    if (p.status === 'returned') {
                        return (
                            <span key={index} style={{ textDecoration: 'line-through', color: '#ef4444', textDecorationThickness: '2px' }} title={t('inventory.returned_helper')}>
                                {p.model}{index < pIds.length - 1 ? ',' : ''}
                            </span>
                        );
                    }
                    return <span key={index}>{p.model}{index < pIds.length - 1 ? ',' : ''}</span>;
                })}
            </div>
        );
    };

    const handlePhoneToggle = (id: string) => {
        setSelectedPhoneIds(prev => {
            let nextIds;
            if (prev.includes(id)) {
                nextIds = prev.filter(pId => pId !== id);
            } else {
                nextIds = [...prev, id];
            }

            // Auto-calculate suggested sum
            const newSum = nextIds.reduce((sum, pId) => {
                const phone = availablePhones.find(p => p.id === pId);
                // Use sellingPrice if available, otherwise fallback to purchasePrice
                const priceToAdd = phone ? (phone.sellingPrice ? Number(phone.sellingPrice) : Number(phone.purchasePrice)) : 0;
                return sum + priceToAdd;
            }, 0);

            if (newSum > 0) {
                setSalePrice(newSum.toString());
            } else {
                setSalePrice('');
            }

            return nextIds;
        });
    };

    const [showAgingReport, setShowAgingReport] = useState(false);

    const totalSalesValue = sales.reduce((sum, s) => sum + getEffectiveSaleValue(s), 0);
    const totalRemainingDebts = sales.reduce((sum, s) => {
        const effPrice = getEffectiveSaleValue(s);
        const effPaid = getEffectiveAmountPaid(s);
        return sum + Math.max(0, effPrice - effPaid);
    }, 0);
    const totalRecovered = sales.reduce((sum, s) => sum + getEffectiveAmountPaid(s), 0);

    // Debt Aging computation
    const agingData = sales
        .filter(s => {
            const remaining = getEffectiveSaleValue(s) - getEffectiveAmountPaid(s);
            return remaining > 0;
        })
        .map(s => {
            const remaining = getEffectiveSaleValue(s) - getEffectiveAmountPaid(s);
            const client = clients.find(c => c.id === s.clientId);
            const daysOverdue = s.dueDate
                ? Math.max(0, Math.floor((Date.now() - new Date(s.dueDate).getTime()) / 86400000))
                : null;
            const risk = daysOverdue === null ? 'none' :
                daysOverdue > 30 ? 'high' :
                daysOverdue > 15 ? 'medium' : 'low';
            return { sale: s, client, remaining, daysOverdue, risk };
        })
        .sort((a, b) => (b.daysOverdue ?? -1) - (a.daysOverdue ?? -1));

    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{t('nav.debtors')}</h1>
                <div className="responsive-btn-group">
                    <button onClick={() => setShowAgingReport(!showAgingReport)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: showAgingReport ? 'var(--danger)' : 'var(--bg-secondary)', color: showAgingReport ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${showAgingReport ? 'var(--danger)' : 'var(--border-color)'}`, borderRadius: '10px', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        📊 {t('debtors.aging_report')}
                    </button>
                    <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        <RefreshCcw size={16} /> {t('common.refresh')}
                    </button>
                    <button className="btn-primary" onClick={() => setIsSaleModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                        <ShoppingCart size={18} /> {t('debtors.sell')}
                    </button>
                </div>
            </div>


            {showAgingReport && (
                <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--danger)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📊 {t('debtors.aging_report_title')}
                    </h2>
                    {/* Desktop View Table */}
                    <div className="mobile-hide" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>{t('clients.name')}</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>{t('clients.products')}</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>{t('debtors.due_date')}</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>{t('debtors.overdue_days')}</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>{t('clients.balance_due')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agingData.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('clients.no_payments')}</td></tr>
                                ) : agingData.map(({ sale, client, remaining, daysOverdue, risk }, idx) => {
                                    const riskColors = {
                                        none: { color: 'var(--text-muted)', bg: 'transparent' },
                                        low: { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                                        medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                                        high: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
                                    };
                                    const r = riskColors[risk as keyof typeof riskColors];

                                    return (
                                        <tr key={sale.id + idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem 0.6rem', fontWeight: 600 }}>{client?.name || sale.customerName || t('common.error')}</td>
                                            <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)' }}>{renderPhoneModels(sale.phoneIds)}</td>
                                            <td style={{ padding: '0.75rem 0.6rem' }}>{sale.dueDate ? new Date(sale.dueDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') : t('common.loading')}</td>
                                            <td style={{ padding: '0.75rem 0.6rem' }}>
                                                {daysOverdue !== null ? (
                                                    <span style={{ padding: '0.25rem 0.65rem', borderRadius: '4px', background: r.bg, color: r.color, fontWeight: 700, fontSize: '0.8rem' }}>
                                                        {daysOverdue > 0 ? `${daysOverdue} ${t('debtors.days')}` : t('common.success')}
                                                    </span>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {agingData.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>{t('clients.no_payments')}</p>
                        ) : (
                            agingData.map(({ sale, client, remaining, daysOverdue }) => (
                                <div key={sale.id} style={{ 
                                    padding: '1rem', 
                                    background: 'var(--bg-tertiary)', 
                                    borderRadius: '12px', 
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{client?.name || sale.customerName || t('common.error')}</div>
                                        <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '1rem' }}>{remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{renderPhoneModels(sale.phoneIds)}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('debtors.due_date')}:</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: daysOverdue !== null && daysOverdue > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                                                {sale.dueDate ? new Date(sale.dueDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') : 'N/A'}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {(() => {
                                                const salePhones = allPhones.filter(p => sale.phoneIds?.includes(p.id));
                                                const phoneNames = salePhones.map(p => p.model).join(', ');
                                                const waLink = client?.phone ? generateSaleWhatsAppLink(t, language, sale, phoneNames, client.name, client.phone) : null;
                                                return waLink ? (
                                                    <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                    </a>
                                                ) : null;
                                            })()}
                                            <button 
                                                onClick={() => generateReceiptPDF(t, language, sale, client, allPhones.filter(p => sale.phoneIds?.includes(p.id)), storeName)}
                                                style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            >
                                                <Printer size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            )}

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel stat-card hover-lift" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>{t('debtors.total_sales')}</p>
                        <h3 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                            {totalSalesValue.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '4px' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--accent-primary)' }}>
                        <TrendingUp size={24} />
                    </div>
                </div>

                <div className="glass-panel stat-card hover-lift" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>{t('debtors.total_recovered')}</p>
                        <h3 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
                            {totalRecovered.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '4px' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--success)' }}>
                        <CheckCircle size={24} />
                    </div>
                </div>

                <div className="glass-panel stat-card hover-lift" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>{t('debtors.unpaid_debts')}</p>
                        <h3 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center' }}>
                            {totalRemainingDebts.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '4px' }}>DA</span>
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--danger)' }}>
                        <AlertTriangle size={24} />
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t('debtors.history')}
                    </h2>
                </div>
                {/* Desktop View Table */}
                <div className="mobile-hide" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', WebkitMaskImage: 'linear-gradient(to right, black 95%, transparent 100%)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('clients.name')}</th>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('clients.products')}</th>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('clients.date')}</th>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('inventory.selling_price')}</th>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('clients.balance_due')}</th>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('clients.status')}</th>
                                <th style={{ padding: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <ShoppingCart size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                                        <p>{t('inventory.empty_state_search')}</p>
                                    </td>
                                </tr>
                            ) : (
                                [...sales].sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()).map((sale) => {
                                    const effectiveSalePrice = getEffectiveSaleValue(sale);
                                    const effectiveAmountPaid = getEffectiveAmountPaid(sale);
                                    const remainingDebt = effectiveSalePrice - effectiveAmountPaid;

                                    // Override UI status based strictly on the effective debt
                                    const uiStatus = remainingDebt <= 0 ? 'paid' : 'pending';
                                    const isOverdue = uiStatus === 'pending' && sale.dueDate && new Date(sale.dueDate).getTime() < new Date().setHours(0,0,0,0);

                                    return (
                                        <tr key={sale.id} className="hover-lift" style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background-color 0.2s', backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                                            <td style={{ padding: '1rem', fontWeight: '500' }}>
                                                {(() => {
                                                    const client = clients.find(c => c.id === sale.clientId);
                                                    return client ? client.name : sale.customerName || t('common.not_available');
                                                })()}
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)', maxWidth: '200px' }}>
                                                {renderPhoneModels(sale.phoneIds)}
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{new Date(sale.saleDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {effectiveSalePrice !== Number(sale.salePrice) && (
                                                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '6px', fontSize: '0.85rem' }}>
                                                        {Number(sale.salePrice).toLocaleString()}
                                                    </span>
                                                )}
                                                {effectiveSalePrice.toLocaleString()} DZD
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: '600', color: remainingDebt > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                {remainingDebt.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
                                                {isOverdue && (
                                                    <span title={t('debtors.overdue_warning')} style={{ marginLeft: '6px' }}>⚠️</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span className={uiStatus === 'paid' ? 'badge badge-success' : 'badge badge-warning'} style={{ width: 'max-content' }}>
                                                        {uiStatus === 'paid' ? t('clients.status_paid') : t('clients.status_pending')}
                                                    </span>
                                                    {uiStatus === 'pending' && sale.dueDate && (
                                                        <span style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isOverdue ? 600 : 400 }}>
                                                            {t('debtors.before')}: {new Date(sale.dueDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {uiStatus !== 'paid' && (
                                                        <button className="btn-secondary" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => openPaymentModal(sale.id)} title={t('debtors.record_payment')}>
                                                            <DollarSign size={15} />
                                                        </button>
                                                    )}
                                                    {uiStatus === 'paid' && (
                                                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', marginLeft: '2px', marginRight: '6px' }} title={t('clients.status_paid')}>
                                                            <CheckCircle size={15} />
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            const saleClient = clients.find(c => c.id === sale.clientId);
                                                            const salePhones = allPhones.filter(p => sale.phoneIds?.includes(p.id) || (sale as any).phoneId === p.id);
                                                            generateReceiptPDF(t, language, sale, saleClient, salePhones, storeName);
                                                        }}
                                                        title={t('clients.print_receipt')}
                                                        style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                    {(() => {
                                                        const saleClient = clients.find(c => c.id === sale.clientId);
                                                        const salePhones = allPhones.filter(p => sale.phoneIds?.includes(p.id));
                                                        const phoneNames = salePhones.map(p => p.model).join(', ');
                                                        const waLink = saleClient?.phone ? generateSaleWhatsAppLink(t, language, sale, phoneNames, saleClient.name, saleClient.phone) : null;
                                                        return waLink ? (
                                                            <a
                                                                href={waLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={t('debtors.send_whatsapp')}
                                                                style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', textDecoration: 'none' }}
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                            </a>
                                                        ) : null;
                                                    })()}
                                                    <button
                                                        onClick={() => openEditSaleModal(sale)}
                                                        title={t('debtors.edit_sale')}
                                                        style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDeleteSale(sale)}
                                                            title={t('debtors.delete_sale')}
                                                            style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Card List */}
                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                    {sales.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                            <ShoppingCart size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                            <p>{t('debtors.no_sales')}</p>
                        </div>
                    ) : (
                        [...sales].sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()).map((sale) => {
                            const remainingDebt = getEffectiveSaleValue(sale) - getEffectiveAmountPaid(sale);
                            const uiStatus = remainingDebt <= 0 ? 'paid' : 'pending';
                            const client = clients.find(c => c.id === sale.clientId);
                            const isOverdue = uiStatus === 'pending' && sale.dueDate && new Date(sale.dueDate).getTime() < new Date().setHours(0,0,0,0);

                            return (
                                <div key={sale.id} className="glass-panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${remainingDebt > 0 ? 'var(--danger)' : 'var(--success)'}`, position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>{client?.name || sale.customerName || t('common.unknown')}</h3>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{new Date(sale.saleDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</div>
                                        </div>
                                        <div className={uiStatus === 'paid' ? 'badge badge-success' : 'badge badge-warning'}>
                                            {uiStatus === 'paid' ? t('clients.status_paid') : t('clients.status_pending')}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                        {renderPhoneModels(sale.phoneIds)}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('clients.balance_due')}:</div>
                                            <div style={{ fontWeight: 800, color: remainingDebt > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '1.1rem' }}>
                                                {remainingDebt.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
                                                {isOverdue && <span style={{ marginLeft: '4px' }}>⚠️</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            {uiStatus !== 'paid' && (
                                                <button onClick={() => openPaymentModal(sale.id)} style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <DollarSign size={20} />
                                                </button>
                                            )}
                                            {(() => {
                                                const saleClient = clients.find(c => c.id === sale.clientId);
                                                const salePhones = allPhones.filter(p => sale.phoneIds?.includes(p.id));
                                                const phoneNames = salePhones.map(p => p.model).join(', ');
                                                const waLink = saleClient?.phone ? generateSaleWhatsAppLink(t, language, sale, phoneNames, saleClient.name, saleClient.phone) : null;
                                                return waLink ? (
                                                    <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                    </a>
                                                ) : null;
                                            })()}
                                            <button 
                                                onClick={() => {
                                                    const saleClient = clients.find(c => c.id === sale.clientId);
                                                    const salePhones = allPhones.filter(p => sale.phoneIds?.includes(p.id));
                                                    generateReceiptPDF(t, language, sale, saleClient, salePhones, storeName);
                                                }}
                                                style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Printer size={20} />
                                            </button>
                                            <button onClick={() => openEditSaleModal(sale)} style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Edit size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    {isOverdue && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700, marginTop: '0.5rem', textAlign: 'right' }}>
                                            {t('debtors.overdue_days')} ({t('debtors.due_date')}: {new Date(sale.dueDate!).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')})
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

            </div>

            {/* Register Sale Modal */}
            {isSaleModalOpen && (
                <div className="modal-overlay" onClick={() => setIsSaleModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{t('debtors.new_sale')}</h2>
                        <form onSubmit={handleAddSale}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.client')} *</label>
                                <select
                                    value={clientId}
                                    onChange={e => setClientId(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                    required
                                >
                                    <option value="">-- {t('clients.search_placeholder')} --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 'bold' }}>{t('inventory.imei_placeholder')}</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={scannerInput}
                                        onChange={(e) => setScannerInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const scannedPhone = availablePhones.find(p => p.imei === scannerInput);
                                                if (scannedPhone) {
                                                    handlePhoneToggle(scannedPhone.id);
                                                    setScannerInput('');
                                                } else {
                                                    showToast(`${t('inventory.device_updated_error')} (IMEI : ${scannerInput})`, 'warning');
                                                }
                                            }
                                        }}
                                        placeholder={t('inventory.imei_placeholder')}
                                        style={{ flex: 1, padding: '0.65rem 0.9rem', background: 'rgba(16, 185, 129, 0.05)', border: '1.5px dashed var(--accent-primary)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                        autoFocus
                                    />
                                    <button type="button" onClick={() => setShowCameraScanner(true)}
                                        title={t('inventory.imei_placeholder')}
                                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                                        <Camera size={16} /> {t('common.preview')}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.products')} *</label>
                                <div style={{
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    paddingRight: '0.5rem'
                                }}>
                                    {availablePhones.length === 0 ? (
                                        <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('inventory.empty_state_search')}</p>
                                        </div>
                                    ) : (
                                        availablePhones.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => handlePhoneToggle(p.id)}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.75rem 1rem',
                                                    backgroundColor: selectedPhoneIds.includes(p.id) ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-tertiary)',
                                                    border: `1px solid ${selectedPhoneIds.includes(p.id) ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{
                                                        width: '1.25rem',
                                                        height: '1.25rem',
                                                        borderRadius: '0.25rem',
                                                        border: `1px solid ${selectedPhoneIds.includes(p.id) ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)'}`,
                                                        backgroundColor: selectedPhoneIds.includes(p.id) ? 'var(--accent-primary)' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        {selectedPhoneIds.includes(p.id) && <CheckCircle size={14} color="white" />}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <p style={{ fontWeight: '500', fontSize: '0.875rem', color: selectedPhoneIds.includes(p.id) ? 'white' : 'var(--text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                            {p.model}
                                                        </p>
                                                        {p.returnReason && (
                                                            <p style={{ fontSize: '0.75rem', color: 'var(--warning)', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <AlertTriangle size={12} /> {p.returnReason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', marginLeft: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {t('inventory.purchase_price')}: {Number(p.purchasePrice).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}
                                                    </div>
                                                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('inventory.selling_price')}:</span>
                                                        <input
                                                            type="number"
                                                            value={p.sellingPrice || ''}
                                                            onChange={async (e) => {
                                                                const newPrice = parseFloat(e.target.value) || 0;
                                                                // Update locally for instant UI response
                                                                setAvailablePhones(prev => prev.map(phone =>
                                                                    phone.id === p.id ? { ...phone, sellingPrice: newPrice } : phone
                                                                ));
                                                                // If this phone is selected, update the total sale price
                                                                if (selectedPhoneIds.includes(p.id)) {
                                                                    const diff = newPrice - (p.sellingPrice || p.purchasePrice);
                                                                    setSalePrice(prev => (parseFloat(prev || '0') + diff).toString());
                                                                }
                                                                // Persist to DB quietly
                                                                await StorageService.updatePhone(p.id, { sellingPrice: newPrice });
                                                            }}
                                                            style={{
                                                                width: '80px',
                                                                padding: '0.25rem 0.5rem',
                                                                fontSize: '0.8rem',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--border-color)',
                                                                background: 'var(--bg-secondary)',
                                                                color: 'var(--success)',
                                                                fontWeight: '600',
                                                                textAlign: 'right'
                                                            }}
                                                            placeholder={p.purchasePrice.toString()}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.selling_price')} (DZD) *</label>
                                    <input
                                        type="number"
                                        value={salePrice}
                                        onChange={e => setSalePrice(e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.total_paid')} (DZD)</label>
                                    <input
                                        type="number"
                                        value={initialPayment}
                                        onChange={e => setInitialPayment(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                {(parseFloat(salePrice || '0') > parseFloat(initialPayment || '0')) && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--warning)', fontSize: '0.875rem', fontWeight: 600 }}>{t('debtors.due_date')} ⚠️</label>
                                        <input
                                            type="date"
                                            value={saleDueDate}
                                            onChange={e => setSaleDueDate(e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'rgba(245, 158, 11, 0.05)', border: '1.5px dashed var(--warning)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                                        />
                                    </div>
                                )}
                            </div>

                             <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.method')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {(['cash', 'edahabia', 'bank_transfer'] as const).map(m => (
                                        <button key={m} type="button" onClick={() => setSalePaymentMethod(m)} style={{ flex: 1, padding: '0.4rem', borderRadius: '7px', border: '1.5px solid', borderColor: salePaymentMethod === m ? 'var(--accent-primary)' : 'var(--border-color)', background: salePaymentMethod === m ? 'var(--accent-primary)22' : 'transparent', color: salePaymentMethod === m ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {m === 'cash' ? t('payment_methods.cash') : m === 'edahabia' ? t('payment_methods.edahabia') : t('payment_methods.bank_transfer')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsSaleModalOpen(false)}>{t('common.close')}</button>
                                <button type="submit" className="btn-primary" disabled={selectedPhoneIds.length === 0 || isSubmittingSale}>
                                    {isSubmittingSale ? '...' : t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Receive Payment Modal */}
            {isPaymentModalOpen && (
                <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{t('debtors.record_payment')}</h2>
                        <form onSubmit={handleAddPayment}>
                             <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.amount_da')} *</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    placeholder="0.00"
                                    min="0.01"
                                    step="0.01"
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>
                             <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.method')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {(['cash', 'edahabia', 'bank_transfer'] as const).map(m => (
                                        <button key={m} type="button" onClick={() => setPaymentMethod(m)} style={{ flex: 1, padding: '0.4rem', borderRadius: '7px', border: '1.5px solid', borderColor: paymentMethod === m ? 'var(--accent-primary)' : 'var(--border-color)', background: paymentMethod === m ? 'var(--accent-primary)22' : 'transparent', color: paymentMethod === m ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {m === 'cash' ? t('payment_methods.cash') : m === 'edahabia' ? t('payment_methods.edahabia') : t('payment_methods.bank_transfer')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>{t('common.close')}</button>
                                <button type="submit" className="btn-primary">{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Sale Modal */}
            {isEditSaleModalOpen && (
                <div className="modal-overlay" onClick={() => setIsEditSaleModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{t('common.edit')}</h2>
                        <form onSubmit={handleEditSale}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.client')} *</label>
                                <select
                                    value={editClientId}
                                    onChange={e => setEditClientId(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                    required
                                >
                                    <option value="">-- {t('clients.search_placeholder')} --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                             <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.selling_price')} (DZD) *</label>
                                <input
                                    type="number"
                                    value={editSalePrice}
                                    onChange={e => setEditSalePrice(e.target.value)}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    style={{ width: '100%' }}
                                    required
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', display: 'block' }}>{t('debtors.debt_reduction_info')}</span>
                            </div>
                             <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('clients.date')} *</label>
                                <input
                                    type="date"
                                    value={editSaleDate}
                                    onChange={e => setEditSaleDate(e.target.value)}
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>
                             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsEditSaleModalOpen(false)}>{t('common.close')}</button>
                                <button type="submit" className="btn-primary">{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showCameraScanner && (
                <IMEIScanner
                    onScanned={(code) => {
                        const scannedPhone = availablePhones.find(p => p.imei === code);
                        if (scannedPhone) {
                            handlePhoneToggle(scannedPhone.id);
                        } else {
                            showToast(`${t('inventory.device_updated_error')} (IMEI : ${code})`, 'warning');
                        }
                        setShowCameraScanner(false);
                    }}
                    onClose={() => setShowCameraScanner(false)}
                />
            )}
        </div>
    );
};

export default Debtors;
