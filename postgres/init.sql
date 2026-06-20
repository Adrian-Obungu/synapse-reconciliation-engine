CREATE TABLE IF NOT EXISTS ledger_audit (
    id SERIAL PRIMARY KEY,
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    invoice_number VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    transaction_date VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    sender_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_audit_transaction_reference ON ledger_audit(transaction_reference);
CREATE INDEX idx_ledger_audit_invoice_number ON ledger_audit(invoice_number);
