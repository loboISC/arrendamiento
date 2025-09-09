# Integración Base de Datos - Sistema de Cotizaciones

## Conexión con la Aplicación React

### 1. API Endpoints Recomendados

```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 2. Servicios de Cotizaciones

```typescript
// services/quotationService.ts
import { QuotationState, QuotationItem, ClientInfo } from '../types/quotation';

class QuotationService {
  private baseUrl = '/api/quotations';

  // Crear nueva cotización
  async createQuotation(data: Partial<QuotationState>): Promise<ApiResponse<string>> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_info: data.clientInfo,
        advisor_id: data.advisorInfo?.id,
        valid_until: data.validUntil,
        items: data.quotationItems?.map(item => ({
          service_id: item.serviceId,
          service_name: item.serviceName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          scaffold_type_id: item.scaffoldType ? getScaffoldTypeId(item.scaffoldType) : null,
          scheduled_date: item.date,
          location: item.location,
          observations: item.observations
        }))
      })
    });
    return response.json();
  }

  // Obtener cotización por ID
  async getQuotation(id: string): Promise<ApiResponse<QuotationState>> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    const result = await response.json();
    
    if (result.success) {
      // Transformar datos de DB a formato de la aplicación
      result.data = this.transformDbToApp(result.data);
    }
    return result;
  }

  // Listar cotizaciones del asesor
  async getQuotationsByAdvisor(
    advisorId: string, 
    page = 1, 
    limit = 10
  ): Promise<PaginatedResponse<QuotationState>> {
    const response = await fetch(
      `${this.baseUrl}?advisor_id=${advisorId}&page=${page}&limit=${limit}`
    );
    return response.json();
  }

  // Actualizar estado de cotización
  async updateQuotationStatus(
    id: string, 
    status: string, 
    notes?: string
  ): Promise<ApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    return response.json();
  }

  // Generar PDF
  async generatePDF(id: string): Promise<ApiResponse<{ downloadUrl: string }>> {
    const response = await fetch(`${this.baseUrl}/${id}/pdf`, {
      method: 'POST'
    });
    return response.json();
  }

  // Enviar por email
  async sendByEmail(
    id: string, 
    email: string, 
    message?: string
  ): Promise<ApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, message })
    });
    return response.json();
  }

  private transformDbToApp(dbData: any): QuotationState {
    return {
      currentStep: 'summary',
      selectedService: null,
      quotationItems: dbData.items?.map((item: any) => ({
        id: item.id,
        serviceId: item.service_id,
        serviceName: item.service_name,
        serviceType: item.service_type,
        quantity: item.quantity,
        scaffoldType: item.scaffold_type,
        date: item.scheduled_date,
        location: item.location,
        observations: item.observations,
        unitPrice: item.unit_price,
        totalPrice: item.total_price
      })) || [],
      clientInfo: {
        name: dbData.contact_name,
        company: dbData.company_name,
        phone: dbData.contact_phone,
        email: dbData.contact_email,
        address: dbData.address,
        taxId: dbData.tax_id
      },
      advisorInfo: {
        id: dbData.advisor_id,
        name: dbData.advisor_name,
        email: dbData.advisor_email,
        department: dbData.advisor_department
      },
      quotationNumber: dbData.quotation_number,
      validUntil: dbData.valid_until,
      status: dbData.status,
      savedToPdf: dbData.pdf_generated || false,
      savedToSystem: true
    };
  }
}

export const quotationService = new QuotationService();
```

### 3. Hooks de React para Estado Global

```typescript
// hooks/useQuotations.ts
import { useState, useEffect } from 'react';
import { quotationService } from '../services/quotationService';

export function useQuotations(advisorId: string) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadQuotations = async () => {
    try {
      setLoading(true);
      const response = await quotationService.getQuotationsByAdvisor(advisorId);
      if (response.success) {
        setQuotations(response.data || []);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Error loading quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (advisorId) {
      loadQuotations();
    }
  }, [advisorId]);

  return {
    quotations,
    loading,
    error,
    refetch: loadQuotations
  };
}

// hooks/useQuotationState.ts - Reemplazar useState local
import { useState, useCallback } from 'react';
import { QuotationState } from '../types/quotation';
import { quotationService } from '../services/quotationService';

