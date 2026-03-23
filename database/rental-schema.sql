-- =====================================================
-- SISTEMA ERP DE ARRENDAMIENTO - ESQUEMA DE BASE DE DATOS
-- Compatible con el sistema existente de cotizaciones
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. GESTIÓN DE INVENTARIO Y PRODUCTOS
-- =====================================================

-- Categorías de productos
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    parent_id UUID REFERENCES product_categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ubicaciones/Almacenes
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Colombia',
    phone VARCHAR(20),
    email VARCHAR(255),
    manager_name VARCHAR(255),
    manager_phone VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT TRUE,
    is_main_warehouse BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Productos del catálogo
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID NOT NULL REFERENCES product_categories(id),
    brand VARCHAR(255),
    model VARCHAR(255),
    specifications JSONB DEFAULT '{}',
    
    -- Precios
    sale_price DECIMAL(15,2),
    daily_rental_rate DECIMAL(15,2),
    weekly_rental_rate DECIMAL(15,2),
    monthly_rental_rate DECIMAL(15,2),
    yearly_rental_rate DECIMAL(15,2),
    
    -- Dimensiones y peso
    weight DECIMAL(10,2), -- en kg
    length DECIMAL(10,2), -- en metros
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    
    -- Stock agregado
    total_stock INTEGER DEFAULT 0,
    available_stock INTEGER DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    rented_stock INTEGER DEFAULT 0,
    maintenance_stock INTEGER DEFAULT 0,
    damaged_stock INTEGER DEFAULT 0,
    
    -- Estado y condición
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, discontinued
    condition_new INTEGER DEFAULT 0,
    condition_good INTEGER DEFAULT 0,
    condition_fair INTEGER DEFAULT 0,
    condition_maintenance INTEGER DEFAULT 0,
    condition_damaged INTEGER DEFAULT 0,
    
    -- Configuración de renta
    min_rental_period INTEGER DEFAULT 1, -- días mínimos
    max_rental_period INTEGER, -- días máximos
    requires_delivery BOOLEAN DEFAULT FALSE,
    delivery_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Mantenimiento
    maintenance_interval_days INTEGER DEFAULT 90,
    last_maintenance_check DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items individuales de inventario
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    serial_number VARCHAR(255) UNIQUE,
    location_id UUID NOT NULL REFERENCES locations(id),
    
    -- Estado del item individual
    condition VARCHAR(20) NOT NULL DEFAULT 'good', -- new, good, fair, maintenance, damaged
    status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, rented, reserved, maintenance, damaged, retired
    
    -- Fechas importantes
    acquisition_date DATE NOT NULL,
    acquisition_cost DECIMAL(15,2),
    current_value DECIMAL(15,2),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    retirement_date DATE,
    
    -- Seguimiento
    total_rental_days INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    maintenance_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Notas
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accesorios para productos
CREATE TABLE product_accessories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    is_required BOOLEAN DEFAULT FALSE,
    additional_cost DECIMAL(15,2) DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    images JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Imágenes de productos
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. COTIZACIONES DE RENTA Y VENTA
-- =====================================================

-- Extender tabla de cotizaciones existente
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(20) DEFAULT 'service';
-- quotation_type: service, rental, sale, mixed

-- Items de renta en cotizaciones
CREATE TABLE quotation_rental_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    
    -- Configuración de renta
    quantity INTEGER NOT NULL DEFAULT 1,
    rental_period VARCHAR(20) NOT NULL, -- daily, weekly, monthly, yearly
    rental_duration INTEGER NOT NULL, -- número de períodos
    unit_rate DECIMAL(15,2) NOT NULL,
    total_rate DECIMAL(15,2) NOT NULL,
    
    -- Fechas
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Entrega
    pickup_location_id UUID REFERENCES locations(id),
    delivery_location_id UUID REFERENCES locations(id),
    delivery_address TEXT,
    delivery_instructions TEXT,
    requires_delivery BOOLEAN DEFAULT FALSE,
    delivery_cost DECIMAL(15,2) DEFAULT 0,
    pickup_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Configuración específica
    observations TEXT,
    special_requirements TEXT,
    
    -- Orden en la cotización
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items de venta en cotizaciones
CREATE TABLE quotation_sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    
    -- Configuración de venta
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Entrega
    delivery_location_id UUID REFERENCES locations(id),
    delivery_address TEXT,
    delivery_instructions TEXT,
    requires_delivery BOOLEAN DEFAULT FALSE,
    delivery_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Configuración específica
    observations TEXT,
    warranty_period_months INTEGER DEFAULT 12,
    
    -- Orden en la cotización
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accesorios seleccionados para items de cotización
CREATE TABLE quotation_item_accessories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_item_id UUID REFERENCES quotation_rental_items(id) ON DELETE CASCADE,
    sale_item_id UUID REFERENCES quotation_sale_items(id) ON DELETE CASCADE,
    accessory_id UUID NOT NULL REFERENCES product_accessories(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost DECIMAL(15,2) NOT NULL,
    total_cost DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_parent_item CHECK (
        (rental_item_id IS NOT NULL AND sale_item_id IS NULL) OR
        (rental_item_id IS NULL AND sale_item_id IS NOT NULL)
    )
);

