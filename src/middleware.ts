import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/admin\/organizations\/([^/]+)\/statistics\/?$/);

  if (match) {
    const [, id] = match;
    const url = request.nextUrl.clone();
    url.pathname = `/admin/organizations/${id}`;
    url.searchParams.set('tab', 'statistics');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/organizations/:path*/statistics'],
};
