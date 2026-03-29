import { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import type { Phone, Supplier, Sale, Client } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { fr, arDZ } from 'date-fns/locale';
import { Plus, Smartphone, Trash2, Search, Edit, RefreshCcw, ArchiveRestore, Camera, Package, DollarSign, ArrowLeftRight, Printer } from 'lucide-react';
import IMEIScanner from '../components/IMEIScanner';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Barcode from 'react-barcode';

const Inventory = () => {
    const { profile } = useAuth();
    const { t, language } = useLanguage();
    const isAdmin = profile?.role === 'admin';
    const { showToast } = useToast();
    const [phones, setPhones] = useState<Phone[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

    // Edit/Return states
    const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
    const [returningPhoneId, setReturningPhoneId] = useState<string | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [returnPrice, setReturnPrice] = useState(''); // New state for return sale price
    const [labelPhone, setLabelPhone] = useState<Phone | null>(null);

    // Form state
    const [model, setModel] = useState('');
    const [imei, setImei] = useState('');
    const [color, setColor] = useState('');
    const [storage, setStorage] = useState('');
    const [batteryHealth, setBatteryHealth] = useState('');
    const [grade, setGrade] = useState('');
    const [price, setPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [supplierId, setSupplierId] = useState('');

    // Search & Filter state
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'inventory' | 'sold' | 'returned'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showCameraScanner, setShowCameraScanner] = useState(false);

    useEffect(() => {
        loadPhones();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsModalOpen(false);
                setIsEditModalOpen(false);
                setIsReturnModalOpen(false);
            }
        };
        const anyOpen = isModalOpen || isEditModalOpen || isReturnModalOpen;
        if (anyOpen) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isModalOpen, isEditModalOpen, isReturnModalOpen]);

    const loadPhones = async () => {
        const data = await StorageService.getData();
        setPhones(data.phones);
        setSuppliers(data.suppliers);
        setSales(data.sales || []);
        setClients(data.clients || []);
    };

    const handleAddPhone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!model || !price) return;

        await StorageService.addPhone({
            model,
            imei,
            ...(color ? { color } : {}),
            ...(storage ? { storage } : {}),
            ...(batteryHealth ? { batteryHealth } : {}),
            ...(grade ? { grade } : {}),
            purchasePrice: parseFloat(price),
            ...(sellingPrice ? { sellingPrice: parseFloat(sellingPrice) } : {}),
            purchaseDate: new Date().toISOString(),
            status: 'inventory',
            ...(supplierId ? { supplierId } : {}),
        });

        // Reset and close
        setModel('');
        setImei('');
        setColor('');
        setStorage('');
        setBatteryHealth('');
        setGrade('');
        setPrice('');
        setSellingPrice('');
        setSupplierId('');
        setIsModalOpen(false);
        setIsModalOpen(false);
        showToast(t('inventory.device_added'), 'success');
        await loadPhones();
    };

    const handleDelete = async (id: string) => {
        if (confirm(t('common.confirm_delete'))) {
            await StorageService.deletePhone(id);
            showToast(t('common.success'), 'success');
            await loadPhones();
        }
    };



    const openEditModal = (phone: Phone) => {
        setEditingPhoneId(phone.id);
        setModel(phone.model);
        setImei(phone.imei || '');
        setColor(phone.color || '');
        setStorage(phone.storage || '');
        setBatteryHealth(phone.batteryHealth || '');
        setGrade(phone.grade || '');
        setPrice(phone.purchasePrice.toString());
        setSellingPrice(phone.sellingPrice?.toString() || '');
        setIsEditModalOpen(true);
    };

    const handleUpdatePhone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPhoneId || !model || !price) return;

        try {
            await StorageService.updatePhone(editingPhoneId, {
                model,
                imei,
                ...(color ? { color } : { color: undefined }),
                ...(storage ? { storage } : { storage: undefined }),
                ...(batteryHealth ? { batteryHealth } : { batteryHealth: undefined }),
                ...(grade ? { grade } : { grade: undefined }),
                purchasePrice: parseFloat(price),
                ...(sellingPrice ? { sellingPrice: parseFloat(sellingPrice) } : { sellingPrice: null as any })
            });

            // Reset and close
            setModel('');
            setImei('');
            setColor('');
            setStorage('');
            setBatteryHealth('');
            setGrade('');
            setPrice('');
            setSellingPrice('');
            setEditingPhoneId(null);
            setIsEditModalOpen(false);
            setIsEditModalOpen(false);
            showToast(t('inventory.device_updated'), 'success');
            await loadPhones();
        } catch (error: any) {
            console.error('Update Phone Error:', error);
            showToast(t('common.error') + `: ${error.message || t('inventory.device_updated_error')}`, 'error');
        }
    };

    const handleReturnPhone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returningPhoneId || !returnReason) return;

        try {
            await StorageService.updatePhone(returningPhoneId, {
                status: 'returned',
                returnReason,
                returnDate: new Date().toISOString(),
                ...(returnPrice ? { returnPrice: parseFloat(returnPrice) } : {})
            });

            // Permanently reflect deduction on the associated sale
            const deduction = parseFloat(returnPrice || '0');
            const sale = sales.find(s => s.phoneIds?.includes(returningPhoneId) || (s as any).phoneId === returningPhoneId);
            if (sale && deduction > 0) {
                const newSalePrice = Math.max(0, Number(sale.salePrice) - deduction);
                await StorageService.updateSale(sale.id, { salePrice: newSalePrice });

                // Check for overpayment (Automated Refund Logic)
                const currentAmountPaid = Number(sale.amountPaid);
                if (currentAmountPaid > newSalePrice) {
                    const surplus = currentAmountPaid - newSalePrice;
                    if (window.confirm(t('inventory.refund_confirm'))) {
                        
                        const client = clients.find(c => c.id === sale.clientId);
                        const clientName = client ? client.name : (sale.customerName || t('activity.unknown_user'));
                        const returnedPhone = phones.find(p => p.id === returningPhoneId);
                        
                        // 1. Log the cash leaving the register
                        await StorageService.addCaisseTransaction({
                            type: 'out',
                            amount: surplus,
                            label: `${t('inventory.refund_confirm_label')}: ${returnedPhone?.model || t('inventory.model')} - Client: ${clientName}`,
                            transactionDate: new Date().toISOString(),
                            category: 'refund'
                        });

                        // 2. Properly adjust the sale's amountPaid by injecting a negative payment record, maintaining the audit trail
                        await StorageService.addPayment({
                            saleId: sale.id,
                            amount: -surplus,
                            method: 'cash',
                            paymentDate: new Date().toISOString()
                        });
                    }
                }
            }

            setReturnReason('');
            setReturnPrice('');
            setReturningPhoneId(null);
            setIsReturnModalOpen(false);
            setIsReturnModalOpen(false);
            showToast(t('inventory.return_recorded'), 'success');
            await loadPhones();
        } catch (error: any) {
            console.error('Return Phone Error:', error);
            showToast(t('common.error') + `: ${error.message || t('inventory.return_recorded_error')}`, 'error');
        }
    };

    const handleRestockPhone = async (phone: Phone) => {
        if (confirm(t('inventory.restock_confirm'))) {
            try {
                await StorageService.updatePhone(phone.id, {
                    status: 'inventory',
                    returnDate: undefined
                    // We intentionally DO NOT clear the returnReason here,
                    // so we remember why it was returned when reselling it.
                });
                showToast(t('inventory.restocked'), 'success');
                await loadPhones();
            } catch (error: any) {
                console.error('Restock Phone Error:', error);
                showToast(t('common.error') + `: ${error.message}`, 'error');
            }
        }
    };

    const filteredPhones = phones.filter(p => {
        const matchesSearch = !search.trim() ||
            p.model.toLowerCase().includes(search.toLowerCase()) ||
            (p.imei && p.imei.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

        const pDate = new Date(p.purchaseDate);
        const matchesFrom = !dateFrom || pDate >= new Date(dateFrom);
        const matchesTo = !dateTo || pDate <= new Date(dateTo + 'T23:59:59');

        return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });

    const getProfitBadge = (phone: Phone) => {
        if (!isAdmin) return null; // Workers cannot see profit
        if (!phone.sellingPrice) return null;
        const profit = phone.sellingPrice - phone.purchasePrice;
        if (profit > 0) return <span style={{ fontSize: '0.75rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem', fontWeight: 'bold' }}>+{profit.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>;
        if (profit < 0) return <span style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem', fontWeight: 'bold' }}>{profit.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>;
        return null;
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ margin: 0 }}>{t('inventory.title')}</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>

                    {/* Status Filters */}
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', width: 'max-content' }}>
                        <button onClick={() => setStatusFilter('all')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: statusFilter === 'all' ? 'var(--accent-primary)' : 'transparent', color: statusFilter === 'all' ? 'white' : 'var(--text-main)', borderRight: '1px solid var(--border-color)' }}>{t('common.all')}</button>
                        <button onClick={() => setStatusFilter('inventory')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: statusFilter === 'inventory' ? 'var(--accent-primary)' : 'transparent', color: statusFilter === 'inventory' ? 'white' : 'var(--text-main)', borderRight: '1px solid var(--border-color)' }}>{t('inventory.in_stock')}</button>
                        <button onClick={() => setStatusFilter('sold')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: statusFilter === 'sold' ? 'var(--accent-primary)' : 'transparent', color: statusFilter === 'sold' ? 'white' : 'var(--text-main)', borderRight: '1px solid var(--border-color)' }}>{t('inventory.sold')}</button>
                        <button onClick={() => setStatusFilter('returned')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: statusFilter === 'returned' ? 'var(--accent-primary)' : 'transparent', color: statusFilter === 'returned' ? 'white' : 'var(--text-main)' }}>{t('inventory.returned')}</button>
                    </div>

                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder={t('inventory.search_placeholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                        />
                    </div>
                    {/* Date filters */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            title={t('common.date_from')}
                            style={{ padding: '0.5rem 0.7rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            title={t('common.date_to')}
                            style={{ padding: '0.5rem 0.7rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '0.4rem 0.7rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>✕ {t('common.dates')}</button>
                        )}
                    </div>
                    <button className="btn-primary" onClick={() => {
                        setModel(''); setImei(''); setPrice(''); setSellingPrice(''); setSupplierId(''); setIsModalOpen(true);
                    }}>
                        <Plus size={18} /> {t('inventory.add_device')}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div className="glass-panel stat-card" style={{ padding: '1rem', flex: 1, minWidth: '140px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{t('inventory.in_stock')}</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{phones.filter(p => p.status === 'inventory').length}</p>
                        </div>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--accent-primary)' }}>
                            <Package size={20} />
                        </div>
                    </div>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '1rem', flex: 1, minWidth: '140px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{t('inventory.sold')}</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--success)' }}>{phones.filter(p => p.status === 'sold').length}</p>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--success)' }}>
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '1rem', flex: 1, minWidth: '140px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{t('inventory.returned')}</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--danger)' }}>{phones.filter(p => p.status === 'returned').length}</p>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--danger)' }}>
                            <ArrowLeftRight size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty State Graphic */}
            {filteredPhones.length === 0 && (
                <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '50%', color: 'var(--text-muted)' }}>
                        <Smartphone size={48} opacity={0.6} />
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '0.5rem' }}>{search || statusFilter !== 'all' ? t('inventory.empty_state_search') : t('inventory.empty_state')}</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                            {search || statusFilter !== 'all'
                                ? t('inventory.empty_state_search_helper')
                                : t('inventory.empty_state_helper')}
                        </p>
                    </div>
                    {(!search && statusFilter === 'all') && (
                        <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ marginTop: '1rem' }}>
                            <Plus size={18} /> {t('inventory.add_device')}
                        </button>
                    )}
                </div>
            )}

            {/* Card View */}
            {filteredPhones.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
                    {filteredPhones.slice().reverse().map((phone) => (
                        <div key={phone.id} className="glass-panel stat-card hover-lift" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {phone.model} {getProfitBadge(phone)}
                                    </h3>
                                    {/* Color & Storage Spec Badges */}
                                    {(phone.color || phone.storage) && (
                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                            {phone.storage && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(59, 130, 246, 0.2)', letterSpacing: '0.02em' }}>
                                                    📦 {phone.storage}
                                                </span>
                                            )}
                                            {phone.color && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', color: 'var(--accent-secondary)', border: '1px solid rgba(139, 92, 246, 0.2)', letterSpacing: '0.02em' }}>
                                                    {(() => {
                                                        const colorMap: any = {
                                                            'Noir': t('inventory.black'),
                                                            'Blanc': t('inventory.white'),
                                                            'Or': t('inventory.gold'),
                                                            'Argent': t('inventory.silver'),
                                                            'Bleu': t('inventory.blue'),
                                                            'Rouge': t('inventory.red'),
                                                            'Vert': t('inventory.green'),
                                                            'Rose': t('inventory.pink'),
                                                            'Violet': t('inventory.purple'),
                                                            'Titanium': t('inventory.titanium')
                                                        };
                                                        return colorMap[phone.color] || <span>🎨 {phone.color}</span>;
                                                    })()}
                                                </span>
                                            )}
                                            {phone.batteryHealth && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.12)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.2)', letterSpacing: '0.02em' }}>
                                                    🔋 {phone.batteryHealth}
                                                </span>
                                            )}
                                            {phone.grade && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)', letterSpacing: '0.02em' }}>
                                                    {(() => {
                                                        const gradeMap: any = {
                                                            'New': t('inventory.grade_new'),
                                                            'Like New': t('inventory.grade_a_plus'),
                                                            'Used - Grade A': t('inventory.grade_a'),
                                                            'Used - Grade B': t('inventory.grade_b'),
                                                            'Used - Grade C': t('inventory.grade_c')
                                                        };
                                                        return gradeMap[phone.grade] || <span>⭐ {phone.grade}</span>;
                                                    })()}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                        IMEI: <span style={{ fontFamily: 'monospace' }}>{phone.imei || 'N/A'}</span>
                                    </p>
                                </div>
                                <div>
                                    {phone.status === 'inventory' && <span className="badge badge-success">{t('inventory.in_stock')}</span>}
                                    {phone.status === 'sold' && <span className="badge badge-neutral">{t('inventory.sold')}</span>}
                                    {phone.status === 'returned' && <span className="badge badge-danger">{t('inventory.returned')}</span>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                                {isAdmin ? (
                                    <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('inventory.buying')}</span>
                                        <span style={{ fontWeight: '600' }}>{Number(phone.purchasePrice).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>
                                    </div>
                                ) : (
                                    <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('inventory.details')}</span>
                                        <span style={{ fontWeight: '600' }}>{phone.storage || t('inventory.not_specified')} / {phone.batteryHealth || t('common.not_available')}</span>
                                    </div>
                                )}
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('inventory.planned_sale')}</span>
                                    <span style={{ fontWeight: '600', color: phone.sellingPrice ? 'var(--text-main)' : 'var(--text-muted)' }}>{phone.sellingPrice ? `${Number(phone.sellingPrice).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA` : '-'}</span>
                                </div>
                            </div>

                            {phone.status === 'sold' && (() => {
                                const sale = sales.find(s => s.phoneIds?.includes(phone.id) || (s as any).phoneId === phone.id);
                                if (sale) {
                                    const client = clients.find(c => c.id === sale.clientId);
                                    const clientName = client ? client.name : (sale.customerName || t('activity.unknown_user'));
                                    if (clientName) {
                                        return <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', padding: '0.4rem 0.75rem', borderRadius: '6px', textAlign: 'center' }}>👤 {t('sale.buyer')}: {clientName}</div>;
                                    }
                                }
                                return null;
                            })()}

                            {phone.returnReason && (
                                <div style={{ fontSize: '0.85rem', color: phone.status === 'inventory' ? 'var(--warning)' : 'var(--danger)', background: phone.status === 'inventory' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>
                                    <strong>{t('inventory.reason')}:</strong> {phone.returnReason}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.2rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {phone.status === 'returned' && phone.returnDate
                                        ? `${t('inventory.returned_label')} ${formatDistanceToNow(new Date(phone.returnDate), { addSuffix: true, locale: language === 'ar' ? arDZ : fr })}`
                                        : formatDistanceToNow(new Date(phone.purchaseDate), { addSuffix: true, locale: language === 'ar' ? arDZ : fr })
                                    }
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => {
                                        setLabelPhone(phone);
                                        setTimeout(() => window.print(), 100);
                                        setTimeout(() => setLabelPhone(null), 1000);
                                    }} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.3)' }} title={t('inventory.print_label')}>
                                        <Printer size={16} />
                                    </button>
                                    <button onClick={() => openEditModal(phone)} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--text-main)' }}>
                                        <Edit size={16} />
                                    </button>
                                    {phone.status === 'sold' && (
                                        <button onClick={() => {
                                            setReturningPhoneId(phone.id);
                                            const sale = sales.find(s => s.phoneIds?.includes(phone.id) || (s as any).phoneId === phone.id);
                                            const defaultPrice = sale ? (sale.salePrice / (sale.phoneIds?.length || 1)) : (phone.sellingPrice || phone.purchasePrice);
                                            setReturnPrice(defaultPrice.toString());
                                            setIsReturnModalOpen(true);
                                        }} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                                            <RefreshCcw size={16} />
                                        </button>
                                    )}
                                    {phone.status === 'returned' && (
                                        <button onClick={() => handleRestockPhone(phone)} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                            <ArchiveRestore size={16} />
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button onClick={() => handleDelete(phone.id)} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Phone Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{t('inventory.add_device')}</h2>
                        <form onSubmit={handleAddPhone}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.model')} *</label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    placeholder={t('inventory.model_placeholder')}
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 'bold' }}>{t('inventory.scan_helper')}</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={imei}
                                        onChange={e => setImei(e.target.value)}
                                        placeholder={t('inventory.imei_placeholder')}
                                        style={{ flex: 1, border: '1.5px dashed var(--accent-primary)', background: 'rgba(16, 185, 129, 0.05)' }}
                                    />
                                    <button type="button" onClick={() => setShowCameraScanner(true)}
                                        title="Scanner avec la caméra"
                                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                                        <Camera size={16} /> {t('common.camera')}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.supplier')}</label>
                                <select
                                    value={supplierId}
                                    onChange={e => setSupplierId(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                >
                                    <option value="">{t('inventory.no_supplier')}</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.buying_price')} *</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%' }}
                                        required
                                    />
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.selling_price')}</label>
                                    <input
                                        type="number"
                                        value={sellingPrice}
                                        onChange={e => setSellingPrice(e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            {/* Color & Storage Capacity */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.color')}</label>
                                    <select
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="">{t('inventory.not_specified')}</option>
                                        <option value="Noir">{t('inventory.black')}</option>
                                        <option value="Blanc">{t('inventory.white')}</option>
                                        <option value="Or">{t('inventory.gold')}</option>
                                        <option value="Argent">{t('inventory.silver')}</option>
                                        <option value="Bleu">{t('inventory.blue')}</option>
                                        <option value="Rouge">{t('inventory.red')}</option>
                                        <option value="Vert">{t('inventory.green')}</option>
                                        <option value="Rose">{t('inventory.pink')}</option>
                                        <option value="Violet">{t('inventory.purple')}</option>
                                        <option value="Titanium">{t('inventory.titanium')}</option>
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.storage')}</label>
                                    <select
                                        value={storage}
                                        onChange={e => setStorage(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="">{t('inventory.not_specified')}</option>
                                        <option value="64 GB">64 GB</option>
                                        <option value="128 GB">128 GB</option>
                                        <option value="256 GB">256 GB</option>
                                        <option value="512 GB">512 GB</option>
                                        <option value="1 TB">1 TB</option>
                                    </select>
                                </div>
                            </div>

                            {/* Battery Health & Grade */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.battery')}</label>
                                    <input
                                        type="text"
                                        value={batteryHealth}
                                        onChange={e => setBatteryHealth(e.target.value)}
                                        placeholder={t('inventory.battery_placeholder')}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.grade')}</label>
                                    <select
                                        value={grade}
                                        onChange={e => setGrade(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="">{t('inventory.not_specified')}</option>
                                        <option value="Neuf Sous Blister">{t('inventory.grade_new')}</option>
                                        <option value="Comme Neuf (Grade A+)">{t('inventory.grade_a_plus')}</option>
                                        <option value="Très Bon État (Grade A)">{t('inventory.grade_a')}</option>
                                        <option value="Bon État (Grade B)">{t('inventory.grade_b')}</option>
                                        <option value="État Correct (Grade C)">{t('inventory.grade_c')}</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="btn-primary">{t('inventory.save_device')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Phone Modal */}
            {isEditModalOpen && (
                <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{t('inventory.update_device')}</h2>
                        <form onSubmit={handleUpdatePhone}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.model')} *</label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.imei')}</label>
                                <input
                                    type="text"
                                    value={imei}
                                    onChange={e => setImei(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.buying_price')} (DA) *</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%' }}
                                        required
                                    />
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.planned_sale')} (DA)</label>
                                    <input
                                        type="number"
                                        value={sellingPrice}
                                        onChange={e => setSellingPrice(e.target.value)}
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            {/* Color & Storage Capacity */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.color')}</label>
                                    <select
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="">{t('inventory.not_specified')}</option>
                                        <option value="Noir">{t('inventory.black')}</option>
                                        <option value="Blanc">{t('inventory.white')}</option>
                                        <option value="Or">{t('inventory.gold')}</option>
                                        <option value="Argent">{t('inventory.silver')}</option>
                                        <option value="Bleu">{t('inventory.blue')}</option>
                                        <option value="Rouge">{t('inventory.red')}</option>
                                        <option value="Vert">{t('inventory.green')}</option>
                                        <option value="Rose">{t('inventory.pink')}</option>
                                        <option value="Violet">{t('inventory.purple')}</option>
                                        <option value="Titanium">{t('inventory.titanium')}</option>
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.storage')}</label>
                                    <select
                                        value={storage}
                                        onChange={e => setStorage(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="">Non spécifié</option>
                                        <option value="64 GB">64 GB</option>
                                        <option value="128 GB">128 GB</option>
                                        <option value="256 GB">256 GB</option>
                                        <option value="512 GB">512 GB</option>
                                        <option value="1 TB">1 TB</option>
                                    </select>
                                </div>
                            </div>

                            {/* Battery Health & Grade */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.battery')}</label>
                                    <input
                                        type="text"
                                        value={batteryHealth}
                                        onChange={e => setBatteryHealth(e.target.value)}
                                        placeholder={t('inventory.battery_placeholder')}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>⭐ Grade / État</label>
                                    <select
                                        value={grade}
                                        onChange={e => setGrade(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="">{t('inventory.not_specified')}</option>
                                        <option value="Neuf Sous Blister">{t('inventory.grade_new')}</option>
                                        <option value="Comme Neuf (Grade A+)">{t('inventory.grade_a_plus')}</option>
                                        <option value="Très Bon État (Grade A)">{t('inventory.grade_a')}</option>
                                        <option value="Bon État (Grade B)">{t('inventory.grade_b')}</option>
                                        <option value="État Correct (Grade C)">{t('inventory.grade_c')}</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="btn-primary">{t('inventory.update_device')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Return Phone Modal */}
            {isReturnModalOpen && (
                <div className="modal-overlay" onClick={() => setIsReturnModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{t('inventory.return_device')}</h2>
                        <form onSubmit={handleReturnPhone}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.refund_confirm_helper')} *</label>
                                <input
                                    type="number"
                                    value={returnPrice}
                                    onChange={e => setReturnPrice(e.target.value)}
                                    placeholder="ex. 150000"
                                    min="0"
                                    step="0.01"
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    required
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', display: 'block' }}>
                                    {t('inventory.refund_audit_helper')}
                                </span>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('inventory.return_reason')} *</label>
                                <textarea
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    placeholder={t('inventory.return_reason_placeholder')}
                                    style={{ width: '100%', minHeight: '100px', resize: 'vertical', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsReturnModalOpen(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }}>{t('inventory.confirm_return')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCameraScanner && (
                <IMEIScanner
                    onScanned={(code) => { setImei(code); setShowCameraScanner(false); }}
                    onClose={() => setShowCameraScanner(false)}
                />
            )}

            {labelPhone && (
                <div id="print-section" style={{
                    width: '40mm',
                    height: '25mm',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'white',
                    color: 'black',
                    padding: '2mm',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '0.5mm', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        SMART TRACK
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '1mm', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                        {labelPhone.model} {labelPhone.storage ? ` | ${labelPhone.storage}` : ''}
                    </div>
                    <Barcode 
                        value={labelPhone.imei || labelPhone.id.substring(0, 10)} 
                        width={1} 
                        height={25} 
                        fontSize={10} 
                        margin={0} 
                        displayValue={true} 
                    />
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '1mm', textAlign: 'center' }}>
                        {labelPhone.sellingPrice ? `${labelPhone.sellingPrice.toLocaleString('fr-DZ')} DA` : ''}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
