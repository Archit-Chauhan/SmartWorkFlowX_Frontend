import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import UserManagement from '../features/auth/UserManagement';
import axiosInstance from '../api/axiosInstance';
import type { AdminUser, AdminUsersResponse } from '../models';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// The signed-in Admin is Alice.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'Alice@Example.com' }, role: 'Admin', isAuthenticated: true }),
}));

const ROLES = [
  { roleId: 1, roleName: 'Admin' },
  { roleId: 2, roleName: 'Manager' },
  { roleId: 3, roleName: 'Employee' },
  { roleId: 4, roleName: 'Auditor' },
  { roleId: 5, roleName: 'Contractor' },
];

const user = (over: Partial<AdminUser> & Pick<AdminUser, 'userId' | 'name' | 'email' | 'roleId' | 'roleName'>): AdminUser => ({
  createdAt: '2026-03-04T10:00:00Z', isDeleted: false, deletedAt: null, openTaskCount: 0, ...over,
});

const ROWS: AdminUser[] = [
  user({ userId: 1, name: 'Alice Smith', email: 'alice@example.com', roleId: 1, roleName: 'Admin', openTaskCount: 2 }),
  user({ userId: 2, name: 'Bob Jones', email: 'bob@example.com', roleId: 3, roleName: 'Employee', openTaskCount: 3 }),
  user({ userId: 3, name: 'Carol Lee', email: 'carol@example.com', roleId: 2, roleName: 'Manager', isDeleted: true, openTaskCount: 1 }),
  user({ userId: 4, name: 'Dan Patel', email: 'dan@example.com', roleId: 1, roleName: 'Admin', openTaskCount: 0 }),
  user({ userId: 5, name: 'Eve Torres', email: 'eve@example.com', roleId: 5, roleName: 'Contractor' }),
];

const COUNTS = { all: 23, active: 20, deactivated: 3 };
const respond = (rows: AdminUser[] = ROWS, extra: Partial<AdminUsersResponse> = {}): AdminUsersResponse =>
  ({ data: rows, total: 23, page: 1, pageSize: 10, counts: COUNTS, ...extra });

type Params = Record<string, string | number>;
let listHandler: (params: Params) => Promise<{ data: AdminUsersResponse }>;
let activeAdmins = 2;

const Where: React.FC = () => <span data-testid="where">{useLocation().search}</span>;

const renderScreen = async (search = '') => {
  render(<MemoryRouter initialEntries={[`/users${search}`]}><UserManagement /><Where /></MemoryRouter>);
  await screen.findByText('Bob Jones');
};

const get = () => vi.mocked(axiosInstance.get);
/** Calls that load the table (the small "how many active Admins" check uses limit 1). */
const listCalls = () => get().mock.calls.filter(([url, cfg]) => url === '/Admin/users' && (cfg as { params: Params }).params.limit === 10);
const lastParams = () => (listCalls().at(-1)![1] as { params: Params }).params;

