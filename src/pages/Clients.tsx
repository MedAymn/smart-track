import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import type { Client, Sale, Payment, Phone } from '../types';
import {
    UserPlus, Search, ChevronDown, ChevronUp,
    Phone as PhoneIcon, MapPin, X, Plus, ArrowLeft,
    RefreshCcw, Calendar, Edit, Trash2, Printer
} from 'lucide-react';
import { generatePaymentReceiptPDF } from '../utils/pdfGenerator';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type PaymentMethod = 'cash' | 'edahabia' | 'bank_transfer';

const METHOD_LABELS = (t: any): Record<PaymentMethod, string> => ({
    cash: t('payment_methods.cash'),
    edahabia: t('payment_methods.edahabia'),
    bank_transfer: t('payment_methods.bank_transfer'),
});

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.9rem',
    background: 'var(--bg-primary, #1a1a2e)',
    border: '1.5px solid var(--border-color, rgba(255,255,255,0.1))',
    borderRadius: '8px',
    color: 'var(--text-primary, #fff)',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
};

const Clients = () => {
    const { profile, storeName } = useAuth();
    const { t, language } = useLanguage();
    const isAdmin = profile?.role === 'admin';
    const { showToast } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [phones, setPhones] = useState<Phone[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Navigation
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

    // Search & filter state
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Add/Edit client modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [clientFormError, setClientFormError] = useState('');
    const [addingClient, setAddingClient] = useState(false);

    // Form state for Add/Edit Client
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    // Payment Form State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [selectedSaleId, setSelectedSaleId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentError, setPaymentError] = useState('');
    const [addingPayment, setAddingPayment] = useState(false);


    // ─── Data loading ──────────────────────────────────────────────────
    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await StorageService.getData();
            setClients(data.clients ?? []);
            setSales(data.sales ?? []);
            setPayments(data.payments ?? []);
            setPhones(data.phones ?? []);
        } catch (e: any) {
            setError(e?.message ?? t('common.error'));
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const getEffectiveSaleValue = (sale: Sale) => {
        return Number(sale.salePrice);
    };

    const renderPhoneModels = (phoneIds: string[] | undefined) => {
        if (!phoneIds || phoneIds.length === 0) return <span>{t('inventory.empty_state_search')}</span>;
        return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {phoneIds.map((id, index) => {
                    const p = phones.find(ph => ph.id === id);
                    if (!p) return <span key={index}>{t('common.error')}{index < phoneIds.length - 1 ? ',' : ''}</span>;

                    if (p.status === 'returned') {
                        return (
                            <span key={index} style={{ textDecoration: 'line-through', color: '#ef4444', textDecorationThickness: '2px' }} title="Ce téléphone a été retourné">
                                {p.model}{index < phoneIds.length - 1 ? ',' : ''}
                            </span>
                        );
                    }
                    return <span key={index}>{p.model}{index < phoneIds.length - 1 ? ',' : ''}</span>;
                })}
            </div>
        );
    };

    const getEffectiveAmountPaid = (sale: Sale) => {
        const effPrice = getEffectiveSaleValue(sale);
        // We cap the amount paid to the effective sale price because any excess is refunded directly in cash (as logged in Caisse).
        return Math.min(Number(sale.amountPaid), effPrice);
    };

    const getClientBalance = (clientId: string) => {
        return sales
            .filter(s => s.clientId === clientId)
            .reduce((sum, s) => {
                const effPrice = getEffectiveSaleValue(s);
                const effPaid = getEffectiveAmountPaid(s);
                return sum + Math.max(0, effPrice - effPaid);
            }, 0);
    };

    const getSalePayments = (saleId: string) =>
        payments.filter(p => p.saleId === saleId).sort(
            (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
        );

    // ─── Derived data ──────────────────────────────────────────────────
    const selectedClient = useMemo(
        () => clients.find(c => c.id === selectedClientId) ?? null,
        [clients, selectedClientId]
    );

    const clientSales = useMemo(() => {
        if (!selectedClientId) return [];
        return sales
            .filter(s => s.clientId === selectedClientId)
            .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
    }, [selectedClientId, sales]);

    const filteredClients = useMemo(() => {
        let result = [...clients];

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.phone && c.phone.toLowerCase().includes(q))
            );
        }

        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate + 'T23:59:59') : null;
            result = result.filter(c => {
                const clientSalesList = sales.filter(s => s.clientId === c.id);
                return clientSalesList.some(s => {
                    const d = new Date(s.saleDate);
                    if (start && d < start) return false;
                    if (end && d > end) return false;
                    return true;
                });
            });
        }

        return result.sort((a, b) => {
            const balA = getClientBalance(a.id);
            const balB = getClientBalance(b.id);
            if (balA !== balB) return balB - balA;
            const latestSaleDate = (id: string) => {
                const ss = sales.filter(s => s.clientId === id);
                return ss.length > 0 ? Math.max(...ss.map(s => new Date(s.saleDate).getTime())) : 0;
            };
            return latestSaleDate(b.id) - latestSaleDate(a.id);
        });
    }, [clients, sales, search, startDate, endDate]);

    // ─── Handlers ─────────────────────────────────────────────────────
    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return; // Changed from newClientName to name
        setClientFormError(''); // Changed from setClientError to setClientFormError
        setAddingClient(true);
        try {
            await StorageService.addClient({
                name: name.trim(), // Changed from newClientName to name
                phone: phone.trim() || undefined, // Changed from newClientPhone to phone
                address: address.trim() || undefined, // Changed from newClientAddress to address
            });
            setIsAddModalOpen(false); // Changed from setShowAddClient to setIsAddModalOpen
            setName(''); // Changed from setNewClientName to setName
            setPhone(''); // Changed from setNewClientPhone to setPhone
            setAddress(''); // Changed from setNewClientAddress to setAddress
            showToast(t('clients.client_added'), 'success');
            await loadData();
        } catch (e: any) {
            setClientFormError(e?.message ?? t('common.error')); // Changed from setClientError to setClientFormError
            showToast(t('common.error'), 'error');
        } finally {
            setAddingClient(false);
        }
    };

    const handleEditClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) return;

        setClientFormError('');
        setAddingClient(true);
        try {
            await StorageService.updateClient(selectedClient.id, {
                name,
                phone,
                address
            });
            await loadData();
            setIsEditModalOpen(false);
            setSelectedClientId(null); // Changed from setSelectedClient to setSelectedClientId
            setName('');
            setPhone('');
            setAddress('');
            showToast(t('clients.client_updated'), 'success');
        } catch (error) {
            console.error('Error editing client:', error);
            setClientFormError(t('common.error'));
            showToast(t('common.error'), 'error');
        } finally {
            setAddingClient(false);
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setPaymentError('');
        setAddingPayment(true);

        try {
            if (!selectedSaleId) {
                throw new Error("Aucune vente sélectionnée.");
            }
            await StorageService.addPayment({ // Changed from storage.addPayment to StorageService.addPayment
                saleId: selectedSaleId,
                amount: Number(paymentAmount),
                paymentDate: paymentDate,
                method: paymentMethod as PaymentMethod
            });

            await loadData();
            setIsPaymentModalOpen(false); // Changed from setShowPaymentModal to setIsPaymentModalOpen
            setSelectedSaleId('');
            setPaymentAmount('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setPaymentMethod('cash');
            showToast(t('clients.payment_recorded'), 'success');
        } catch (error) {
            setPaymentError(t('common.error'));
            showToast(t('common.error'), 'error');
        } finally {
            setAddingPayment(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <RefreshCcw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
            <div>{t('common.loading')}</div>
        </div>
    );

    if (error) return (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
            <div style={{ marginBottom: '1rem' }}>{error}</div>
            <button onClick={loadData} style={{ padding: '0.6rem 1.2rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                {t('nav.refresh')}
            </button>
        </div>
    );

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {selectedClientId && (
                        <button
                            onClick={() => { setSelectedClientId(null); setExpandedSaleId(null); }}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                        >
                            <ArrowLeft size={18} /> {t('common.back')}
                        </button>
                    )}
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                        {selectedClient ? selectedClient.name : t('nav.clients')}
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={loadData}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', padding: '0.55rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                        <RefreshCcw size={15} /> {t('nav.refresh')}
                    </button>
                    {!selectedClient ? (
                        <button
                            onClick={() => { setClientFormError(''); setIsAddModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                        >
                            <UserPlus size={17} /> {t('clients.add_client')}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => {
                                    setClientFormError('');
                                    setName(selectedClient.name);
                                    setPhone(selectedClient.phone || '');
                                    setAddress(selectedClient.address || '');
                                    setIsEditModalOpen(true);
                                }}
                                title={t('clients.edit_client')}
                                style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                            >
                                <Edit size={18} />
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={async () => {
                                        if (window.confirm(t('clients.delete_confirm'))) {
                                            try {
                                                await StorageService.deleteClient(selectedClient.id);
                                                await loadData();
                                                setSelectedClientId(null);
                                                showToast(t('clients.client_deleted'), 'success');
                                            } catch (err) {
                                                console.error('Error deleting client:', err);
                                                showToast(t('common.error'), 'error');
                                            }
                                        }
                                    }}
                                    title={t('common.delete')}
                                    style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Client Detail View ── */}
            {selectedClient && (
                <div>
                    {/* Info card */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center', border: '1.5px solid var(--border-color)' }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>{t('clients.name')}</div>
                            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selectedClient.name}</div>
                        </div>
                        {selectedClient.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                <PhoneIcon size={15} />
                                <span>{selectedClient.phone}</span>
                            </div>
                        )}
                        {selectedClient.address && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                <MapPin size={15} />
                                <span>{selectedClient.address}</span>
                            </div>
                        )}
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>{t('clients.balance_due')}</div>
                            <div style={{ fontWeight: 800, fontSize: '1.5rem', color: getClientBalance(selectedClient.id) > 0 ? '#ef4444' : '#22c55e' }}>
                                {getClientBalance(selectedClient.id).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
                            </div>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="responsive-grid-3" style={{ marginBottom: '1.5rem' }}>
                        {[
                            { label: t('dashboard.sales'), value: clientSales.length },
                            { label: t('clients.total_billed'), value: `${clientSales.reduce((s, v) => s + getEffectiveSaleValue(v), 0).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA` },
                            { label: t('clients.total_paid'), value: `${clientSales.reduce((s, v) => s + getEffectiveAmountPaid(v), 0).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA` },
                        ].map(stat => (
                            <div key={stat.label} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '0.9rem 1rem', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{stat.label}</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{stat.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Sales history (now a table) */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{t('clients.bills_title')}</h2>
                        </div>
                        {clientSales.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)', padding: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>{t('clients.no_bills')}</div>
                        ) : (
                            <div>
                                {/* Desktop View Table */}
                                <div className="mobile-hide" style={{ overflowX: 'auto', width: '100%' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                                        <thead style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                                            <tr>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('inventory.purchase_date')}</th>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('clients.products')}</th>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{t('inventory.selling_price')}</th>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{t('dashboard.collected')}</th>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{t('clients.rest')}</th>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>{t('repairs.status')}</th>
                                                <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>{t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientSales.map(sale => {
                                                const salePayments = getSalePayments(sale.id);
                                                const effectiveSalePrice = getEffectiveSaleValue(sale);
                                                const effectiveAmountPaid = getEffectiveAmountPaid(sale);
                                                const remaining = effectiveSalePrice - effectiveAmountPaid;
                                                const isExpanded = expandedSaleId === sale.id;

                                                return (
                                                    <React.Fragment key={sale.id}>
                                                        <tr
                                                            onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                                                            style={{ cursor: 'pointer', borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', background: isExpanded ? 'rgba(0,0,0,0.1)' : 'transparent', transition: 'background 0.2s' }}
                                                            className="hover-lift-row"
                                                        >
                                                            <td style={{ padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                                                                {new Date(sale.saleDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}
                                                            </td>
                                                            <td style={{ padding: '0.8rem 1.25rem', fontSize: '0.9rem' }}>
                                                                <div style={{ fontWeight: 600 }}>{renderPhoneModels(sale.phoneIds)}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                    {sale.phoneIds?.length ?? 1} {t('inventory.total_label')}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '0.9rem' }}>
                                                                {effectiveSalePrice !== Number(sale.salePrice) && (
                                                                    <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', marginRight: '6px', fontSize: '0.8rem' }}>
                                                                        {Number(sale.salePrice).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}
                                                                    </span>
                                                                )}
                                                                <span style={{ fontWeight: 700 }}>{effectiveSalePrice.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>
                                                            </td>
                                                            <td style={{ padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '0.9rem' }}>
                                                                <span style={{ color: '#22c55e', fontWeight: 700 }}>{effectiveAmountPaid.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>
                                                            </td>
                                                            <td style={{ padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '0.9rem' }}>
                                                                <span style={{ color: remaining > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>
                                                            </td>
                                                            <td style={{ padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: remaining <= 0 ? '#22c55e22' : '#ef444422', color: remaining <= 0 ? '#22c55e' : '#ef4444' }}>
                                                                    {remaining <= 0 ? t('clients.status_paid') : t('clients.status_pending')}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border-color)' }}>
                                                                <td colSpan={7} style={{ padding: '1rem 1.25rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('clients.payment_recorded')} ({salePayments.length})</span>
                                                                        {remaining > 0 && (
                                                                            <button
                                                                                onClick={e => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedSaleId(sale.id);
                                                                                    setPaymentAmount(remaining.toString());
                                                                                    setPaymentError('');
                                                                                    setIsPaymentModalOpen(true);
                                                                                }}
                                                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                                                                            >
                                                                                <Plus size={14} /> {t('clients.add_payment')}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {salePayments.length === 0 ? (
                                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('clients.no_bills')}</div>
                                                                    ) : salePayments.map(p => (
                                                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.88rem' }}>
                                                                            <span style={{ color: 'var(--text-secondary)' }}>{new Date(p.paymentDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</span>
                                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{METHOD_LABELS(t)[p.method as PaymentMethod] ?? p.method}</span>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ fontWeight: 700, color: '#22c55e' }}>+{Number(p.amount).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>
                                                                                <button
                                                                                    onClick={e => {
                                                                                        e.stopPropagation();
                                                                                        // Calculate remaining balance after all payments on this sale
                                                                                        const saleForPayment = sales.find(s => s.id === p.saleId);
                                                                                        let remainingAfterAll = 0;
                                                                                        if (saleForPayment) {
                                                                                            const effPrice = getEffectiveSaleValue(saleForPayment);
                                                                                            const allPaymentsForSale = payments.filter(pay => pay.saleId === p.saleId);
                                                                                            const totalPaid = allPaymentsForSale.reduce((sum, pay) => sum + Number(pay.amount), 0);
                                                                                            remainingAfterAll = Math.max(0, effPrice - totalPaid);
                                                                                        }
                                                                                        generatePaymentReceiptPDF(t, language, Number(p.amount), selectedClient?.name || t('nav.clients'), p.paymentDate, p.method, 'in', undefined, remainingAfterAll, storeName);
                                                                                    }}
                                                                                    title={t('clients.print_receipt')}
                                                                                    style={{ padding: '0.2rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                >
                                                                                    <Printer size={14} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile View Cards */}
                                <div className="mobile-only" style={{ padding: '0.75rem' }}>
                                    {clientSales.map(sale => {
                                        const salePayments = getSalePayments(sale.id);
                                        const effectiveSalePrice = getEffectiveSaleValue(sale);
                                        const effectiveAmountPaid = getEffectiveAmountPaid(sale);
                                        const remaining = effectiveSalePrice - effectiveAmountPaid;
                                        const isExpanded = expandedSaleId === sale.id;

                                        return (
                                            <div key={sale.id} className="glass-panel" style={{ marginBottom: '1rem', padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '14px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                            {new Date(sale.saleDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{renderPhoneModels(sale.phoneIds)}</div>
                                                    </div>
                                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: remaining <= 0 ? '#22c55e22' : '#ef444422', color: remaining <= 0 ? '#22c55e' : '#ef4444' }}>
                                                        {remaining <= 0 ? t('clients.status_paid') : t('clients.status_pending')}
                                                    </span>
                                                </div>

                                                <div className="responsive-grid-3" style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t('inventory.total_label')}</div>
                                                        <div style={{ fontWeight: 700 }}>{effectiveSalePrice.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                                    </div>
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t('dashboard.collected')}</div>
                                                        <div style={{ fontWeight: 700, color: '#22c55e' }}>{effectiveAmountPaid.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                                    </div>
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t('clients.rest')}</div>
                                                        <div style={{ fontWeight: 700, color: remaining > 0 ? '#ef4444' : '#22c55e' }}>{remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                                                    style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                                                >
                                                    {isExpanded ? t('clients.hide_payments') : `${t('clients.payment_recorded')} (${salePayments.length})`}
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>

                                                {isExpanded && (
                                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('clients.payment_recorded')} ({salePayments.length})</span>
                                                            {remaining > 0 && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedSaleId(sale.id);
                                                                        setPaymentAmount(remaining.toString());
                                                                        setPaymentError('');
                                                                        setIsPaymentModalOpen(true);
                                                                    }}
                                                                    className="btn-primary"
                                                                    style={{ padding: '4px 12px', fontSize: '0.75rem', height: 'auto' }}
                                                                >
                                                                    <Plus size={14} /> {t('common.add')}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {salePayments.length === 0 ? (
                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>{t('clients.no_payments')}</div>
                                                        ) : salePayments.map(p => (
                                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{Number(p.amount).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(p.paymentDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} · {METHOD_LABELS(t)[p.method as PaymentMethod] ?? p.method}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => generatePaymentReceiptPDF(t, language, Number(p.amount), selectedClient?.name || t('nav.clients'), p.paymentDate, p.method, 'in', undefined, undefined, storeName)}
                                                                    style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none' }}
                                                                >
                                                                    <Printer size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Client List View ── */}
            {!selectedClientId && (
                <>
                    {/* Search & Date filters */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 2, minWidth: '200px' }}>
                            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder={t('clients.search_placeholder')}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ ...inputStyle, background: 'var(--bg-secondary)', paddingLeft: '2.4rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '320px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Calendar size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    style={{ ...inputStyle, background: 'var(--bg-secondary)', paddingLeft: '2rem', fontSize: '0.82rem' }} />
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>→</span>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Calendar size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                    style={{ ...inputStyle, background: 'var(--bg-secondary)', paddingLeft: '2rem', fontSize: '0.82rem' }} />
                            </div>
                            {(search || startDate || endDate) && (
                                <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }}
                                    title={t('common.reset')}
                                    style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.06))', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '0.55rem 0.7rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Result count */}
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                        {filteredClients.length} {t('nav.clients')}
                        {(search || startDate || endDate) ? ' ' : ` ${t('inventory.total_label')}`}
                    </div>

                    {filteredClients.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '14px' }}>
                            <UserPlus size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                            <div>{clients.length === 0 ? t('clients.no_clients') : t('clients.no_clients_search')}</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
                            {filteredClients.map(client => {
                                const balance = getClientBalance(client.id);
                                const saleCount = sales.filter(s => s.clientId === client.id).length;
                                return (
                                    <div
                                        key={client.id}
                                        onClick={() => setSelectedClientId(client.id)}
                                        className="glass-panel stat-card hover-lift"
                                        style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '2px' }}>{client.name}</div>
                                                {client.phone && (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <PhoneIcon size={12} /> {client.phone}
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.73rem', background: balance > 0 ? '#ef444422' : '#22c55e22', color: balance > 0 ? '#ef4444' : '#22c55e', borderRadius: '20px', padding: '3px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {balance > 0 ? `${balance.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA` : t('clients.status_paid')}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{saleCount} {saleCount === 1 ? t('clients.sale') : t('clients.sales')}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Add/Edit Client Modal */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{isEditModalOpen ? t('clients.edit_client') : t('clients.add_client')}</h2>
                            <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {clientFormError && <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>{clientFormError}</div>}

                        <form onSubmit={isEditModalOpen ? handleEditClient : handleAddClient}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('clients.name')} *</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Ahmed Benali" />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('clients.phone')}</label>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="05..." />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('clients.address')} ({t('inventory.total_label')})</label>
                                <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Alger" />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{t('common.cancel')}</button>
                                <button type="submit" disabled={addingClient} className="btn-primary" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: addingClient ? 'not-allowed' : 'pointer' }}>
                                    {addingClient ? '...' : (isEditModalOpen ? t('clients.update_client') : t('clients.save_client'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Payment Modal */}
            {isPaymentModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('clients.add_payment')}</h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {paymentError && <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>{paymentError}</div>}

                        <form onSubmit={handleAddPayment}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('clients.amount_da')} *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 'bold' }}
                                />
                            </div>
                             <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('clients.method')} *</label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                >
                                    {Object.entries(METHOD_LABELS(t)).map(([val, label]) => (
                                        <option key={val} value={val}>{label as string}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('clients.date')}</label>
                                <input
                                    type="date"
                                    required
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                />
                            </div>
                             <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" onClick={() => setIsPaymentModalOpen(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{t('common.cancel')}</button>
                                <button type="submit" disabled={addingPayment} className="btn-primary" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: addingPayment ? 'not-allowed' : 'pointer' }}>
                                    {addingPayment ? '...' : t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;
