import type { RepairOrder, Sale } from '../types';

const formatPhoneNumber = (phone: string | undefined): string => {
    if (!phone) return '';
    // Strip everything but digits
    let cleaned = phone.replace(/\D/g, '');
    // Standardize to Algerian format if local
    if (cleaned.startsWith('0')) {
        cleaned = '213' + cleaned.substring(1);
    }
    return cleaned;
};

export const generateRepairWhatsAppLink = (t: any, language: string, order: RepairOrder, clientName: string, clientPhone: string) => {
    const formattedPhone = formatPhoneNumber(clientPhone);
    if (!formattedPhone) return null;

    const remaining = order.repair_cost - order.deposit;
    const isReady = order.status === 'done';
    
    let message = t('whatsapp.repair_greeting', { name: clientName }) + "\n\n";
    message += t('whatsapp.repair_update', { device: order.device_description }) + "\n";
    
    if (isReady) {
        message += t('whatsapp.repair_ready') + "\n";
        if (remaining > 0) {
            message += t('whatsapp.repair_remaining', { amount: remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') }) + "\n";
        } else {
            message += t('whatsapp.repair_paid') + "\n";
        }
    } else {
        const statusMap: Record<string, string> = {
            'received': t('repairs.status_received'),
            'in_progress': t('repairs.status_in_progress'),
            'delivered': t('repairs.status_delivered'),
            'cancelled': t('repairs.status_cancelled')
        };
        message += t('whatsapp.repair_status', { status: statusMap[order.status] }) + "\n";
        message += t('whatsapp.repair_cost', { amount: order.repair_cost.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') }) + "\n";
        message += t('whatsapp.repair_deposit', { amount: order.deposit.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') }) + "\n";
        if (remaining > 0) {
            message += t('whatsapp.repair_delivery', { amount: remaining.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ') }) + "\n";
        }    
    }
    
    message += "\n" + t('whatsapp.repair_thanks');

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

export const generateSaleWhatsAppLink = (t: any, language: string, sale: Sale, phoneDetails: string, clientName: string, clientPhone: string) => {
    const formattedPhone = formatPhoneNumber(clientPhone);
    if (!formattedPhone) return null;

    const remaining = sale.salePrice - sale.amountPaid;
    const locale = language === 'ar' ? 'ar-DZ' : 'fr-DZ';
    const dateLocale = language === 'ar' ? 'ar-DZ' : 'fr-FR';
    
    let message = t('whatsapp.sale_greeting', { name: clientName }) + "\n\n";
    message += t('whatsapp.sale_thanks') + "\n\n";
    message += t('whatsapp.sale_item', { details: phoneDetails }) + "\n";
    message += t('whatsapp.sale_total', { amount: sale.salePrice.toLocaleString(locale) }) + "\n";
    message += t('whatsapp.sale_paid', { amount: sale.amountPaid.toLocaleString(locale) }) + "\n";
    
    if (remaining > 0) {
        message += t('whatsapp.sale_remaining', { amount: remaining.toLocaleString(locale) }) + "\n";
        if (sale.dueDate) {
            message += t('whatsapp.sale_due', { date: new Date(sale.dueDate).toLocaleDateString(dateLocale) }) + "\n";
        }
    } else {
        message += t('whatsapp.sale_settled') + "\n";
    }

    message += "\n" + t('whatsapp.sale_footer');

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};
