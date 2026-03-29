import { useState, useEffect, useMemo } from "react";
import { StorageService } from "../services/storage";
import type {
  Payment,
  SupplierPayment,
  Client,
  Supplier,
  CaisseTransaction,
  Phone,
  Sale,
} from "../types";
import { TrendingUp, TrendingDown, Search, Plus, X, Edit, Trash2, Printer } from "lucide-react";
import { generatePaymentReceiptPDF } from "../utils/pdfGenerator";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";

type PaymentMethod = "cash" | "edahabia" | "bank_transfer";

// Move METHOD_LABELS inside component to use t()

type TransactionEntry = {
  id: string;
  date: string;
  type: "in" | "out";
  amount: number;
  method: PaymentMethod;
  label: string;
  subLabel?: string;
  saleId?: string; // For client payments — used to calculate remaining balance on receipt
};

const Transactions = () => {
  const { profile, storeName } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const isAdmin = profile?.role === 'admin';
  const METHOD_LABELS: Record<PaymentMethod, string> = {
    cash: `💵 ${t('payment_methods.cash')}`,
    edahabia: `💳 ${t('payment_methods.edahabia')}`,
    bank_transfer: `🏦 ${t('payment_methods.bank_transfer')}`,
  };

  const [phones, setPhones] = useState<Phone[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(
    [],
  );
  const [caisseTransactions, setCaisseTransactions] = useState<
    CaisseTransaction[]
  >([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Add general transaction modal
  const [showAddTx, setShowAddTx] = useState(false);
  const [swipedTxId, setSwipedTxId] = useState<string | null>(null);
  const [newTxType, setNewTxType] = useState<"in" | "out">("out");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxLabel, setNewTxLabel] = useState("");
  const [newTxMethod, setNewTxMethod] = useState<PaymentMethod>("cash");
  const [newTxCategory, setNewTxCategory] = useState<'general' | 'rent' | 'salary' | 'utilities' | 'marketing' | 'refund' | 'other'>('general');
  const [newTxDate, setNewTxDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [addingTx, setAddingTx] = useState(false);

  // Linking Tx Modal
  const [txTargetType, setTxTargetType] = useState<
    "none" | "supplier" | "client"
  >("none");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedLinkedSaleId, setSelectedLinkedSaleId] = useState(""); // Only if client

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await StorageService.getData();
      setPhones(data.phones || []);
      setPayments(data.payments);
      setSupplierPayments(data.supplierPayments);
      setCaisseTransactions(data.caisseTransactions || []);
      setClients(data.clients);
      setSuppliers(data.suppliers);
      setSales(data.sales);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allTransactions = useMemo((): TransactionEntry[] => {
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const saleClientMap = new Map(sales.map((s) => [s.id, s.clientId]));

    const incoming: TransactionEntry[] = payments.map((p) => {
      const clientId = saleClientMap.get(p.saleId);
      const clientName = clientId ? clientMap.get(clientId) : undefined;
      return {
        id: p.id,
        date: p.paymentDate,
        type: "in",
        amount: Number(p.amount),
        method: (p.method || "cash") as PaymentMethod,
        label: clientName ? `${t('transactions.received_from')} ${clientName}` : t('transactions.client_payment'),
        subLabel: undefined,
        saleId: p.saleId, // carry saleId for remaining balance on receipt
      };
    });

    const outgoing: TransactionEntry[] = supplierPayments.map((p) => {
      const supplierName = supplierMap.get(p.supplierId) || "Fournisseur";
      return {
        id: p.id,
        date: p.paymentDate,
        type: "out",
        amount: Number(p.amount),
        method: (p.method || "cash") as PaymentMethod,
        label: `${t('transactions.paid_to')} ${supplierName}`,
        subLabel:
          (p as SupplierPayment & { notes?: string }).notes || undefined,
      };
    });

    const generalTxs: TransactionEntry[] = (caisseTransactions || []).map(
      (t) => ({
        id: t.id,
        date: t.transactionDate,
        type: t.type,
        amount: Number(t.amount),
        method: "cash", // Standardizing direct transactions as cash, or we can add method later
        label: t.label,
        subLabel: t.notes,
      }),
    );

    const returns: TransactionEntry[] = phones
      .filter((p) => p.status === "returned" && p.returnPrice && Number(p.returnPrice) > 0)
      .map((p) => ({
        id: `return-${p.id}`,
        date: (p as any).returnDate || new Date().toISOString(),
        type: "out",
        amount: Number(p.returnPrice),
        method: "cash",
        label: `${t('nav.repairs')} (${t('inventory.returned')}: ${p.model})`,
        subLabel: p.returnReason,
      }));

    return [...incoming, ...outgoing, ...generalTxs, ...returns].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [
    phones,
    payments,
    supplierPayments,
    caisseTransactions,
    clients,
    suppliers,
    sales,
  ]);

  const filtered = useMemo(() => {
    return allTransactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      // Only filter method if it's not a generic transaction (which currently defaults to cash)
      if (
        filterMethod !== "all" &&
        t.method !== filterMethod &&
        (t.label.includes("Payé") || t.label.includes("Reçu"))
      )
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.label.toLowerCase().includes(q) &&
          !t.subLabel?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allTransactions, filterType, filterMethod, search]);

  const totalIncoming = filtered
    .filter((t) => t.type === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOutgoing = filtered
    .filter((t) => t.type === "out")
    .reduce((s, t) => s + t.amount, 0);

  // Edit Transaction Modal State
  const [showEditTx, setShowEditTx] = useState(false);
  const [editTxId, setEditTxId] = useState("");
  const [editTxTargetType, setEditTxTargetType] = useState<
    "none" | "supplier" | "client" | "return"
  >("none");
  const [editTxType, setEditTxType] = useState<"in" | "out">("out");
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxLabel, setEditTxLabel] = useState("");
  const [editTxMethod, setEditTxMethod] = useState<PaymentMethod>("cash");
  const [editTxCategory, setEditTxCategory] = useState<'general' | 'rent' | 'salary' | 'utilities' | 'marketing' | 'refund' | 'other'>('general');
  const [editTxDate, setEditTxDate] = useState("");

  const openEditModal = (t: TransactionEntry) => {
    setEditTxId(t.id);
    setEditTxType(t.type);
    setEditTxAmount(t.amount.toString());
    setEditTxLabel(t.subLabel || t.label);
    setEditTxMethod(t.method);
    setEditTxDate(t.date.split("T")[0]);

    // Determine the target type based on how we constructed the id or label
    if (t.id.startsWith("return-")) {
      setEditTxTargetType("return");
    } else if (payments.some((p) => p.id === t.id)) {
      setEditTxTargetType("client");
    } else if (supplierPayments.some((p) => p.id === t.id)) {
      setEditTxTargetType("supplier");
    } else {
      setEditTxTargetType("none");
      setEditTxLabel(t.label); // For general caisse tx, label is the main label
      const originalTx = caisseTransactions.find(tx => tx.id === t.id);
      if (originalTx?.category) setEditTxCategory(originalTx.category);
    }
    setShowEditTx(true);
  };

  const handleEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTx(true);
    try {
      if (editTxTargetType === "none") {
        await StorageService.updateCaisseTransaction(editTxId, {
          type: editTxType,
          amount: Number(editTxAmount),
          label: editTxLabel,
          transactionDate: new Date(editTxDate).toISOString(),
          category: editTxType === 'out' ? editTxCategory : 'general'
        });
      } else if (editTxTargetType === "supplier") {
        await StorageService.updateSupplierPayment(editTxId, {
          amount: Number(editTxAmount),
          method: editTxMethod,
          paymentDate: new Date(editTxDate).toISOString(),
          notes: editTxLabel,
        });
      } else if (editTxTargetType === "client") {
        await StorageService.updatePayment(editTxId, {
          amount: Number(editTxAmount),
          method: editTxMethod,
          paymentDate: new Date(editTxDate).toISOString(),
        });
      }

      setShowEditTx(false);
      await loadData();
      showToast(t('common.save'), 'success');
    } catch (error: any) {
      showToast(t('common.error') + ": " + error.message, 'error');
    } finally {
      setAddingTx(false);
    }
  };

  const handleDeleteTx = async (tEntry: TransactionEntry) => {
    if (
      window.confirm(
        `${t('debtors.delete_confirm')} (${tEntry.amount.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA) ?`,
      )
    ) {
      try {
        if (tEntry.id.startsWith("return-")) {
          const phoneId = tEntry.id.replace("return-", "");
          await StorageService.updatePhone(phoneId, {
            returnPrice: 0,
          } as any);
        } else if (payments.some((p) => p.id === tEntry.id)) {
          await StorageService.deletePayment(tEntry.id);
        } else if (supplierPayments.some((p) => p.id === tEntry.id)) {
          await StorageService.deleteSupplierPayment(tEntry.id);
        } else {
          await StorageService.deleteCaisseTransaction(tEntry.id);
        }
        showToast(t('common.delete'), 'success');
        await loadData();
      } catch (error: any) {
        showToast(t('common.error') + ": " + error.message, 'error');
      }
    }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxAmount) return;
    setAddingTx(true);
    try {
      if (txTargetType === "none") {
        if (!newTxLabel) return;
        await StorageService.addCaisseTransaction({
          type: newTxType,
          amount: Number(newTxAmount),
          label: newTxLabel,
          transactionDate: new Date(newTxDate).toISOString(),
          category: newTxType === 'out' ? newTxCategory : 'general'
        });
      } else if (
        txTargetType === "supplier" &&
        newTxType === "out" &&
        selectedTargetId
      ) {
        await StorageService.addSupplierPayment({
          supplierId: selectedTargetId,
          amount: Number(newTxAmount),
          method: newTxMethod,
          paymentDate: new Date(newTxDate).toISOString(),
          ...(newTxLabel ? { notes: newTxLabel } : {}),
        });
      } else if (
        txTargetType === "client" &&
        newTxType === "in" &&
        selectedLinkedSaleId
      ) {
        await StorageService.addPayment({
          saleId: selectedLinkedSaleId,
          amount: Number(newTxAmount),
          method: newTxMethod,
          paymentDate: new Date(newTxDate).toISOString(),
        });
      }

      setShowAddTx(false);
      setNewTxLabel("");
      setNewTxAmount("");
      setTxTargetType("none");
      setSelectedTargetId("");
      setSelectedLinkedSaleId("");
      await loadData();
    } catch (e: any) {
      setAddingTx(false);
    }
  };

  if (loading)
    return (
      <div
        style={{
          color: "var(--text-secondary)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        {t('common.loading')}...
      </div>
    );

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
          {t('nav.transactions')}
        </h1>
        <button
          onClick={() => setShowAddTx(true)}
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            background: "var(--accent-primary)",
            color: "white",
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          <Plus size={16} /> {t('transactions.new_transaction')}
        </button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "12px",
            padding: "1.1rem",
            border: "1.5px solid #22c55e33",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <TrendingUp size={14} color="#22c55e" />
            {t('transactions.incoming')}
          </div>
          <div
            style={{ fontWeight: 800, fontSize: "1.25rem", color: "#22c55e" }}
          >
            {totalIncoming.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
          </div>
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "12px",
            padding: "1.1rem",
            border: "1.5px solid #ef444433",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <TrendingDown size={14} color="#ef4444" />
            {t('transactions.outgoing')}
          </div>
          <div
            style={{ fontWeight: 800, fontSize: "1.25rem", color: "#ef4444" }}
          >
            {totalOutgoing.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
          </div>
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "12px",
            padding: "1.1rem",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              marginBottom: "4px",
            }}
          >
            {t('transactions.net_balance')}
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: "1.25rem",
              color: totalIncoming - totalOutgoing >= 0 ? "#22c55e" : "#ef4444",
            }}
          >
            {(totalIncoming - totalOutgoing).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
            }}
          />
          <input
            type="text"
            placeholder={t('common.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem 1rem 0.6rem 2.2rem",
              background: "var(--bg-secondary)",
              border: "1.5px solid var(--border-color)",
              borderRadius: "9px",
              color: "var(--text-primary)",
              fontSize: "0.88rem",
              boxSizing: "border-box",
            }}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: "0.6rem 0.9rem",
            background: "var(--bg-secondary)",
            border: "1.5px solid var(--border-color)",
            borderRadius: "9px",
            color: "var(--text-primary)",
            fontSize: "0.88rem",
            cursor: "pointer",
          }}
        >
          <option value="all">{t('transactions.all_types')}</option>
          <option value="in">{t('transactions.incoming')} ({t('transactions.received')})</option>
          <option value="out">{t('transactions.outgoing')} ({t('transactions.sent')})</option>
        </select>
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          style={{
            padding: "0.6rem 0.9rem",
            background: "var(--bg-secondary)",
            border: "1.5px solid var(--border-color)",
            borderRadius: "9px",
            color: "var(--text-primary)",
            fontSize: "0.88rem",
            cursor: "pointer",
          }}
        >
          <option value="all">{t('transactions.all_methods')}</option>
          <option value="cash">{`💵 ${t('payment_methods.cash')}`}</option>
          <option value="edahabia">{`💳 ${t('payment_methods.edahabia')}`}</option>
          <option value="bank_transfer">{`🏦 ${t('payment_methods.bank_transfer')}`}</option>
        </select>
      </div>

      {/* Transactions List */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            color: "var(--text-secondary)",
          }}
        >
          {t('inventory.empty_state_search')}
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {filtered.map((tEntry, i) => {
            const isOpen = swipedTxId === tEntry.id;
            return (
              <div
                key={tEntry.id}
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                {/* Main row - click to toggle actions */}
                <div
                  onClick={() => setSwipedTxId(isOpen ? null : tEntry.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem',
                    gap: '1rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: tEntry.type === 'in' ? '#22c55e22' : '#ef444422' }}>
                      {tEntry.type === 'in' ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tEntry.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(tEntry.date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ', { day: '2-digit', month: '2-digit' })} · {tEntry.subLabel}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: tEntry.type === 'in' ? 'var(--success)' : 'var(--danger)' }}>
                      {tEntry.type === 'in' ? '+' : '-'}{Number(tEntry.amount).toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-DZ')} DA
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {METHOD_LABELS[tEntry.method] || tEntry.method}
                    </div>
                  </div>
                </div>

                {/* Action buttons revealed on click */}
                {isOpen && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '0.5rem 1.25rem 0.8rem',
                    background: 'rgba(255,255,255,0.03)',
                    justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        let entityName = tEntry.label;
                        let notes = tEntry.subLabel;
                        
                        if (entityName.startsWith('Reçu de ')) entityName = entityName.replace('Reçu de ', '');
                        if (entityName.startsWith('Payé à ')) entityName = entityName.replace('Payé à ', '');
                        
                        // Parse Return Refunds to cleanly extract Client name and Phone
                        if (tEntry.type === 'out' && entityName.includes('Remboursement Retour:') && entityName.includes(' - Client: ')) {
                            const match = entityName.match(/Remboursement Retour: (.*?) - Client: (.*)/);
                            if (match) {
                                notes = `Remboursement Retour: ${match[1]}`;
                                entityName = match[2];
                            }
                        }
                        
                        generatePaymentReceiptPDF(
                          t,
                          language,
                          Number(tEntry.amount),
                          entityName,
                          tEntry.date,
                          tEntry.method,
                          tEntry.type,
                          notes,
                          // Pass remaining balance only for 'in' (client payment) transactions
                          (() => {
                            if (tEntry.type !== 'in' || !tEntry.saleId) return undefined;
                            const sale = sales.find(s => s.id === tEntry.saleId);
                            if (!sale) return undefined;
                            const effPrice = Number(sale.salePrice);
                            const allPaid = payments.filter(p => p.saleId === tEntry.saleId).reduce((sum, p) => sum + Number(p.amount), 0);
                            return Math.max(0, effPrice - allPaid);
                          })(),
                          storeName
                        );
                        setSwipedTxId(null);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.9rem', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                    >
                      <Printer size={14} /> {t('common.print')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(tEntry); setSwipedTxId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.9rem', borderRadius: '8px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                    >
                      <Edit size={14} /> {t('common.edit')}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTx(tEntry); setSwipedTxId(null); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.9rem', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                      >
                        <Trash2 size={14} /> {t('common.delete')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditTx && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                {t('common.edit')}
              </h2>
              <button
                onClick={() => setShowEditTx(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleEditTx}>
              {editTxTargetType === "none" && (
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setEditTxType("in")}
                    style={{
                      flex: 1,
                      padding: "0.7rem",
                      borderRadius: "8px",
                      border: "2px solid",
                      borderColor:
                        editTxType === "in" ? "#22c55e" : "var(--border-color)",
                      background:
                        editTxType === "in" ? "#22c55e11" : "transparent",
                      color:
                        editTxType === "in"
                          ? "#22c55e"
                          : "var(--text-secondary)",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {t('transactions.incoming')} (IN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTxType("out")}
                    style={{
                      flex: 1,
                      padding: "0.7rem",
                      borderRadius: "8px",
                      border: "2px solid",
                      borderColor:
                        editTxType === "out"
                          ? "#ef4444"
                          : "var(--border-color)",
                      background:
                        editTxType === "out" ? "#ef444411" : "transparent",
                      color:
                        editTxType === "out"
                          ? "#ef4444"
                          : "var(--text-secondary)",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {t('transactions.outgoing')} (OUT)
                  </button>
                </div>
              )}

              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t('transactions.amount')} (DA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  placeholder="Ex: 5000"
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>

              {editTxTargetType !== "none" && editTxTargetType !== "return" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t('transactions.method')} *
                  </label>
                  <select
                    value={editTxMethod}
                    onChange={(e) => setEditTxMethod(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  >
                    <option value="cash">{t('payment_methods.cash')}</option>
                    <option value="edahabia">{t('payment_methods.edahabia')}</option>
                    <option value="bank_transfer">{t('payment_methods.bank_transfer')}</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {editTxTargetType === "none"
                    ? `${t('common.label')} *`
                    : editTxTargetType === "return"
                      ? `${t('repairs.reason')} *`
                      : t('common.notes')}
                </label>
                <input
                  type="text"
                  required={editTxTargetType === "none" || editTxTargetType === "return"}
                  value={editTxLabel}
                  onChange={(e) => setEditTxLabel(e.target.value)}
                  placeholder="Ex: Achat EURO, Café..."
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>

              {editTxTargetType === "none" && editTxType === "out" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t('transactions.category')}
                  </label>
                  <select
                    value={editTxCategory}
                    onChange={(e) => setEditTxCategory(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  >
                    <option value="general">{t('transactions.cat_general')}</option>
                    <option value="rent">{t('transactions.cat_rent')}</option>
                    <option value="salary">{t('transactions.cat_salary')}</option>
                    <option value="utilities">{t('transactions.cat_utilities')}</option>
                    <option value="marketing">{t('transactions.cat_marketing')}</option>
                    <option value="refund">{t('transactions.cat_refund')}</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t('common.date')}
                </label>
                <input
                  type="date"
                  value={editTxDate}
                  onChange={(e) => setEditTxDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={addingTx}
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  background: "var(--accent-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: addingTx ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                }}
              >
                {addingTx ? "..." : t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTx && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                {t('transactions.new_transaction')}
              </h2>
              <button
                onClick={() => setShowAddTx(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleAddTx}>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setNewTxType("in");
                    setTxTargetType("none");
                  }}
                  style={{
                    flex: 1,
                    padding: "0.7rem",
                    borderRadius: "8px",
                    border: "2px solid",
                    borderColor:
                      newTxType === "in" ? "#22c55e" : "var(--border-color)",
                    background:
                      newTxType === "in" ? "#22c55e11" : "transparent",
                    color:
                      newTxType === "in" ? "#22c55e" : "var(--text-secondary)",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {t('transactions.incoming')} (IN)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewTxType("out");
                    setTxTargetType("none");
                  }}
                  style={{
                    flex: 1,
                    padding: "0.7rem",
                    borderRadius: "8px",
                    border: "2px solid",
                    borderColor:
                      newTxType === "out" ? "#ef4444" : "var(--border-color)",
                    background:
                      newTxType === "out" ? "#ef444411" : "transparent",
                    color:
                      newTxType === "out" ? "#ef4444" : "var(--text-secondary)",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {t('transactions.outgoing')} (OUT)
                </button>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t('transactions.target_type')}
                </label>
                <select
                  value={txTargetType}
                  onChange={(e) => {
                    setTxTargetType(e.target.value as any);
                    setSelectedTargetId("");
                    setSelectedLinkedSaleId("");
                  }}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "white",
                  }}
                >
                  <option value="none">{t('transactions.target_direct')}</option>
                  {newTxType === "out" && (
                    <option value="supplier">{t('transactions.target_supplier')}</option>
                  )}
                  {newTxType === "in" && (
                    <option value="client">{t('transactions.target_client')}</option>
                  )}
                </select>
              </div>

              {txTargetType === "supplier" && newTxType === "out" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t('transactions.supplier')} *
                  </label>
                  <select
                    required
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  >
                    <option value="">{t('transactions.select')}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {txTargetType === "client" && newTxType === "in" && (
                <>
                  <div style={{ marginBottom: "1rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        marginBottom: "6px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {t('transactions.client')} *
                    </label>
                    <select
                      required
                      value={selectedTargetId}
                      onChange={(e) => setSelectedTargetId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        color: "white",
                      }}
                    >
                      <option value="">{t('transactions.select')}</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedTargetId && (
                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          marginBottom: "6px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {t('transactions.linked_sale')} *
                      </label>
                      <select
                        required
                        value={selectedLinkedSaleId}
                        onChange={(e) =>
                          setSelectedLinkedSaleId(e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "0.65rem",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          color: "white",
                        }}
                      >
                        <option value="">{t('transactions.select_sale')}</option>
                        {sales
                          .filter((s) => s.clientId === selectedTargetId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {t('transactions.sale_id')} {s.id.substring(0, 8)}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t('transactions.amount')} (DA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  placeholder="Ex: 5000"
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>

              {txTargetType !== "none" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t('transactions.method')} *
                  </label>
                  <select
                    value={newTxMethod}
                    onChange={(e) => setNewTxMethod(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  >
                    <option value="cash">{t('payment_methods.cash')}</option>
                    <option value="edahabia">{t('payment_methods.edahabia')}</option>
                    <option value="bank_transfer">{t('payment_methods.bank_transfer')}</option>
                  </select>
                </div>
              )}

              {txTargetType === "none" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t('common.label')} *
                  </label>
                  <input
                    type="text"
                    required={txTargetType === "none"}
                    value={newTxLabel}
                    onChange={(e) => setNewTxLabel(e.target.value)}
                    placeholder="Ex: Achat EURO, Café..."
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  />
                </div>
              )}

              {txTargetType === "none" && newTxType === "out" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t('transactions.category')}
                  </label>
                  <select
                    value={newTxCategory}
                    onChange={(e) => setNewTxCategory(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  >
                    <option value="general">{t('transactions.cat_general')}</option>
                    <option value="rent">{t('transactions.cat_rent')}</option>
                    <option value="salary">{t('transactions.cat_salary')}</option>
                    <option value="utilities">{t('transactions.cat_utilities')}</option>
                    <option value="marketing">{t('transactions.cat_marketing')}</option>
                    <option value="refund">{t('transactions.cat_refund')}</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t('transactions.date')}
                </label>
                <input
                  type="date"
                  value={newTxDate}
                  onChange={(e) => setNewTxDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={addingTx}
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  background: "var(--accent-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: addingTx ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                }}
              >
                {addingTx ? t('common.loading') : t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
