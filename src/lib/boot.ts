// Fades out the static preloader painted by index.html (#fp-boot).
export function hideBoot(minVisibleMs = 450) {
  const element = document.getElementById('fp-boot')
  if (!element || element.dataset.done) return
  element.dataset.done = '1'
  // performance.now() counts from navigation start, so fast loads still show the brand briefly.
  const wait = Math.max(0, minVisibleMs - performance.now())
  window.setTimeout(() => {
    element.classList.add('is-done')
    window.setTimeout(() => element.remove(), 500)
  }, wait)
}
