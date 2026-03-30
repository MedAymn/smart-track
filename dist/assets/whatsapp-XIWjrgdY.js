const d=a=>{if(!a)return"";let s=a.replace(/\D/g,"");return s.startsWith("0")&&(s="213"+s.substring(1)),s},u=(a,s,e,o,c)=>{const p=d(c);if(!p)return null;const r=e.repair_cost-e.deposit,i=e.status==="done";let t=a("whatsapp.repair_greeting",{name:o})+`

`;if(t+=a("whatsapp.repair_update",{device:e.device_description})+`
`,i)t+=a("whatsapp.repair_ready")+`
`,r>0?t+=a("whatsapp.repair_remaining",{amount:r.toLocaleString(s==="ar"?"ar-DZ":"fr-DZ")})+`
`:t+=a("whatsapp.repair_paid")+`
`;else{const n={received:a("repairs.status_received"),in_progress:a("repairs.status_in_progress"),delivered:a("repairs.status_delivered"),cancelled:a("repairs.status_cancelled")};t+=a("whatsapp.repair_status",{status:n[e.status]})+`
`,t+=a("whatsapp.repair_cost",{amount:e.repair_cost.toLocaleString(s==="ar"?"ar-DZ":"fr-DZ")})+`
`,t+=a("whatsapp.repair_deposit",{amount:e.deposit.toLocaleString(s==="ar"?"ar-DZ":"fr-DZ")})+`
`,r>0&&(t+=a("whatsapp.repair_delivery",{amount:r.toLocaleString(s==="ar"?"ar-DZ":"fr-DZ")})+`
`)}t+=`
`+a("whatsapp.repair_thanks");const l=encodeURIComponent(t);return`https://wa.me/${p}?text=${l}`},_=(a,s,e,o,c,p)=>{const r=d(p);if(!r)return null;const i=e.salePrice-e.amountPaid,t=s==="ar"?"ar-DZ":"fr-DZ",l=s==="ar"?"ar-DZ":"fr-FR";let n=a("whatsapp.sale_greeting",{name:c})+`

`;n+=a("whatsapp.sale_thanks")+`

`,n+=a("whatsapp.sale_item",{details:o})+`
`,n+=a("whatsapp.sale_total",{amount:e.salePrice.toLocaleString(t)})+`
`,n+=a("whatsapp.sale_paid",{amount:e.amountPaid.toLocaleString(t)})+`
`,i>0?(n+=a("whatsapp.sale_remaining",{amount:i.toLocaleString(t)})+`
`,e.dueDate&&(n+=a("whatsapp.sale_due",{date:new Date(e.dueDate).toLocaleDateString(l)})+`
`)):n+=a("whatsapp.sale_settled")+`
`,n+=`
`+a("whatsapp.sale_footer");const h=encodeURIComponent(n);return`https://wa.me/${r}?text=${h}`};export{u as a,_ as g};
