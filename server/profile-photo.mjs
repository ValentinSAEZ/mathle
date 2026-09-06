// Inline JPEG only: no remote tracking URL, SVG or executable markup.
export function validProfilePhoto(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length > 24000) return false;
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const encoded = value.slice('data:image/jpeg;base64,'.length);
  const bytes = Buffer.from(encoded, 'base64');
  return bytes.toString('base64') === encoded && bytes.length >= 4 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}