export function useQuotationState(initialState: QuotationState) {
  const [state, setState] = useState(initialState);
  const [saving, setSaving] = useState(false);

  const saveToSystem = useCallback(async () => {
    try {
      setSaving(true);
      const response = await quotationService.createQuotation(state);
      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          savedToSystem: true,
          quotationNumber: response.data || prev.quotationNumber
        }));
        return response.data;
      }
    } catch (error) {
      console.error('Error saving quotation:', error);
    } finally {
      setSaving(false);
    }
  }, [state]);

  const generatePDF = useCallback(async (quotationId: string) => {
    try {
      const response = await quotationService.generatePDF(quotationId);
      if (response.success) {
        setState(prev => ({ ...prev, savedToPdf: true }));
        return response.data?.downloadUrl;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  }, []);

  return {
    state,
    setState,
    saving,
    saveToSystem,
    generatePDF
  };
}
```

### 4. Actualización del App.tsx Principal

```typescript
// App.tsx - Versión con integración de BD
import { useState, useEffect } from 'react';
import { useQuotationState } from './hooks/useQuotationState';
import { useAuth } from './hooks/useAuth'; // Hook de autenticación
// ... otros imports

export default function App() {
  const { user } = useAuth(); // Usuario autenticado
  const initialState: QuotationState = {
    // ... estado inicial
    advisorInfo: user ? {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      department: user.department
    } : null
  };

  const { 
    state, 
    setState, 
    saving, 
    saveToSystem, 
    generatePDF 
  } = useQuotationState(initialState);

  // Reemplazar handlers existentes
  const handleSaveToSystem = async () => {
    const quotationId = await saveToSystem();
    if (quotationId) {
      console.log('Cotización guardada:', quotationId);
      // Mostrar notificación de éxito
    }
  };

  const handleSavePDF = async () => {
    if (state.quotationNumber) {
      const downloadUrl = await generatePDF(state.quotationNumber);
      if (downloadUrl) {
        // Abrir URL de descarga
        window.open(downloadUrl, '_blank');
      }
    }
  };

  // ... resto del componente igual, pero usando los nuevos handlers
}
```

### 5. Servicios de Facturación

```typescript
// services/invoiceService.ts
class InvoiceService {
  private baseUrl = '/api/invoices';

  // Crear factura desde cotización
  async createFromQuotation(
    quotationId: string, 
    invoiceData: Partial<InvoiceInfo>
  ): Promise<ApiResponse<string>> {
    const response = await fetch(`${this.baseUrl}/from-quotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotation_id: quotationId,
        issue_date: invoiceData.issueDate,
        due_date: invoiceData.dueDate,
        payment_terms: invoiceData.paymentTerms,
        payment_method: invoiceData.paymentMethod,
        tax_rate: invoiceData.taxRate,
        notes: invoiceData.notes
      })
    });
    return response.json();
  }

  // Obtener estado de cartera
  async getAccountsReceivable(advisorId?: string): Promise<ApiResponse<any[]>> {
    const url = advisorId 
      ? `${this.baseUrl}/accounts-receivable?advisor_id=${advisorId}`
      : `${this.baseUrl}/accounts-receivable`;
    
    const response = await fetch(url);
    return response.json();
  }

  // Registrar pago
  async registerPayment(
    invoiceId: string,
    paymentData: {
      amount: number;
      payment_date: string;
      payment_method: string;
      reference?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    return response.json();
  }
}

export const invoiceService = new InvoiceService();
```

### 6. Configuración de la API Backend (Node.js/Express ejemplo)

```javascript
// routes/quotations.js
const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// POST /api/quotations - Crear cotización
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Crear cliente si no existe
    let clientId;
    const existingClient = await client.query(
      'SELECT id FROM clients WHERE contact_email = $1',
      [req.body.client_info.email]
    );
    
    if (existingClient.rows.length > 0) {
      clientId = existingClient.rows[0].id;
    } else {
      const newClient = await client.query(`
        INSERT INTO clients (company_name, contact_name, contact_email, contact_phone, address, tax_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        req.body.client_info.company,
        req.body.client_info.name,
        req.body.client_info.email,
        req.body.client_info.phone,
        req.body.client_info.address,
        req.body.client_info.taxId,
        req.body.advisor_id
      ]);
      clientId = newClient.rows[0].id;
    }
    
    // Crear cotización
    const quotation = await client.query(`
      INSERT INTO quotations (client_id, advisor_id, valid_until, status)
      VALUES ($1, $2, $3, 'draft')
      RETURNING id, quotation_number
    `, [clientId, req.body.advisor_id, req.body.valid_until]);
    
    const quotationId = quotation.rows[0].id;
    
    // Insertar items
    for (const item of req.body.items) {
      await client.query(`
        INSERT INTO quotation_items (
          quotation_id, service_id, service_name, quantity, 
          unit_price, total_price, scaffold_type_id, 
          scheduled_date, location, observations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        quotationId, item.service_id, item.service_name,
        item.quantity, item.unit_price, item.total_price,
        item.scaffold_type_id, item.scheduled_date,
        item.location, item.observations
      ]);
    }
    
    // Recalcular totales
    await client.query('SELECT calculate_quotation_totals($1)', [quotationId]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: quotation.rows[0].quotation_number,
      message: 'Cotización creada exitosamente'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/quotations/:id - Obtener cotización
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM quotation_details WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### 7. Variables de Entorno

```env
# .env
DATABASE_URL=postgresql://username:password@localhost:5432/tecnoseguridad_pro
JWT_SECRET=your-secret-key
API_BASE_URL=http://localhost:3001/api
STORAGE_PATH=/uploads/documents
EMAIL_SERVICE_API_KEY=your-email-service-key
```

### 8. Migración Gradual

```typescript
// utils/migration.ts - Para migrar datos existentes
export class DataMigration {
  static async migrateLocalStateToDatabase(localState: QuotationState) {
    try {
      // Guardar estado local en base de datos
      const response = await quotationService.createQuotation(localState);
      
      if (response.success) {
        // Limpiar localStorage
        localStorage.removeItem('quotation-draft');
        return response.data;
      }
    } catch (error) {
      console.error('Migration failed:', error);
      // Mantener en localStorage como backup
      localStorage.setItem('quotation-draft', JSON.stringify(localState));
    }
  }
  
  static loadDraftFromStorage(): QuotationState | null {
    try {
      const stored = localStorage.getItem('quotation-draft');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}
```

## Ventajas de esta Integración

1. **Persistencia Real**: Datos guardados permanentemente
2. **Colaboración**: Múltiples asesores pueden trabajar
3. **Auditoría**: Historial completo de cambios
4. **Reportes**: Consultas complejas para análisis
5. **Escalabilidad**: Preparado para crecimiento
6. **Backup**: Datos seguros y recuperables
7. **Integraciones**: Fácil conexión con otros sistemas

## Próximos Pasos Recomendados

1. Implementar autenticación JWT
2. Configurar backup automático
3. Agregar cache con Redis
4. Implementar WebSocket para actualizaciones en tiempo real
5. Configurar monitoreo con logs estructurados
6. Agregar tests de integración
7. Documentar API con OpenAPI/Swagger