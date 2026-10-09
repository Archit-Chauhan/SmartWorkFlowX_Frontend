import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'react-toastify';
import TaskList from '../features/tasks/TaskList';
import axiosInstance from '../api/axiosInstance';
import type { TaskItem } from '../models';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const TASKS: TaskItem[] = [
  { taskId: 1, title: 'Vendor contract renewal', description: 'Sign off the revised SLA.', workflowId: 1, workflowTitle: 'Vendor Approval', status: 'In Progress', priority: 'High', currentStepOrder: 2, totalSteps: 3, dueDate: daysFromNow(-2.5), createdAt: '2026-10-01T00:00:00Z' },
  { taskId: 2, title: 'Laptop request', description: '', workflowId: 2, workflowTitle: 'Hardware Request', status: 'Pending', priority: 'Low', currentStepOrder: 0, totalSteps: 2, createdAt: '2026-10-02T00:00:00Z' },
];

let tasks: TaskItem[];

beforeEach(() => {
  vi.clearAllMocks();
  tasks = [...TASKS];
  vi.mocked(axiosInstance.get).mockImplementation(async (url: string) => {
    if (url.startsWith('/Task/my-tasks')) return { data: { data: tasks, total: tasks.length } };
    if (url.endsWith('/history')) return { data: [{ stepOrder: 1, actedByName: 'Riya Sharma', action: 'Approved', comment: 'Looks fine', actedAt: '2026-10-05T10:00:00Z' }] };
    return { data: { data: [], total: 0 } };
  });
  vi.mocked(axiosInstance.post).mockImplementation(async (url: string) => {
    const id = Number(url.split('/')[2]);
    tasks = tasks.filter((t) => t.taskId !== id);
    return { data: {} };
  });
});

const renderList = async () => {
  render(<TaskList />);
  await screen.findByText('Vendor contract renewal');
};

describe('TaskList (My Tasks)', () => {
  it('TC-T01: groups tasks by urgency and shows no action buttons on the rows', async () => {
    await renderList();

    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No due date' })).toBeInTheDocument();
    expect(screen.getByText('3 days overdue')).toBeInTheDocument();
    expect(screen.getByText('Sign off the revised SLA.')).toBeInTheDocument();
    expect(screen.getByText('No description')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  });

  it('TC-T02: opening a row shows the labelled review panel with history', async () => {
    await renderList();
    fireEvent.click(screen.getByText('Vendor contract renewal'));

    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByRole('heading', { name: 'Vendor contract renewal' })).toBeInTheDocument();
    for (const label of ['Task', 'Description', 'Details', 'History']) {
      expect(within(panel).getByRole('region', { name: label })).toBeInTheDocument();
    }
    expect(await within(panel).findByText(/Riya Sharma/)).toBeInTheDocument();
    expect(within(panel).getByText('Waiting for you')).toBeInTheDocument();
  });

  it('TC-T03: Approve asks for confirmation and only posts after "Yes"', async () => {
    await renderList();
    fireEvent.click(screen.getByText('Vendor contract renewal'));
    fireEvent.click(await screen.findByRole('button', { name: /^approve$/i }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Approve this task?' });
    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/moves to step 3/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, approve/i }));

    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/Task/1/approve', null));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Vendor contract renewal')).not.toBeInTheDocument());
  });

  it('TC-T04: Reject needs a reason, then sends reason and comment', async () => {
    await renderList();
    fireEvent.click(screen.getByText('Vendor contract renewal'));
    fireEvent.click(await screen.findByRole('button', { name: /^reject$/i }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Reject this task?' });
    fireEvent.click(within(dialog).getByRole('button', { name: /reject task/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/give a reason/i);
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Missing documents' }));
    fireEvent.change(within(dialog).getByLabelText(/additional comment/i), { target: { value: 'Attach the SLA' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /reject task/i }));

    await waitFor(() =>
      expect(axiosInstance.post).toHaveBeenCalledWith('/Task/1/reject', { reason: 'Missing documents', comment: 'Attach the SLA' }));
  });

  it('TC-T05: Escape cancels the dialog without closing the panel behind it', async () => {
    await renderList();
    fireEvent.click(screen.getByText('Vendor contract renewal'));
    fireEvent.click(await screen.findByRole('button', { name: /^approve$/i }));
    await screen.findByRole('alertdialog');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('TC-T06: a failed approval keeps the dialog open and reports the error', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({ response: { data: { message: 'Already handled by someone else.' } } });
    await renderList();
    fireEvent.click(screen.getByText('Vendor contract renewal'));
    fireEvent.click(await screen.findByRole('button', { name: /^approve$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, approve/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Already handled by someone else.'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('TC-T07: review mode walks the queue and uses Complete for the starting step', async () => {
    await renderList();
    fireEvent.click(screen.getByRole('button', { name: /start review/i }));

    const review = await screen.findByRole('region', { name: 'Review mode' });
    expect(within(review).getByText(/Reviewing/)).toHaveTextContent('Reviewing 1 of 2');
    expect(within(review).getByRole('heading', { name: 'Vendor contract renewal' })).toBeInTheDocument();

    fireEvent.click(within(review).getByRole('button', { name: 'Next task' }));
    expect(await within(review).findByRole('heading', { name: 'Laptop request' })).toBeInTheDocument();
    expect(within(review).getByRole('button', { name: /^complete$/i })).toBeInTheDocument();

    fireEvent.click(within(review).getByRole('button', { name: /exit review/i }));
    expect(screen.queryByRole('region', { name: 'Review mode' })).not.toBeInTheDocument();
  });

  it('TC-T08: review mode keyboard shortcuts move and open the confirmation', async () => {
    await renderList();
    fireEvent.click(screen.getByRole('button', { name: /start review/i }));
    await screen.findByRole('region', { name: 'Review mode' });

    fireEvent.keyDown(document.body, { key: 'j' });
    expect(await screen.findByRole('heading', { name: 'Laptop request' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(await screen.findByRole('alertdialog', { name: 'Complete this task?' })).toBeInTheDocument();
  });

  it('TC-T09: shows an empty state when nothing is assigned', async () => {
    tasks = [];
    render(<TaskList />);
    expect(await screen.findByText(/All clear/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start review/i })).not.toBeInTheDocument();
  });

  it('TC-T10: offers a retry when loading fails', async () => {
    vi.mocked(axiosInstance.get).mockRejectedValueOnce(new Error('network'));
    render(<TaskList />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Vendor contract renewal')).toBeInTheDocument();
  });
});
