import { StorageService } from './storage';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const ExportService = {
    async exportToExcel() {
        const data = await StorageService.getData();
        const wb = XLSX.utils.book_new();

        // 1. Phones Inventory
        const phonesData = data.phones.map(p => ({
            'Modèle': p.model,
            'IMEI / N°S': p.imei || 'N/A',
            "Prix d'Achat (DZD)": Number(p.purchasePrice),
            "Date d'Ajout": new Date(p.purchaseDate).toLocaleDateString('fr-DZ'),
            'Statut': p.status === 'inventory' ? 'En Stock' : p.status === 'sold' ? 'Vendu' : 'Retourné',
            'Raison Retour': p.returnReason || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(phonesData), "Inventaire");

        // 2. Sales
        const salesData = data.sales.map(s => {
            const client = data.clients?.find((c: any) => c.id === s.clientId);
            const models = (s.phoneIds || []).map((id: string) => {
                const ph = data.phones.find(p => p.id === id);
                return ph ? ph.model : 'Inconnu';
            }).join(', ');
            return {
                'Client': client?.name || s.customerName || 'Comptoir',
                'Appareils': models,
                'Prix Vente (DZD)': Number(s.salePrice),
                'Montant Payé (DZD)': Number(s.amountPaid),
                'Reste (DZD)': Number(s.salePrice) - Number(s.amountPaid),
                'Date': new Date(s.saleDate).toLocaleDateString('fr-DZ'),
                'Statut': s.status === 'paid' ? 'Payé' : 'En Attente',
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "Ventes");

        // 3. Client Payments (Versements Clients)
        const paymentsData = data.payments.map(p => {
            const sale = data.sales.find(s => s.id === p.saleId);
            const client = data.clients?.find((c: any) => c.id === sale?.clientId);
            return {
                'Client': client?.name || sale?.customerName || 'Inconnu',
                'Montant (DZD)': Number(p.amount),
                'Méthode': p.method || 'Cash',
                'Date': new Date(p.paymentDate).toLocaleDateString('fr-DZ'),
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentsData), "Versements Clients");

        // 4. Supplier Payments
        const supplierPaymentsData = (data.supplierPayments || []).map((p: any) => {
            const supplier = (data.suppliers || []).find((s: any) => s.id === p.supplierId);
            return {
                'Fournisseur': supplier?.name || 'Inconnu',
                'Montant (DZD)': Number(p.amount),
                'Méthode': p.method || 'Cash',
                'Notes': p.notes || '',
                'Date': new Date(p.paymentDate).toLocaleDateString('fr-DZ'),
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierPaymentsData), "Versements Fournisseurs");

        // 5. Full Transactions (Caisse / Toutes entrées-sorties)
        const allTxs: any[] = [];
        // Client payments as IN
        data.payments.forEach((p: any) => {
            const sale = data.sales.find(s => s.id === p.saleId);
            const client = (data.clients || []).find((c: any) => c.id === sale?.clientId);
            allTxs.push({
                'Date': new Date(p.paymentDate).toLocaleDateString('fr-DZ'),
                'Type': 'Entrée',
                'Libellé': `Versement de ${client?.name || sale?.customerName || 'Client'}`,
                'Montant (DZD)': Number(p.amount),
                'Méthode': p.method || 'Cash',
            });
        });
        // Supplier payments as OUT
        (data.supplierPayments || []).forEach((p: any) => {
            const supplier = (data.suppliers || []).find((s: any) => s.id === p.supplierId);
            allTxs.push({
                'Date': new Date(p.paymentDate).toLocaleDateString('fr-DZ'),
                'Type': 'Sortie',
                'Libellé': `Payé à ${supplier?.name || 'Fournisseur'}`,
                'Montant (DZD)': Number(p.amount),
                'Méthode': p.method || 'Cash',
            });
        });
        // General caisse transactions
        (data.caisseTransactions || []).forEach((t: any) => {
            allTxs.push({
                'Date': new Date(t.transactionDate).toLocaleDateString('fr-DZ'),
                'Type': t.type === 'in' ? 'Entrée' : 'Sortie',
                'Libellé': t.label,
                'Montant (DZD)': Number(t.amount),
                'Méthode': 'Cash',
            });
        });
        // Sort by date desc
        allTxs.sort((a, b) => new Date(b['Date']).getTime() - new Date(a['Date']).getTime());
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allTxs), "Toutes Transactions");

        // Save
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(dataBlob, `SmartTrack_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    },

    async exportDatabase() {
        // Allows the user to download the raw JSON for migrating from Browser -> Desktop App
        const data = await StorageService.getData();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        saveAs(blob, `PhoneTracker_Backup_${new Date().toISOString().split('T')[0]}.json`);
    },

    importDatabase(_file: File, _onSuccess: () => void, onError: (err: string) => void) {
        alert("L'importation de sauvegarde locale n'est plus supportée depuis le passage à la base de données Cloud (Supabase). Toutes vos données sont sauvegardées et synchronisées automatiquement en ligne.");
        onError("Importation non supportée.");
    }
};
