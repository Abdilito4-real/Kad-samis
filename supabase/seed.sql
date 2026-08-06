-- Seed data for KAD-SAMIS
-- This script populates the database with realistic sample data

-- Insert Ministries (5)
INSERT INTO ministries (name, code, description, headquarters_address, phone, email, website) VALUES
('Ministry of Education', 'MOE', 'Education sector management', 'KDN-001, Kaduna', '+234-062-234567', 'info@education.kg.gov.ng', 'https://education.kg.gov.ng'),
('Ministry of Health', 'MOH', 'Health sector management', 'KDN-002, Kaduna', '+234-062-234568', 'info@health.kg.gov.ng', 'https://health.kg.gov.ng'),
('Ministry of Works', 'MOW', 'Infrastructure and works', 'KDN-003, Kaduna', '+234-062-234569', 'info@works.kg.gov.ng', 'https://works.kg.gov.ng'),
('Ministry of Agriculture', 'MOA', 'Agriculture development', 'KDN-004, Kaduna', '+234-062-234570', 'info@agriculture.kg.gov.ng', 'https://agriculture.kg.gov.ng'),
('Ministry of Water Resources', 'MOWR', 'Water supply and management', 'KDN-005, Kaduna', '+234-062-234571', 'info@water.kg.gov.ng', 'https://water.kg.gov.ng');

-- Insert Departments (15)
INSERT INTO departments (ministry_id, name, code, description, location, phone, email) 
SELECT m.id, 'Curriculum Planning', 'EDU-001', 'Curriculum development and planning', 'Kaduna', '+234-062-300001', 'curriculum@education.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOE'
UNION ALL
SELECT m.id, 'Teacher Development', 'EDU-002', 'Teacher training and development', 'Kaduna', '+234-062-300002', 'training@education.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOE'
UNION ALL
SELECT m.id, 'Quality Assurance', 'EDU-003', 'Quality assurance in education', 'Kaduna', '+234-062-300003', 'qa@education.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOE'
UNION ALL
SELECT m.id, 'Public Health', 'HLT-001', 'Public health initiatives', 'Kaduna', '+234-062-300004', 'public@health.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOH'
UNION ALL
SELECT m.id, 'Hospital Services', 'HLT-002', 'Hospital management services', 'Kaduna', '+234-062-300005', 'hospitals@health.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOH'
UNION ALL
SELECT m.id, 'Disease Control', 'HLT-003', 'Disease prevention and control', 'Kaduna', '+234-062-300006', 'disease@health.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOH'
UNION ALL
SELECT m.id, 'Road Infrastructure', 'WRK-001', 'Road construction and maintenance', 'Kaduna', '+234-062-300007', 'roads@works.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOW'
UNION ALL
SELECT m.id, 'Building Services', 'WRK-002', 'Building construction and maintenance', 'Kaduna', '+234-062-300008', 'buildings@works.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOW'
UNION ALL
SELECT m.id, 'Maintenance Division', 'WRK-003', 'Infrastructure maintenance', 'Kaduna', '+234-062-300009', 'maintenance@works.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOW'
UNION ALL
SELECT m.id, 'Crop Production', 'AGR-001', 'Crop production programs', 'Kaduna', '+234-062-300010', 'crops@agriculture.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOA'
UNION ALL
SELECT m.id, 'Livestock Services', 'AGR-002', 'Livestock development', 'Kaduna', '+234-062-300011', 'livestock@agriculture.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOA'
UNION ALL
SELECT m.id, 'Extension Services', 'AGR-003', 'Agricultural extension services', 'Kaduna', '+234-062-300012', 'extension@agriculture.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOA'
UNION ALL
SELECT m.id, 'Water Supply', 'WTR-001', 'Water supply services', 'Kaduna', '+234-062-300013', 'supply@water.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOWR'
UNION ALL
SELECT m.id, 'Water Treatment', 'WTR-002', 'Water treatment operations', 'Kaduna', '+234-062-300014', 'treatment@water.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOWR'
UNION ALL
SELECT m.id, 'Infrastructure', 'WTR-003', 'Water infrastructure management', 'Kaduna', '+234-062-300015', 'infra@water.kg.gov.ng'
FROM ministries m WHERE m.code = 'MOWR';

