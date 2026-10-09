import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'react-toastify';
import TaskAssign from '../features/tasks/TaskAssign';
import axiosInstance from '../api/axiosInstance';
import { isoDate } from '../features/tasks/assignUtils';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const WORKFLOWS = [
  { workflowId: 1, title: 'Expense Approval', status: 'Active', stepCount: 2 },
  { workflowId: 2, title: 'Leave Request', status: 'Active', stepCount: 1 },
  { workflowId: 3, title: 'Vendor Onboarding', status: 'Draft', stepCount: 3 },
];
const DETAIL: Record<number, unknown> = {
  1: { workflowId: 1, title: 'Expense Approval', status: 'Active', steps: [
    { stepId: 2, stepOrder: 2, stepName: 'Finance sign-off', approverRoleName: 'Admin' },
    { stepId: 1, stepOrder: 1, stepName: 'Manager review', approverRoleName: 'Manager' },
  ] },
  2: { workflowId: 2, title: 'Leave Request', status: 'Active', steps: [{ stepId: 3, stepOrder: 1, stepName: 'Manager approval', approverRoleName: 'Manager' }] },
};
const USERS = [
  { userId: 4, name: 'Dan Patel', email: 'dan@x.io', roleName: 'Employee', openTaskCount: 3 },
  { userId: 5, name: 'Eve Torres', email: 'eve@x.io', roleName: 'Employee', openTaskCount: 0 },
  { userId: 2, name: 'Bob Jones', email: 'bob@x.io', roleName: 'Manager', openTaskCount: 7 },
];
const CATEGORIES = [{ categoryId: 1, name: 'Finance', colorHex: '#0f62fe' }, { categoryId: 2, name: 'HR', colorHex: '#8a3ffc' }];

let workflows = WORKFLOWS;
let users: unknown[] = USERS;

const renderScreen = async () => {
  render(<MemoryRouter><TaskAssign /></MemoryRouter>);
  await screen.findByRole('heading', { name: /Step 1 of 2/ });
};

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp, role: string = 'button') => fireEvent.click(screen.getByRole(role, { name }));

const goToStep2 = async (title = 'Q1 expense report') => {
  await renderScreen();
  type(/Task title/, title);
  click(/Continue/);
  await screen.findByRole('heading', { name: /Step 2 of 2/ });
};

const pickPerson = (name: string) => {
  const box = screen.getByRole('combobox');
  fireEvent.focus(box);
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(name) }));
};

const reachDialog = async () => {
  await goToStep2('  Q1 expense report  ');
  click(/Expense Approval/, 'radio');
  pickPerson('Dan Patel');
  click(/Review and assign/);
  return screen.findByRole('alertdialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  workflows = WORKFLOWS;
  users = USERS;
  vi.mocked(axiosInstance.get).mockImplementation(async (url: string) => {
    if (url.startsWith('/Workflow?')) return { data: { data: workflows, total: workflows.length, page: 1, pageSize: 1000 } };
    const m = url.match(/^\/Workflow\/(\d+)$/);
    if (m) return { data: DETAIL[Number(m[1])] };
    if (url === '/Task/assignable-users') return { data: users };
    if (url === '/Task/categories') return { data: CATEGORIES };
    return { data: [] };
  });
  vi.mocked(axiosInstance.post).mockResolvedValue({ data: { message: 'ok', taskId: 9 } });
});

