// App roles, mapped from the role names the API puts in the login token
// (SuperAdmin, Admin, Manager, Captain, Chef / "Cheif", Cashier, Waiter, Kitchen Staff).
export type AppRole = 'owner' | 'admin' | 'manager' | 'captain' | 'chef' | 'cashier';

export type TabId = 'dashboard' | 'tables' | 'tokens' | 'kot' | 'pickup' | 'orders' | 'more';

export interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

export const ALL_TABS: TabDef[] = [
  { id: 'dashboard', label: 'Sales', icon: 'stats-chart-outline' },
  { id: 'tables', label: 'Tables', icon: 'grid-outline' },
  { id: 'tokens', label: 'Tokens', icon: 'ticket-outline' },
  { id: 'kot', label: 'Kitchen', icon: 'flame-outline' },
  { id: 'pickup', label: 'Captain', icon: 'hand-left-outline' },
  { id: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { id: 'more', label: 'More', icon: 'person-circle-outline' },
];

// Tabs per role. Kept to what the API allows each role (e.g. Waitlist / Tables are
// Manager, Admin, SuperAdmin, Captain; the KOT list is Admin, SuperAdmin, Chef, Captain).
export const ROLE_TABS: Record<AppRole, TabId[]> = {
  owner: ['dashboard', 'tables', 'tokens', 'kot', 'orders', 'more'],
  admin: ['dashboard', 'tables', 'tokens', 'kot', 'orders', 'more'],
  manager: ['tables', 'tokens', 'more'],
  captain: ['tables', 'tokens', 'pickup', 'orders', 'more'],
  chef: ['kot', 'more'],
  cashier: ['tables', 'more'],
};

export const ROLE_HOME: Record<AppRole, TabId> = {
  owner: 'dashboard',
  admin: 'dashboard',
  manager: 'tokens',
  captain: 'tables',
  chef: 'kot',
  cashier: 'tables',
};

export function normalizeRole(role: string | null | undefined): AppRole {
  const r = String(role ?? '').replace(/\s+/g, '').toLowerCase();
  switch (r) {
    case 'superadmin': return 'owner';
    case 'admin': return 'admin';
    case 'manager': return 'manager';
    case 'captain':
    case 'captian':
    case 'waiter': return 'captain';
    case 'chef':
    case 'cheif':
    case 'kitchenstaff': return 'chef';
    default: return 'cashier';
  }
}

export function roleLabel(role: string | null | undefined): string {
  const r = String(role ?? '').trim();
  return r.toLowerCase() === 'cheif' ? 'Chef' : r || 'User';
}
