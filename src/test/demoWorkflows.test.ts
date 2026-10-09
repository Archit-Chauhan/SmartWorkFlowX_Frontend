import { describe, it, expect } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { demoAdapter } from '../demo/mockAdapter';

const call = async (method: string, url: string, data?: unknown) => {
  try {
    const res = await demoAdapter({ method, url, data } as InternalAxiosRequestConfig);
    return { ok: true as const, data: res.data as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch (e) {
    const err = e as { response: { status: number; data: { message: string } } };
    return { ok: false as const, status: err.response.status, message: err.response.data.message };
  }
};

const step = (over: Record<string, unknown> = {}) => ({ stepOrder: 9, approverRoleId: 2, stepName: 'Review', description: '', onRejectAction: 'Cancel', ...over });
const body = (over: Record<string, unknown> = {}) => ({ title: 'Brand new flow', description: '', steps: [step()], ...over });

describe('demo workflow API follows the contract', () => {
  it('TC-D01: list items carry description, creator, date, lock count and the steps summary', async () => {
    const res = await call('get', '/Workflow?page=1&limit=200');
    const items = res.data.data as { workflowId: number; status: string; activeTaskCount: number; steps: { stepOrder: number }[]; stepCount: number; createdByName: string; createdAt: string }[];
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.filter((w) => w.activeTaskCount > 0).length).toBeGreaterThanOrEqual(2);
    expect(items.some((w) => w.status === 'Draft' && w.activeTaskCount === 0)).toBe(true);
    expect(items.some((w) => w.status === 'Inactive' && w.activeTaskCount === 0)).toBe(true);
    for (const w of items) {
      expect(w.steps).toHaveLength(w.stepCount);
      expect(w.createdByName).toBeTruthy();
      expect(w.createdAt).toBeTruthy();
    }
  });

  it('TC-D02: the detail has approverRoleId on every step', async () => {
    const res = await call('get', '/Workflow/1');
    expect(res.data.steps.every((s: { approverRoleId: unknown }) => typeof s.approverRoleId === 'number')).toBe(true);
    const missing = await call('get', '/Workflow/9999');
    expect(missing).toMatchObject({ ok: false, status: 404, message: 'Workflow not found.' });
  });

  it('TC-D03: create validates in the server order with the server messages', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ title: '   ' }, 'Workflow title is required.'],
      [{ title: 'x'.repeat(151) }, 'Workflow title must be 150 characters or fewer.'],
      [{ title: ' expense approval ' }, 'A workflow with this title already exists.'],
      [{ description: 'd'.repeat(1001) }, 'Description must be 1000 characters or fewer.'],
      [{ steps: [] }, 'A workflow needs at least one step.'],
      [{ steps: Array.from({ length: 21 }, () => step()) }, 'A workflow can have at most 20 steps.'],
      [{ steps: [step({ stepName: ' ' })] }, 'Step 1: name is required.'],
      [{ steps: [step(), step({ stepName: 'n'.repeat(101) })] }, 'Step 2: name must be 100 characters or fewer.'],
      [{ steps: [step({ description: 'i'.repeat(501) })] }, 'Step 1: instructions must be 500 characters or fewer.'],
      [{ steps: [step({ approverRoleId: 99 })] }, 'Step 1: the approver role was not found.'],
      [{ steps: [step({ onRejectAction: 'Nope' })] }, 'Step 1: reject action must be GoBack or Cancel.'],
      [{ steps: [step({ escalationHours: 721 })] }, 'Step 1: escalation must be between 1 and 720 hours.'],
      [{ steps: [step({ escalationHours: 0 })] }, 'Step 1: escalation must be between 1 and 720 hours.'],
      [{ status: 'Inactive' }, 'Status must be Draft or Active when creating.'],
    ];
    for (const [over, message] of cases) {
      expect(await call('post', '/Workflow', body(over))).toMatchObject({ ok: false, status: 400, message });
    }
  });

  it('TC-D04: create honours status, stores order by position, and the new workflow shows in the list', async () => {
    expect((await call('post', '/Workflow', body({ title: 'Active on creation', status: 'Active', steps: [step({ stepOrder: 5 }), step({ stepName: 'Second', stepOrder: 1 })] }))).ok).toBe(true);
    expect((await call('post', '/Workflow', body({ title: 'Plain draft' }))).ok).toBe(true);
    const list = (await call('get', '/Workflow?page=1&limit=200')).data.data as { title: string; status: string; workflowId: number; steps: { stepOrder: number; stepName: string }[] }[];
    const active = list.find((w) => w.title === 'Active on creation')!;
    expect(active.status).toBe('Active');
    expect(active.steps.map((s) => [s.stepOrder, s.stepName])).toEqual([[1, 'Review'], [2, 'Second']]);
    expect(list.find((w) => w.title === 'Plain draft')!.status).toBe('Draft');
  });

  it('TC-D05: locked workflows refuse edit and deactivate; others can be changed, activated and cloned', async () => {
    const list = (await call('get', '/Workflow?page=1&limit=200')).data.data as { workflowId: number; title: string; status: string; activeTaskCount: number }[];
    const locked = list.find((w) => w.activeTaskCount > 0)!;
    expect(await call('put', `/Workflow/${locked.workflowId}`, { ...body({ title: locked.title }), status: locked.status }))
      .toMatchObject({ ok: false, status: 400, message: 'Cannot modify a workflow with active in-progress tasks.' });
    expect(await call('delete', `/Workflow/${locked.workflowId}`))
      .toMatchObject({ ok: false, status: 400, message: 'Cannot deactivate a workflow with active in-progress tasks.' });

    const free = list.find((w) => w.title === 'Purchase Order Approval')!;
    expect(free.activeTaskCount).toBe(0);
    expect((await call('put', `/Workflow/${free.workflowId}`, { ...body({ title: free.title }), status: 'Bogus' })))
      .toMatchObject({ ok: false, message: 'Status must be Draft, Active or Inactive.' });
    expect((await call('put', `/Workflow/${free.workflowId}`, { ...body({ title: free.title }), status: 'Draft' })).ok).toBe(true);

    expect((await call('post', `/Workflow/${free.workflowId}/activate`)).data.message).toBe('Workflow activated successfully.');
    expect((await call('post', `/Workflow/${free.workflowId}/activate`)).data.message).toBe('Workflow is already active.');
    expect((await call('post', '/Workflow/9999/activate'))).toMatchObject({ ok: false, status: 404, message: 'Workflow not found.' });

    expect((await call('post', `/Workflow/${free.workflowId}/clone`)).ok).toBe(true);
    expect((await call('delete', `/Workflow/${free.workflowId}`)).ok).toBe(true);
    const after = (await call('get', '/Workflow?page=1&limit=200')).data.data as { workflowId: number; title: string; status: string }[];
    expect(after.find((w) => w.workflowId === free.workflowId)!.status).toBe('Inactive');
    expect(after.find((w) => w.title === 'Purchase Order Approval (Copy)')!.status).toBe('Draft');
  });
});
