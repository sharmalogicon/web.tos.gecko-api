"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import {
  WORKFLOWS as INITIAL_WORKFLOWS,
  ROLE_LABELS,
  describeThreshold,
  type ApprovalWorkflow,
  type ApprovalStep,
  type ApproverKind,
  type ApprovalThreshold,
} from '@/lib/approval-workflows';

const APPLIES_TO_LABEL: Record<string, string> = {
  TARIFF_SCHEDULE: 'Tariff Schedule',
  REBATE: 'Rebate',
  CREDIT_NOTE: 'Credit Note',
};

const KIND_LABEL: Record<ApproverKind, string> = {
  user: 'Specific user',
  role: 'Any user in role',
  auto: 'System auto-step',
};

const THRESHOLD_OPTIONS: { value: ApprovalThreshold['condition']; label: string; needsValue: boolean }[] = [
  { value: 'never',              label: 'Always manual (never auto)',          needsValue: false },
  { value: 'always',             label: 'Always auto-approve',                  needsValue: false },
  { value: 'delta-pct-lt',       label: 'Auto if Δ vs standard < N%',            needsValue: true  },
  { value: 'amount-lt',          label: 'Auto if total < N THB',                 needsValue: true  },
  { value: 'ai-confidence-gte',  label: 'Auto if AI confidence ≥ N (0–1)',       needsValue: true  },
];

let _idSeed = 1000;
const newId = (p: string) => `${p}-${_idSeed++}`;

