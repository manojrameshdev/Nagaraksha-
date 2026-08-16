import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { StakeholderWorkspace, AdminWorkspace, ResponderWorkspace } from '../nagraksha/workspaces';
import { AppShell } from '../nagraksha/shell';
import type { Role } from '../nagraksha/shell';

describe('StakeholderWorkspace — live registry', () => {
  it('loads stakeholders from the backend and renders them in the table', async () => {
    render(<StakeholderWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Kasaragod District Hospital')).toBeTruthy();
    });
    expect(screen.getByText('Forest Rescue Unit')).toBeTruthy();
  });

  it('filters the table as the search box is typed into', async () => {
    render(<StakeholderWorkspace />);
    await waitFor(() => {
      expect(screen.getByText('Kasaragod District Hospital')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Search stakeholders'), {
      target: { value: 'Forest' },
    });

    await waitFor(() => {
      expect(screen.getByText('Forest Rescue Unit')).toBeTruthy();
    });
    expect(screen.queryByText('Kasaragod District Hospital')).toBeNull();
  });

  it('adds a stakeholder through the inline form and refreshes the list', async () => {
    render(<StakeholderWorkspace />);
    await waitFor(() => {
      expect(screen.getByText('Kasaragod District Hospital')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add stakeholder/i }));
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'MSRIT NSS Unit' },
    });
    fireEvent.change(screen.getByLabelText('District'), {
      target: { value: 'Bengaluru' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add to registry/i }));

    await waitFor(() => {
      expect(screen.getByText('Stakeholder added.')).toBeTruthy();
    });
  });
});

describe('ResponderWorkspace — full incident load', () => {
  it('renders without crashing and shows pending symptoms when the list endpoint returns a slim row', async () => {
    // The /api/incidents list handler returns a slim row (no symptomObservations);
    // useLatestIncident must upgrade it via GET /api/incidents/:id before render.
    render(<ResponderWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('mock-incident-id-123')).toBeTruthy();
    });
    expect(screen.getByText('Pending log')).toBeTruthy();
  });
});

describe('AdminWorkspace — live system data', () => {
  it('shows live incident, audit and outbox numbers from the backend', async () => {
    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/5 records/i)).toBeTruthy();
    });
    expect(screen.getByText(/SOS_TRIGGERED/i)).toBeTruthy();
    expect(screen.getByText(/2 pending · 8 processed · 0 failed/i)).toBeTruthy();
  });
});

describe('AppShell — mobile workspace menu', () => {
  it('opens the role menu when the header menu button is clicked and switches role', async () => {
    const handleRoleChange = (role: Role) => {
      expect(role).toBe('Responder');
    };
    const { rerender } = render(
      <AppShell role="Victim" onRoleChange={handleRoleChange}>
        <p>content</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open workspace menu/i }));
    expect(screen.getByText('SWITCH WORKSPACE')).toBeTruthy();

    const menu = screen.getByText('SWITCH WORKSPACE').closest('div');
    expect(menu).toBeTruthy();
    fireEvent.click(within(menu as HTMLElement).getByRole('button', { name: 'Responder desk' }));
    rerender(
      <AppShell role="Responder" onRoleChange={handleRoleChange}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getAllByText('Responder desk').length).toBeGreaterThan(0);
  });
});
