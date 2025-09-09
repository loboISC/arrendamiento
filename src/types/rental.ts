// =====================================================
// TIPOS PARA SISTEMA DE ARRENDAMIENTO
// =====================================================

export type QuotationType = 'rental' | 'sale' | 'service';

export type RentalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  manager: string;
  isActive: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  parentId?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  brand: string;
  model: string;
  specifications: Record<string, any>;
  images: string[];
  
  // Precios
  salePrice: number;
  dailyRentalRate: number;
  weeklyRentalRate: number;
  monthlyRentalRate: number;
  yearlyRentalRate: number;
  
  // Inventario
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  maintenanceStock: number;
  
  // Estado
  status: 'active' | 'inactive' | 'discontinued';
  condition: 'new' | 'good' | 'fair' | 'maintenance' | 'damaged';
  
  // Metadatos
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  
  // Fechas
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  product: Product;
  serialNumber: string;
  locationId: string;
  location: Location;
  condition: 'new' | 'good' | 'fair' | 'maintenance' | 'damaged';
  status: 'available' | 'rented' | 'reserved' | 'maintenance' | 'damaged';
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  acquisitionDate: string;
  acquisitionCost: number;
  currentValue: number;
  notes?: string;
}

export interface Accessory {
  id: string;
  name: string;
  description: string;
  productId: string; // Producto principal al que pertenece
  isRequired: boolean;
  additionalCost: number;
  images: string[];
}

export interface RentalItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  rentalPeriod: RentalPeriod;
  rentalDuration: number; // número de períodos
  unitRate: number;
  totalRate: number;
  
  // Fechas
  startDate: string;
  endDate: string;
  
  // Ubicación y entrega
  pickupLocationId?: string;
  deliveryLocationId?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  requiresDelivery: boolean;
  deliveryCost: number;
  
  // Accesorios
  accessories: AccessorySelection[];
  
  // Configuración específica
  observations: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  
  // Entrega
  deliveryLocationId?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  requiresDelivery: boolean;
  deliveryCost: number;
  
  // Configuración específica
  observations: string;
}

export interface AccessorySelection {
  accessoryId: string;
  accessory: Accessory;
  quantity: number;
  totalCost: number;
}

export interface DeliveryInfo {
  type: 'pickup' | 'delivery' | 'both';
  pickupLocation?: Location;
  deliveryLocation?: Location;
  customAddress?: string;
  instructions?: string;
  preferredDate?: string;
  preferredTime?: string;
  contactPerson?: string;
  contactPhone?: string;
  additionalCost: number;
}

export interface RentalQuotationState {
  currentStep: 'type-selection' | 'product-selection' | 'configuration' | 'accessories' | 'delivery' | 'summary' | 'confirmation' | 'contract' | 'invoice';
  quotationType: QuotationType;
  
  // Items según el tipo
  rentalItems: RentalItem[];
  saleItems: SaleItem[];
  serviceItems: any[]; // Reutilizar del sistema existente
  
  // Información del cliente
  clientInfo: ClientInfo;
  advisorInfo: AdvisorInfo;
  
  // Información de entrega
  deliveryInfo: DeliveryInfo;
  
  // Ubicación seleccionada para búsqueda
  searchLocation?: {
    postalCode: string;
    city: string;
    state: string;
  };
  
  // Configuraciones
  quotationNumber: string;
  validUntil: string;
  status: 'draft' | 'generated' | 'sent' | 'approved' | 'rejected' | 'contracted' | 'invoiced';
  
  // Estados de guardado
  savedToPdf: boolean;
  savedToSystem: boolean;
  
  // Facturación (si aplica)
  invoiceInfo?: InvoiceInfo;
}

export interface InventoryFilter {
  categoryId?: string;
  locationId?: string;
  status?: string[];
  condition?: string[];
  availability?: 'all' | 'available' | 'rented' | 'maintenance';
  searchTerm?: string;
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface InventoryReport {
  totalProducts: number;
  totalValue: number;
  availableItems: number;
  rentedItems: number;
  maintenanceItems: number;
  byCategory: Array<{
    categoryName: string;
    count: number;
    value: number;
  }>;
  byLocation: Array<{
    locationName: string;
    count: number;
    value: number;
  }>;
  topRentedProducts: Array<{
    productName: string;
    timesRented: number;
    revenue: number;
  }>;
}

// =====================================================
// TIPOS PARA CONTRATOS DE RENTA
// =====================================================

export interface GuaranteeInfo {
  type: 'monetary' | 'check' | 'bank_letter' | 'insurance';
  amount: number;
  status: 'pending' | 'received' | 'returned' | 'executed';
  
