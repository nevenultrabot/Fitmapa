import { getSupabase } from './supabase';

// Smanjuje sliku i pretvara u JPEG (telefonske slike su često > 5 MB)
export async function resizeImage(file, maxSize = 1600, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}

// Otprema sliku u skladište "photos" (folder korisnika) i vraća javni link
export async function uploadPhoto(userId, file, { maxSize = 1600, quality = 0.85 } = {}) {
  const blob = await resizeImage(file, maxSize, quality);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storage = getSupabase().storage.from('photos');
  const { error } = await storage.upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return storage.getPublicUrl(path).data.publicUrl;
}
