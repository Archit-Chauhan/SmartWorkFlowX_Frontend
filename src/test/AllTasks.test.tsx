import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AllTasks from '../features/tasks/AllTasks';
import axiosInstance from '../api/axiosInstance';
import type { AllTasksResponse, TaskItem } from '../models';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const base: Omit<TaskItem, 'taskId' | 'title' | 'status'> = {
  workflowId: 1, workflowTitle: 'Expense Approval', priority: 'Medium', currentStepOrder: 1, totalSteps: 2,
  createdAt: daysFromNow(-10), description: '', assignedTo: null, assigneeName: null, assignedRoleName: null,
};

const ROWS: TaskItem[] = [
  { ...base, taskId: 1, title: 'Vendor contract renewal', status: 'In Progress', priority: 'High', assignedTo: 4, assigneeName: 'Dan Patel', dueDate: daysFromNow(-7.5), description: 'Sign off the SLA.', categoryId: 1, categoryName: 'Finance', categoryColor: '#0f62fe' },
  { ...base, taskId: 2, title: 'Laptop request', status: 'In Progress', assignedRoleName: 'Manager' },
  { ...base, taskId: 3, title: 'Leave certificate', status: 'Completed', dueDate: daysFromNow(-20), currentStepOrder: 2 },
  { ...base, taskId: 4, title: 'Old NDA', status: 'Cancelled', dueDate: daysFromNow(-30) },
  { ...base, taskId: 5, title: 'Budget exception', status: 'Rejected', rejectedReason: 'Missing documents', dueDate: daysFromNow(-3) },
];

const COUNTS = { all: 37, open: 11, completed: 16, closed: 10 };
const respond = (rows: TaskItem[] = ROWS, extra: Partial<AllTasksResponse> = {}): AllTasksResponse =>
  ({ data: rows, total: 37, page: 1, pageSize: 20, counts: COUNTS, ...extra });

let allHandler: (params: Record<string, string | number>) => Promise<{ data: AllTasksResponse }>;

const Where: React.FC = () => <span data-testid="where">{useLocation().search}</span>;

const renderScreen = async (search = '', ready: string | RegExp = 'Vendor contract renewal') => {
  render(<MemoryRouter initialEntries={[`/all-tasks${search}`]}><AllTasks /><Where /></MemoryRouter>);
  await screen.findByText(ready);
};

const allCalls = () => vi.mocked(axiosInstance.get).mock.calls.filter(([url]) => url === '/Task/all');
const lastParams = () => (allCalls().at(-1)![1] as { params: Record<string, string | number> }).params;

beforeEach(() => {
  vi.clearAllMocks();
  allHandler = async () => ({ data: respond() });
  vi.mocked(axiosInstance.get).mockImplementation(async (url: string, config?: unknown) => {
    if (url === '/Task/all') return allHandler((config as { params: Record<string, string | number> }).params);
    if (url === '/Task/categories') return { data: [{ categoryId: 1, name: 'Finance', colorHex: '#0f62fe' }, { categoryId: 2, name: 'HR', colorHex: '#8a3ffc' }] };
    if (url === '/Task/assignable-users') return { data: [{ userId: 4, name: 'Dan Patel', email: 'd@x.io', roleName: 'Employee' }, { userId: 2, name: 'Bob Jones', email: 'b@x.io', roleName: 'Manager' }] };
    if (url.endsWith('/history')) return { data: [{ stepOrder: 1, actedByName: 'Riya Sharma', action: 'Approved', comment: 'Looks fine', actedAt: '2026-10-05T10:00:00Z' }] };
    return { data: [] };
  });
});

