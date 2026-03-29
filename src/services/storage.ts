import type { AppData, Phone, Sale, Payment, Client, Supplier, SupplierPayment, CaisseTransaction, RepairOrder, Task } from '../types';
import { supabase } from './supabase';

const logAction = async (action_type: string, target_type: string, details?: any) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        
        await supabase.from('audit_logs').insert([{
            user_id: session.user.id,
            action_type,
            target_type,
            details
        }]);
    } catch (e) {
        console.error('Failed to log action:', e);
    }
};

export const StorageService = {
    async getData(): Promise<AppData> {
        const [
            { data: phones }, { data: sales }, { data: payments },
            { data: clients }, { data: suppliers }, { data: supplierPayments },
            { data: caisseTransactions }, { data: repairOrders }, { data: tasks },
            { data: notifications }
        ] = await Promise.all([
            supabase.from('phones').select('*'),
            supabase.from('sales').select('*'),
            supabase.from('payments').select('*'),
            supabase.from('clients').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('supplier_payments').select('*'),
            supabase.from('caisse_transactions').select('*'),
            supabase.from('repair_orders').select('*'),
            supabase.from('tasks').select('*, profiles:assigned_to(full_name)'),
            supabase.from('notifications').select('*').order('created_at', { ascending: false })
        ]);

        return {
            phones: phones || [],
            sales: sales || [],
            payments: payments || [],
            clients: clients || [],
            suppliers: suppliers || [],
            supplierPayments: supplierPayments || [],
            caisseTransactions: caisseTransactions || [],
            repairOrders: repairOrders || [],
            tasks: (tasks || []).map((t: any) => ({
                ...t,
                assignee_name: t.profiles?.full_name
            })),
            notifications: notifications || []
        };
    },

    // Clients
    async addClient(client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
        const { data, error } = await supabase.from('clients').insert([client]).select().single();
        if (error) throw error;
        return data;
    },

    async updateClient(id: string, updates: Partial<Client>): Promise<void> {
        const { error } = await supabase.from('clients').update(updates).eq('id', id);
        if (error) throw error;
    },

    async deleteClient(id: string): Promise<void> {
        // Find sales
        const { data: sales } = await supabase.from('sales').select('id, "phoneIds"').eq('clientId', id);
        if (sales && sales.length > 0) {
            const saleIds = sales.map(s => s.id);
            // Delete payments
            await supabase.from('payments').delete().in('saleId', saleIds);
            
            // Restore phones
            const phoneIdsToRestore: string[] = [];
            sales.forEach(s => {
                if (s.phoneIds) phoneIdsToRestore.push(...s.phoneIds);
            });
            if (phoneIdsToRestore.length > 0) {
                await supabase.from('phones').update({
                    status: 'inventory',
                    returnPrice: null,
                    returnReason: null,
                    returnDate: null
                }).in('id', phoneIdsToRestore);
            }
            // Delete sales
            await supabase.from('sales').delete().in('id', saleIds);
        }
        
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
    },

    // Suppliers
    async addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier> {
        const { data, error } = await supabase.from('suppliers').insert([supplier]).select().single();
        if (error) throw error;
        return data;
    },

    async updateSupplier(id: string, updates: Partial<Supplier>): Promise<void> {
        const { error } = await supabase.from('suppliers').update(updates).eq('id', id);
        if (error) throw error;
    },

    async deleteSupplier(id: string): Promise<void> {
        await supabase.from('supplier_payments').delete().eq('supplierId', id);
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    },

    // Supplier Payments
    async addSupplierPayment(payment: Omit<SupplierPayment, 'id'>): Promise<SupplierPayment> {
        const { data, error } = await supabase.from('supplier_payments').insert([payment]).select().single();
        if (error) throw error;
        return data;
    },

    async updateSupplierPayment(id: string, updates: Partial<SupplierPayment>): Promise<void> {
        const { error } = await supabase.from('supplier_payments').update(updates).eq('id', id);
        if (error) throw error;
    },

    async deleteSupplierPayment(id: string): Promise<void> {
        const { error } = await supabase.from('supplier_payments').delete().eq('id', id);
        if (error) throw error;
    },

    // Phones
    async addPhone(phone: Omit<Phone, 'id'>): Promise<Phone> {
        const { data, error } = await supabase.from('phones').insert([phone]).select().single();
        if (error) throw error;
        await logAction('CREATE', 'phones', { model: phone.model, price: phone.purchasePrice });
        return data;
    },

    async updatePhone(id: string, updates: Partial<Phone>): Promise<void> {
        // Wrap keys in quotes if they match reserved JS keywords or for safety (Supabase JS handles camelCase automatically if mapped, but let's be safe passing objects)
        const { error } = await supabase.from('phones').update(updates).eq('id', id);
        if (error) throw error;
    },

    async deletePhone(id: string): Promise<void> {
        // Find sales containing this phone
        const { data: sales } = await supabase.from('sales').select('id, "phoneIds"');
        if (sales) {
            const affectedSales = sales.filter(s => s.phoneIds?.includes(id));
            if (affectedSales.length > 0) {
                const saleIds = affectedSales.map(s => s.id);
                // Delete payments
                await supabase.from('payments').delete().in('saleId', saleIds);
                // Delete sales
                await supabase.from('sales').delete().in('id', saleIds);
            }
        }

        const { error } = await supabase.from('phones').delete().eq('id', id);
        if (error) throw error;
    },

    // Sales
    async addSale(sale: Omit<Sale, 'id'>): Promise<Sale> {
        const { data: newSale, error } = await supabase.from('sales').insert([sale]).select().single();
        if (error) throw error;

        if (sale.phoneIds && sale.phoneIds.length > 0) {
            await supabase.from('phones').update({ status: 'sold' }).in('id', sale.phoneIds);
        }

        await logAction('SALE', 'sales', { saleId: newSale.id, price: sale.salePrice, paid: sale.amountPaid });
        return newSale;
    },

    async deleteSale(id: string): Promise<void> {
        const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single();
        if (!sale) throw new Error('Sale not found');

        // Delete associated payments
        await supabase.from('payments').delete().eq('saleId', id);

        // Restore ONLY phones that are still 'sold' — do not touch phones already marked 'returned'
        if (sale.phoneIds && sale.phoneIds.length > 0) {
            const { data: phones } = await supabase.from('phones').select('id, status').in('id', sale.phoneIds);
            const phoneIdsToRestore = (phones || []).filter((p: any) => p.status === 'sold').map((p: any) => p.id);
            if (phoneIdsToRestore.length > 0) {
                await supabase.from('phones').update({
                    status: 'inventory',
                    returnPrice: null,
                    returnReason: null,
                    returnDate: null
                }).in('id', phoneIdsToRestore);
            }
        }

        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;
    },

    async updateSale(id: string, updates: Partial<Sale>): Promise<void> {
        const { data: sale } = await supabase.from('sales').select('amountPaid').eq('id', id).single();
        if (!sale) throw new Error('Sale not found');

        const finalUpdates = { ...updates };
        
        if (updates.salePrice !== undefined) {
            finalUpdates.status = Number(sale.amountPaid) >= Number(updates.salePrice) ? 'paid' : 'pending';
        }

        const { error } = await supabase.from('sales').update(finalUpdates).eq('id', id);
        if (error) throw error;
    },

    // Payments (Client Versements)
    async addPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
        const { data: sale } = await supabase.from('sales').select('amountPaid, salePrice').eq('id', payment.saleId).single();
        if (!sale) throw new Error('Sale not found');

        const { data: newPayment, error } = await supabase.from('payments').insert([payment]).select().single();
        if (error) throw error;

        // Clamp to 0 minimum — a refund payment (negative) should never push amountPaid below 0
        const newAmountPaid = Math.max(0, Number(sale.amountPaid || 0) + Number(payment.amount));
        const newStatus = newAmountPaid >= Number(sale.salePrice) ? 'paid' : 'pending';

        await supabase.from('sales').update({
            amountPaid: newAmountPaid,
            status: newStatus
        }).eq('id', payment.saleId);

        await logAction('PAYMENT', 'sales', { paymentId: newPayment.id, amount: payment.amount, method: payment.method });
        return newPayment;
    },

    async deletePayment(id: string): Promise<void> {
        const { data: payment } = await supabase.from('payments').select('*').eq('id', id).single();
        if (payment) {
            const { data: sale } = await supabase.from('sales').select('amountPaid, salePrice').eq('id', payment.saleId).single();
            if (sale) {
                // Subtract the payment amount (which may be negative if it was a refund record)
                // Do NOT clamp with Math.max here — if the payment was negative, subtracting it increases amountPaid
                const newAmountPaid = Math.max(0, Number(sale.amountPaid || 0) - Number(payment.amount));
                const newStatus = newAmountPaid >= Number(sale.salePrice) ? 'paid' : 'pending';
                await supabase.from('sales').update({
                    amountPaid: newAmountPaid,
                    status: newStatus
                }).eq('id', payment.saleId);
            }
        }
        
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) throw error;
    },

    async updatePayment(id: string, updates: Partial<Payment>): Promise<void> {
        const { error } = await supabase.from('payments').update(updates).eq('id', id);
        if (error) throw error;
    },

    // Caisse Transactions
    async addCaisseTransaction(transaction: Omit<CaisseTransaction, 'id'>): Promise<CaisseTransaction> {
        const { data, error } = await supabase.from('caisse_transactions').insert([transaction]).select().single();
        if (error) throw error;
        await logAction('CREATE', 'caisse', { type: transaction.type, amount: transaction.amount, label: transaction.label });
        return data;
    },

    async deleteCaisseTransaction(id: string): Promise<void> {
        const { error } = await supabase.from('caisse_transactions').delete().eq('id', id);
        if (error) throw error;
    },

    async updateCaisseTransaction(id: string, updates: Partial<CaisseTransaction>): Promise<void> {
        const { error } = await supabase.from('caisse_transactions').update(updates).eq('id', id);
        if (error) throw error;
    },

    // Repair Orders
    async getRepairOrders(): Promise<RepairOrder[]> {
        const { data, error } = await supabase.from('repair_orders').select('*').order('received_date', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async addRepairOrder(order: Omit<RepairOrder, 'id' | 'createdAt'>): Promise<RepairOrder> {
        const { data, error } = await supabase.from('repair_orders').insert([order]).select().single();
        if (error) throw error;
        await logAction('CREATE', 'repairs', { device: order.device_description, cost: order.repair_cost });
        
        if (order.store_id) {
            try {
                await NotificationService.addNotification({
                    store_id: order.store_id,
                    title: 'Nouvelle Réparation',
                    message: `Un nouvel appareil à réparer a été reçu : ${order.device_description}`,
                    type: 'warning'
                });
            } catch (e) {
                console.error('Notification failed', e);
            }
        }
        
        return data;
    },

    async updateRepairOrder(id: string, updates: Partial<RepairOrder>): Promise<void> {
        const { error } = await supabase.from('repair_orders').update(updates).eq('id', id);
        if (error) throw error;
    },

    async deleteRepairOrder(id: string): Promise<void> {
        const { error } = await supabase.from('repair_orders').delete().eq('id', id);
        if (error) throw error;
    }
};

export const TaskService = {
    async getTasks(): Promise<Task[]> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, profiles:assigned_to(full_name)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []).map((t: any) => ({
            ...t,
            assignee_name: t.profiles?.full_name
        }));
    },

    async addTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignee_name'>): Promise<Task> {
        const { data, error } = await supabase.from('tasks').insert([task]).select().single();
        if (error) throw error;
        await logAction('CREATE', 'tasks', { title: task.title });
        
        if (task.store_id) {
            try {
                await NotificationService.addNotification({
                    store_id: task.store_id,
                    title: 'Nouvelle Tâche',
                    message: `La tâche "${task.title}" a été assignée.`,
                    type: 'info'
                });
            } catch (e) {
                console.error('Notification failed', e);
            }
        }

        return data;
    },

    async updateTask(id: string, updates: Partial<Task>): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        await logAction('UPDATE', 'tasks', { taskId: id, updates });
    },

    async deleteTask(id: string): Promise<void> {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        await logAction('DELETE', 'tasks', { taskId: id });
    }
};

export const NotificationService = {
    async getNotifications(): Promise<import('../types').Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        return data || [];
    },

    async addNotification(notification: Omit<import('../types').Notification, 'id' | 'created_at' | 'is_read'>): Promise<import('../types').Notification> {
        const { data, error } = await supabase.from('notifications').insert([notification]).select().single();
        if (error) throw error;
        return data;
    },

    async markAsRead(id: string): Promise<void> {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (error) throw error;
    },

    async markAllAsRead(): Promise<void> {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
        if (error) throw error;
    },

    async deleteNotification(id: string): Promise<void> {
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) throw error;
    }
};
