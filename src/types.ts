export interface Profile {
  id: string;
  store_id: string;
  full_name?: string;
  role: 'admin' | 'staff';
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  method: 'cash' | 'edahabia' | 'bank_transfer';
  paymentDate: string;
  notes?: string;
}

export interface Phone {
  id: string;
  model: string;
  imei?: string;
  color?: string;    // Optional - e.g. "Black", "White", "Gold"
  storage?: string;  // Optional - e.g. "128 GB", "256 GB", "512 GB"
  batteryHealth?: string; // Optional - e.g. "100%", "85%"
  grade?: string; // Optional - e.g. "Neuf", "Comme Neuf (A+)"
  purchasePrice: number;
  sellingPrice?: number; // Newly added - Prix de vente prevu
  purchaseDate: string;
  status: 'inventory' | 'sold' | 'returned';
  returnReason?: string;
  returnPrice?: number;
  returnDate?: string;
  supplierId?: string; // Newly added
}

export interface Sale {
  id: string;
  phoneIds: string[];
  clientId?: string; // Replaces customerName
  customerName?: string; // Keeping for backward compatibility temporarily if needed
  salePrice: number;
  amountPaid: number;
  saleDate: string;
  dueDate?: string; // Newly added
  status: 'pending' | 'paid';
}

export interface Payment {
  id: string;
  saleId: string;
  amount: number;
  method: 'cash' | 'edahabia' | 'bank_transfer'; // Newly added
  paymentDate: string;
}

export interface CaisseTransaction {
  id: string;
  type: 'in' | 'out';
  amount: number;
  label: string;
  transactionDate: string;
  notes?: string;
  category?: 'general' | 'rent' | 'salary' | 'utilities' | 'marketing' | 'refund' | 'other';
}

export interface RepairOrder {
  id: string;
  store_id?: string;
  client_id?: string;
  device_description: string;
  issue: string;
  status: 'received' | 'in_progress' | 'done' | 'delivered' | 'cancelled';
  repair_cost: number;
  deposit: number;
  received_date: string;
  delivery_date?: string;
  notes?: string;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  store_id: string;
  user_id: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT' | 'SALE';
  target_type: 'phones' | 'sales' | 'repairs' | 'caisse' | 'clients' | 'suppliers' | 'inventory';
  details?: any;
  created_at: string;
}

export interface Task {
  id: string;
  store_id: string;
  created_by: string;
  assigned_to?: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'done';
  due_date?: string;
  created_at: string;
  updated_at: string;
  assignee_name?: string; // Virtual field from join
}

export interface Notification {
  id: string;
  store_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export interface AppData {
  phones: Phone[];
  sales: Sale[];
  payments: Payment[];
  clients: Client[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  caisseTransactions: CaisseTransaction[];
  repairOrders: RepairOrder[];
  tasks: Task[];
  notifications: Notification[];
}
