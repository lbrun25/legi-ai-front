import {type NextRequest, NextResponse} from 'next/server'
import {updateSession} from "@/lib/supabase/middleware";
import {createClient} from "@/lib/supabase/client/server";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/settings')) {
    const supabase = createClient()
    const {data: authData, error: authError} = await supabase.auth.getUser();
    if (authError) throw authError;
    if (authData?.user?.app_metadata?.role !== "super-admin")
      return NextResponse.rewrite(new URL('/unauthorized', request.url))
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
