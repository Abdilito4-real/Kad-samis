-- The bootstrap script (003_complete_project_init.sql) already defines this
-- same seed list, but it never landed on this database — asset_categories
-- came back empty, which blocks the CSV import flow entirely (every row
-- needs a category to resolve against). Re-applying it here, idempotently,
-- so it's safe to run regardless of what's already present.
INSERT INTO asset_categories (name, code, description, depreciation_rate)
VALUES
  ('ICT Equipment', 'ICT', 'Computers, printers, network devices and related ICT equipment', 10.00),
  ('Office Furniture', 'FURN', 'Desks, chairs, cabinets and office furniture', 8.00),
  ('Vehicles', 'VEH', 'Government vehicles and transport assets', 15.00),
  ('Medical Equipment', 'MED', 'Medical and clinical equipment', 12.00),
  ('Building Infrastructure', 'BLD', 'Structural and building infrastructure assets', 5.00)
ON CONFLICT (code) DO NOTHING;
