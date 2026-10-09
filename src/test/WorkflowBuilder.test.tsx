import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'react-toastify';
import WorkflowBuilder from '../features/workflows/WorkflowBuilder';
import axiosInstance from '../api/axiosInstance';
import type { Workflow, WorkflowDetail } from '../models';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const LIST_URL = '/Workflow?page=1&limit=200';
// Unusual ids on purpose: the builder must use what the server returns, never a guess.
const ROLES = [{ roleId: 7, roleName: 'Manager' }, { roleId: 9, roleName: 'Admin' }];

const LIST: Workflow[] = [
  { workflowId: 1, title: 'Expense Approval', status: 'Active', stepCount: 1, activeTaskCount: 0 },
  { workflowId: 5, title: 'Vendor Onboarding', status: 'Draft', stepCount: 2, activeTaskCount: 0 },
  { workflowId: 6, title: 'Busy Workflow', status: 'Active', stepCount: 1, activeTaskCount: 2 },
];

// Step 1's role is NAMED Manager but has id 9: only approverRoleId may decide the select value.
const DETAIL: WorkflowDetail = {
  workflowId: 5, title: 'Vendor Onboarding', description: 'Vet new suppliers.', status: 'Draft', createdByName: 'Alice', createdAt: '2026-09-20T10:00:00Z',
  steps: [
    { stepId: 31, stepOrder: 1, stepName: 'Manager review', description: 'Check the paperwork.', approverRoleName: 'Manager', approverRoleId: 9, onRejectAction: 'GoBack', escalationHours: 24 },
    { stepId: 32, stepOrder: 2, stepName: 'Legal check', approverRoleName: 'Admin', approverRoleId: 9, onRejectAction: 'Cancel' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosInstance.get).mockImplementation(async (url: string) => {
    if (url === '/Workflow/roles') return { data: ROLES };
    if (url === LIST_URL) return { data: { data: LIST, total: LIST.length } };
    if (url === '/Workflow/5') return { data: DETAIL };
    if (url === '/Workflow/6') return { data: { ...DETAIL, workflowId: 6, title: 'Busy Workflow' } };
    throw Object.assign(new Error('nf'), { response: { status: 404, data: { message: 'Workflow not found.' } } });
  });
  vi.mocked(axiosInstance.post).mockResolvedValue({ data: {} });
  vi.mocked(axiosInstance.put).mockResolvedValue({ data: {} });
});

const open = async (path: string) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workflows" element={<p>LIST PAGE</p>} />
        <Route path="/workflows/new" element={<WorkflowBuilder />} />
        <Route path="/workflows/:id/edit" element={<WorkflowBuilder />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('form');
};

const title = () => screen.getByLabelText(/workflow title/i) as HTMLInputElement;
const stepNames = () => screen.getAllByLabelText(/step name/i) as HTMLInputElement[];
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const preview = () => screen.getByRole('complementary', { name: 'How tasks will flow' });
const submit = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const fillValid = () => {
  type(title(), 'Hardware Request');
  type(stepNames()[0], 'IT approval');
};

