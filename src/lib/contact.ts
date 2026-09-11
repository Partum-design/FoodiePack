// Mexico City mobile number for FoodiePack's WhatsApp line.
export const WHATSAPP_NUMBER = '5215660356369'
export const WHATSAPP_DISPLAY = '56 6035 6369'

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const SOCIAL_LINKS = {
  tiktok: 'https://www.tiktok.com/@foodiepack',
  facebook: 'https://www.facebook.com/foodiepack.mx/',
  instagram: 'https://www.instagram.com/foodiepack.cdmx/',
}
