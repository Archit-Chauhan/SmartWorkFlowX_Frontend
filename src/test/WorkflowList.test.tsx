import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'react-toastify';
import WorkflowList from '../features/workflows/WorkflowList';
import axiosInstance from '../api/axiosInstance';
import type { Workflow, WorkflowDetail } from '../models';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const LIST_URL = '/Workflow?page=1&limit=200';

const WORKFLOWS: Workflow[] = [
  {
    workflowId: 1, title: 'Expense Approval', status: 'Active', stepCount: 2, description: 'Employee expense claims.',
    createdByName: 'Alice Smith', createdAt: '2026-08-12T10:00:00Z', activeTaskCount: 3,
    steps: [{ stepOrder: 1, stepName: 'Manager review', approverRoleName: 'Manager' }, { stepOrder: 2, stepName: 'Finance sign-off', approverRoleName: 'Admin' }],
  },
  {
    workflowId: 2, title: 'Leave Request', status: 'Active', stepCount: 1, description: 'Annual and sick leave.',
    createdByName: 'Bob Jones', createdAt: '2026-07-03T10:00:00Z', activeTaskCount: 0,
    steps: [{ stepOrder: 1, stepName: 'Manager approval', approverRoleName: 'Manager' }],
  },
  {
    workflowId: 3, title: 'Contract Review', status: 'Draft', stepCount: 1, description: null,
    createdByName: 'Neha Iyer', createdAt: '2026-10-01T10:00:00Z', activeTaskCount: 0,
    steps: [{ stepOrder: 1, stepName: 'Legal check', approverRoleName: 'Admin' }],
  },
  {
    workflowId: 4, title: 'Travel Policy', status: 'Inactive', stepCount: 1, description: 'Replaced.',
    createdByName: 'Alice Smith', createdAt: '2026-02-02T10:00:00Z', activeTaskCount: 0,
    steps: [{ stepOrder: 1, stepName: 'Audit check', approverRoleName: 'Auditor' }],
  },
];

const DETAIL: WorkflowDetail = {
  workflowId: 1, title: 'Expense Approval', description: 'Employee expense claims.', status: 'Active', createdByName: 'Alice Smith', createdAt: '2026-08-12T10:00:00Z',
  steps: [
    { stepId: 11, stepOrder: 1, stepName: 'Manager review', description: 'Check receipts match the amounts.', approverRoleName: 'Manager', approverRoleId: 2, onRejectAction: 'GoBack', escalationHours: 24 },
    { stepId: 12, stepOrder: 2, stepName: 'Finance sign-off', approverRoleName: 'Admin', approverRoleId: 1, onRejectAction: 'Cancel' },
  ],
};

let list: Workflow[];
let total: number;

beforeEach(() => {
  vi.clearAllMocks();
  list = WORKFLOWS.map((w) => ({ ...w }));
  total = list.length;
  vi.mocked(axiosInstance.get).mockImplementation(async (url: string) => {
    if (url === LIST_URL) return { data: { data: list, total, page: 1, pageSize: 200 } };
    if (url === '/Workflow/1') return { data: DETAIL };
    throw new Error(`unexpected GET ${url}`);
  });
  vi.mocked(axiosInstance.post).mockResolvedValue({ data: {} });
  vi.mocked(axiosInstance.delete).mockResolvedValue({ data: {} });
});