describe('Workflow builder', () => {
  it('TC-B01: a new workflow starts with one step whose role is the first role returned', async () => {
    await open('/workflows/new');
    expect(screen.getByRole('heading', { name: 'New workflow' })).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith('/Workflow/roles');
    expect(stepNames()).toHaveLength(1);
    const role = screen.getByLabelText('Who approves') as HTMLSelectElement;
    expect(role.value).toBe('7');
    expect(within(role).getAllByRole('option').map((o) => o.textContent)).toEqual(['Manager', 'Admin']);
    expect(screen.getByRole('radio', { name: /Cancel the task/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save and activate/ })).toBeInTheDocument();
    expect(title()).toHaveFocus();
  });

  it('TC-B02: add, reorder and remove steps; a new step takes focus in its name field', async () => {
    await open('/workflows/new');
    type(stepNames()[0], 'First');
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(stepNames()).toHaveLength(2);
    expect(stepNames()[1]).toHaveFocus();
    expect((screen.getAllByLabelText('Who approves')[1] as HTMLSelectElement).value).toBe('7');
    type(stepNames()[1], 'Second');

    expect(screen.getByRole('button', { name: 'Move step 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move step 2 down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 1 down' }));
    expect(stepNames().map((i) => i.value)).toEqual(['Second', 'First']);
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(stepNames().map((i) => i.value)).toEqual(['First', 'Second']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }));
    expect(stepNames().map((i) => i.value)).toEqual(['Second']);
    expect(screen.getByRole('button', { name: 'Remove step 1' })).toBeDisabled();
  });

  it('TC-B03: the preview follows the form', async () => {
    await open('/workflows/new');
    expect(within(preview()).getByText('Your workflow title')).toBeInTheDocument();
    type(title(), 'Hardware Request');
    type(stepNames()[0], 'IT approval');
    type(screen.getByLabelText('Who approves'), '9');
    type(screen.getByLabelText(/escalate after/i), '12');
    fireEvent.click(screen.getByRole('radio', { name: /Send back one step/ }));

    const p = within(preview());
    expect(p.getByText('Hardware Request')).toBeInTheDocument();
    expect(p.getByText('IT approval')).toBeInTheDocument();
    expect(p.getByText(/Any Admin can approve/)).toBeInTheDocument();
    expect(p.getByText('Escalates after 12h')).toBeInTheDocument();
    expect(p.getByText('If rejected: sent back one step')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Send back one step/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Back to the person who did the work.')).toBeInTheDocument();
  });

  it('TC-B04: Save as draft posts status Draft with role ids and step order, then returns to the list', async () => {
    await open('/workflows/new');
    fillValid();
    type(screen.getByLabelText(/^Description/), '  Laptops and phones.  ');
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    type(stepNames()[1], 'Finance');
    type(screen.getAllByLabelText('Who approves')[1], '9');
    fireEvent.click(screen.getAllByRole('radio', { name: /Send back one step/ })[1]);
    type(screen.getAllByLabelText(/escalate after/i)[1], '48');

    submit(/save as draft/i);
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1));
    expect(axiosInstance.post).toHaveBeenCalledWith('/Workflow', {
      title: 'Hardware Request',
      description: 'Laptops and phones.',
      status: 'Draft',
      steps: [
        { stepOrder: 1, approverRoleId: 7, stepName: 'IT approval', description: '', onRejectAction: 'Cancel', escalationHours: undefined },
        { stepOrder: 2, approverRoleId: 9, stepName: 'Finance', description: '', onRejectAction: 'GoBack', escalationHours: 48 },
      ],
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('LIST PAGE')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('“Hardware Request” saved as a draft.');
  });

  it('TC-B05: Save and activate confirms first and posts status Active', async () => {
    await open('/workflows/new');
    fillValid();
    submit(/save and activate/i);

    const dialog = await screen.findByRole('alertdialog', { name: 'Save and activate?' });
    expect(within(dialog).getByText(/1 approval step: IT approval/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();

    submit(/save and activate/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, save and activate' }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/Workflow', expect.objectContaining({ status: 'Active', title: 'Hardware Request' })));
    expect(await screen.findByText('LIST PAGE')).toBeInTheDocument();
  });

  it('TC-B06: an empty form shows the server messages inline, a warning summary and focuses the title', async () => {
    await open('/workflows/new');
    submit(/save and activate/i);

    expect(await screen.findByText('Workflow title is required.')).toBeInTheDocument();
    expect(screen.getByText('Step 1: name is required.')).toBeInTheDocument();
    expect(screen.getByText('Please fix 2 things below.')).toBeInTheDocument();
    expect(title()).toHaveFocus();
    expect(title()).toHaveAttribute('aria-invalid', 'true');
    expect(title()).toHaveAccessibleDescription('Workflow title is required.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();

    type(title(), 'Hardware Request');
    expect(screen.queryByText('Workflow title is required.')).not.toBeInTheDocument();
    submit(/save as draft/i);
    expect(stepNames()[0]).toHaveFocus();
    expect(screen.getByText('Please fix 1 thing below.')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('TC-B07: title length, description length and step name/instruction limits', async () => {
    await open('/workflows/new');
    type(title(), 'x'.repeat(151));
    type(screen.getByLabelText(/^Description/), 'y'.repeat(1001));
    type(stepNames()[0], 'n'.repeat(101));
    type(screen.getByLabelText(/instructions for the approver/i), 'i'.repeat(501));
    submit(/save as draft/i);

    expect(await screen.findByText('Workflow title must be 150 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Description must be 1000 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Step 1: name must be 100 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Step 1: instructions must be 500 characters or fewer.')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('TC-B08: a title that already exists (any case, extra spaces) is refused against the loaded list', async () => {
    await open('/workflows/new');
    type(title(), '  expense APPROVAL ');
    type(stepNames()[0], 'Review');
    submit(/save as draft/i);
    expect(await screen.findByText('A workflow with this title already exists.')).toBeInTheDocument();
    expect(title()).toHaveFocus();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('TC-B09: escalation must be 1 to 720 hours or empty', async () => {
    await open('/workflows/new');
    fillValid();
    const hours = screen.getByLabelText(/escalate after/i);
    for (const bad of ['0', '721', '-3', '1.5']) {
      type(hours, bad);
      submit(/save as draft/i);
      expect(await screen.findByText('Step 1: escalation must be between 1 and 720 hours.')).toBeInTheDocument();
      expect(hours).toHaveFocus();
    }
    expect(axiosInstance.post).not.toHaveBeenCalled();

    type(hours, '720');
    submit(/save as draft/i);
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/Workflow', expect.objectContaining({
      steps: [expect.objectContaining({ escalationHours: 720 })],
    })));
  });

  it('TC-B10: the add button stops at 20 steps', async () => {
    await open('/workflows/new');
    for (let i = 1; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(stepNames()).toHaveLength(20);
    expect(screen.getByRole('button', { name: /add step/i })).toBeDisabled();
  }, 30_000);

  it('TC-B11: the edit page fills the form from approverRoleId, not from the role name', async () => {
    await open('/workflows/5/edit');
    expect(screen.getByRole('heading', { name: 'Edit workflow' })).toBeInTheDocument();
    expect(title().value).toBe('Vendor Onboarding');
    expect(stepNames().map((i) => i.value)).toEqual(['Manager review', 'Legal check']);
    const roles = screen.getAllByLabelText('Who approves') as HTMLSelectElement[];
    expect(roles.map((r) => r.value)).toEqual(['9', '9']);
    expect((screen.getAllByLabelText(/instructions for the approver/i)[0] as HTMLInputElement).value).toBe('Check the paperwork.');
    expect((screen.getAllByLabelText(/escalate after/i)[0] as HTMLInputElement).value).toBe('24');
    expect(screen.getAllByRole('radio', { name: /Send back one step/ })[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument();
  });

  it('TC-B12: Save changes confirms, then PUTs with the current status and the loaded role ids', async () => {
    await open('/workflows/5/edit');
    type(stepNames()[1], 'Legal and tax check');
    submit(/save changes/i);

    const dialog = await screen.findByRole('alertdialog', { name: 'Save these changes?' });
    expect(within(dialog).getByText('Its status stays Draft.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(axiosInstance.put).not.toHaveBeenCalled();

    submit(/save changes/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, save' }));
    await waitFor(() => expect(axiosInstance.put).toHaveBeenCalledTimes(1));
    expect(axiosInstance.put).toHaveBeenCalledWith('/Workflow/5', {
      title: 'Vendor Onboarding',
      description: 'Vet new suppliers.',
      status: 'Draft',
      steps: [
        { stepOrder: 1, approverRoleId: 9, stepName: 'Manager review', description: 'Check the paperwork.', onRejectAction: 'GoBack', escalationHours: 24 },
        { stepOrder: 2, approverRoleId: 9, stepName: 'Legal and tax check', description: '', onRejectAction: 'Cancel', escalationHours: undefined },
      ],
    });
    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(await screen.findByText('LIST PAGE')).toBeInTheDocument();
  });

  it('TC-B13: keeping its own title is fine when editing', async () => {
    await open('/workflows/5/edit');
    submit(/save changes/i);
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByText('A workflow with this title already exists.')).not.toBeInTheDocument();
  });

  it('TC-B14: the edit URL of a locked workflow explains why and links back, with no form', async () => {
    render(
      <MemoryRouter initialEntries={['/workflows/6/edit']}>
        <Routes>
          <Route path="/workflows" element={<p>LIST PAGE</p>} />
          <Route path="/workflows/:id/edit" element={<WorkflowBuilder />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Cannot modify “Busy Workflow” while 2 tasks are in progress/)).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    const back = screen.getAllByRole('link', { name: /back to workflows/i });
    expect(back[0]).toHaveAttribute('href', '/workflows');
  });

  it('TC-B15: a server refusal lands in a focused alert banner and the user stays on the form', async () => {
    vi.mocked(axiosInstance.put).mockRejectedValueOnce({ response: { status: 400, data: { message: 'Cannot modify a workflow with active in-progress tasks.' } } });
    await open('/workflows/5/edit');
    submit(/save changes/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, save' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Cannot modify a workflow with active in-progress tasks.');
    expect(banner).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('LIST PAGE')).not.toBeInTheDocument();
    expect(title().value).toBe('Vendor Onboarding');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('TC-B16: a create 409/400 from the server is shown too', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({ response: { status: 409, data: { message: 'A workflow with this title already exists.' } } });
    await open('/workflows/new');
    fillValid();
    submit(/save as draft/i);
    expect(await screen.findByRole('alert')).toHaveTextContent('A workflow with this title already exists.');
    expect(screen.getByRole('button', { name: /save as draft/i })).not.toBeDisabled();
  });

  it('TC-B17: Formalize with AI replaces the text, Restore original brings it back, and a failure keeps the text', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: { formalizedText: 'A formal description.' } });
    await open('/workflows/new');
    const formalize = screen.getByRole('button', { name: /formalize with ai/i });
    expect(formalize).toBeDisabled();
    const desc = screen.getByLabelText(/^Description/) as HTMLTextAreaElement;
    type(desc, 'rough notes');
    fireEvent.click(formalize);
    await waitFor(() => expect(desc.value).toBe('A formal description.'));
    expect(axiosInstance.post).toHaveBeenCalledWith('/Task/formalize-description', { rawText: 'rough notes', context: 'workflow' });

    fireEvent.click(screen.getByRole('button', { name: /restore original/i }));
    expect(desc.value).toBe('rough notes');
    expect(screen.queryByRole('button', { name: /restore original/i })).not.toBeInTheDocument();

    vi.mocked(axiosInstance.post).mockRejectedValueOnce(new Error('ai down'));
    fireEvent.click(screen.getByRole('button', { name: /formalize with ai/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(desc.value).toBe('rough notes');
  });

  it('TC-B18: Cancel goes back to the list without saving', async () => {
    await open('/workflows/new');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('LIST PAGE')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('TC-B19: an unknown workflow shows the server message and a way back', async () => {
    render(
      <MemoryRouter initialEntries={['/workflows/99/edit']}>
        <Routes><Route path="/workflows/:id/edit" element={<WorkflowBuilder />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Workflow not found.');
    expect(screen.getByRole('link', { name: /back to workflows/i })).toBeInTheDocument();
  });

  it('TC-B20: a failed load offers Try again', async () => {
    vi.mocked(axiosInstance.get).mockRejectedValueOnce(new Error('network'));
    render(<MemoryRouter initialEntries={['/workflows/new']}><Routes><Route path="/workflows/new" element={<WorkflowBuilder />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('form')).toBeInTheDocument();
  });
});
