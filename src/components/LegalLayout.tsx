import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { setPageMeta } from '../lib/seo'
import Footer from './Footer'
import SiteHeader from './SiteHeader'

type LegalLayoutProps = {
  kind: 'privacy' | 'terms'
  title: string
  updatedAt: string
  lead: string
  canonical: string
  children: ReactNode
}

/** Shared shell for the legal pages: green hero, section index and a readable card. */
export default function LegalLayout({ kind, title, updatedAt, lead, canonical, children }: LegalLayoutProps) {
  const [sections, setSections] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    setPageMeta({ title: `${title} | FoodiePack Lindavista`, description: lead, path: new URL(canonical).pathname })
    setSections(Array.from(document.querySelectorAll<HTMLHeadingElement>('.fp-legal-body h2[id]'))
      .map((heading) => ({ id: heading.id, label: heading.textContent || '' })))
  }, [title, canonical, lead])

  return (
    <div className="fp fp--page">
      <SiteHeader />
      <section className="fp-page-hero">
        <div className="fp-page-hero__card">
          <span className="fp-pill fp-pill--glass">{kind === 'privacy' ? <ShieldCheck size={14} /> : <FileText size={14} />} Legal</span>
          <h1>{title}</h1>
          <p>{lead}</p>
          <small>Última actualización: {updatedAt}</small>
          <nav className="fp-legal-switch" aria-label="Documentos legales">
            <a href="/terminos" className={kind === 'terms' ? 'is-active' : ''}>Términos y condiciones</a>
            <a href="/privacidad" className={kind === 'privacy' ? 'is-active' : ''}>Aviso de privacidad</a>
          </nav>
        </div>
      </section>

      <div className="fp-legal">
        {sections.length > 0 && (
          <aside className="fp-legal__toc" aria-label="Contenido">
            <strong>En esta página</strong>
            <ol>
              {sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>)}
            </ol>
          </aside>
        )}
        <main className="fp-legal-body">{children}</main>
      </div>

      <Footer />
    </div>
  )
}
