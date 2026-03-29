import type { Sale, Client, Phone } from '../types';

export const generateReceiptPDF = (
    t: any,
    language: string,
    sale: Sale,
    client: Client | undefined,
    phones: Phone[],
    storeName?: string | null
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert(t('receipt.popup_warning'));
        return;
    }

    const isRTL = language === 'ar';
    const dateFormatted = new Date(sale.saleDate).toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const validPhones = phones;
    const effectiveSalePrice = Number(sale.salePrice);
    const effectiveAmountPaid = Math.min(Number(sale.amountPaid), effectiveSalePrice);
    const remainingDebt = effectiveSalePrice - effectiveAmountPaid;

    const tableRows = validPhones.map((p, index) => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${index + 1}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500;">${p.model}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">${p.imei || "-"}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">1</td>
        </tr>
    `).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="${language}" dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <title>${t('receipt.title')} - ${client?.name || 'Client'}</title>
        <style>
            body {
                font-family: ${isRTL ? "'Sakkal Majalla', 'Simplified Arabic', 'Segoe UI', serif" : "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"};
                margin: 0;
                padding: 40px;
                color: #1f2937;
                background-color: white;
                text-align: ${isRTL ? 'right' : 'left'};
            }
            .invoice-box {
                max-width: 800px;
                margin: auto;
                box-sizing: border-box;
            }
            .header {
                display: flex;
                flex-direction: ${isRTL ? 'row-reverse' : 'row'};
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #1f2937;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                color: #1f2937;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .header-info {
                text-align: ${isRTL ? 'left' : 'right'};
                color: #6b7280;
                font-size: 14px;
            }
            .client-section {
                display: flex;
                flex-direction: ${isRTL ? 'row-reverse' : 'row'};
                justify-content: space-between;
                margin-bottom: 40px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
            }
            .client-section div h3 {
                margin-top: 0;
                margin-bottom: 10px;
                color: #4b5563;
                font-size: 14px;
                text-transform: uppercase;
            }
            .client-section div p {
                margin: 5px 0;
                font-size: 15px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 40px;
            }
            th {
                background: #1f2937;
                color: white;
                text-align: ${isRTL ? 'right' : 'left'};
                padding: 12px;
                font-size: 14px;
            }
            .summary {
                display: flex;
                justify-content: ${isRTL ? 'flex-start' : 'flex-end'};
            }
            .summary-box {
                width: 300px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
            }
            .summary-row {
                display: flex;
                flex-direction: ${isRTL ? 'row-reverse' : 'row'};
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 15px;
            }
            .summary-row.total {
                font-weight: bold;
                font-size: 18px;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            .summary-row.debt {
                font-weight: bold;
                color: ${remainingDebt > 0 ? '#ef4444' : '#10b981'};
                font-size: 16px;
                margin-top: 15px;
                border-top: 1px solid #e5e7eb;
                padding-top: 15px;
            }
            .footer {
                text-align: center;
                margin-top: 60px;
                color: #9ca3af;
                font-size: 12px;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
            }
            @media print {
                body { padding: 0; }
                .invoice-box { padding: 20mm; }
            }
        </style>
    </head>
    <body>
        <div class="invoice-box">
            <div class="header">
                <h1>${t('receipt.title')}</h1>
                <div class="header-info">
                    <p>${t('receipt.date')} ${dateFormatted}</p>
                    <p>${t('receipt.ref')} ${sale.id.slice(0, 8).toUpperCase()}</p>
                </div>
            </div>

            <div class="client-section">
                <div>
                    <h3>${t('receipt.billed_to')}</h3>
                    <p style="font-weight: bold; font-size: 18px;">${client?.name || sale.customerName || (isRTL ? "زبون عادي" : "Client Comptoir")}</p>
                    ${client?.phone ? `<p>${t('clients.phone')} : ${client.phone}</p>` : ''}
                    ${client?.address ? `<p>${t('clients.address')} : ${client.address}</p>` : ''}
                </div>
                <div style="text-align: ${isRTL ? 'left' : 'right'};">
                    <h3>${t('receipt.store')}</h3>
                    <p style="font-weight: bold; font-size: 18px;">${storeName || (isRTL ? "محلي" : "Ma Boutique")}</p>
                </div> 
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="${isRTL ? 'border-top-right-radius: 6px;' : 'border-top-left-radius: 6px;'}">#</th>
                        <th>${t('receipt.designation')}</th>
                        <th>${t('receipt.imei')}</th>
                        <th style="text-align: center; ${isRTL ? 'border-top-left-radius: 6px;' : 'border-top-right-radius: 6px;'}">${t('receipt.quantity')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="summary">
                <div class="summary-box">
                    <div class="summary-row total">
                        <span>${t('receipt.total_invoice')}</span>
                        <span>${effectiveSalePrice.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} DA</span>
                    </div>
                    <div class="summary-row">
                        <span>${t('receipt.amount_paid')}</span>
                        <span>${effectiveAmountPaid.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} DA</span>
                    </div>
                    <div class="summary-row debt">
                        <span>${t('receipt.remaining')}</span>
                        <span>${remainingDebt > 0 ? remainingDebt.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ') + ' DA' : t('receipt.settled')}</span>
                    </div>
                </div>
            </div>

            <div class="footer">
                ${t('receipt.footer')}
            </div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <script>
            window.onload = function() {
                var element = document.querySelector('.invoice-box');
                var opt = {
                    margin:       0.5,
                    filename:     '${t('receipt.title').replace(/\s+/g, '_')}_'+ '${sale.id.slice(0, 8).toUpperCase()}' + '.pdf',
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                html2pdf().set(opt).from(element).save().then(function() {
                    setTimeout(function() {
                        window.close();
                    }, 500);
                });
            };
        </script>
    </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

export const generatePaymentReceiptPDF = (
    t: any,
    language: string,
    amount: number,
    entityName: string | undefined,
    date: string,
    method: 'cash' | 'edahabia' | 'bank_transfer' | string,
    type: 'in' | 'out',
    notes?: string,
    remainingBalance?: number,
    storeName?: string | null
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert(t('receipt.popup_warning'));
        return;
    }

    const isRTL = language === 'ar';
    const dateFormatted = new Date(date).toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const methodLabel = method === 'cash' ? t('transactions.method_cash') : 
                       method === 'edahabia' ? t('transactions.method_card_gold') : 
                       method === 'bank_transfer' ? t('transactions.method_bank') : method;
    const isIncome = type === 'in';
    const title = isIncome ? t('receipt.payment_title') : t('receipt.payment_out_title');
    const amountColor = isIncome ? '#10b981' : '#ef4444';
    const entityLabel = isIncome ? t('receipt.received_from') : t('receipt.paid_to');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="${language}" dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <title>${title} - ${entityName || (isRTL ? 'غير معروف' : 'Inconnu')}</title>
        <style>
            body {
                font-family: ${isRTL ? "'Sakkal Majalla', 'Simplified Arabic', 'Segoe UI', serif" : "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"};
                margin: 0;
                padding: 40px;
                color: #1f2937;
                background-color: white;
                text-align: ${isRTL ? 'right' : 'left'};
            }
            .invoice-box {
                max-width: 600px;
                margin: auto;
                box-sizing: border-box;
                border: 1px solid #e5e7eb;
                padding: 40px;
                border-radius: 8px;
            }
            .header {
                display: flex;
                flex-direction: ${isRTL ? 'row-reverse' : 'row'};
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #1f2937;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                color: #1f2937;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .header-info {
                text-align: ${isRTL ? 'left' : 'right'};
                color: #6b7280;
                font-size: 14px;
            }
            .client-section {
                display: flex;
                flex-direction: ${isRTL ? 'row-reverse' : 'row'};
                justify-content: space-between;
                margin-bottom: 30px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
            }
            .client-section div h3 {
                margin-top: 0;
                margin-bottom: 5px;
                color: #4b5563;
                font-size: 14px;
                text-transform: uppercase;
            }
            .client-section div p {
                margin: 0;
                font-size: 18px;
                font-weight: bold;
            }
            .details-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 40px;
            }
            .details-table th, .details-table td {
                padding: 15px 10px;
                text-align: ${isRTL ? 'right' : 'left'};
                border-bottom: 1px solid #e5e7eb;
            }
            .details-table th {
                color: #6b7280;
                font-weight: 500;
                width: 40%;
            }
            .details-table td {
                font-weight: 600;
                font-size: 16px;
            }
            .amount-row {
                background: #f9fafb;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin-bottom: 40px;
            }
            .amount-label {
                color: #6b7280;
                font-size: 14px;
                text-transform: uppercase;
                margin-bottom: 5px;
            }
            .amount-value {
                font-size: 32px;
                font-weight: bold;
                color: ${amountColor};
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                color: #9ca3af;
                font-size: 12px;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
            }
            @media print {
                body { padding: 0; }
                .invoice-box { padding: 20mm; border: none; }
            }
        </style>
    </head>
    <body>
        <div class="invoice-box">
            <div class="header">
                <h1>${title}</h1>
                <div class="header-info">
                    <p>${t('receipt.date')} ${dateFormatted}</p>
                </div>
            </div>

            <div class="client-section">
                <div>
                    <h3>${entityLabel}</h3>
                    <p>${entityName || (isRTL ? 'غير معروف' : 'Inconnu')}</p>
                </div>
                <div style="text-align: ${isRTL ? 'left' : 'right'};">
                    <h3>${t('receipt.store')}</h3>
                    <p style="font-weight: bold; font-size: 18px;">${storeName || (isRTL ? "محلي" : "Ma Boutique")}</p>
                </div>
            </div>

            <div class="amount-row">
                <div class="amount-label">${isIncome ? t('receipt.amount_paid') : t('receipt.amount_paid')}</div>
                <div class="amount-value">${Number(amount).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} DA</div>
            </div>

            <table class="details-table">
                <tbody>
                    <tr>
                        <th>${t('receipt.method')}</th>
                        <td>${methodLabel}</td>
                    </tr>
                    ${notes ? `
                    <tr>
                        <th>${t('receipt.notes')}</th>
                        <td style="font-weight: 400; color: #4b5563;">${notes}</td>
                    </tr>
                    ` : ''}
                    ${(remainingBalance !== undefined && remainingBalance !== null && type === 'in') ? `
                    <tr style="background: ${remainingBalance > 0 ? '#fef2f2' : '#f0fdf4'};">
                        <th style="color: ${remainingBalance > 0 ? '#dc2626' : '#16a34a'}; font-weight: 700;">${t('receipt.remaining')} :</th>
                        <td style="font-size: 20px; font-weight: 800; color: ${remainingBalance > 0 ? '#dc2626' : '#16a34a'}">${remainingBalance > 0 ? Number(remainingBalance).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ') + ' DA' : '✓ ' + t('receipt.settled')}</td>
                    </tr>
                    ` : ''}
                </tbody>
            </table>

            <div class="footer">
                ${t('receipt.document_generated')} ${new Date().toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-FR')} - ${new Date().toLocaleTimeString(isRTL ? 'ar-DZ' : 'fr-FR')}
                <br><br>
                ${t('receipt.signature')}
            </div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <script>
            window.onload = function() {
                var element = document.querySelector('.invoice-box');
                var opt = {
                    margin:       0.5,
                    filename:     '${title.replace(/\s+/g, '_')}_' + Date.now() + '.pdf',
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                html2pdf().set(opt).from(element).save().then(function() {
                    setTimeout(function() {
                        window.close();
                    }, 500);
                });
            };
        </script>
    </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

