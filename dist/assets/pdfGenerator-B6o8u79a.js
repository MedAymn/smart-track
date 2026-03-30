const $=(e,c,a,i,f,s)=>{const d=window.open("","_blank");if(!d){alert(e("receipt.popup_warning"));return}const t=c==="ar",r=new Date(a.saleDate).toLocaleDateString(t?"ar-DZ":"fr-FR",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),b=f,n=Number(a.salePrice),o=Math.min(Number(a.amountPaid),n),m=n-o,x=b.map((l,g)=>`
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${g+1}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500;">${l.model}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">${l.imei||"-"}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">1</td>
        </tr>
    `).join(""),p=`
    <!DOCTYPE html>
    <html lang="${c}" dir="${t?"rtl":"ltr"}">
    <head>
        <meta charset="UTF-8">
        <title>${e("receipt.title")} - ${i?.name||"Client"}</title>
        <style>
            body {
                font-family: ${t?"'Sakkal Majalla', 'Simplified Arabic', 'Segoe UI', serif":"'Segoe UI', Roboto, Helvetica, Arial, sans-serif"};
                margin: 0;
                padding: 40px;
                color: #1f2937;
                background-color: white;
                text-align: ${t?"right":"left"};
            }
            .invoice-box {
                max-width: 800px;
                margin: auto;
                box-sizing: border-box;
            }
            .header {
                display: flex;
                flex-direction: ${t?"row-reverse":"row"};
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
                text-align: ${t?"left":"right"};
                color: #6b7280;
                font-size: 14px;
            }
            .client-section {
                display: flex;
                flex-direction: ${t?"row-reverse":"row"};
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
                text-align: ${t?"right":"left"};
                padding: 12px;
                font-size: 14px;
            }
            .summary {
                display: flex;
                justify-content: ${t?"flex-start":"flex-end"};
            }
            .summary-box {
                width: 300px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
            }
            .summary-row {
                display: flex;
                flex-direction: ${t?"row-reverse":"row"};
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
                color: ${m>0?"#ef4444":"#10b981"};
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
                <h1>${e("receipt.title")}</h1>
                <div class="header-info">
                    <p>${e("receipt.date")} ${r}</p>
                    <p>${e("receipt.ref")} ${a.id.slice(0,8).toUpperCase()}</p>
                </div>
            </div>

            <div class="client-section">
                <div>
                    <h3>${e("receipt.billed_to")}</h3>
                    <p style="font-weight: bold; font-size: 18px;">${i?.name||a.customerName||(t?"زبون عادي":"Client Comptoir")}</p>
                    ${i?.phone?`<p>${e("clients.phone")} : ${i.phone}</p>`:""}
                    ${i?.address?`<p>${e("clients.address")} : ${i.address}</p>`:""}
                </div>
                <div style="text-align: ${t?"left":"right"};">
                    <h3>${e("receipt.store")}</h3>
                    <p style="font-weight: bold; font-size: 18px;">${s||(t?"محلي":"Ma Boutique")}</p>
                </div> 
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="${t?"border-top-right-radius: 6px;":"border-top-left-radius: 6px;"}">#</th>
                        <th>${e("receipt.designation")}</th>
                        <th>${e("receipt.imei")}</th>
                        <th style="text-align: center; ${t?"border-top-left-radius: 6px;":"border-top-right-radius: 6px;"}">${e("receipt.quantity")}</th>
                    </tr>
                </thead>
                <tbody>
                    ${x}
                </tbody>
            </table>

            <div class="summary">
                <div class="summary-box">
                    <div class="summary-row total">
                        <span>${e("receipt.total_invoice")}</span>
                        <span>${n.toLocaleString(t?"ar-DZ":"fr-DZ")} DA</span>
                    </div>
                    <div class="summary-row">
                        <span>${e("receipt.amount_paid")}</span>
                        <span>${o.toLocaleString(t?"ar-DZ":"fr-DZ")} DA</span>
                    </div>
                    <div class="summary-row debt">
                        <span>${e("receipt.remaining")}</span>
                        <span>${m>0?m.toLocaleString(t?"ar-DZ":"fr-DZ")+" DA":e("receipt.settled")}</span>
                    </div>
                </div>
            </div>

            <div class="footer">
                ${e("receipt.footer")}
            </div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
        <script>
            window.onload = function() {
                var element = document.querySelector('.invoice-box');
                var opt = {
                    margin:       0.5,
                    filename:     '${e("receipt.title").replace(/\s+/g,"_")}_'+ '${a.id.slice(0,8).toUpperCase()}' + '.pdf',
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
        <\/script>
    </body>
    </html>
    `;d.document.open(),d.document.write(p),d.document.close()},v=(e,c,a,i,f,s,d,t,r,b)=>{const n=window.open("","_blank");if(!n){alert(e("receipt.popup_warning"));return}const o=c==="ar",m=new Date(f).toLocaleDateString(o?"ar-DZ":"fr-FR",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),x=s==="cash"?e("transactions.method_cash"):s==="edahabia"?e("transactions.method_card_gold"):s==="bank_transfer"?e("transactions.method_bank"):s,p=d==="in",l=e(p?"receipt.payment_title":"receipt.payment_out_title"),g=p?"#10b981":"#ef4444",h=e(p?"receipt.received_from":"receipt.paid_to"),u=`
    <!DOCTYPE html>
    <html lang="${c}" dir="${o?"rtl":"ltr"}">
    <head>
        <meta charset="UTF-8">
        <title>${l} - ${i||(o?"غير معروف":"Inconnu")}</title>
        <style>
            body {
                font-family: ${o?"'Sakkal Majalla', 'Simplified Arabic', 'Segoe UI', serif":"'Segoe UI', Roboto, Helvetica, Arial, sans-serif"};
                margin: 0;
                padding: 40px;
                color: #1f2937;
                background-color: white;
                text-align: ${o?"right":"left"};
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
                flex-direction: ${o?"row-reverse":"row"};
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
                text-align: ${o?"left":"right"};
                color: #6b7280;
                font-size: 14px;
            }
            .client-section {
                display: flex;
                flex-direction: ${o?"row-reverse":"row"};
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
                text-align: ${o?"right":"left"};
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
                color: ${g};
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
                <h1>${l}</h1>
                <div class="header-info">
                    <p>${e("receipt.date")} ${m}</p>
                </div>
            </div>

            <div class="client-section">
                <div>
                    <h3>${h}</h3>
                    <p>${i||(o?"غير معروف":"Inconnu")}</p>
                </div>
                <div style="text-align: ${o?"left":"right"};">
                    <h3>${e("receipt.store")}</h3>
                    <p style="font-weight: bold; font-size: 18px;">${b||(o?"محلي":"Ma Boutique")}</p>
                </div>
            </div>

            <div class="amount-row">
                <div class="amount-label">${e("receipt.amount_paid")}</div>
                <div class="amount-value">${Number(a).toLocaleString(o?"ar-DZ":"fr-DZ")} DA</div>
            </div>

            <table class="details-table">
                <tbody>
                    <tr>
                        <th>${e("receipt.method")}</th>
                        <td>${x}</td>
                    </tr>
                    ${t?`
                    <tr>
                        <th>${e("receipt.notes")}</th>
                        <td style="font-weight: 400; color: #4b5563;">${t}</td>
                    </tr>
                    `:""}
                    ${r!=null&&d==="in"?`
                    <tr style="background: ${r>0?"#fef2f2":"#f0fdf4"};">
                        <th style="color: ${r>0?"#dc2626":"#16a34a"}; font-weight: 700;">${e("receipt.remaining")} :</th>
                        <td style="font-size: 20px; font-weight: 800; color: ${r>0?"#dc2626":"#16a34a"}">${r>0?Number(r).toLocaleString(o?"ar-DZ":"fr-DZ")+" DA":"✓ "+e("receipt.settled")}</td>
                    </tr>
                    `:""}
                </tbody>
            </table>

            <div class="footer">
                ${e("receipt.document_generated")} ${new Date().toLocaleDateString(o?"ar-DZ":"fr-FR")} - ${new Date().toLocaleTimeString(o?"ar-DZ":"fr-FR")}
                <br><br>
                ${e("receipt.signature")}
            </div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
        <script>
            window.onload = function() {
                var element = document.querySelector('.invoice-box');
                var opt = {
                    margin:       0.5,
                    filename:     '${l.replace(/\s+/g,"_")}_' + Date.now() + '.pdf',
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
        <\/script>
    </body>
    </html>
    `;n.document.open(),n.document.write(u),n.document.close()};export{v as a,$ as g};