const manage = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Manage ${name}` }));
  return screen.findByRole('dialog', { name: new RegExp(name) });
};

const apiError = (status: number, message: string) => Object.assign(new Error(message), { response: { status, data: { message } } });

beforeEach(() => {
  vi.clearAllMocks();
  activeAdmins = 2;
  listHandler = async () => ({ data: respond() });
  get().mockImplementation(async (url: string, config?: unknown) => {
    const params = ((config as { params?: Params })?.params ?? {}) as Params;
    if (url === '/Admin/roles') return { data: ROLES };
    if (url === '/Admin/users' && params.limit === 1) return { data: respond([], { total: activeAdmins }) };
    if (url === '/Admin/users') return listHandler(params);
    return { data: [] };
  });
  vi.mocked(axiosInstance.post).mockResolvedValue({ data: { message: 'ok', userId: 99 } });
  vi.mocked(axiosInstance.put).mockResolvedValue({ data: { message: 'ok' } });
  vi.mocked(axiosInstance.delete).mockResolvedValue({ data: { message: 'ok' } });
});

describe('UserManagement (table)', () => {
  it('TC-U01: shows a loading line, then the rows the server sent', async () => {
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
    expect(screen.getByText('Manage Users')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading users...');

    await screen.findByText('Bob Jones');
    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(within(table).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(table).getByText('Contractor')).toBeInTheDocument();
    expect(within(table).getAllByText('Deactivated')).toHaveLength(1);
    expect(within(table).getAllByText('Active')).toHaveLength(ROWS.length - 1);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1-10 of 23 users');

    expect(listCalls()).toHaveLength(1);
    expect(lastParams()).toEqual({ page: 1, limit: 10, status: 'all', sort: 'name', dir: 'asc' });
  });

  it('TC-U02: header counts come from the server, not from the visible rows', async () => {
    await renderScreen();
    const group = screen.getByRole('group', { name: 'Filter by status' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['All23', 'Active20', 'Deactivated3']);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('TC-U03: status chips, role select and search send the right params and go back to page 1', async () => {
    await renderScreen('?page=2');
    expect(lastParams().page).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /^Deactivated/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ status: 'deactivated', page: 1 }));
    expect(screen.getByTestId('where')).toHaveTextContent('?status=deactivated');
    expect(screen.getByRole('button', { name: /^Deactivated/ })).toHaveAttribute('aria-pressed', 'true');

    const roleSelect = screen.getByLabelText('Filter by role');
    expect(within(roleSelect).getAllByRole('option').map((o) => o.textContent)).toEqual(['Role: any', 'Admin', 'Manager', 'Employee', 'Auditor', 'Contractor']);
    fireEvent.change(roleSelect, { target: { value: '2' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ status: 'deactivated', roleId: 2 }));

    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'bob' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ search: 'bob', roleId: 2, status: 'deactivated', page: 1 }));
    expect(screen.getByTestId('where').textContent).toBe('?q=bob&status=deactivated&roleId=2');
  });

  it('TC-U04: search is debounced (one request for a burst of typing)', async () => {
    await renderScreen();
    const before = listCalls().length;
    const box = screen.getByLabelText('Search users');
    fireEvent.change(box, { target: { value: 'b' } });
    fireEvent.change(box, { target: { value: 'bo' } });
    fireEvent.change(box, { target: { value: 'bob' } });
    expect(listCalls().length).toBe(before);
    await waitFor(() => expect(lastParams().search).toBe('bob'));
    expect(listCalls().length).toBe(before + 1);
  });

  it('TC-U05: sortable headers set aria-sort, flip direction and reset the page', async () => {
    await renderScreen('?page=2');
    const nameHeader = screen.getByRole('columnheader', { name: /^User/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /^Role/ })).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(nameHeader).getByRole('button'));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'name', dir: 'desc', page: 1 }));
    expect(screen.getByRole('columnheader', { name: /^User/ })).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(within(screen.getByRole('columnheader', { name: /^Open tasks/ })).getByRole('button'));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'open', dir: 'desc' }));
    expect(screen.getByRole('columnheader', { name: /^Open tasks/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByTestId('where').textContent).toBe('?sort=open&dir=desc');
  });

  it('TC-U06: paging asks the server for the next page and keeps the filters', async () => {
    await renderScreen('?status=active');
    fireEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0]);
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2, status: 'active' }));
    expect(screen.getByTestId('where').textContent).toBe('?status=active&page=2');
  });

  it('TC-U07: URL state is read on load', async () => {
    await renderScreen('?q=ann&status=active&roleId=3&sort=added&dir=desc&page=2');
    expect(lastParams()).toEqual({ page: 2, limit: 10, status: 'active', sort: 'added', dir: 'desc', search: 'ann', roleId: 3 });
    expect(screen.getByLabelText('Search users')).toHaveValue('ann');
  });

  it('TC-U08: error state with Try again, then recovery', async () => {
    listHandler = async () => { throw new Error('down'); };
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load the users.");

    listHandler = async () => ({ data: respond() });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Bob Jones');
  });

  it('TC-U09: empty states: nothing yet, and nothing matching (with Clear filters)', async () => {
    listHandler = async () => ({ data: respond([], { total: 0, counts: { all: 0, active: 0, deactivated: 0 } }) });
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
    expect(await screen.findByText('No users yet')).toBeInTheDocument();
  });

  it('TC-U10: no match with filters offers Clear filters', async () => {
    listHandler = async (p) => ({ data: p.search ? respond([], { total: 0 }) : respond() });
    render(<MemoryRouter initialEntries={['/users?q=zzz']}><UserManagement /><Where /></MemoryRouter>);
    expect(await screen.findByText('No users match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('Bob Jones');
    expect(screen.getByTestId('where').textContent).toBe('');
  });

  it('TC-U11: Export CSV uses the current search, status and role', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = vi.fn();
    get().mockImplementation(async (url: string, config?: unknown) => {
      const params = ((config as { params?: Params })?.params ?? {}) as Params;
      if (url === '/Admin/roles') return { data: ROLES };
      if (url === '/Admin/users/export') return { data: 'csv' };
      if (url === '/Admin/users') return listHandler(params);
      return { data: [] };
    });
    await renderScreen('?q=bob&status=active&roleId=3&page=2');
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(get()).toHaveBeenCalledWith('/Admin/users/export', { params: { search: 'bob', status: 'active', roleId: 3 }, responseType: 'blob' });
  });
});

describe('UserManagement (panel)', () => {
  it('TC-U20: Manage opens the panel with the details; Esc and the scrim close it', async () => {
    await renderScreen();
    const panel = await manage('Bob Jones');
    expect(within(panel).getByText('bob@example.com')).toBeInTheDocument();
    const details = within(panel).getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Employee')).toBeInTheDocument();
    expect(within(details).getByText('3')).toBeInTheDocument();
    expect(within(details).getByText('Active')).toBeInTheDocument();

    fireEvent.keyDown(within(panel).getByRole('button', { name: /close/i }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await manage('Bob Jones');
    fireEvent.mouseDown(document.querySelector('.bg-overlay')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('TC-U21: clicking a row and pressing Enter on a focused row both open the panel', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('Bob Jones'));
    expect(await screen.findByRole('dialog', { name: /Bob Jones/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const row = screen.getByText('Eve Torres').closest('tr')!;
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: /Eve Torres/ })).toBeInTheDocument();
  });

  it('TC-U22: change role: pick a card, confirm, request body, toast and quiet refetch', async () => {
    await renderScreen();
    const panel = await manage('Bob Jones');
    const group = within(panel).getByRole('radiogroup', { name: 'Role' });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    expect(within(group).getByText('Assigns tasks, approves steps, sees the dashboard.')).toBeInTheDocument();
    expect(within(group).getByText(/permissions/)).toBeInTheDocument(); // generic text for the unknown role
    expect(within(group).getByRole('radio', { name: /Employee/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(panel).queryByRole('button', { name: /change role to/i })).not.toBeInTheDocument();

    fireEvent.click(within(group).getByRole('radio', { name: /Manager/ }));
    const before = listCalls().length;
    fireEvent.click(within(panel).getByRole('button', { name: 'Change role to Manager' }));

    const dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('Change Bob Jones');
    expect(dlg).toHaveTextContent('Employee');
    expect(axiosInstance.put).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Yes, change role' }));

    await waitFor(() => expect(axiosInstance.put).toHaveBeenCalledWith('/Admin/users/2/role', { roleId: 2 }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Bob Jones is now Manager.'));
    await waitFor(() => expect(listCalls().length).toBe(before + 1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).not.toHaveClass('opacity-60'); // no dimming on a quiet reload
  });

  it('TC-U23: your own account: role cards are disabled and the reason is shown; Deactivate is aria-disabled', async () => {
    await renderScreen();
    const panel = await manage('Alice Smith');
    expect(within(panel).getByText('(you)')).toBeInTheDocument();
    expect(within(panel).getAllByText('You cannot change your own role.').length).toBeGreaterThan(0);
    const radios = within(panel).getAllByRole('radio');
    radios.forEach((r) => expect(r).toHaveAttribute('aria-disabled', 'true'));

    fireEvent.click(radios[1]);
    expect(within(panel).queryByRole('button', { name: /change role to/i })).not.toBeInTheDocument();

    const deactivate = within(panel).getByRole('button', { name: 'Deactivate user' });
    expect(deactivate).toHaveAttribute('aria-disabled', 'true');
    expect(within(panel).getByText('You cannot deactivate your own account.')).toBeInTheDocument();
    fireEvent.click(deactivate);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.delete).not.toHaveBeenCalled();
  });

  it('TC-U24: the last active Admin (not you) is guarded when the count is exactly one', async () => {
    activeAdmins = 1;
    await renderScreen();
    const panel = await manage('Dan Patel');
    await waitFor(() => expect(within(panel).getByText('The last active Admin cannot be demoted.')).toBeInTheDocument());
    within(panel).getAllByRole('radio').forEach((r) => expect(r).toHaveAttribute('aria-disabled', 'true'));
    expect(within(panel).getByRole('button', { name: 'Deactivate user' })).toHaveAttribute('aria-disabled', 'true');
    expect(get()).toHaveBeenCalledWith('/Admin/users', { params: { page: 1, limit: 1, status: 'active', roleId: 1 } });
  });

  it('TC-U25: with two active Admins the Admin is not guarded by the UI', async () => {
    await renderScreen();
    const panel = await manage('Dan Patel');
    await waitFor(() => expect(get()).toHaveBeenCalledWith('/Admin/users', expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) })));
    within(panel).getAllByRole('radio').forEach((r) => expect(r).not.toHaveAttribute('aria-disabled'));
    expect(within(panel).getByRole('button', { name: 'Deactivate user' })).not.toHaveAttribute('aria-disabled');
  });

  it('TC-U26: a server error on role change appears in the panel banner and nothing is toasted', async () => {
    vi.mocked(axiosInstance.put).mockRejectedValue(apiError(400, 'The last active Admin cannot be demoted. Make someone else an Admin first.'));
    await renderScreen();
    const panel = await manage('Dan Patel');
    fireEvent.click(within(panel).getByRole('radio', { name: /Manager/ }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Change role to Manager' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, change role' }));

    const banner = await within(panel).findByRole('alert');
    expect(banner).toHaveTextContent('The last active Admin cannot be demoted. Make someone else an Admin first.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('TC-U27: Cancel on the role confirmation does not call the API', async () => {
    await renderScreen();
    const panel = await manage('Bob Jones');
    fireEvent.click(within(panel).getByRole('radio', { name: /Auditor/ }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Change role to Auditor' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(axiosInstance.put).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('TC-U30: deactivate: the dialog says how many open tasks stay assigned, confirm calls DELETE', async () => {
    await renderScreen();
    const panel = await manage('Bob Jones');
    fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate user' }));

    const dlg = await screen.findByRole('alertdialog', { name: 'Deactivate Bob Jones?' });
    expect(dlg).toHaveTextContent('3 open tasks stay assigned to them');
    expect(axiosInstance.delete).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Yes, deactivate' }));

    await waitFor(() => expect(axiosInstance.delete).toHaveBeenCalledWith('/Admin/users/2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Bob Jones deactivated.'));
    // The panel flips to the deactivated state without waiting for the refetch.
    expect(await within(panel).findByRole('button', { name: /restore user/i })).toBeInTheDocument();
  });

  it('TC-U31: Cancel on the deactivate dialog does not call the API; a user with no open tasks says so', async () => {
    await renderScreen();
    const panel = await manage('Eve Torres');
    fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate user' }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('They have no open tasks.');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(axiosInstance.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('TC-U32: a server 400 on deactivate lands in the panel banner', async () => {
    vi.mocked(axiosInstance.delete).mockRejectedValue(apiError(400, 'The last active Admin cannot be deactivated. Make someone else an Admin first.'));
    await renderScreen();
    const panel = await manage('Dan Patel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate user' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, deactivate' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('The last active Admin cannot be deactivated.');
  });

  it('TC-U33: restore: confirmation, then PUT .../restore; Cancel does nothing; a 404 shows in the banner', async () => {
    await renderScreen();
    let panel = await manage('Carol Lee');
    expect(within(panel).getByText(/cannot sign in/)).toHaveTextContent('Their 1 open task stays assigned');
    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: /restore user/i }));
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Restore Carol Lee?' })).getByRole('button', { name: 'Cancel' }));
    expect(axiosInstance.put).not.toHaveBeenCalled();

    vi.mocked(axiosInstance.put).mockRejectedValueOnce(apiError(404, 'User not found.'));
    fireEvent.click(within(panel).getByRole('button', { name: /restore user/i }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, restore' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('User not found.');
    expect(axiosInstance.put).toHaveBeenCalledWith('/Admin/users/3/restore');

    fireEvent.click(within(panel).getByRole('button', { name: /restore user/i }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, restore' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Carol Lee restored.'));
    panel = screen.getByRole('dialog');
    expect(await within(panel).findByRole('button', { name: 'Deactivate user' })).toBeInTheDocument();
  });
});

describe('UserManagement (invite)', () => {
  const open = async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    return screen.findByRole('dialog', { name: 'Invite a user' });
  };

  it('TC-U40: the drawer has name, email, role cards (Employee by default) and a temporary password, no e-mail link copy', async () => {
    const drawer = await open();
    expect(within(drawer).getByLabelText(/full name/i)).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/^email/i)).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/temporary password/i)).toBeInTheDocument();
    expect(within(drawer).getByRole('radio', { name: /Employee/ })).toHaveAttribute('aria-checked', 'true');
    expect(drawer.textContent).not.toMatch(/link/i);
  });

  it('TC-U41: Generate fills a strong 12 character password and shows it; the toggle hides and shows it', async () => {
    const drawer = await open();
    const input = within(drawer).getByLabelText(/temporary password/i) as HTMLInputElement;
    expect(input.type).toBe('password');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Generate' }));
    expect(input.value).toHaveLength(12);
    expect(input.value).toMatch(/[a-z]/);
    expect(input.value).toMatch(/[A-Z]/);
    expect(input.value).toMatch(/[0-9]/);
    expect(input.value).toMatch(/[^a-zA-Z0-9]/);
    expect(input.type).toBe('text');

    const first = input.value;
    fireEvent.click(within(drawer).getByRole('button', { name: 'Generate' }));
    expect(input.value).not.toBe(first);

    fireEvent.click(within(drawer).getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
  });

  it('TC-U42: Copy writes to the clipboard and toasts; if it fails it says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const drawer = await open();
    expect(within(drawer).getByRole('button', { name: 'Copy' })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Generate' }));
    const pw = (within(drawer).getByLabelText(/temporary password/i) as HTMLInputElement).value;
    fireEvent.click(within(drawer).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(pw));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Password copied.'));

    writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = vi.fn(() => false);
    fireEvent.click(within(drawer).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('TC-U43: validation messages show inline and focus goes to the first invalid field', async () => {
    const drawer = await open();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create user' }));
    expect(await within(drawer).findByText('Name is required.')).toBeInTheDocument();
    expect(within(drawer).getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(within(drawer).getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/full name/i)).toHaveFocus();
    expect(within(drawer).getByLabelText(/full name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.change(within(drawer).getByLabelText(/full name/i), { target: { value: 'x'.repeat(101) } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create user' }));
    expect(await within(drawer).findByText('Name must be 100 characters or fewer.')).toBeInTheDocument();

    fireEvent.change(within(drawer).getByLabelText(/full name/i), { target: { value: 'Zed' } });
    fireEvent.change(within(drawer).getByLabelText(/^email/i), { target: { value: 'not-an-email' } });
    fireEvent.change(within(drawer).getByLabelText(/temporary password/i), { target: { value: '1234567' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create user' }));
    expect(await within(drawer).findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/^email/i)).toHaveFocus();

    fireEvent.change(within(drawer).getByLabelText(/^email/i), { target: { value: 'zed@example.com' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create user' }));
    expect(await within(drawer).findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/temporary password/i)).toHaveFocus();
  });

  it('TC-U44: submit sends the contract body, closes the drawer, refetches and toasts', async () => {
    const drawer = await open();
    fireEvent.change(within(drawer).getByLabelText(/full name/i), { target: { value: '  Charlie Brown ' } });
    fireEvent.change(within(drawer).getByLabelText(/^email/i), { target: { value: 'Charlie@Example.com' } });
    fireEvent.change(within(drawer).getByLabelText(/temporary password/i), { target: { value: 'password123' } });
    fireEvent.click(within(drawer).getByRole('radio', { name: /Manager/ }));
    const before = listCalls().length;
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/Admin/users', {
      name: 'Charlie Brown', email: 'charlie@example.com', password: 'password123', roleId: 2,
    }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Invitation created for charlie@example.com.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls().length).toBe(before + 1));
  });

  it('TC-U45: a server 400 is shown in a banner inside the drawer, which stays open', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValue(apiError(400, 'A deactivated user with this email already exists. Restore them instead.'));
    const drawer = await open();
    fireEvent.change(within(drawer).getByLabelText(/full name/i), { target: { value: 'Carol Lee' } });
    fireEvent.change(within(drawer).getByLabelText(/^email/i), { target: { value: 'carol@example.com' } });
    fireEvent.change(within(drawer).getByLabelText(/temporary password/i), { target: { value: 'password123' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Create user' }));

    const banner = await within(drawer).findByRole('alert');
    expect(banner).toHaveTextContent('A deactivated user with this email already exists. Restore them instead.');
    expect(banner).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Invite a user' })).toBeInTheDocument();
  });

  it('TC-U46: Esc closes the drawer', async () => {
    const drawer = await open();
    fireEvent.keyDown(within(drawer).getByLabelText(/full name/i), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
