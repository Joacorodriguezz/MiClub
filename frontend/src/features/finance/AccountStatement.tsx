import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isOrganizationId, readApiUrl } from '../../shared/api/client';
import { isStatement, methods, pesos, type Statement } from './statement';

const paymentDate = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

export function AccountStatement({ club, userId, auth }: { club: string; userId: string; auth: SupabaseClient }) {
  const [account, setAccount] = useState('');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    const id = account.trim().toLowerCase();
    setStatement(null);
    if (!isOrganizationId(id)) {
      setMessage('Ingresá un identificador de cuenta válido (UUID).');
      return;
    }
    setLoading(true);
    setMessage('Consultando la cuenta…');
    try {
      const { data } = await auth.auth.getSession();
      if (!data.session || data.session.user.id !== userId) throw new Error();
      const base = readApiUrl();
      if (!base) throw new Error();
      const response = await fetch(base + '/api/v1/accounts/' + id + '/statement', {
        signal: request.signal, cache: 'no-store', redirect: 'error',
        headers: { Authorization: 'Bearer ' + data.session.access_token, 'X-Organization-Id': club, Accept: 'application/json' },
      });
      if (request.signal.aborted) return;
      if (!response.ok) {
        setMessage(response.status === 401 || response.status === 403
          ? 'La API no autorizó la consulta para este club.'
          : response.status === 404 ? 'Cuenta o servicio de cobranza no disponible.' : 'No se pudo consultar la cuenta.');
        return;
      }
      const body: unknown = await response.json();
      if (request.signal.aborted) return;
      if (!isStatement(body, id)) throw new Error();
      setStatement(body);
      setMessage('');
    } catch {
      if (!request.signal.aborted) setMessage('No se pudo obtener la cuenta corriente. Volvé a intentar.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return <section className="checks" aria-labelledby="cuenta-title">
    <h2 id="cuenta-title">Cuenta corriente</h2>
    <form className="form" onSubmit={search}>
      <label>Identificador de la cuenta
        <input value={account} required autoComplete="off" spellCheck={false} onChange={event => {
          active.current?.abort();
          setLoading(false);
          setMessage('');
          setStatement(null);
          setAccount(event.target.value);
        }} />
      </label>
      <button disabled={loading}>Consultar cuenta</button>
    </form>
    <p role="status" hidden={!message}>{message}</p>
    {statement && <div className="checks">
      <div className="card">
        <h3>{statement.charges.length === 0 && statement.payments.length === 0
          ? 'Sin movimientos para esta cuenta' : statement.status === 'UP_TO_DATE' ? 'Al día' : 'En mora'}</h3>
        <p>Importes en pesos argentinos (ARS)</p>
        <dl><dt>Deuda total</dt><dd>{pesos(statement.totals.debtCents)}</dd>
          <dt>Vencido</dt><dd>{pesos(statement.totals.overdueCents)}</dd>
          <dt>Saldo a favor</dt><dd>{pesos(statement.totals.creditCents)}</dd></dl>
      </div>
      <div className="card"><h3>Cargos</h3>
        {!statement.charges.length && <p>Sin cargos registrados.</p>}
        {statement.charges.map(c => <div key={c.id}><h4>{c.concept}</h4>
          <p>Vencimiento {c.dueDate.split('-').reverse().join('/')}</p>
          <p>Importe {pesos(c.amountCents)} · Pendiente {pesos(c.outstandingCents)}</p></div>)}
      </div>
      <div className="card"><h3>Pagos</h3>
        {!statement.payments.length && <p>Sin pagos registrados.</p>}
        {statement.payments.map(p => <div key={p.id}><h4>{methods[p.method]} · {paymentDate.format(new Date(p.paidAt))}</h4>
          <p>Recibido {pesos(p.amountCents)} · Aplicado {pesos(p.appliedCents)}</p></div>)}
      </div>
    </div>}
  </section>;
}