const renderList = async () => {
  render(
    <MemoryRouter initialEntries={['/workflows']}>
      <Routes>
        <Route path="/workflows" element={<WorkflowList />} />
        <Route path="/workflows/new" element={<p>NEW PAGE</p>} />
        <Route path="/workflows/:id/edit" element={<p>EDIT PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('article', { name: 'Expense Approval' });
};

const row = (title: string) => screen.getByRole('article', { name: title });

describe('Workflows list', () => {
  it('TC-W01: loads the list once and shows each row with status, lock chip, description, journey line and meta', async () => {
    await renderList();
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    expect(axiosInstance.get).toHaveBeenCalledWith(LIST_URL);

    const expense = within(row('Expense Approval'));
    expect(expense.getByRole('heading', { name: /Expense Approval/ })).toBeInTheDocument();
    expect(expense.getByText('Active')).toBeInTheDocument();
    expect(expense.getByText('In use by 3 tasks')).toBeInTheDocument();
    expect(expense.getByText('Employee expense claims.')).toBeInTheDocument();
    const journey = expense.getByRole('list', { name: 'Approval journey' });
    expect(within(journey).getByText('Start')).toBeInTheDocument();
    expect(within(journey).getByText(/Manager review/)).toBeInTheDocument();
    expect(within(journey).getByText(/Finance sign-off/)).toBeInTheDocument();
    expect(within(journey).getByText(/Done/)).toBeInTheDocument();
    expect(expense.getByText('2 approval steps')).toBeInTheDocument();
    expect(expense.getByText('Created by Alice Smith, 12 Aug 2026')).toBeInTheDocument();

    expect(within(row('Leave Request')).getByText('1 approval step')).toBeInTheDocument();
    expect(within(row('Leave Request')).queryByText(/In use by/)).not.toBeInTheDocument();
    expect(within(row('Contract Review')).getByText('No description')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new workflow/i })).toHaveAttribute('href', '/workflows/new');
  });

  it('TC-W02: status chips show counts and filter the loaded set; search narrows further', async () => {
    await renderList();
    const filters = screen.getByRole('group', { name: 'Filter by status' });
    expect(within(filters).getByRole('button', { name: 'All 4' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(filters).getByRole('button', { name: 'Active 2' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Draft 1' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Inactive 1' })).toBeInTheDocument();

    fireEvent.click(within(filters).getByRole('button', { name: 'Draft 1' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Contract Review' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Draft 1' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(filters).getByRole('button', { name: 'All 4' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search workflows' }), { target: { value: 'sick' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Leave Request' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search workflows' }), { target: { value: 'nothing here' } });
    expect(screen.getByText('No workflows match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it('TC-W03: the details toggle sits at the right end of the meta line, is primary, and sets aria-expanded', async () => {
    await renderList();
    const expense = within(row('Expense Approval'));
    const toggle = expense.getByRole('button', { name: /show details/i });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.className).toMatch(/\bbtn-primary\b/);
    expect(toggle.className).toMatch(/\bbtn-sm\b/);
    expect(toggle.className).toMatch(/\bml-auto\b/);
    const metaLine = toggle.parentElement as HTMLElement;
    expect(metaLine.lastElementChild).toBe(toggle);
    expect(metaLine).toHaveTextContent('2 approval steps');

    fireEvent.click(toggle);
    const open = expense.getByRole('button', { name: /hide details/i });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(await expense.findByText('“Check receipts match the amounts.”')).toBeInTheDocument();
    expect(expense.getByText('If rejected: sent back one step')).toBeInTheDocument();
    expect(expense.getByText('If rejected: task cancelled')).toBeInTheDocument();
    expect(expense.getByText('Escalates after 24h')).toBeInTheDocument();
    expect(expense.getByText('The assignee does the work')).toBeInTheDocument();
    expect(expense.getByText('Task completed')).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith('/Workflow/1');

    fireEvent.click(open);
    expect(expense.queryByText('Task completed')).not.toBeInTheDocument();
    fireEvent.click(expense.getByRole('button', { name: /show details/i }));
    expect(await expense.findByText('Task completed')).toBeInTheDocument();
    expect(vi.mocked(axiosInstance.get).mock.calls.filter(([u]) => u === '/Workflow/1')).toHaveLength(1);
  });

  it('TC-W04: a locked workflow has aria-disabled Edit and Deactivate; clicking explains why and does nothing else', async () => {
    await renderList();
    const expense = within(row('Expense Approval'));
    const edit = expense.getByRole('button', { name: /edit/i });
    const deactivate = expense.getByRole('button', { name: /deactivate/i });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(deactivate).toHaveAttribute('aria-disabled', 'true');
    expect(expense.getByRole('button', { name: /clone/i })).not.toHaveAttribute('aria-disabled');

    fireEvent.click(edit);
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Cannot modify “Expense Approval” while 3 tasks are in progress.');
    expect(banner).toHaveFocus();
    expect(screen.queryByText('EDIT PAGE')).not.toBeInTheDocument();

    fireEvent.click(deactivate);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot deactivate “Expense Approval” while 3 tasks are in progress.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.delete).not.toHaveBeenCalled();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('TC-W05: Edit on an unlocked workflow opens its edit page', async () => {
    await renderList();
    fireEvent.click(within(row('Leave Request')).getByRole('button', { name: /edit/i }));
    expect(await screen.findByText('EDIT PAGE')).toBeInTheDocument();
  });

  it('TC-W06: Activate asks first; Cancel calls nothing, confirming posts to the activate endpoint', async () => {
    await renderList();
    const draft = within(row('Contract Review'));
    expect(draft.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
    fireEvent.click(draft.getByRole('button', { name: /^activate/i }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Activate this workflow?' });
    expect(within(dialog).getByText(/becomes available in Assign Task/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.click(draft.getByRole('button', { name: /^activate/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, activate' }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/Workflow/3/activate'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Contract Review” is now active.'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(vi.mocked(axiosInstance.get).mock.calls.filter(([u]) => u === LIST_URL)).toHaveLength(2);
  });

  it('TC-W07: Deactivate asks first, then sends DELETE; Escape cancels', async () => {
    await renderList();
    const leave = within(row('Leave Request'));
    fireEvent.click(leave.getByRole('button', { name: /deactivate/i }));
    await screen.findByRole('alertdialog', { name: 'Deactivate this workflow?' });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(axiosInstance.delete).not.toHaveBeenCalled();

    fireEvent.click(leave.getByRole('button', { name: /deactivate/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, deactivate' }));
    await waitFor(() => expect(axiosInstance.delete).toHaveBeenCalledWith('/Workflow/2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Leave Request” deactivated.'));
  });

  it('TC-W08: Clone asks first, then posts to the clone endpoint', async () => {
    await renderList();
    const leave = within(row('Leave Request'));
    fireEvent.click(leave.getByRole('button', { name: /clone/i }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Clone this workflow?' });
    expect(within(dialog).getByText(/Leave Request \(Copy\)/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.click(leave.getByRole('button', { name: /clone/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, clone' }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/Workflow/2/clone'));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('TC-W09: buttons are disabled while a confirmation is saving', async () => {
    let finish: () => void = () => {};
    vi.mocked(axiosInstance.post).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ data: {} }); }));
    await renderList();
    fireEvent.click(within(row('Contract Review')).getByRole('button', { name: /^activate/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, activate' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Activating...' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('TC-W10: a server refusal is shown in a banner instead of a toast', async () => {
    vi.mocked(axiosInstance.delete).mockRejectedValueOnce({ response: { status: 400, data: { message: 'Cannot deactivate a workflow with active in-progress tasks.' } } });
    await renderList();
    fireEvent.click(within(row('Leave Request')).getByRole('button', { name: /deactivate/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, deactivate' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Cannot deactivate a workflow with active in-progress tasks.');
    expect(banner).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('TC-W11: shows an error state with Try again when loading fails', async () => {
    vi.mocked(axiosInstance.get).mockRejectedValueOnce(new Error('network'));
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('article', { name: 'Expense Approval' })).toBeInTheDocument();
  });

  it('TC-W12: shows an empty state when there are no workflows', async () => {
    list = [];
    total = 0;
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    expect(await screen.findByText('No workflows yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /new workflow/i }).length).toBeGreaterThan(0);
  });

  it('TC-W13: tells the user when only the first 200 workflows are shown', async () => {
    total = 250;
    await renderList();
    expect(screen.getByText(/Showing the first 200 workflows/)).toBeInTheDocument();
  });
});