describe('TaskAssign: steps and validation', () => {
  it('step 1 blocks Continue until the title and dates are valid, with inline errors and focus', async () => {
    await renderScreen();
    expect(screen.getByText('The task').closest('li')).toHaveAttribute('aria-current', 'step');

    click(/Continue/);
    expect(await screen.findByText('Give the task a title.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix 1 thing below.');
    expect(screen.getByLabelText(/Task title/)).toHaveFocus();
    expect(screen.getByRole('heading', { name: /Step 1 of 2/ })).toBeInTheDocument();

    type(/Task title/, 'x'.repeat(201));
    expect(screen.getByText('201/200')).toBeInTheDocument();
    click(/Continue/);
    expect(await screen.findByText('Keep the title to 200 characters or fewer.')).toBeInTheDocument();

    type(/Task title/, 'Fine title');
    type('Pick a due date', isoDate(-3));
    click(/Continue/);
    expect(await screen.findByText('The due date cannot be in the past.')).toBeInTheDocument();
    expect(screen.getByLabelText('Pick a due date')).toHaveFocus();

    type(/Description/, 'd'.repeat(2001));
    type('Pick a due date', '');
    click(/Continue/);
    expect(await screen.findByText('Keep the description to 2000 characters or fewer.')).toBeInTheDocument();
  });

  it('moves to step 2, requires workflow and person, and keeps step 1 state when going Back', async () => {
    await goToStep2('Keep me');
    expect(screen.getByText('Workflow and person').closest('li')).toHaveAttribute('aria-current', 'step');

    click(/Review and assign/);
    expect(await screen.findByText('Choose a workflow.')).toBeInTheDocument();
    expect(screen.getByText('Choose who does the work first.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix 2 things below.');
    expect(screen.getAllByRole('radio', { name: /approval step/ })[0]).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    click(/Back/);
    expect(screen.getByLabelText(/Task title/)).toHaveValue('Keep me');
  });

  it('only lists Active workflows', async () => {
    await goToStep2();
    expect(screen.getAllByRole('radio', { name: /approval step/ }).map((r) => r.textContent)).toEqual([
      'Expense Approval2 approval steps', 'Leave Request1 approval step',
    ]);
  });
});

describe('TaskAssign: preview', () => {
  it('builds the journey from the chosen workflow steps, in order, and caches them', async () => {
    await goToStep2('Preview me');
    const preview = screen.getByRole('complementary', { name: 'What will happen' });
    expect(within(preview).getByText('Preview me')).toBeInTheDocument();
    expect(within(preview).getByText('Choose a workflow to see every step it will go through.')).toBeInTheDocument();

    click(/Expense Approval/, 'radio');
    expect(await within(preview).findByText('Manager review')).toBeInTheDocument();
    const items = within(preview).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('The assignee does the work');
    expect(items[1]).toContain('Manager review');
    expect(items[1]).toContain('Any Manager can approve, first to act wins');
    expect(items[2]).toContain('Finance sign-off');
    expect(items[3]).toContain('Task completed');

    pickPerson('Eve Torres');
    expect(within(preview).getByText('Eve Torres does the work')).toBeInTheDocument();

    click(/Leave Request/, 'radio');
    expect(await within(preview).findByText('Manager approval')).toBeInTheDocument();
    click(/Expense Approval/, 'radio');
    expect(within(preview).getByText('Finance sign-off')).toBeInTheDocument();
    const detailCalls = vi.mocked(axiosInstance.get).mock.calls.filter(([u]) => u === '/Workflow/1');
    expect(detailCalls).toHaveLength(1);
  });

  it('shows a polite fallback when the steps cannot be loaded', async () => {
    const base = vi.mocked(axiosInstance.get).getMockImplementation()!;
    vi.mocked(axiosInstance.get).mockImplementation(async (url: string) => {
      if (url === '/Workflow/1') throw new Error('boom');
      return base(url);
    });
    await goToStep2();
    click(/Expense Approval/, 'radio');
    const preview = screen.getByRole('complementary', { name: 'What will happen' });
    expect(await within(preview).findByText(/could not load this workflow/)).toBeInTheDocument();
    expect(within(preview).getByText('Task completed')).toBeInTheDocument();
  });
});

describe('TaskAssign: person picker', () => {
  it('filters by search and selects with the keyboard, then offers Change', async () => {
    await goToStep2();
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(3);
    expect(within(list).getByText('3 open')).toBeInTheDocument();

    fireEvent.change(box, { target: { value: 'manager' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getByText(/No one matches/)).toBeInTheDocument();

    fireEvent.change(box, { target: { value: '' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getAllByText('Eve Torres').length).toBeGreaterThan(0);
    const change = screen.getByRole('button', { name: /Change person/ });
    fireEvent.click(change);
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows "N open" only when openTaskCount is present', async () => {
    users = [{ userId: 4, name: 'Dan Patel', email: 'dan@x.io', roleName: 'Employee' }];
    await goToStep2();
    fireEvent.focus(screen.getByRole('combobox'));
    expect(within(screen.getByRole('listbox')).queryByText(/open/)).not.toBeInTheDocument();
  });
});

describe('TaskAssign: due date and Formalize', () => {
  it('quick chips set the date, Clear removes it', async () => {
    await renderScreen();
    const input = screen.getByLabelText('Pick a due date') as HTMLInputElement;
    expect(input).toHaveAttribute('min', isoDate());
    click('Tomorrow');
    expect(input.value).toBe(isoDate(1));
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'true');
    click('In 3 days');
    expect(input.value).toBe(isoDate(3));
    click('Next week');
    expect(input.value).toBe(isoDate(7));
    click('Clear');
    expect(input.value).toBe('');
  });

  it('Formalize replaces the text and Restore original brings it back', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: { formalizedText: 'Formal text.' } });
    await renderScreen();
    expect(screen.getByRole('button', { name: /Formalize with AI/ })).toBeDisabled();
    type(/Description/, 'rough notes');
    click(/Formalize with AI/);
    await waitFor(() => expect(screen.getByLabelText(/Description/)).toHaveValue('Formal text.'));
    expect(axiosInstance.post).toHaveBeenCalledWith('/Task/formalize-description', { rawText: 'rough notes', context: 'task' });
    click(/Restore original/);
    expect(screen.getByLabelText(/Description/)).toHaveValue('rough notes');
    expect(screen.queryByRole('button', { name: /Restore original/ })).not.toBeInTheDocument();
  });

  it('shows an error toast when Formalize fails and keeps the text', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce(new Error('down'));
    await renderScreen();
    type(/Description/, 'rough notes');
    click(/Formalize with AI/);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText(/Description/)).toHaveValue('rough notes');
  });
});

