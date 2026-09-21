import test from 'node:test';
import assert from 'node:assert/strict';
import {canManageGoogle} from '../app/lib/google-permissions.server.mjs';

const session = {shop:'example.myshopify.com',isOnline:true,onlineAccessInfo:{associated_user:{id:123,account_owner:false}}};
test('only the owner or an explicitly delegated online user can manage Google',()=>{
  assert.equal(canManageGoogle(session,''),false);
  assert.equal(canManageGoogle(session,' example.myshopify.com:123,other.myshopify.com:456 '),true);
  assert.equal(canManageGoogle(session,'other.myshopify.com:123'),false);
  assert.equal(canManageGoogle(session,'example.myshopify.com:1234'),false);
  assert.equal(canManageGoogle({...session,isOnline:false},'example.myshopify.com:123'),false);
  assert.equal(canManageGoogle({...session,onlineAccessInfo:undefined},'example.myshopify.com:123'),false);
  assert.equal(canManageGoogle({...session,onlineAccessInfo:{associated_user:{id:123,account_owner:true}}},''),true);
});
