CREATE TABLE IF NOT EXISTS managed_service_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id VARCHAR NOT NULL,
  ticket_title VARCHAR,
  customer_name VARCHAR,
  location VARCHAR,
  amount NUMERIC NOT NULL,
  file_url VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
