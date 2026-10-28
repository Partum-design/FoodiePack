/** Per-page title, description and canonical (index.html ships the storefront's by default). */
export function setPageMeta({ title, description, path }: { title: string; description?: string; path: string }) {
  document.title = title
  const url = `https://www.foodiepack.com.mx${path}`
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', url)
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', url)
  document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title)
  if (description) {
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description)
  }
}
