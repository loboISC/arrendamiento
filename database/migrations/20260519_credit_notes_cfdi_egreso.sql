-- Migracion del modulo de notas de credito CFDI 4.0.
-- Mantiene id UUID para la nota y agrega id_factura_origen para compatibilidad con facturas.id_factura actual.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NULL,
  id_factura_origen INTEGER NULL REFERENCES facturas(id_factura),
  customer_id INTEGER NULL REFERENCES clientes(id_cliente),
  uuid TEXT NULL,
  folio TEXT NULL,
  relation_type VARCHAR(5) NOT NULL DEFAULT '01',
  reason TEXT NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance_applied NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  sat_status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  provider VARCHAR(30) NOT NULL DEFAULT 'facturama',
  branch_id INTEGER NULL,
  created_by INTEGER NULL,
  updated_by INTEGER NULL,
  stamped_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT credit_notes_status_chk CHECK (status IN ('BORRADOR','TIMBRANDO','TIMBRADA','ERROR','CANCELADA','APLICADA','PARCIAL')),
  CONSTRAINT credit_notes_total_chk CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id INTEGER NULL,
  quantity NUMERIC(14, 6) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14, 6) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sat_product_key VARCHAR(20) NOT NULL DEFAULT '01010101',
  sat_unit_key VARCHAR(20) NOT NULL DEFAULT 'H87',
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_note_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  invoice_uuid TEXT NOT NULL,
  relation_type VARCHAR(5) NOT NULL DEFAULT '01',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_note_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NULL REFERENCES credit_notes(id) ON DELETE SET NULL,
  event VARCHAR(80) NOT NULL,
  request_sat JSONB NULL,
  response_sat JSONB NULL,
  error JSONB NULL,
  user_id INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_factura_origen ON credit_notes(id_factura_origen);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_uuid ON credit_notes(uuid);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_note ON credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_relations_note ON credit_note_relations(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_logs_note ON credit_note_logs(credit_note_id);
