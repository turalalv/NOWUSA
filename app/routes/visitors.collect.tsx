import type {ActionFunctionArgs,LoaderFunctionArgs} from 'react-router';
import db from '../db.server';
import {collectVisitor} from '../lib/visitors.server.mjs';
export const action=({request}:ActionFunctionArgs)=>collectVisitor(request,db);
export const loader=({request}:LoaderFunctionArgs)=>collectVisitor(request,db);
