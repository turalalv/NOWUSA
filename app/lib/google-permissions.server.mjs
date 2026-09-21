// Call only after authenticate.admin and assertAllowedShop. Entries are shop:userId.
export function canManageGoogle(session, delegates = process.env.GOOGLE_MANAGER_USERS || '') {
  const user = session?.onlineAccessInfo?.associated_user;
  if (!session?.isOnline || !user || !/^\d+$/.test(String(user.id))) return false;
  if (user.account_owner === true) return true;
  return delegates.split(',').map(entry => entry.trim()).includes(`${session.shop}:${user.id}`);
}
