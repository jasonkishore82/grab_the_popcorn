import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import DomeGallery from '../components/DomeGallery';
import SpotlightCard from '../components/SpotlightCard';
import Lanyard from '../components/Lanyard';
import { useThemeName } from '../theme';

// Design preview only: fake friends, nothing is read from or saved to the server.
const NAMES = ['Ava Mendez', 'Noah Kim', 'Iris Patel', 'Leo Brandt', 'Maya Osei', 'Sam Duarte', 'Zoe Laurent', 'Kai Tanaka', 'Nina Volkov', 'Omar Haddad', 'Ella Rossi', 'Theo Quinn'];

const face = (name, i) => {
  const hue = (i * 47 + 20) % 360;
  const ini = name.split(' ').map((p) => p[0]).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 52%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360} 50% 26%)"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="240" font-family="Helvetica,Arial" font-size="150" font-weight="700" fill="white" text-anchor="middle">${ini}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const FRIENDS = NAMES.map((name, i) => ({ id: i, name, handle: name.split(' ')[0].toLowerCase(), watched: 20 + ((i * 37) % 180), src: face(name, i) }));

// Signed in: real friends and the saved dome from the server. Signed out: the made-up friends above, kept on screen only.
function useDome(initial = 6) {
  const { user, social, notify, openAuth } = useStore();
  const live = !!user;
  const [ids, setIds] = useState(() => FRIENDS.slice(0, initial).map((f) => f.id));
  const [saved, setSaved] = useState([]);
  useEffect(() => {
    if (!live) return;
    api('/dome').then((d) => setSaved(d.members.map((m) => m.handle))).catch(() => {});
  }, [live]);
  const friends = useMemo(
    () => (live ? social.friends.map((f) => ({ id: f.handle, name: f.name, handle: f.handle, watched: null, src: f.avatarUrl || face(f.name, f.handle.length) })) : FRIENDS),
    [live, social.friends],
  );
  const inDome = live ? saved : ids;
  const toggle = async (id) => {
    if (!live) return setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    try {
      const d = await api(`/dome/${id}`, { method: saved.includes(id) ? 'DELETE' : 'PUT' });
      setSaved(d.members.map((m) => m.handle));
    } catch (e) {
      notify?.(e.message);
    }
  };
  const images = useMemo(() => friends.filter((f) => inDome.includes(f.id)).map((f) => ({ src: f.src, alt: f.name })), [friends, inDome]);
  const me = live ? { src: `/api/users/${user.handle}/avatar`, name: user.name } : friends[0];
  return { ids: inDome, toggle, images, friends, live, me };
}

const frame = { height: 560, borderRadius: 14, overflow: 'hidden', position: 'relative' };

// Option A: dome on the left, a column of spotlight cards on the right to add or remove friends.
function OptionA({ theme }) {
  const { ids, toggle, images, friends } = useDome();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }}>
      <div style={frame}><DomeGallery images={images} fit={0.8} grayscale={false} overlayBlurColor={theme === 'dark' ? '#0b0b0d' : '#f2f2f7'} /></div>
      <div style={{ display: 'grid', gap: 10, maxHeight: 560, overflow: 'auto', alignContent: 'start', gridAutoRows: 'min-content' }}>
        {friends.map((f) => (
          <SpotlightCard key={f.id} theme={theme} spotlightSize={160} style={{ padding: 12, borderRadius: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={f.src} alt="" width="40" height="40" style={{ borderRadius: 10 }} />
              <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block' }}>{f.name}</strong><span className="muted small">@{f.handle}</span></div>
              <button className={ids.includes(f.id) ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={() => toggle(f.id)}>{ids.includes(f.id) ? 'Remove' : 'Add'}</button>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
}

// Option B: the dome fills the stage and a tray of friends sits along the bottom.
function OptionB({ theme }) {
  const { ids, toggle, images, friends } = useDome(8);
  return (
    <div style={{ ...frame, height: 620 }}>
      <DomeGallery images={images} fit={0.9} grayscale={false} overlayBlurColor={theme === 'dark' ? '#0b0b0d' : '#f2f2f7'} />
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 40, display: 'flex', gap: 8, overflowX: 'auto', padding: 4 }}>
        {friends.map((f) => (
          <SpotlightCard key={f.id} theme={theme} spotlightSize={120} proximity={40} style={{ padding: 8, borderRadius: 12, minWidth: 92, textAlign: 'center', cursor: 'pointer', opacity: ids.includes(f.id) ? 1 : 0.7 }} onClick={() => toggle(f.id)}>
            <img src={f.src} alt="" width="44" height="44" style={{ borderRadius: 22 }} />
            <div className="small" style={{ marginTop: 4 }}>{f.name.split(' ')[0]}</div>
            <div className="muted small">{ids.includes(f.id) ? 'In dome' : 'Add'}</div>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
}

// Option C: your ID card on a lanyard beside a smaller dome; a spotlight card holds the add action.
function OptionC({ theme }) {
  const { ids, toggle, images, friends, me } = useDome(5);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 16 }}>
      <div style={{ height: 560 }}>{me && <Lanyard frontImage={me.src} cardColor="#ffffff" finish="glossy" size={0.5} anchor="center" intro={false} strapColor="#1c1c1e" />}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ ...frame, height: 400 }}><DomeGallery images={images} fit={0.85} grayscale={false} overlayBlurColor={theme === 'dark' ? '#0b0b0d' : '#f2f2f7'} /></div>
        <SpotlightCard theme={theme} shape="beam" spotlightSize={300} style={{ padding: 14, borderRadius: 14 }}>
          <strong>Add to your dome</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {friends.slice(1).map((f) => (
              <button key={f.id} className={ids.includes(f.id) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => toggle(f.id)}>{ids.includes(f.id) ? '✓ ' : '+ '}{f.name.split(' ')[0]}</button>
            ))}
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

const OPTIONS = [
  ['A', 'Dome with a friends list', 'Dome beside a scrolling column of friend cards. Add or Remove on each card updates the dome.', OptionA],
  ['B', 'Full-stage dome with a tray', 'The dome is the whole page. Tap a friend in the tray along the bottom to put them in or take them out.', OptionB],
  ['C', 'Lanyard and dome', 'Your ID card hangs on the left, the dome sits on the right, and one spotlight panel holds the add buttons.', OptionC]
];

export default function DomeLab() {
  const theme = useThemeName() === 'dark' ? 'dark' : 'light';
  const [pick, setPick] = useState('A');
  const [, , , Active] = OPTIONS.find((o) => o[0] === pick);
  const { user, social } = useStore();
  return (
    <div className="page">
      <h1>Friends Dome: 3 layout options</h1>
      <p className="muted">Signed in, this uses your real friends and saves your dome. Signed out, it shows made-up friends and saves nothing.</p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {OPTIONS.map(([k, t]) => (
          <button key={k} className={pick === k ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setPick(k)}>{k}. {t}</button>
        ))}
      </div>
      <p className="muted small">{OPTIONS.find((o) => o[0] === pick)[2]}</p>
      {user && social.friends.length === 0 ? <p className="muted">Add some friends first, then they can join your dome.</p> : <Active key={pick + theme} theme={theme} />}
    </div>
  );
}
