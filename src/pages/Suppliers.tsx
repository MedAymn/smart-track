import { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import type { Supplier, SupplierPayment, Phone } from '../types';
import { Plus, Search, X, ArrowLeft, Phone as PhoneIcon, MapPin, TrendingDown, Edit, Trash2, Printer } from 'lucide-react';
import { generatePaymentReceiptPDF } from '../utils/pdfGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

type PaymentMethod = 'cash' | 'edahabia' | 'bank_transfer';

const METHOD_LABELS = (t: any): Record<PaymentMethod, string> => ({
    cash: t('payment_methods.cash'),
    edahabia: t('payment_methods.edahabia'),
    bank_transfer: t('payment_methods.bank_transfer'),
});

const Suppliers = () => {
    const { profile, storeName } = useAuth();
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const isAdmin = profile?.role === 'admin';
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [phones, setPhones] = useState<Phone[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [addingSupplier, setAddingSupplier] = useState(false);
    const [addingPayment, setAddingPayment] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    // Payment State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'edahabia' | 'bank_transfer'>('cash');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const [search, setSearch] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await StorageService.getData();
            setSuppliers(data.suppliers || []);
            setPhones(data.phones || []);
            setSupplierPayments(data.supplierPayments || []);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingSupplier(true);
        try {
            await StorageService.addSupplier({ name, phone, address });
            setIsAddModalOpen(false);
            showToast(t('suppliers.supplier_added'), 'success');
            await loadData();
        } catch (error: any) {
            showToast(error.message || t('common.error'), 'error');
        } finally {
            setAddingSupplier(false);
        }
    };

    const handleEditSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier) return;
        try {
            await StorageService.updateSupplier(selectedSupplier.id, { name, phone, address });
            setIsEditModalOpen(false);
            showToast(t('common.save'), 'success'); // Reusing common save or could add supplier_updated
            await loadData();
        } catch (error: any) {
            showToast(error.message || t('common.error'), 'error');
        }
    };

    const handleDeleteSupplier = async (supplier: Supplier) => {
        const supplierPhones = phones.filter(p => p.supplierId === supplier.id);
        if (supplierPhones.length > 0) {
            if (!confirm(t('suppliers.delete_confirm_with_phones').replace('{count}', supplierPhones.length.toString()))) {
                return;
            }
        } else {
            if (!confirm(t('common.delete_confirm'))) {
                return;
            }
        }

        try {
            await StorageService.deleteSupplier(supplier.id);
            if (selectedSupplier?.id === supplier.id) setSelectedSupplier(null);
            showToast(t('common.delete'), 'success');
            await loadData();
        } catch (error: any) {
            showToast(error.message || t('common.error'), 'error');
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier || !paymentAmount) return;

        setAddingPayment(true);
        try {
            await StorageService.addSupplierPayment({
                supplierId: selectedSupplier.id,
                amount: Number(paymentAmount),
                method: paymentMethod,
                paymentDate: new Date(paymentDate).toISOString(),
            });

            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentMethod('cash');
            showToast(t('clients.payment_recorded'), 'success');
            await loadData();
        } catch (error: any) {
            showToast(error.message || t('common.error'), 'error');
        } finally {
            setAddingPayment(false);
        }
    };

    const filteredSuppliers = useMemo(() => {
        if (!search.trim()) return suppliers;
        return suppliers.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.phone && s.phone.includes(search))
        );
    }, [suppliers, search]);

    // const selectedSupplier = suppliers.find(s => s.id === selectedId); // This line is now replaced by the state variable

    const getSupplierBalance = (supplierId: string) => {
        const supplierPhones = phones.filter(p => p.supplierId === supplierId);
        const totalPurchased = supplierPhones.reduce((sum, p) => sum + Number(p.purchasePrice), 0);
        const totalPaid = supplierPayments.filter(p => p.supplierId === supplierId).reduce((sum, p) => sum + Number(p.amount), 0);
        return { totalPurchased, totalPaid, balance: totalPurchased - totalPaid };
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <div>{t('common.loading')}</div>
        </div>
    );

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {selectedSupplier && (
                        <button onClick={() => setSelectedSupplier(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <ArrowLeft size={18} /> {t('common.back')}
                        </button>
                    )}
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                        {selectedSupplier ? selectedSupplier.name : t('nav.suppliers')}
                    </h1>
                </div>
                {!selectedSupplier ? (
                    <button onClick={() => setIsAddModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                        <Plus size={17} /> {t('suppliers.add_supplier')}
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => {
                                setName(selectedSupplier.name);
                                setPhone(selectedSupplier.phone || '');
                                setAddress(selectedSupplier.address || '');
                                setIsEditModalOpen(true);
                            }}
                            title={t('common.edit')}
                            style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                        >
                            <Edit size={18} />
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => handleDeleteSupplier(selectedSupplier)}
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

            {/* Supplier Detail */}
            {selectedSupplier && (() => {
                const { totalPurchased, totalPaid, balance } = getSupplierBalance(selectedSupplier.id);
                const supplierPhones = phones.filter(p => p.supplierId === selectedSupplier.id).sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
                const myPayments = supplierPayments.filter(p => p.supplierId === selectedSupplier.id).sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
                return (
                    <div>
                        {/* Stats Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('clients.total_billed')}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{totalPurchased.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('clients.total_paid')}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#22c55e' }}>{totalPaid.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem', border: balance > 0 ? '1.5px solid #ef444455' : '1.5px solid #22c55e55' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('clients.balance_due')}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: balance > 0 ? '#ef4444' : '#22c55e' }}>{balance.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                            </div>
                        </div>

                        {/* Actions */}
                        {balance > 0 && (
                            <button onClick={() => setIsPaymentModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                <TrendingDown size={17} /> {t('debtors.record_payment')}
                            </button>
                        )}
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            {/* Phones from this Supplier */}
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', padding: '0 1.25rem' }}>{t('clients.products')}</h2>
                            {supplierPhones.length === 0 ? (
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem', padding: '0 1.25rem' }}>{t('inventory.empty_state_search')}</div>
                            ) : (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    {supplierPhones.map((phone, i) => (
                                        <div key={phone.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderBottom: i < supplierPhones.length - 1 ? '1px solid var(--border-color)' : 'none', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '180px' }}>
                                                <div style={{ fontWeight: 600 }}>{phone.model}</div>
                                                {phone.imei && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>IMEI: {phone.imei}</div>}
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(phone.purchaseDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</div>
                                                {/* Spec badges */}
                                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                                                    {(phone as any).storage && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>📦 {(phone as any).storage}</span>}
                                                    {(phone as any).color && (
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
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
                                                                    'Purple': t('inventory.purple'),
                                                                    'Titanium': t('inventory.titanium')
                                                                };
                                                                return colorMap[(phone as any).color] || <span>🎨 {(phone as any).color}</span>;
                                                            })()}
                                                        </span>
                                                    )}
                                                    {(phone as any).batteryHealth && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>🔋 {(phone as any).batteryHealth}</span>}
                                                    {(phone as any).grade && (
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                                            {(() => {
                                                                const gradeMap: any = {
                                                                    'New': t('inventory.grade_new'),
                                                                    'Like New': t('inventory.grade_a_plus'),
                                                                    'Used - Grade A': t('inventory.grade_a'),
                                                                    'Used - Grade B': t('inventory.grade_b'),
                                                                    'Used - Grade C': t('inventory.grade_c')
                                                                };
                                                                return gradeMap[(phone as any).grade] || <span>⭐ {(phone as any).grade}</span>;
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700 }}>{Number(phone.purchasePrice).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', background: phone.status === 'sold' ? '#3b82f622' : phone.status === 'returned' ? '#f59e0b22' : '#22c55e22', color: phone.status === 'sold' ? '#3b82f6' : phone.status === 'returned' ? '#f59e0b' : '#22c55e' }}>
                                                    {phone.status === 'sold' ? t('inventory.status_sold') : phone.status === 'returned' ? t('inventory.status_returned') : t('inventory.status_in_stock')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Payments made to supplier */}
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', padding: '0 1.25rem' }}>{t('clients.payment_recorded')}</h2>
                            {myPayments.length === 0 ? (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0 1.25rem', paddingBottom: '1rem' }}>{t('clients.no_payments')}</div>
                            ) : (
                                <div>
                                    {myPayments.map((p, i) => (
                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderBottom: i < myPayments.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{new Date(p.paymentDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</div>
                                                {(p as SupplierPayment & { notes?: string }).notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{(p as SupplierPayment & { notes?: string }).notes}</div>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{METHOD_LABELS(t)[p.method as PaymentMethod] || p.method}</span>
                                                <span style={{ fontWeight: 700, color: '#22c55e' }}>{Number(p.amount).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</span>
                                                <button onClick={() => generatePaymentReceiptPDF(t, language, Number(p.amount), selectedSupplier?.name || t('nav.suppliers'), p.paymentDate, p.method, 'out', undefined, undefined, storeName)} style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Printer size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Supplier List */}
            {!selectedSupplier && (
                <>
                    <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input type="text" placeholder={t('suppliers.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    </div>
                    {filteredSuppliers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>{t('suppliers.no_suppliers')}</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {filteredSuppliers.map((supplier) => {
                                const { balance, totalPurchased } = getSupplierBalance(supplier.id);
                                const pCount = phones.filter(p => p.supplierId === supplier.id).length;
                                return (
                                    <div key={supplier.id} onClick={() => setSelectedSupplier(supplier)} style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '1.25rem', cursor: 'pointer', border: '1.5px solid var(--border-color)', transition: 'border-color 0.2s, transform 0.15s' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{supplier.name}</div>
                                                {supplier.phone && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><PhoneIcon size={13} />{supplier.phone}</div>}
                                                {supplier.address && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} />{supplier.address}</div>}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', background: balance > 0 ? '#ef444422' : '#16a34a22', color: balance > 0 ? '#ef4444' : '#22c55e', borderRadius: '20px', padding: '3px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {balance > 0 ? `${t('inventory.rest')}: ${balance.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA` : t('clients.status_paid')}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{pCount} {t('inventory.total_label')} · {t('inventory.selling_price')}: {totalPurchased.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
            {/* Add/Edit Supplier Modal */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{isEditModalOpen ? t('common.edit') : t('suppliers.add_supplier')}</h2>
                            <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={22} /></button>
                        </div>
                        <form onSubmit={isEditModalOpen ? handleEditSupplier : handleAddSupplier}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>{t('suppliers.name')} *</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={t('suppliers.name')} style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>{t('suppliers.phone')}</label>
                                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xxx xxx xxx" style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>{t('suppliers.address')}</label>
                                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder={t('suppliers.address')} style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                             <button type="submit" disabled={addingSupplier} className="btn-primary" style={{ width: '100%', padding: '0.8rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: addingSupplier ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem' }}>
                                {addingSupplier ? '...' : (isEditModalOpen ? t('inventory.update_device') : t('inventory.save_device'))}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Make Payment Modal */}
            {isPaymentModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{t('debtors.record_payment')}</h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleAddPayment}>
                             <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>{t('clients.amount_da')} *</label>
                                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required min="1" placeholder="Ex: 20000" style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>{t('clients.method')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {(['cash', 'edahabia', 'bank_transfer'] as PaymentMethod[]).map(method => (
                                        <button key={method} type="button" onClick={() => setPaymentMethod(method)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1.5px solid', borderColor: paymentMethod === method ? 'var(--accent-primary)' : 'var(--border-color)', background: paymentMethod === method ? 'var(--accent-primary)22' : 'var(--bg-primary)', color: paymentMethod === method ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {METHOD_LABELS(t)[method]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>{t('clients.date')}</label>
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                             <button type="submit" disabled={addingPayment} className="btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', cursor: addingPayment ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem' }}>
                                {addingPayment ? '...' : t('common.save')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suppliers;
