import { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import type { RepairOrder, Client } from '../types';
import { Wrench, Plus, Edit, Trash2, CheckCircle, Clock, AlertTriangle, XCircle, Truck, RefreshCcw } from 'lucide-react';
import { generateRepairWhatsAppLink } from '../utils/whatsapp';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

// STATUS_CONFIG will be inside the component to use t()

const emptyForm = {
    client_id: '',
    device_description: '',
    issue: '',
    status: 'received' as RepairOrder['status'],
    repair_cost: '',
    deposit: '',
    received_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    notes: '',
};

const Repairs = () => {
    const { profile } = useAuth();
    const { t, language } = useLanguage();
    const isAdmin = profile?.role === 'admin';
    const { showToast } = useToast();

    const STATUS_CONFIG = {
        received:    { label: t('repairs.status_received'),       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: <Clock size={13}/> },
        in_progress: { label: t('repairs.status_in_progress'),   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <Wrench size={13}/> },
        done:        { label: t('repairs.status_done'),    color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <CheckCircle size={13}/> },
        delivered:   { label: t('repairs.status_delivered'),      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: <Truck size={13}/> },
        cancelled:   { label: t('repairs.status_cancelled'),     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: <XCircle size={13}/> },
    };
    const [orders, setOrders] = useState<RepairOrder[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<RepairOrder['status'] | 'all'>('all');
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ordersData, data] = await Promise.all([
                StorageService.getRepairOrders(),
                StorageService.getData()
            ]);
            setOrders(ordersData);
            setClients(data.clients);
        } catch (e: any) {
            showToast(t('common.error') + ": " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setIsModalOpen(true);
    };

    const openEdit = (order: RepairOrder) => {
        setEditingId(order.id);
        setForm({
            client_id: order.client_id || '',
            device_description: order.device_description,
            issue: order.issue,
            status: order.status,
            repair_cost: order.repair_cost.toString(),
            deposit: order.deposit.toString(),
            received_date: order.received_date.split('T')[0],
            delivery_date: order.delivery_date ? order.delivery_date.split('T')[0] : '',
            notes: order.notes || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            client_id: form.client_id || undefined,
            device_description: form.device_description,
            issue: form.issue,
            status: form.status,
            repair_cost: parseFloat(form.repair_cost) || 0,
            deposit: parseFloat(form.deposit) || 0,
            received_date: new Date(form.received_date).toISOString(),
            delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : undefined,
            notes: form.notes || undefined,
        };

        try {
            if (editingId) {
                await StorageService.updateRepairOrder(editingId, payload);
                // If now done/delivered and balance remaining → offer caisse entry
                const remaining = payload.repair_cost - payload.deposit;
                if ((payload.status === 'done' || payload.status === 'delivered') && remaining > 0) {
                    if (window.confirm(`${t('repairs.balance_warning').replace('{amount}', remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ'))}\n\n${t('repairs.add_to_caisse')}?`)) {
                        const client = clients.find(c => c.id === payload.client_id);
                        await StorageService.addCaisseTransaction({
                            type: 'in',
                            amount: remaining,
                            label: `${t('repairs.repair')}: ${payload.device_description} — ${client ? client.name : t('common.client')}`,
                            transactionDate: new Date().toISOString(),
                            category: 'general'
                        });
                    }
                }
                showToast(t('common.save'), 'success');
            } else {
                await StorageService.addRepairOrder(payload);
                showToast(t('common.save'), 'success');
            }
            setIsModalOpen(false);
            await loadData();
        } catch (e: any) {
            showToast('Erreur: ' + e.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('debtors.delete_confirm'))) return;
        try {
            await StorageService.deleteRepairOrder(id);
            showToast(t('common.delete'), 'success');
            await loadData();
        } catch (e: any) {
            showToast(t('common.error') + ": " + e.message, 'error');
        }
    };

    const filtered = useMemo(() =>
        orders.filter(o => {
            const matchStatus = filter === 'all' || o.status === filter;
            const q = search.toLowerCase();
            const matchSearch = !q || o.device_description.toLowerCase().includes(q) || o.issue.toLowerCase().includes(q);
            return matchStatus && matchSearch;
        }), [orders, filter, search]);

    const stats = useMemo(() => ({
        total: orders.length,
        active: orders.filter(o => ['received','in_progress'].includes(o.status)).length,
        done: orders.filter(o => o.status === 'done').length,
        revenue: orders.filter(o => ['done','delivered'].includes(o.status)).reduce((s, o) => s + o.repair_cost, 0),
    }), [orders]);

    const inputStyle: React.CSSProperties = { width: '100%', padding: '0.65rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' };
    const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 };

    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(245,158,11,0.35)' }}>
                        <Wrench size={22} color="white" strokeWidth={2.2} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>{t('nav.repairs')}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{t('repairs.subtitle')}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        <RefreshCcw size={15} /> {t('common.refresh')}
                    </button>
                    <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.2rem', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                        <Plus size={18} /> {t('common.add')}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: t('repairs.stats_total'), value: stats.total, color: '#6366f1', icon: <Wrench size={20}/> },
                    { label: t('repairs.stats_active'), value: stats.active, color: '#f59e0b', icon: <Clock size={20}/> },
                    { label: t('repairs.stats_done'), value: stats.done, color: '#10b981', icon: <CheckCircle size={20}/> },
                    { label: t('repairs.stats_revenue'), value: `${stats.revenue.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA`, color: '#8b5cf6', icon: <AlertTriangle size={20}/> },
                ].map(s => (
                    <div key={s.label} className="glass-panel hover-lift" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.2rem' }}>{s.label}</p>
                            <p style={{ fontWeight: 800, fontSize: '1.4rem', margin: 0, color: 'var(--text-main)' }}>{s.value}</p>
                        </div>
                        <div style={{ background: `${s.color}18`, padding: '0.6rem', borderRadius: '10px', color: s.color }}>{s.icon}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('repairs.search_placeholder')}
                    style={{ flex: '1 1 220px', padding: '0.55rem 0.9rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                />
                {(['all', 'received', 'in_progress', 'done', 'delivered', 'cancelled'] as const).map(s => (
                    <button key={s} onClick={() => setFilter(s)} style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1.5px solid', borderColor: filter === s ? (s === 'all' ? '#6366f1' : STATUS_CONFIG[s as Exclude<typeof s,'all'>]?.color || '#6366f1') : 'var(--border-color)', background: filter === s ? (s === 'all' ? 'rgba(99,102,241,0.12)' : STATUS_CONFIG[s as Exclude<typeof s,'all'>]?.bg || 'rgba(99,102,241,0.12)') : 'transparent', color: filter === s ? (s === 'all' ? '#6366f1' : STATUS_CONFIG[s as Exclude<typeof s,'all'>]?.color || '#6366f1') : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}>
                        {s === 'all' ? t('common.all') : STATUS_CONFIG[s]?.label}
                    </button>
                ))}
            </div>

            {/* Orders Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                {/* Desktop View */}
                <div className="mobile-hide" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                                {[t('repairs.device_issue'), t('common.client'), t('repairs.received_at'), t('repairs.cost'), t('repairs.deposit'), t('repairs.remaining'), t('common.status'), t('common.actions')].map(h => (
                                    <th key={h} style={{ padding: '0.85rem 1rem', textAlign: language === 'ar' ? 'right' : 'left', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <Wrench size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                                    {t('inventory.empty_state_search')}
                                </td></tr>
                            ) : filtered.map(order => {
                                const cfg = STATUS_CONFIG[order.status];
                                const client = clients.find(c => c.id === order.client_id);
                                const remaining = order.repair_cost - order.deposit;
                                return (
                                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hover-lift">
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{order.device_description}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{order.issue}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{client ? client.name : '—'}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{new Date(order.received_date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{order.repair_cost.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</td>
                                        <td style={{ padding: '0.85rem 1rem', color: 'var(--success)' }}>{order.deposit.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>{remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '999px', background: cfg.bg, color: cfg.color }}>
                                                {cfg.icon} {cfg.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <button onClick={() => openEdit(order)} style={{ padding: '0.35rem', borderRadius: '7px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={t('common.edit')}><Edit size={15}/></button>
                                                {(() => {
                                                    const repClient = clients.find(c => c.id === order.client_id);
                                                    const waLink = repClient?.phone ? generateRepairWhatsAppLink(t, language, order, repClient.name, repClient.phone) : null;
                                                    return waLink ? (
                                                        <a href={waLink} target="_blank" rel="noopener noreferrer" title={`${t('common.client')} (WhatsApp)`} style={{ padding: '0.35rem', borderRadius: '7px', background: 'rgba(37,211,102,0.1)', color: '#25D366', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                        </a>
                                                    ) : null;
                                                })()}
                                                {isAdmin && (
                                                    <button onClick={() => handleDelete(order.id)} style={{ padding: '0.35rem', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={t('common.delete')}><Trash2 size={15}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mobile-only" style={{ padding: '0.75rem' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('inventory.empty_state_search')}</div>
                    ) : filtered.map(order => {
                        const cfg = STATUS_CONFIG[order.status];
                        const client = clients.find(c => c.id === order.client_id);
                        const remaining = order.repair_cost - order.deposit;
                        return (
                            <div key={order.id} className="glass-panel" style={{ marginBottom: '1rem', padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '2px' }}>{order.device_description}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.issue}</div>
                                    </div>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '999px', background: cfg.bg, color: cfg.color }}>
                                        {cfg.label}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', marginBottom: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('common.client')}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{client ? client.name : '—'}</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('repairs.received_at')}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{new Date(order.received_date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')}</div>
                                    </div>
                                </div>
                                <div className="responsive-grid-3" style={{ marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('repairs.cost')}</div>
                                        <div style={{ fontWeight: 700 }}>{order.repair_cost.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                    </div>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('repairs.deposit')}</div>
                                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{order.deposit.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                    </div>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('repairs.remaining')}</div>
                                        <div style={{ fontWeight: 800, color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>{remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => openEdit(order)} className="btn-secondary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}>
                                        <Edit size={16} style={{ marginRight: '6px' }}/> {t('common.edit')}
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => handleDelete(order.id)} style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                                            <Trash2 size={16}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%' }}>
                        <h2 style={{ marginBottom: '1.25rem', fontWeight: 800 }}>{editingId ? t('repairs.edit_title') : t('repairs.new_title')}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="responsive-grid-3" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>{t('repairs.device')} *</label>
                                    <input style={inputStyle} value={form.device_description} onChange={e => setForm(f => ({...f, device_description: e.target.value}))} placeholder="ex. iPhone 13, Samsung A54..." required />
                                </div>
                                <div className="mobile-only" style={{ marginTop: '-0.5rem' }}></div> {/* Spacer for mobile grid stack */}
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>{t('repairs.issue_reported')} *</label>
                                    <textarea style={{...inputStyle, minHeight: '70px', resize: 'vertical'}} value={form.issue} onChange={e => setForm(f => ({...f, issue: e.target.value}))} placeholder="ex. Écran cassé..." required />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('common.client')}</label>
                                    <select style={inputStyle} value={form.client_id} onChange={e => setForm(f => ({...f, client_id: e.target.value}))}>
                                        <option value="">— {t('common.none')} —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('common.status')}</label>
                                    <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as RepairOrder['status']}))}>
                                        {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('repairs.cost_dzd')}</label>
                                    <input type="number" style={inputStyle} value={form.repair_cost} onChange={e => setForm(f => ({...f, repair_cost: e.target.value}))} placeholder="0" />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('repairs.deposit_dzd')}</label>
                                    <input type="number" style={inputStyle} value={form.deposit} onChange={e => setForm(f => ({...f, deposit: e.target.value}))} placeholder="0" />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('repairs.date_received')}</label>
                                    <input type="date" style={inputStyle} value={form.received_date} onChange={e => setForm(f => ({...f, received_date: e.target.value}))} required />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('repairs.date_delivery')}</label>
                                    <input type="date" style={inputStyle} value={form.delivery_date} onChange={e => setForm(f => ({...f, delivery_date: e.target.value}))} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>{t('repairs.internal_notes')}</label>
                                    <textarea style={{...inputStyle, minHeight: '60px', resize: 'vertical'}} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder={t('common.notes_placeholder')} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                                <button type="submit" style={{ padding: '0.65rem 1.4rem', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                                    {editingId ? t('common.save') : t('common.add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Repairs;
