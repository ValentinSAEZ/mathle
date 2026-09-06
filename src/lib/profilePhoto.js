export async function prepareProfilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choisis une image JPG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choisis une image de moins de 5 Mo.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 192, 192);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    if (!size) throw new Error('Image illisible.');
    ctx.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 192, 192);
    for (const quality of [0.85, 0.65, 0.45, 0.25]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= 24000) return result;
    }
    throw new Error('Cette image est trop détaillée. Essaie une photo plus simple.');
  } finally { URL.revokeObjectURL(url); }
}
