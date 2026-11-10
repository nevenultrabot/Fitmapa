export default function Avatar({ url, name, size = 'md' }) {
  if (url) return <img src={url} alt="" className={`avatar avatar-${size}`} />;
  const initials = (name || '?')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <span className={`avatar avatar-${size} avatar-empty`}>{initials}</span>;
}