describe('AllTasks (table)', () => {
  it('TC-A01: renders the rows the server sent, with assignee and due rules', async () => {
    await renderScreen();

    const table = screen.getByRole('table', { name: 'All tasks' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(table).getAllByRole('row')).toHaveLength(ROWS.length + 1);

    expect(within(table).getByText('Dan Patel')).toBeInTheDocument();
    expect(screen.getByText('Any Manager')).toBeInTheDocument(); // waiting in a role pool
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getByText('Cancelled', { selector: 'span.text-ink-subtle' })).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument(); // rejected, nobody holds it

    expect(screen.getByText('8d overdue')).toHaveClass('text-error');
    expect(screen.getAllByText(/^Was due /)).toHaveLength(3); // completed, cancelled and rejected are never overdue
    expect(screen.getAllByText('No due date')).toHaveLength(1);
    expect(screen.getByText('Sent back')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1-20 of 37 tasks');
  });

  it('TC-A02: tabs show the counts from the server', async () => {
    await renderScreen();
    const tabs = within(screen.getByRole('tablist', { name: 'Status group' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['All37', 'Open11', 'Completed16', 'Rejected / Cancelled10']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('TC-A03: changing tab asks the server for that group and goes back to page 1', async () => {
    await renderScreen('?page=2');
    expect(lastParams()).toMatchObject({ page: 2, group: 'all' });

    fireEvent.click(screen.getByRole('tab', { name: /^Completed/ }));

    await waitFor(() => expect(lastParams()).toMatchObject({ group: 'completed', page: 1 }));
    expect(screen.getByTestId('where')).toHaveTextContent('?group=completed');
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=');
    expect(screen.getByRole('tab', { name: /^Completed/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('TC-A04: a filter is sent to the server, shown as a pill, and can be removed or cleared', async () => {
    await renderScreen('?page=3');

    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'High' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ priority: 'High', page: 1 }));

    await screen.findByRole('option', { name: 'Dan Patel' });
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: '4' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ priority: 'High', assignedTo: 4 }));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '2' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ categoryId: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    await waitFor(() => expect(lastParams()).toMatchObject({ overdue: 'true' }));

    expect(screen.getByText('Assignee: Dan Patel')).toBeInTheDocument();
    expect(screen.getByText('Category: HR')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Priority: High' }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty('priority'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 20, group: 'all', sort: 'due', dir: 'asc' }));
    expect(screen.queryByText('Filters:')).not.toBeInTheDocument();
  });

  it('TC-A05: column headers sort on the server, flip on a second click, and expose aria-sort', async () => {
    await renderScreen('?page=2');
    const th = (name: string) => screen.getByRole('columnheader', { name });

    expect(th('Due')).toHaveAttribute('aria-sort', 'ascending');
    expect(th('Task')).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(th('Task')).getByRole('button'));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'title', dir: 'asc', page: 1 }));
    expect(th('Task')).toHaveAttribute('aria-sort', 'ascending');
    expect(th('Due')).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(th('Task')).getByRole('button'));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'title', dir: 'desc' }));
    expect(th('Task')).toHaveAttribute('aria-sort', 'descending');

    // Age is the mirror of "created": the first click shows the youngest tasks, i.e. newest created first.
    fireEvent.click(within(th('Age')).getByRole('button'));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'created', dir: 'desc' }));
    expect(th('Age')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('TC-A06: search is debounced by 300 ms, trimmed, and resets the page', async () => {
    await renderScreen('?page=2');
    const before = allCalls().length;

    const box = screen.getByLabelText('Search tasks');
    fireEvent.change(box, { target: { value: 'con' } });
    fireEvent.change(box, { target: { value: ' contract ' } });
    await new Promise((r) => setTimeout(r, 150));
    expect(allCalls()).toHaveLength(before); // still waiting

    await waitFor(() => expect(lastParams()).toMatchObject({ q: 'contract', page: 1 }));
    expect(allCalls()).toHaveLength(before + 1); // typing did not fire one request per keystroke
    expect(screen.getByText('Search: “contract”')).toBeInTheDocument();
  });

  it('TC-A07: pagination asks the server for the next page', async () => {
    allHandler = async (p) => ({ data: respond(ROWS, { total: 45, page: Number(p.page), counts: { ...COUNTS, all: 45 } }) });
    await renderScreen();

    fireEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0]);
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(screen.getByTestId('where')).toHaveTextContent('?page=2');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Showing 21-40 of 45 tasks'));
  });

  it('TC-A08: opening a row shows a read-only panel with who holds the task and no decision buttons', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Vendor contract renewal' }));

    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByRole('heading', { name: 'Vendor contract renewal' })).toBeInTheDocument();
    expect(within(panel).getByText('Currently with')).toBeInTheDocument();
    expect(within(panel).getByText('Dan Patel')).toBeInTheDocument();
    expect(within(panel).getByText(/Read-only here/)).toBeInTheDocument();
    expect(await within(panel).findByText(/Riya Sharma/)).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith('/Task/1/history');
    expect(within(panel).queryByRole('button', { name: /approve|reject|complete/i })).not.toBeInTheDocument();
    expect(within(panel).queryByText('Waiting for you')).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('TC-A09: clicking anywhere on the row opens the panel too', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('Sign off the SLA.'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('TC-A10: a failed load shows an error and Try again loads it', async () => {
    let fail = true;
    allHandler = async () => { if (fail) throw new Error('boom'); return { data: respond() }; };
    render(<MemoryRouter><AllTasks /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the tasks.");
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Vendor contract renewal')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('TC-A11: no matches shows an empty state whose button clears the filters', async () => {
    allHandler = async (p) => ({ data: p.priority ? respond([], { total: 0, counts: { all: 0, open: 0, completed: 0, closed: 0 } }) : respond() });
    await renderScreen('?priority=Low', 'No tasks match these filters');

    expect(screen.getByRole('status')).toHaveTextContent('0 tasks');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Vendor contract renewal')).toBeInTheDocument();
    expect(lastParams()).not.toHaveProperty('priority');
  });

  it('TC-A12: an answer that arrives late for an older query is ignored', async () => {
    let releaseOld!: () => void;
    allHandler = (p) => {
      if (p.group === 'all') return new Promise((resolve) => { releaseOld = () => resolve({ data: respond([ROWS[1]]) }); });
      return Promise.resolve({ data: respond([ROWS[0]]) });
    };
    render(<MemoryRouter><AllTasks /></MemoryRouter>);
    await waitFor(() => expect(releaseOld).toBeTypeOf('function'));

    fireEvent.click(screen.getByRole('tab', { name: /^Open/ })); // newer query answers first
    await screen.findByText('Vendor contract renewal');
    releaseOld(); // the older one answers last and must not win
    await new Promise((r) => setTimeout(r, 30));

    expect(screen.getByText('Vendor contract renewal')).toBeInTheDocument();
    expect(screen.queryByText('Laptop request')).not.toBeInTheDocument();
  });

  it('TC-A13: a page past the end (old link) lands on the last real page', async () => {
    allHandler = async (p) => ({ data: Number(p.page) > 2 ? respond([], { total: 30, page: Number(p.page) }) : respond(ROWS, { total: 30, page: Number(p.page) }) });
    render(<MemoryRouter initialEntries={['/all-tasks?page=9']}><AllTasks /><Where /></MemoryRouter>);

    await screen.findByText('Vendor contract renewal');
    expect(lastParams()).toMatchObject({ page: 2 });
    expect(screen.getByTestId('where')).toHaveTextContent('?page=2');
  });
});
