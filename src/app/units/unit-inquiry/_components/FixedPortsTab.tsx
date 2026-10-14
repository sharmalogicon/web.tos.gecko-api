"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useApiList } from '@/lib/api/use-api';
import { ApiError } from '@/lib/api/problem';
import { PORTS_PATH, type Port } from '@/lib/api/logistics';
import { fromRegistry, requestFrom, saveRegistry, type RegistryRow } from '@/lib/api/container-master';
import { formatDateTime } from '@/lib/format';

/**
 * FIXED PORTS — Vector's "Fix Port Details", on its own tab.
 *
 * The ports this box is designated to. Empty means ANY port, which is the
 * common case and is said in words: an empty grid on the desktop said nothing
 * at all, and a clerk could not tell "no restriction" from "not set up yet".
 *
 * IT SHARES ONE ENDPOINT AND ONE rowVersion WITH THE MASTER DATA TAB. The
 * registry PUT replaces the whole row, so saving from here has to send the
 * identity fields back exactly as they were read — which is what `fromRegistry`
 * gives, with only the port list swapped. Send less and the box would lose its
 * tare weight for the sake of a port.
 *
 * The consequence is worth knowing: two clerks, one on each tab, will collide
 * on `rowVersion` and the second gets a 409. That is the right answer — they
 * are editing one record — and the page re-reads so the loser can re-apply.
 */

export function FixedPortsTab({ registry, registryError, canView, canEdit, onSaved }: {
  registry: RegistryRow | null;
  registryError: number | null;
  canView: boolean;
  canEdit: boolean;
  onSaved: () => void;
}) {
  if (!canView) return <div className="gecko-cell-meta">You do not have access to the container registry.</div>;
  if (registryError === 404) {
    return (
      <div className="gecko-alert gecko-alert-info">
        <Icon name="info" size={18} />
        <div>
          <strong>Not in the container registry</strong>
          <div>
            Fixed ports are a property of the registry record, and this box has none. Register it from
            Masters → Containers first.
          </div>
        </div>
      </div>
    );
  }
  if (!registry) {
    return <div className="gecko-cell-meta">{registryError ? 'The registry could not be read.' : 'Reading the registry…'}</div>;
  }
  // Keyed on the version: a save re-reads, and the editor starts from what came back.
  return <Ports key={registry.rowVersion} registry={registry} canEdit={canEdit} onSaved={onSaved} />;
}

function Ports({ registry, canEdit, onSaved }: {
  registry: RegistryRow; canEdit: boolean; onSaved: () => void;
}) {
  const { toast } = useToast();
  const saved = useMemo(() => [...(registry.fixedPortCodes ?? [])], [registry.fixedPortCodes]);
  const [codes, setCodes] = useState<string[]>(saved);
  const [picked, setPicked] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const ports = useApiList<Port>(`${PORTS_PATH}?pageSize=500&isActive=true`);
  const all = ports.data ?? [];
  const nameOf = (code: string) => all.find(p => p.portCode === code)?.portNameEn ?? null;
  const available = all.filter(p => !codes.includes(p.portCode));
  const dirty = codes.join(',') !== saved.join(',');

  const add = () => {
    if (!picked || codes.includes(picked)) return;
    setCodes([...codes, picked]);
    setPicked('');
  };

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      // The whole row, with only the ports changed — the PUT is a replace.
      await saveRegistry(registry.containerNo, requestFrom(
        { ...fromRegistry(registry), fixedPortCodes: codes }, registry.rowVersion,
      ));
      toast({
        variant: 'success',
        title: 'Fixed ports saved',
        message: codes.length === 0 ? 'The box may go out to any port.' : codes.join(', '),
      });
      onSaved();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setFailure(err);
      if (err.status === 409) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gecko-stack gecko-cm-stack">
      {failure && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{failure.forField('fixedPortCodes') ?? failure.title}</strong>
            {failure.status === 409 && <div>Somebody else saved this container first. It was re-read — apply your change again.</div>}
            {failure.status !== 409 && failure.explanation && <div>{failure.explanation}</div>}
          </div>
        </div>
      )}

      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow"><Icon name="mapPin" size={13} /> Fixed ports</div>
          <span className="gecko-cell-meta">
            {codes.length === 0
              ? 'No fixed port — the box may go out to any port.'
              : `Restricted to ${codes.length} port${codes.length === 1 ? '' : 's'}; an export gate-out to any other is refused.`}
          </span>
        </div>

        {canEdit && (
          <div className="gecko-cm-port-add">
            <select className="gecko-select" value={picked} onChange={e => setPicked(e.target.value)}
              disabled={available.length === 0}>
              <option value="">
                {ports.error ? 'The port master could not be read'
                  : available.length === 0 ? 'Every port is already listed'
                  : 'Choose a port…'}
              </option>
              {available.map(p => (
                <option key={p.portCode} value={p.portCode}>{p.portCode} · {p.portNameEn}</option>
              ))}
            </select>
            <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={!picked} onClick={add}>
              <Icon name="plus" size={13} /> Add
            </button>
          </div>
        )}

        {codes.length > 0 ? (
          <table className="gecko-table gecko-cm-port-table">
            <thead><tr><th>Port code</th><th>Port name</th><th className="gecko-cm-port-action" /></tr></thead>
            <tbody>
              {codes.map(code => (
                <tr key={code}>
                  <td className="gecko-mono">{code}</td>
                  <td>{nameOf(code) ?? <span className="gecko-cell-meta">not in the port master</span>}</td>
                  <td className="gecko-cm-port-action">
                    {canEdit && (
                      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                        title={`Remove ${code}`} onClick={() => setCodes(codes.filter(c => c !== code))}>
                        <Icon name="x" size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="gecko-cell-meta">
            Nothing listed. Add a port to restrict where this box may be sent; leave it empty and it may go anywhere.
          </div>
        )}
      </section>

      {canEdit && (
        <div className="gecko-cm-save">
          <div className="gecko-cell-meta">
            {dirty ? 'Unsaved changes.' : 'Nothing changed.'}
            {registry.updatedAt && <> Last modified {formatDateTime(registry.updatedAt)}.</>}
          </div>
          <div className="gecko-cm-save-actions">
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              disabled={!dirty || saving} onClick={() => { setCodes(saved); setFailure(null); }}>
              Discard
            </button>
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? <><span className="gecko-spinner gecko-spinner-sm" /> Saving…</> : <><Icon name="save" size={14} /> Save ports</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
