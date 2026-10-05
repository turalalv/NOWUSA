import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import db from '../db.server';
import { runDaily } from '../lib/daily.server.mjs';
import {unauthenticated} from '../shopify.server';

export const config = { maxDuration: 600 };
// Vercel Cron uses GET; existing external schedulers can keep using POST.
export const loader = ({ request }: LoaderFunctionArgs) => runDaily(request, db, undefined, unauthenticated.admin);
export const action = ({ request }: ActionFunctionArgs) => runDaily(request, db, undefined, unauthenticated.admin);