-- Insert Facilities (8)
INSERT INTO facilities (name, code, address, latitude, longitude, lga, ministry_id, facility_type, total_floors, constructed_year) 
SELECT 'Education Ministry Headquarters', 'FAC-001', 'Block A, Ministry Office Complex, Kaduna', 10.5269, 7.4383, 'Kaduna North', m.id, 'Office Building', 4, 2010
FROM ministries m WHERE m.code = 'MOE'
UNION ALL
SELECT 'Central Hospital', 'FAC-002', 'Hospital Road, Kaduna', 10.5200, 7.4400, 'Kaduna South', m.id, 'Hospital', 6, 2005
FROM ministries m WHERE m.code = 'MOH'
UNION ALL
SELECT 'Works Department Building', 'FAC-003', 'Industrial Area, Kaduna', 10.5100, 7.4500, 'Kaduna North', m.id, 'Office Building', 3, 2012
FROM ministries m WHERE m.code = 'MOW'
UNION ALL
SELECT 'Agricultural Research Station', 'FAC-004', 'Kachia Road, Kaduna', 10.4900, 7.4600, 'Kachia', m.id, 'Research Facility', 2, 2015
FROM ministries m WHERE m.code = 'MOA'
UNION ALL
SELECT 'Water Board Headquarters', 'FAC-005', 'Zaria Road, Kaduna', 10.5300, 7.4300, 'Kaduna South', m.id, 'Office Building', 5, 2008
FROM ministries m WHERE m.code = 'MOWR'
UNION ALL
SELECT 'Teacher Training College', 'FAC-006', 'Barnawa Road, Kaduna', 10.5150, 7.4250, 'Kaduna North', m.id, 'Educational Building', 4, 2009
FROM ministries m WHERE m.code = 'MOE'
UNION ALL
SELECT 'Regional Health Clinic', 'FAC-007', 'Murtala Road, Kaduna', 10.5050, 7.4450, 'Kaduna South', m.id, 'Health Facility', 2, 2014
FROM ministries m WHERE m.code = 'MOH'
UNION ALL
SELECT 'Equipment Warehouse', 'FAC-008', 'Industrial Zone, Kaduna', 10.5000, 7.4550, 'Kaduna North', m.id, 'Storage Facility', 1, 2016
FROM ministries m WHERE m.code = 'MOW';

-- Insert Buildings (8+)
INSERT INTO buildings (facility_id, name, code, floors, constructed_date)
SELECT f.id, 'Main Administrative Wing', 'BLD-001', 4, '2010-06-15'
FROM facilities f WHERE f.code = 'FAC-001'
UNION ALL
SELECT f.id, 'Teaching Hospital Block', 'BLD-002', 6, '2005-03-20'
FROM facilities f WHERE f.code = 'FAC-002'
UNION ALL
SELECT f.id, 'Administrative Building', 'BLD-003', 3, '2012-09-10'
FROM facilities f WHERE f.code = 'FAC-003'
UNION ALL
SELECT f.id, 'Research Building', 'BLD-004', 2, '2015-01-25'
FROM facilities f WHERE f.code = 'FAC-004'
UNION ALL
SELECT f.id, 'Head Office Building', 'BLD-005', 5, '2008-04-12'
FROM facilities f WHERE f.code = 'FAC-005'
UNION ALL
SELECT f.id, 'College Main Building', 'BLD-006', 4, '2009-07-30'
FROM facilities f WHERE f.code = 'FAC-006'
UNION ALL
SELECT f.id, 'Clinic Building', 'BLD-007', 2, '2014-11-08'
FROM facilities f WHERE f.code = 'FAC-007'
UNION ALL
SELECT f.id, 'Warehouse Block', 'BLD-008', 1, '2016-02-18'
FROM facilities f WHERE f.code = 'FAC-008';

-- Note: Seed data continues with assets, maintenance records, etc.
-- This is phase 1 of seed data. Phase 2 will include detailed asset records.
