import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TaskService } from '../services/storage';
import { supabase } from '../services/supabase';
import type { Task, Profile } from '../types';
import { 
    ClipboardList, 
    Plus, 
    Search, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    Trash2, 
    User,
    Check,
    X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

// PRIORITY_COLORS and STATUS_LABELS will be inside the component to use t()

const Tasks = () => {
    const { profile } = useAuth();
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const isAdmin = profile?.role === 'admin';

    const PRIORITY_COLORS = {
        low: { bg: 'rgba(107, 114, 128, 0.1)', text: '#6b7280', label: t('tasks.priority_low') },
        normal: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', label: t('tasks.priority_normal') },
        high: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: t('tasks.priority_high') },
        urgent: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', label: t('tasks.priority_urgent') }
    };

    const STATUS_LABELS = {
        pending: t('tasks.status_pending'),
        in_progress: t('tasks.status_in_progress'),
        done: t('tasks.status_done')
    };

    const [tasks, setTasks] = useState<Task[]>([]);
    const [staff, setStaff] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [priority, setPriority] = useState<Task['priority']>('normal');
    const [dueDate, setDueDate] = useState('');

    useEffect(() => {
        loadData();
    }, [profile?.store_id]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsModalOpen(false); };
        if (isModalOpen) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isModalOpen]);

    const loadData = async () => {
        if (!profile?.store_id) return;
        setLoading(true);
        try {
            const [tasksData, staffData] = await Promise.all([
                TaskService.getTasks(),
                supabase.from('profiles').select('*').eq('store_id', profile.store_id)
            ]);
            setTasks(tasksData);
            setStaff(staffData.data || []);
        } catch (error: any) {
            showToast(t('common.error') + ": " + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.store_id || !profile?.id) return;

        setIsSubmitting(true);
        try {
            await TaskService.addTask({
                store_id: profile.store_id,
                created_by: profile.id,
                title,
                description,
                assigned_to: assignedTo || undefined,
                priority,
                status: 'pending',
                due_date: dueDate ? new Date(dueDate).toISOString() : undefined
            });
            
            showToast(t('common.save'), 'success');
            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (error: any) {
            showToast('Erreur: ' + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setAssignedTo('');
        setPriority('normal');
        setDueDate('');
    };

    const handleUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
        try {
            await TaskService.updateTask(taskId, { status: newStatus });
            setTasks(prev => prev.map(tTask => tTask.id === taskId ? { ...tTask, status: newStatus } : tTask));
            showToast(t('common.save'), 'success');
        } catch (error: any) {
            showToast('Erreur: ' + error.message, 'error');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm(t('debtors.delete_confirm'))) return;
        try {
            await TaskService.deleteTask(taskId);
            setTasks(prev => prev.filter(tTask => tTask.id !== taskId));
            showToast(t('common.delete'), 'success');
        } catch (error: any) {
            showToast('Erreur: ' + error.message, 'error');
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 t.description?.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Staff only sees their own tasks
            if (!isAdmin) {
                return matchesStatus && matchesSearch && t.assigned_to === profile?.id;
            }
            return matchesStatus && matchesSearch;
        });
    }, [tasks, filterStatus, searchQuery, isAdmin, profile?.id]);

    const isOverdue = (date: string | undefined) => {
        if (!date) return false;
        return new Date(date) < new Date();
    };

    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <ClipboardList size={28} style={{ color: 'var(--accent-primary)' }} />
                        {t('nav.tasks')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                        {isAdmin ? t('tasks.subtitle_admin') : t('tasks.subtitle_staff')}
                    </p>
                </div>
                {isAdmin && (
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem' }}>
                        <Plus size={18} /> {t('tasks.new_task')}
                    </button>
                )}
            </div>

            {/* Filters & Search */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        placeholder={t('tasks.search_placeholder')} 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.3rem', borderRadius: '12px', border: '1.5px solid var(--border-color)' }}>
                    {['all', 'pending', 'in_progress', 'done'].map((s) => (
                        <button 
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            style={{ 
                                padding: '0.45rem 1rem', 
                                borderRadius: '10px', 
                                border: 'none', 
                                background: filterStatus === s ? 'var(--accent-primary)' : 'transparent',
                                color: filterStatus === s ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            {s === 'all' ? t('common.all') : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tasks Grid */}
            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}...</div>
            ) : filteredTasks.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '20px', border: '2px dashed var(--border-color)' }}>
                    <ClipboardList size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>{t('tasks.no_tasks')}</h3>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{searchQuery ? t('tasks.empty_search') : t('tasks.all_done')}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {filteredTasks.map((task) => (
                        <div 
                            key={task.id} 
                            className="glass-panel hover-lift" 
                            style={{ 
                                padding: '1.5rem', 
                                borderLeft: `4px solid ${PRIORITY_COLORS[task.priority].text}`,
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                borderTop: isOverdue(task.due_date) && task.status !== 'done' ? '2px solid #ef4444' : 'none'
                            }}
                        >
                            {/* Priority & Status Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ 
                                        padding: '0.2rem 0.6rem', 
                                        borderRadius: '6px', 
                                        background: PRIORITY_COLORS[task.priority].bg, 
                                        color: PRIORITY_COLORS[task.priority].text,
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {PRIORITY_COLORS[task.priority].label}
                                    </span>
                                    {isOverdue(task.due_date) && task.status !== 'done' && (
                                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700 }}>{t('tasks.overdue')}</span>
                                    )}
                                </div>
                                {isAdmin && (
                                    <button 
                                        onClick={() => handleDeleteTask(task.id)}
                                        style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                    >
                                        <Trash2 size={16} className="hover-danger" />
                                    </button>
                                )}
                            </div>

                            {/* Title & Description */}
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                                    {task.title}
                                </h3>
                                {task.description && (
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {task.description}
                                    </p>
                                )}
                            </div>

                            {/* Meta Info: Assignee & Date */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        <User size={14} />
                                        <span>{task.assignee_name || t('tasks.not_assigned')}</span>
                                    </div>
                                    {task.due_date && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isOverdue(task.due_date) && task.status !== 'done' ? '#ef4444' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: isOverdue(task.due_date) ? 600 : 400 }}>
                                            <Calendar size={14} />
                                            <span>{new Date(task.due_date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status Controls */}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {task.status === 'pending' && (
                                        <button 
                                            onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            <Clock size={14} /> {t('tasks.start')}
                                        </button>
                                    )}
                                    {task.status !== 'done' ? (
                                        <button 
                                            onClick={() => handleUpdateStatus(task.id, 'done')}
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            <CheckCircle2 size={14} /> {t('tasks.finish')}
                                        </button>
                                    ) : (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>
                                            <Check size={18} /> {t('tasks.status_done')}
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(task.id, 'pending')}
                                                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
                                                >
                                                    {t('tasks.reopen')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New Task Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>{t('tasks.new_task')}</h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddTask}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{t('common.title')} *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ex: Nettoyer la vitrine"
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{t('common.description')}</label>
                                <textarea 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder={t('common.notes_placeholder')}
                                    rows={3}
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{t('tasks.assign_to')}</label>
                                    <select 
                                        value={assignedTo}
                                        onChange={e => setAssignedTo(e.target.value)}
                                        style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">{t('tasks.not_assigned')}</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.full_name || 'Inconnu'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{t('tasks.priority')}</label>
                                    <select 
                                        value={priority}
                                        onChange={e => setPriority(e.target.value as Task['priority'])}
                                        style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="low">{t('tasks.priority_low')}</option>
                                        <option value="normal">{t('tasks.priority_normal')}</option>
                                        <option value="high">{t('tasks.priority_high')}</option>
                                        <option value="urgent">{t('tasks.priority_urgent')}</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{t('tasks.due_date')}</label>
                                <input 
                                    type="date" 
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>{t('common.cancel')}</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ flex: 2 }}>
                                    {isSubmitting ? '...' : t('common.add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tasks;
