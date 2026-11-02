-- Ensure the default categories are present so asset imports can resolve
-- spreadsheet category names to asset_categories rows.
INSERT INTO asset_categories (name, code, description, depreciation_rate)
VALUES
  ('ICT Equipment', 'ICT', 'Computers, printers, network devices and related ICT equipment', 10.00),
  ('Office Furniture', 'FURN', 'Desks, chairs, cabinets and office furniture', 8.00),
  ('Vehicles', 'VEH', 'Government vehicles and transport assets', 15.00),
  ('Medical Equipment', 'MED', 'Medical and clinical equipment', 12.00),
  ('Building Infrastructure', 'BLD', 'Structural and building infrastructure assets', 5.00)
ON CONFLICT (code) DO NOTHING;
