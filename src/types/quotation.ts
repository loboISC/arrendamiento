export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'curso' | 'inspeccion' | 'inspeccion-liberacion';
}

export interface QuotationItem {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  quantity: number;
  scaffoldType?: string;
  date: string;
  location: string;
  observations: string;
  unitPrice?: number;
  totalPrice?: number;
  tax?: number;
  discount?: number;
}

export interface ClientInfo {
  name: string;
  company: string;
  phone: string;
  email: string;
  address?: string;
  taxId?: string;
}

export interface AdvisorInfo {
  id: string;
  name: string;
  email: string;
  department: string;
}

export interface InvoiceInfo {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  paymentMethod: string;
  notes?: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
}

export interface QuotationState {
  currentStep: 'selection' | 'configuration' | 'summary' | 'confirmation' | 'invoice';
  selectedService: Service | null;
  quotationItems: QuotationItem[];
  clientInfo: ClientInfo;
  advisorInfo: AdvisorInfo;
  quotationNumber: string;
  validUntil: string;
  status: 'draft' | 'generated' | 'sent' | 'approved' | 'rejected' | 'invoiced';
  invoiceInfo?: InvoiceInfo;
  savedToPdf: boolean;
  savedToSystem: boolean;
}