export default function ApprovalWorkflowsPage() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>(INITIAL_WORKFLOWS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_WORKFLOWS[0]?.id ?? '');
  const [dirty, setDirty] = useState(false);

  const selected = workflows.find(w => w.id === selectedId);

  const updateSelected = (patch: Partial<ApprovalWorkflow>) => {
    if (!selected) return;
    setDirty(true);
    setWorkflows(ws => ws.map(w => w.id === selected.id ? { ...w, ...patch } : w));
  };

  const updateStep = (stepId: string, patch: Partial<ApprovalStep>) => {
    if (!selected) return;
    setDirty(true);
    setWorkflows(ws => ws.map(w => w.id === selected.id
      ? { ...w, steps: w.steps.map(s => s.id === stepId ? { ...s, ...patch } : s) }
      : w
    ));
  };

  const addStep = () => {
    if (!selected) return;
    setDirty(true);
    setWorkflows(ws => ws.map(w => w.id === selected.id
      ? {
        ...w,
        steps: [...w.steps, {
          id: newId('s'),
          name: 'New approval step',
          approverKind: 'role',
          approverRef: 'SALES_MGR',
        }],
      }
      : w
    ));
  };

  const removeStep = (stepId: string) => {
    if (!selected) return;
    setDirty(true);
    setWorkflows(ws => ws.map(w => w.id === selected.id
      ? { ...w, steps: w.steps.filter(s => s.id !== stepId) }
      : w
    ));
  };

  const moveStep = (stepId: string, dir: -1 | 1) => {
    if (!selected) return;
    setDirty(true);
    setWorkflows(ws => ws.map(w => {
      if (w.id !== selected.id) return w;
      const idx = w.steps.findIndex(s => s.id === stepId);
      const ni = idx + dir;
      if (ni < 0 || ni >= w.steps.length) return w;
      const next = [...w.steps];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return { ...w, steps: next };
    }));
  };

  const setAsDefault = () => {
    if (!selected) return;
    setDirty(true);
    setWorkflows(ws => ws.map(w => ({ ...w, isDefault: w.id === selected.id })));
    toast({ variant: 'success', title: 'Default updated', message: `"${selected.name}" is now the default workflow.` });
  };

  const newWorkflow = () => {
    const id = newId('wf');
    const wf: ApprovalWorkflow = {
      id,
      name: 'Untitled workflow',
      description: '',
      isDefault: false,
      appliesTo: ['TARIFF_SCHEDULE'],
      steps: [
        { id: newId('s'), name: 'Sales draft', approverKind: 'role', approverRef: 'SALES' },
        { id: newId('s'), name: 'Sales Manager', approverKind: 'role', approverRef: 'SALES_MGR' },
      ],
    };
    setWorkflows(ws => [...ws, wf]);
    setSelectedId(id);
    setDirty(true);
  };

  const onSave = () => {
    setDirty(false);
    toast({ variant: 'success', title: 'Workflows saved', message: `${workflows.length} workflows persisted.` });
  };

  return (
    <div className="gecko-stack gecko-stack-lg" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 20, paddingBottom: 40 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline" style={{ gap: 12 }}>
            <h1 className="gecko-page-title">Approval Workflows</h1>
            <span className="gecko-count-badge">{workflows.length} workflows</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Configurable multi-step approval chains. Drives sign-off on tariffs, rebates, and credit notes.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={newWorkflow}>
            <Icon name="plus" size={14} /> New Workflow
          </button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onSave} disabled={!dirty}>
            <Icon name="save" size={14} /> {dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'flex-start' }}>

        {/* Left: list */}
        <div className="gecko-table-card">
          <div className="gecko-eyebrow" style={{ padding: '10px 14px', borderBottom: '1px solid var(--gecko-border)' }}>
            All Workflows
          </div>
          {workflows.map(w => {
            const active = w.id === selectedId;
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px',
                  background: active ? 'var(--gecko-primary-50)' : 'transparent',
                  border: 'none', borderLeft: `3px solid ${active ? 'var(--gecko-primary-600)' : 'transparent'}`,
                  borderBottom: '1px solid var(--gecko-border)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div className="gecko-row gecko-row-between" style={{ gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>{w.name}</span>
                  {w.isDefault && <span className="gecko-pill gecko-pill-primary" style={{ fontSize: 9 }}>DEFAULT</span>}
                </div>
                <div className="gecko-cell-meta" style={{ lineHeight: 1.4 }}>{w.description || <em style={{ color: 'var(--gecko-text-disabled)' }}>No description</em>}</div>
                <div className="gecko-row" style={{ gap: 6, fontSize: 10, color: 'var(--gecko-text-disabled)' }}>
                  <Icon name="layers" size={10} /> {w.steps.length} step{w.steps.length === 1 ? '' : 's'}
                  <span>·</span>
                  {w.appliesTo.map(a => APPLIES_TO_LABEL[a]).join(', ')}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: detail */}
        {selected && (
          <div className="gecko-stack gecko-stack-lg">

            {/* Header card */}
            <div className="gecko-card gecko-card-padded">
              <div className="gecko-row" style={{ gap: 12, marginBottom: 14 }}>
                <Icon name="gitBranch" size={20} style={{ color: 'var(--gecko-primary-600)' }} />
                <h2 className="gecko-card-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selected.name}</h2>
                {selected.isDefault
                  ? <span className="gecko-pill gecko-pill-primary">DEFAULT</span>
                  : <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={setAsDefault}>Set as default</button>
                }
              </div>

              <div className="gecko-grid-2" style={{ gap: 14 }}>
                <div className="gecko-field">
                  <div className="gecko-field-label">Name</div>
                  <input className="gecko-input" value={selected.name} onChange={e => updateSelected({ name: e.target.value })} />
                </div>
                <div className="gecko-field">
                  <div className="gecko-field-label">Applies To</div>
                  <div className="gecko-row gecko-row-wrap" style={{ gap: 6 }}>
                    {(['TARIFF_SCHEDULE', 'REBATE', 'CREDIT_NOTE'] as const).map(a => {
                      const on = selected.appliesTo.includes(a);
                      return (
                        <button
                          key={a}
                          className={`gecko-axis-chip ${on ? 'gecko-axis-chip-active' : ''}`}
                          onClick={() => updateSelected({
                            appliesTo: on ? selected.appliesTo.filter(x => x !== a) : [...selected.appliesTo, a],
                          })}
                          style={{ fontSize: 11 }}
                        >
                          {on ? <Icon name="check" size={10} /> : <Icon name="plus" size={10} />}
                          {APPLIES_TO_LABEL[a]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="gecko-field" style={{ marginTop: 14 }}>
                <div className="gecko-field-label">Description</div>
                <textarea
                  className="gecko-textarea"
                  rows={2}
                  value={selected.description}
                  onChange={e => updateSelected({ description: e.target.value })}
                  placeholder="When should this workflow be used?"
                />
              </div>
            </div>

            {/* Steps */}
            <div className="gecko-table-card">
              <div className="gecko-row gecko-row-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)' }}>
                <div>
                  <div className="gecko-section-header-title">Approval steps</div>
                  <div className="gecko-section-header-subtitle">Ordered chain. Each step blocks until approved or auto-skipped.</div>
                </div>
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={addStep}>
                  <Icon name="plus" size={14} /> Add step
                </button>
              </div>

              <div className="gecko-stack" style={{ padding: 18, gap: 10 }}>
                {selected.steps.length === 0 && (
                  <div className="gecko-empty-state" style={{ padding: 32 }}>
                    <Icon name="layers" size={28} className="gecko-empty-state-icon" />
                    <div className="gecko-empty-state-title">No steps yet</div>
                    <div className="gecko-empty-state-description">A workflow needs at least one step. Click <strong>Add step</strong>.</div>
                  </div>
                )}

                {selected.steps.map((s, i) => (
                  <div key={s.id} className="gecko-workflow-step">
                    <div className="gecko-row" style={{ gap: 10 }}>
                      <div className="gecko-workflow-step-num">{i + 1}</div>
                      <div className="gecko-flex-1" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                        <input
                          className="gecko-input gecko-input-sm"
                          value={s.name}
                          onChange={e => updateStep(s.id, { name: e.target.value })}
                          placeholder="Step name"
                        />
                        <select
                          className="gecko-select gecko-input-sm"
                          value={s.approverKind}
                          onChange={e => updateStep(s.id, { approverKind: e.target.value as ApproverKind })}
                        >
                          {(['user', 'role', 'auto'] as ApproverKind[]).map(k =>
                            <option key={k} value={k}>{KIND_LABEL[k]}</option>
                          )}
                        </select>
                        {s.approverKind === 'auto' ? (
                          <input
                            className="gecko-input gecko-input-sm"
                            value={s.approverRef}
                            readOnly
                            style={{ background: 'var(--gecko-bg-subtle)', fontStyle: 'italic' }}
                          />
                        ) : s.approverKind === 'role' ? (
                          <select
                            className="gecko-select gecko-input-sm"
                            value={s.approverRef}
                            onChange={e => updateStep(s.id, { approverRef: e.target.value })}
                          >
                            {Object.entries(ROLE_LABELS).map(([k, v]) =>
                              <option key={k} value={k}>{v}</option>
                            )}
                          </select>
                        ) : (
                          <input
                            className="gecko-input gecko-input-sm"
                            value={s.approverRef}
                            onChange={e => updateStep(s.id, { approverRef: e.target.value })}
                            placeholder="Username"
                          />
                        )}
                      </div>
                      <div className="gecko-row" style={{ gap: 2 }}>
                        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={() => moveStep(s.id, -1)} disabled={i === 0}>
                          <Icon name="chevronUp" size={13} />
                        </button>
                        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={() => moveStep(s.id, 1)} disabled={i === selected.steps.length - 1}>
                          <Icon name="chevronDown" size={13} />
                        </button>
                        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={() => removeStep(s.id)} title="Remove step">
                          <Icon name="trash" size={13} style={{ color: 'var(--gecko-error-500)' }} />
                        </button>
                      </div>
                    </div>

                    {/* Threshold rule */}
                    <div style={{ marginTop: 10, marginLeft: 38, paddingTop: 10, borderTop: '1px dashed var(--gecko-border)' }}>
                      <div className="gecko-row gecko-row-wrap gecko-stack-md">
                        <span className="gecko-eyebrow" style={{ letterSpacing: '0.05em' }}>
                          Auto rule:
                        </span>
                        <select
                          className="gecko-select gecko-input-sm"
                          value={s.threshold?.condition ?? 'never'}
                          onChange={e => updateStep(s.id, {
                            threshold: e.target.value === 'never'
                              ? undefined
                              : { condition: e.target.value as ApprovalThreshold['condition'], value: s.threshold?.value ?? 0 },
                          })}
                          style={{ minWidth: 280 }}
                        >
                          {THRESHOLD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {s.threshold && THRESHOLD_OPTIONS.find(o => o.value === s.threshold!.condition)?.needsValue && (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="gecko-input gecko-input-sm"
                            value={s.threshold.value ?? 0}
                            onChange={e => updateStep(s.id, {
                              threshold: { ...s.threshold!, value: Number(e.target.value) || 0 },
                            })}
                            style={{ width: 100 }}
                          />
                        )}
                        {s.threshold && describeThreshold(s.threshold) && (
                          <span style={{ fontSize: 11, color: 'var(--gecko-info-700)', fontStyle: 'italic' }}>
                            → {describeThreshold(s.threshold)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gecko-row gecko-row-start" style={{ padding: 14, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 10, gap: 10, fontSize: 12, color: 'var(--gecko-info-700)' }}>
              <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>AI-future room:</strong> the threshold rule format is structured DSL. Once we ship the AI rate-suggestion engine,
                an extra threshold (<code>ai-confidence-gte</code>) will let workflows auto-approve AI suggestions above a confidence floor
                without schema migration. Available today in the rule dropdown above.
              </div>
            </div>
          </div>
        )}

        {!selected && (
          <div className="gecko-empty-state" style={{ padding: 48 }}>
            <Icon name="gitBranch" size={36} className="gecko-empty-state-icon" />
            <div className="gecko-empty-state-title">Pick a workflow on the left</div>
            <div className="gecko-empty-state-description">Or click <strong>+ New Workflow</strong> to create one.</div>
          </div>
        )}
      </div>
    </div>
  );
}