  // Campos específicos por tipo
  cashAmount?: number;
  checkNumber?: string;
  checkBank?: string;
  checkDate?: string;
  bankName?: string;
  letterNumber?: string;
  expirationDate?: string;
  insuranceCompany?: string;
  policyNumber?: string;
  notes?: string;
}

export interface ContractTerms {
  deliveryTerms: string;
  returnTerms: string;
  damagePolicy: string;
  lateReturnPenalty: number; // porcentaje
  maintenanceResponsibility: string;
  specialConditions: string[];
}

export interface RentalContract {
  id: string;
  quotationNumber: string;
  contractNumber: string;
  clientId: string;
  clientInfo: ClientInfo;
  advisorInfo: AdvisorInfo;
  rentalItems: RentalItem[];
  
  // Fechas del contrato
  startDate: string;
  endDate: string;
  signedDate: string;
  
  // Garantía y términos
  guaranteeInfo: GuaranteeInfo;
  terms: ContractTerms;
  
  // Estado y pagos
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'breached';
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  
  // Fechas de control
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// TIPOS PARA GESTIÓN DE CLIENTES
// =====================================================

export interface CustomerRating {
  score: number; // 1-5
  paymentReliability: number; // 1-5
  communicationQuality: number; // 1-5
  equipmentCare: number; // 1-5
  overallSatisfaction: number; // 1-5
  lastReviewDate: string;
  reviewNotes: string;
}

export interface Customer {
  id: string;
  personalInfo: ClientInfo;
  rating: CustomerRating;
  segment: 'individual' | 'small_business' | 'medium_business' | 'enterprise' | 'government';
  creditLimit: number;
  currentDebt: number;
  paymentTerms: number; // días
  paymentMethod: 'cash' | 'transfer' | 'check' | 'credit_card';
  registrationDate: string;
  lastActivityDate: string;
  totalTransactions: number;
  totalSpent: number;
  status: 'active' | 'inactive' | 'blacklisted';
  notes: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'rental' | 'sale' | 'service' | 'payment' | 'refund';
  referenceNumber: string;
  description: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  transactionDate: string;
  completedDate?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  advisorId: string;
  advisorName: string;
}

export interface CustomerSatisfactionSurvey {
  id: string;
  customerId: string;
  customerName: string;
  transactionId?: string;
  contractId?: string;
  surveyDate: string;
  responses: {
    overallSatisfaction: number; // 1-5
    productQuality: number; // 1-5
    deliveryService: number; // 1-5
    customerSupport: number; // 1-5
    valueForMoney: number; // 1-5
    wouldRecommend: boolean;
    comments: string;
    improvementSuggestions: string;
  };
  advisorId: string;
  advisorName: string;
}

// =====================================================
// TIPOS PARA MÓDULO DE ANÁLISIS
// =====================================================

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'semester' | 'year';

export interface SalesData {
  period: string;
  totalRevenue: number;
  rentalRevenue: number;
  salesRevenue: number;
  serviceRevenue: number;
  totalTransactions: number;
  newCustomers: number;
  utilizationRate: number;
  customerSatisfaction: number;
}

export interface TrendAnalysis {
  period: AnalyticsPeriod;
  data: SalesData[];
  growth: {
    revenue: number;
    transactions: number;
    customers: number;
  };
  forecast: {
    nextPeriodRevenue: number;
    confidence: number;
  };
}

export interface ProductAnalytics {
  productId: string;
  productName: string;
  category: string;
  totalRentals: number;
  totalRevenue: number;
  averageRentalDuration: number;
  utilizationRate: number;
  profitMargin: number;
  customerRating: number;
}

export interface CustomerAnalytics {
  segmentAnalysis: Array<{
    segment: string;
    customerCount: number;
    totalRevenue: number;
    averageOrderValue: number;
    retentionRate: number;
  }>;
  satisfactionTrends: Array<{
    period: string;
    averageScore: number;
    responseRate: number;
  }>;
  lifetimeValueAnalysis: {
    averageLTV: number;
    topCustomers: Array<{
      customerId: string;
      customerName: string;
      ltv: number;
      transactionCount: number;
    }>;
  };
}

// Reutilizar tipos existentes
export type { ClientInfo, AdvisorInfo, InvoiceInfo } from './quotation';