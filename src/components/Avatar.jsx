export default function Avatar({ user, size = 40 }) {
  const key = String(user.id ?? user.handle ?? user.name);
  const hue = [...key].reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 360;
  const initials = user.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, hsl(${hue} 38% 46%), hsl(${(hue + 40) % 360} 42% 24%))`,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
