"use client";

import { v4 as uuidv4 } from 'uuid';

export function seedDemoData() {
  if (typeof window === 'undefined') return;

  const key = 'kadsamis-demo-orgs';
  if (localStorage.getItem(key)) return;

  const now = new Date().toISOString();

  const orgs = [
    {
      id: uuidv4(),
      name: 'Ministry of Works',
      organization_type: 'MINISTRY',
      email: 'works@kd.gov.ng',
      phone: '0801-000-0001',
      address: 'State Secretariat',
      created_at: now,
      profiles: [
        { id: uuidv4(), email: 'john.ibrahim@kd.gov.ng', role: 'ministry_admin' },
      ],
    },
    {
      id: uuidv4(),
      name: 'Department of Transportation',
      organization_type: 'DEPARTMENT',
      email: 'transport@kd.gov.ng',
      phone: '0801-000-0002',
      address: 'Transport House',
      created_at: now,
      profiles: [
        { id: uuidv4(), email: 'grace.al@kd.gov.ng', role: 'department_admin' },
      ],
    },
    {
      id: uuidv4(),
      name: 'Kaduna Water Agency',
      organization_type: 'AGENCY',
      email: 'water@kd.gov.ng',
      phone: '0801-000-0003',
      address: 'Water Complex',
      created_at: now,
      profiles: [
        { id: uuidv4(), email: 'musa.bala@kd.gov.ng', role: 'agency_admin' },
      ],
    },
  ];

  localStorage.setItem(key, JSON.stringify(orgs));
}

export function readDemoData() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('kadsamis-demo-orgs');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
