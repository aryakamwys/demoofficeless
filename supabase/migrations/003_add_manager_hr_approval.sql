-- Add role and relations to employees
ALTER TABLE employees 
ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR')),
ADD COLUMN manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
ADD COLUMN hr_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Add manager and hr status to claims
ALTER TABLE claims
ADD COLUMN manager_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (manager_status IN ('PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN hr_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (hr_status IN ('PENDING', 'APPROVED', 'REJECTED'));