describe('TaskAssign: confirm and result', () => {
  it('Cancel closes the dialog without posting', async () => {
    const dialog = await reachDialog();
    expect(within(dialog).getByText('Q1 expense report')).toBeInTheDocument();
    expect(within(dialog).getByText(/starting with .Manager review. \(any Manager\)/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('Yes, assign posts the exact body with a trimmed title and shows the success card', async () => {
    const dialog = await reachDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, assign' }));
    expect(await screen.findByRole('heading', { name: 'Task assigned' })).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledWith('/Task/assign', {
      title: 'Q1 expense report', description: '', workflowId: 1, assignedTo: 4, priority: 'Medium',
    });
    expect(screen.getByRole('link', { name: 'View in All Tasks' })).toHaveAttribute('href', '/all-tasks?q=Q1%20expense%20report');
  });

  it('includes due date and category when chosen', async () => {
    await goToStep2('With extras');
    click(/Back/);
    click('Tomorrow');
    click('High', 'radio');
    click('HR', 'radio');
    click(/Continue/);
    click(/Leave Request/, 'radio');
    pickPerson('Bob Jones');
    click(/Review and assign/);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, assign' }));
    await screen.findByRole('heading', { name: 'Task assigned' });
    expect(axiosInstance.post).toHaveBeenCalledWith('/Task/assign', {
      title: 'With extras', description: '', workflowId: 2, assignedTo: 2, priority: 'High', dueDate: isoDate(1), categoryId: 2,
    });
  });

  it('shows the server 400 message in a warning banner and moves focus to it', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({ response: { status: 400, data: { message: 'The selected person was not found or is deactivated.' } } });
    const dialog = await reachDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, assign' }));
    const banner = await screen.findByText('The selected person was not found or is deactivated.');
    await waitFor(() => expect(banner.closest('[role="alert"]')).toHaveFocus());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Step 2 of 2/ })).toBeInTheDocument();
  });

  it('"Assign another" keeps workflow, priority and category and focuses the title', async () => {
    await renderScreen();
    type(/Task title/, 'First');
    click('High', 'radio');
    click('Finance', 'radio');
    click(/Continue/);
    await screen.findByRole('heading', { name: /Step 2 of 2/ });
    click(/Leave Request/, 'radio');
    pickPerson('Dan Patel');
    click(/Review and assign/);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, assign' }));
    await screen.findByRole('heading', { name: 'Task assigned' });

    click(/Assign another with the same workflow/);
    const title = screen.getByLabelText(/Task title/);
    expect(title).toHaveValue('');
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Finance' })).toHaveAttribute('aria-checked', 'true');
    type(/Task title/, 'Second');
    click(/Continue/);
    await screen.findByRole('heading', { name: /Step 2 of 2/ });
    expect(screen.getByRole('radio', { name: /Leave Request/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // person cleared
  });

  it('"Start a blank form" resets everything', async () => {
    const dialog = await reachDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, assign' }));
    await screen.findByRole('heading', { name: 'Task assigned' });
    click(/Start a blank form/);
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Task title/)).toHaveValue('');
  });
});

describe('TaskAssign: no active workflows', () => {
  it('shows an empty state with a link to Workflows', async () => {
    workflows = [WORKFLOWS[2]];
    render(<MemoryRouter><TaskAssign /></MemoryRouter>);
    expect(await screen.findByText('No active workflows')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Workflows' })).toHaveAttribute('href', '/workflows');
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();
  });
});
