import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { buildAssetImportWorkbook } from '@/lib/assetWorkbook';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function getRequestContext(req: Request) {
  const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());
  const ctx = await getProfile(supabase, req);
  return { supabase, ctx };
}

export async function GET(req: Request) {
  try {
    const { supabase, ctx } = await getRequestContext(req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const database = serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : supabase;
    const { data: categories, error: categoryError } = await database
      .from('asset_categories')
      .select('name')
      .order('name');

    if (categoryError) {
      console.error('Asset template category lookup failed', categoryError);
      return NextResponse.json({ error: 'Unable to load asset categories' }, { status: 500 });
    }
    if (!categories?.length) {
      return NextResponse.json({ error: 'No asset categories are configured' }, { status: 400 });
    }

    const buffer = await buildAssetImportWorkbook(categories.map((category: { name: string }) => category.name));
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': EXCEL_MIME,
        'Content-Disposition': 'attachment; filename="assets-import-template.xlsx"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Asset template generation failed', error);
    return NextResponse.json({ error: 'Unable to prepare the Excel template' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { ctx } = await getRequestContext(req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Upload an .xlsx workbook' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Workbook must be 10 MB or smaller' }, { status: 413 });
    }

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return NextResponse.json({ records: [] });

    const cellToString = (value: import('exceljs').CellValue): string => {
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object') {
        if ('richText' in value) return value.richText.map((item) => item.text).join('');
        if ('text' in value) return String(value.text ?? '');
        if ('result' in value) return String(value.result ?? '');
      }
      return String(value).trim();
    };

    let headers: string[] = [];
    const records: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      const values = (row.values as import('exceljs').CellValue[]).slice(1).map(cellToString);
      if (rowNumber === 1) {
        headers = values.map((header) => header.trim());
        return;
      }
      if (values.every((value) => value.trim().length === 0)) return;
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = (values[index] ?? '').trim();
      });
      records.push(record);
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Asset workbook parsing failed', error);
    return NextResponse.json({ error: 'Unable to read the Excel workbook' }, { status: 400 });
  }
}
