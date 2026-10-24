import { handleAccountRequest } from '@/lib/accounts/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleAccountRequest(request);