-- =====================================================
-- 3. CONTRATOS DE RENTA
-- =====================================================

-- Contratos generados desde cotizaciones aprobadas
CREATE TABLE rental_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id UUID NOT NULL REFERENCES quotations(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    advisor_id UUID NOT NULL REFERENCES users(id),
    
    -- Fechas del contrato
    contract_date DATE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Términos financieros
    subtotal DECIMAL(15,2) NOT NULL,
    delivery_cost DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    security_deposit DECIMAL(15,2) DEFAULT 0,
    
    -- Estado del contrato
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    -- active, completed, cancelled, overdue, terminated
    
    -- Configuraciones
    auto_renewal BOOLEAN DEFAULT FALSE,
    payment_frequency VARCHAR(20) DEFAULT 'monthly', -- daily, weekly, monthly
    grace_period_days INTEGER DEFAULT 3,
    late_fee_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Términos y condiciones
    terms_and_conditions TEXT,
    special_clauses TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items específicos del contrato de renta
CREATE TABLE rental_contract_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    inventory_item_id UUID REFERENCES inventory_items(id), -- Item específico asignado
    
    -- Configuración
    quantity INTEGER NOT NULL,
    unit_rate DECIMAL(15,2) NOT NULL,
    total_rate DECIMAL(15,2) NOT NULL,
    
    -- Fechas específicas del item
    item_start_date DATE NOT NULL,
    item_end_date DATE NOT NULL,
    actual_return_date DATE,
    
    -- Estado del item en el contrato
    status VARCHAR(20) DEFAULT 'active', -- active, returned, damaged, lost, extended
    
    -- Ubicación
    delivery_location VARCHAR(255),
    pickup_location VARCHAR(255),
    
    -- Evaluación al retorno
    return_condition VARCHAR(20), -- good, fair, damaged, lost
    damage_description TEXT,
    damage_cost DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. FACTURACIÓN DE RENTAS
-- =====================================================

-- Extender tabla de facturas para incluir rentas
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'service';
-- invoice_type: service, rental, sale, mixed

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES rental_contracts(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_start DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_end DATE;

-- =====================================================
-- 5. ENTREGAS Y LOGÍSTICA
-- =====================================================

-- Programación de entregas
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_number VARCHAR(50) UNIQUE NOT NULL,
    contract_id UUID REFERENCES rental_contracts(id),
    quotation_id UUID REFERENCES quotations(id), -- Para ventas directas
    
    -- Tipo de entrega
    delivery_type VARCHAR(20) NOT NULL, -- delivery, pickup, both
    
    -- Fechas
    scheduled_date DATE NOT NULL,
    scheduled_time_start TIME,
    scheduled_time_end TIME,
    actual_date DATE,
    actual_time TIME,
    
    -- Ubicaciones
    origin_location_id UUID REFERENCES locations(id),
    destination_address TEXT NOT NULL,
    destination_city VARCHAR(100),
    destination_state VARCHAR(100),
    destination_postal_code VARCHAR(20),
    
    -- Contacto en destino
    contact_name VARCHAR(255),
    contact_phone VARCHAR(20),
    special_instructions TEXT,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'scheduled',
    -- scheduled, in_transit, delivered, failed, cancelled
    
    -- Costo y vehículo
    delivery_cost DECIMAL(15,2),
    vehicle_type VARCHAR(100),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    
    -- Evidencias
    delivery_notes TEXT,
    signature_url TEXT,
    photos JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items específicos de cada entrega
CREATE TABLE delivery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    
    -- Estado del item en la entrega
    planned_quantity INTEGER NOT NULL,
    delivered_quantity INTEGER DEFAULT 0,
    condition_on_delivery VARCHAR(20) DEFAULT 'good',
    
    -- Notas específicas del item
    item_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. MANTENIMIENTO Y OPERACIONES
-- =====================================================

-- Órdenes de mantenimiento
CREATE TABLE maintenance_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    
    -- Tipo de mantenimiento
    maintenance_type VARCHAR(30) NOT NULL,
    -- preventive, corrective, inspection, cleaning, repair
    
    -- Fechas
    scheduled_date DATE NOT NULL,
    started_date DATE,
    completed_date DATE,
    
    -- Responsables
    assigned_technician VARCHAR(255),
    supervisor VARCHAR(255),
    
    -- Estado
    status VARCHAR(20) DEFAULT 'scheduled',
    -- scheduled, in_progress, completed, cancelled, postponed
    
    -- Detalles
    description TEXT NOT NULL,
    work_performed TEXT,
    parts_used JSONB DEFAULT '[]',
    labor_hours DECIMAL(5,2) DEFAULT 0,
    material_cost DECIMAL(15,2) DEFAULT 0,
    labor_cost DECIMAL(15,2) DEFAULT 0,
    total_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Resultado
    next_maintenance_date DATE,
    condition_after VARCHAR(20), -- excellent, good, fair, poor
    recommendations TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. REPORTES Y ANÁLISIS
-- =====================================================

-- Vista consolidada de inventario
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    pc.name AS category_name,
    l.name AS location_name,
    COUNT(ii.id) AS total_items,
    COUNT(ii.id) FILTER (WHERE ii.status = 'available') AS available_items,
    COUNT(ii.id) FILTER (WHERE ii.status = 'rented') AS rented_items,
    COUNT(ii.id) FILTER (WHERE ii.status = 'maintenance') AS maintenance_items,
    SUM(ii.current_value) AS total_value,
    AVG(ii.current_value) AS avg_value,
    p.daily_rental_rate,
    p.monthly_rental_rate,
    p.sale_price
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN inventory_items ii ON p.id = ii.product_id
LEFT JOIN locations l ON ii.location_id = l.id
GROUP BY p.id, p.sku, p.name, pc.name, l.name, p.daily_rental_rate, p.monthly_rental_rate, p.sale_price;

-- Vista de contratos activos
CREATE OR REPLACE VIEW active_rentals AS
SELECT 
    rc.id AS contract_id,
    rc.contract_number,
    c.company_name AS client_name,
    rc.start_date,
    rc.end_date,
    rc.status,
    rc.total_amount,
    COUNT(rci.id) AS total_items,
    COUNT(rci.id) FILTER (WHERE rci.status = 'active') AS active_items,
    COUNT(rci.id) FILTER (WHERE rci.status = 'returned') AS returned_items,
    SUM(rci.total_rate) AS monthly_revenue
FROM rental_contracts rc
JOIN clients c ON rc.client_id = c.id
LEFT JOIN rental_contract_items rci ON rc.id = rci.contract_id
WHERE rc.status = 'active'
GROUP BY rc.id, rc.contract_number, c.company_name, rc.start_date, rc.end_date, rc.status, rc.total_amount;

-- =====================================================
-- 8. ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices principales para productos e inventario
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status_condition ON products(status, condition_good);

CREATE INDEX idx_inventory_items_product ON inventory_items(product_id);
CREATE INDEX idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);
CREATE INDEX idx_inventory_items_serial ON inventory_items(serial_number);

-- Índices para cotizaciones y contratos
CREATE INDEX idx_quotation_rental_items_quotation ON quotation_rental_items(quotation_id);
CREATE INDEX idx_quotation_rental_items_product ON quotation_rental_items(product_id);
CREATE INDEX idx_quotation_rental_items_dates ON quotation_rental_items(start_date, end_date);

CREATE INDEX idx_rental_contracts_client ON rental_contracts(client_id);
CREATE INDEX idx_rental_contracts_status ON rental_contracts(status);
CREATE INDEX idx_rental_contracts_dates ON rental_contracts(start_date, end_date);

-- Índices para entregas y mantenimiento
CREATE INDEX idx_deliveries_status_date ON deliveries(status, scheduled_date);
CREATE INDEX idx_maintenance_orders_item ON maintenance_orders(inventory_item_id);
CREATE INDEX idx_maintenance_orders_status ON maintenance_orders(status);

-- =====================================================
-- 9. TRIGGERS Y FUNCIONES
-- =====================================================

-- Función para actualizar stock de productos
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products SET
        total_stock = (
            SELECT COUNT(*) FROM inventory_items 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        ),
        available_stock = (
            SELECT COUNT(*) FROM inventory_items 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
            AND status = 'available'
        ),
        rented_stock = (
            SELECT COUNT(*) FROM inventory_items 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
            AND status = 'rented'
        ),
        maintenance_stock = (
            SELECT COUNT(*) FROM inventory_items 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
            AND status = 'maintenance'
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock automáticamente
CREATE TRIGGER update_product_stock_trigger
    AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- Función para generar números de contrato
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    sequence_record RECORD;
    new_number INTEGER;
    formatted_number VARCHAR(50);
BEGIN
    SELECT * INTO sequence_record 
    FROM number_sequences 
    WHERE sequence_type = 'contract' AND year = current_year;
    
    IF NOT FOUND THEN
        INSERT INTO number_sequences (sequence_type, prefix, current_number, year, format)
        VALUES ('contract', 'CONT', 1, current_year, 'CONT-{YYYY}-{000000}')
        RETURNING * INTO sequence_record;
        new_number := 1;
    ELSE
        new_number := sequence_record.current_number + 1;
        UPDATE number_sequences 
        SET current_number = new_number 
        WHERE id = sequence_record.id;
    END IF;
    
    formatted_number := REPLACE(
        REPLACE(sequence_record.format, '{YYYY}', current_year::TEXT),
        '{000000}', LPAD(new_number::TEXT, 6, '0')
    );
    
    NEW.contract_number := formatted_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_contract_number_trigger
    BEFORE INSERT ON rental_contracts
    FOR EACH ROW EXECUTE FUNCTION generate_contract_number();

-- =====================================================
-- 10. DATOS INICIALES
-- =====================================================

-- Insertar categorías por defecto
INSERT INTO product_categories (name, description, icon) VALUES
('Andamios', 'Sistemas de andamiaje y estructuras temporales', 'scaffold'),
('Herramientas Eléctricas', 'Herramientas de construcción eléctricas', 'zap'),
('Herramientas Manuales', 'Herramientas de mano y equipos manuales', 'wrench'),
('Equipos de Seguridad', 'Equipos de protección personal y seguridad', 'shield'),
('Maquinaria Pesada', 'Equipos y maquinaria de construcción pesada', 'truck'),
('Accesorios', 'Complementos y accesorios para equipos', 'package');

-- Insertar ubicación principal
INSERT INTO locations (name, code, address, city, state, postal_code, phone, manager_name, is_main_warehouse) VALUES
('Almacén Principal', 'MAIN-BOG', 'Calle 100 #50-25', 'Bogotá', 'Cundinamarca', '110111', '(1) 234-5678', 'Carlos Rodríguez', true);

-- Configuraciones del sistema para arrendamiento
INSERT INTO system_settings (setting_key, setting_value, data_type, description, is_public) VALUES
('rental_default_delivery_cost', '50000', 'number', 'Costo por defecto de entrega de rentas', true),
('rental_min_period_days', '1', 'number', 'Período mínimo de renta en días', true),
('rental_max_period_days', '365', 'number', 'Período máximo de renta en días', true),
('rental_late_fee_percentage', '2', 'number', 'Porcentaje de mora por día de retraso', true),
('maintenance_interval_default', '90', 'number', 'Intervalo por defecto de mantenimiento en días', true),
('security_deposit_percentage', '20', 'number', 'Porcentaje del total como depósito de garantía', true);

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

/*
CARACTERÍSTICAS DEL ESQUEMA DE ARRENDAMIENTO:

1. GESTIÓN COMPLETA DE INVENTARIO:
   - Productos con múltiples precios (venta/renta)
   - Items individuales con seguimiento completo
   - Control de stock en tiempo real
   - Múltiples ubicaciones/almacenes

2. COTIZACIONES FLEXIBLES:
   - Soporte para renta, venta y servicios en una misma cotización
   - Configuración detallada de períodos de renta
   - Accesorios y complementos
   - Costos de entrega y logística

3. CONTRATOS DE RENTA:
   - Generación automática desde cotizaciones
   - Seguimiento de items específicos
   - Facturación periódica
   - Control de devoluciones y estado

4. LOGÍSTICA INTEGRADA:
   - Programación de entregas
   - Seguimiento de vehículos y conductores
   - Evidencias fotográficas y firmas
   - Costos de transporte

5. MANTENIMIENTO PREVENTIVO:
   - Órdenes de trabajo automatizadas
   - Seguimiento de costos de mantenimiento
   - Programación basada en uso y tiempo
   - Historial completo por item

6. REPORTES Y ANÁLISIS:
   - Vistas consolidadas de inventario
   - Análisis de rentabilidad por producto
   - Seguimiento de contratos activos
   - Métricas de utilización de equipos

7. ESCALABILIDAD:
   - Diseño preparado para múltiples ubicaciones
   - Soporte para diferentes tipos de negocio
   - Integración con sistemas existentes
   - APIs ready para integraciones futuras

El esquema mantiene compatibilidad con el sistema existente de servicios
y permite una migración gradual hacia el ERP completo de arrendamiento.
*/