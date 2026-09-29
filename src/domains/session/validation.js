export const isPhone = (v) => /^(\+62|62|0)8\d{7,12}$/.test(String(v ?? '').replace(/[\s-]/g, ''))
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())

export function validateRegister(v) {
  const e = {}
  if (v.name.trim().length < 3) e.name = 'Nama minimal 3 huruf.'
  if (!isPhone(v.contact) && !isEmail(v.contact)) e.contact = 'Masukkan nomor WhatsApp (08…) atau email yang valid.'
  if (!v.acceptTerms) e.acceptTerms = 'Centang persetujuan Syarat & Ketentuan untuk lanjut.'
  if (!v.acceptPrivacy) e.acceptPrivacy = 'Centang persetujuan Kebijakan Privasi untuk lanjut.'
  return e
}
