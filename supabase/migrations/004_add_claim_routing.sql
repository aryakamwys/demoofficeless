-- Add specific manager and hr routing to claims
ALTER TABLE claims
ADD COLUMN manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
ADD COLUMN hr_id UUID REFERENCES employees(id) ON DELETE SET NULL;
