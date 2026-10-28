import { FormEvent, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Clock3, Loader2, Megaphone, Send, Smartphone, Users } from 'lucide-react'
import { getAdminPush, sendAdminPush } from '../api'
import type { PushBroadcast } from '../api'
import { enablePush, usePushPermission } from '../lib/push'

const LINKS = [
  { value: '/#menu', label: 'Menú del día' },
  { value: '/?utm_source=push#paquetes', label: 'Paquetes' },
  { value: '/menu-semana', label: 'Carta de la semana' },
  { value: '/', label: 'Inicio' },
]

const TEMPLATES = [
  { title: '🍲 ¡Ya está el menú de mañana!', body: 'Pide antes de las 6 pm y te lo llevamos a tu oficina.' },
  { title: '🔥 Hoy hay especial', body: 'Pozole con precio único. ¡Aparta el tuyo antes de que se acabe!' },
  { title: '💸 Arma tu semana y ahorra', body: 'Paga tu plan semanal por adelantado y llévate el mejor precio.' },
]

const KIND_LABEL: Record<string, string> = { lunch: '11 am', evening: '5 pm', campaign: 'Campaña', test: 'Prueba' }

function when(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(date))
}

/** Admin tab: turn on new-order alerts on this device and send notifications to customers. */
export default function AdminPushPanel({ token }: { token: string }) {
  const permission = usePushPermission()
  const [stats, setStats] = useState<{ enabled: boolean; customers: number; admins: number; broadcasts: PushBroadcast[] } | null>(null)
  const [title, setTitle] = useState(TEMPLATES[0].title)
  const [body, setBody] = useState(TEMPLATES[0].body)
  const [url, setUrl] = useState(LINKS[0].value)
  const [busy, setBusy] = useState<'' | 'send' | 'test' | 'device'>('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [deviceOn, setDeviceOn] = useState(false)

  const load = () => getAdminPush(token).then(setStats).catch((problem) => setError(problem instanceof Error ? problem.message : 'No se pudo cargar'))
  useEffect(() => { void load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const enableDevice = async () => {
    setBusy('device')
    setError('')
    try {
      const ok = await enablePush({ admin: token, source: 'admin' })
      setDeviceOn(ok)
      if (!ok) setError('El navegador bloqueó las notificaciones. Actívalas en la configuración del sitio.')
      void load()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No se pudo activar')
    } finally {
      setBusy('')
    }
  }

  const send = async (event: FormEvent, test = false) => {
    event.preventDefault()
    if (!test && !window.confirm(`¿Enviar esta notificación a ${stats?.customers ?? 0} clientes?`)) return
    setBusy(test ? 'test' : 'send')
    setError('')
    setNotice('')
    try {
      const result = await sendAdminPush({ title, body, url, test }, token)
      setNotice(test ? `Prueba enviada a ${result.sent} dispositivo(s) de la cocina.` : `¡Listo! Enviada a ${result.sent} cliente(s).`)
      void load()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No se pudo enviar')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="admin-push">
      <header className="admin-page-head">
        <div><p>Foodie Pack · Avisos</p><h1>Notificaciones</h1><span>Manda avisos al celular de tus clientes y recibe cada pedido nuevo al instante.</span></div>
      </header>

      <div className="admin-stats">
        <div className="admin-stat"><Users size={20} /><span><b>{stats?.customers ?? '—'}</b>Clientes con avisos</span></div>
        <div className="admin-stat admin-stat--accent"><Smartphone size={20} /><span><b>{stats?.admins ?? '—'}</b>Dispositivos de cocina</span></div>
      </div>

      {stats && !stats.enabled && <div className="inline-error">Las notificaciones no están configuradas en el servidor (faltan las llaves VAPID).</div>}
      {error && <div className="inline-error">{error}</div>}

      <div className="admin-push__grid">
        <section className="admin-card admin-push__device">
          <i><BellRing size={24} /></i>
          <h2>Avisos de pedidos nuevos</h2>
          <p>Activa este celular o computadora para que suene cada vez que llegue un pedido.</p>
          {permission === 'needs-install' && <p className="admin-push__hint">En iPhone, primero agrega esta página a tu pantalla de inicio y ábrela desde ahí.</p>}
          {permission === 'denied' && <p className="admin-push__hint">Bloqueaste las notificaciones en este navegador. Actívalas desde el candado de la barra de direcciones.</p>}
          {(permission === 'default' || permission === 'granted') && (
            <button type="button" className={deviceOn ? 'admin-secondary' : 'admin-primary'} onClick={enableDevice} disabled={busy === 'device'}>
              {busy === 'device' ? <Loader2 size={16} className="spin" /> : deviceOn ? <CheckCircle2 size={16} /> : <BellRing size={16} />}
              {deviceOn ? 'Este dispositivo ya recibe pedidos' : 'Recibir pedidos en este dispositivo'}
            </button>
          )}
          <ul className="admin-push__schedule">
            <li><Clock3 size={15} /> <b>11:00 am</b> Recordatorio con el menú de mañana</li>
            <li><Clock3 size={15} /> <b>5:00 pm</b> Última llamada (solo a quien no ha pedido)</li>
            <li><CheckCircle2 size={15} /> Al aceptar o cancelar un pedido, el cliente recibe aviso</li>
          </ul>
        </section>

        <form className="admin-card admin-push__compose" onSubmit={(event) => send(event)}>
          <h2><Megaphone size={20} /> Enviar notificación a clientes</h2>
          <div className="admin-push__templates">
            {TEMPLATES.map((template) => (
              <button type="button" key={template.title} onClick={() => { setTitle(template.title); setBody(template.body) }}>{template.title}</button>
            ))}
          </div>
          <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} required minLength={3} /></label>
          <label>Mensaje<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={180} required minLength={3} rows={3} /><small>{body.length}/180</small></label>
          <label>Al tocarla abre
            <select value={url} onChange={(event) => setUrl(event.target.value)}>
              {LINKS.map((link) => <option key={link.value} value={link.value}>{link.label}</option>)}
            </select>
          </label>

          <div className="admin-push__preview" aria-label="Vista previa">
            <span>Vista previa</span>
            <div className="admin-push__toast">
              <img src="/icons/icon-96.png" alt="" />
              <p><b>FoodiePack · ahora</b><strong>{title || 'Título'}</strong><span>{body || 'Mensaje'}</span></p>
            </div>
          </div>

          {notice && <div className="save-message">{notice}</div>}
          <div className="admin-push__actions">
            <button type="button" className="admin-secondary" onClick={(event) => send(event, true)} disabled={Boolean(busy)}>
              {busy === 'test' ? <Loader2 size={16} className="spin" /> : <Smartphone size={16} />} Probar en cocina
            </button>
            <button type="submit" className="admin-primary" disabled={Boolean(busy) || !stats?.enabled}>
              {busy === 'send' ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Enviar a {stats?.customers ?? 0} clientes
            </button>
          </div>
        </form>
      </div>

      <section className="admin-card admin-push__history">
        <h2>Historial</h2>
        {!stats?.broadcasts.length && <p className="admin-push__hint">Aún no se ha enviado ninguna notificación.</p>}
        <ul>
          {stats?.broadcasts.map((item) => (
            <li key={`${item.createdAt}-${item.title}`}>
              <em className={`admin-push__kind admin-push__kind--${item.kind}`}>{KIND_LABEL[item.kind] || item.kind}</em>
              <p><strong>{item.title}</strong><span>{item.body}</span></p>
              <small>{when(item.createdAt)}<br />{item.sent} enviadas{item.failed ? ` · ${item.failed} fallidas` : ''}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
