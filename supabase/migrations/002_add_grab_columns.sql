-- Add missing grab columns to trips table
ALTER TABLE trips
  ADD COLUMN service_type VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN employee_group VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN cost_code VARCHAR(255) NOT NULL DEFAULT '';
