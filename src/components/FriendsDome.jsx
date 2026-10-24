import { useMemo } from 'react';
import DomeGallery from './DomeGallery';
import { useThemeName } from '../theme';

// A flat tile for friends without a picture: their initials on a neutral square.
const tile = (name, dark) => {
  const ini = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${dark ? '#3a3a3c' : '#d1d1d6'}"/><text x="150" y="188" font-family="-apple-system,Helvetica,Arial" font-size="110" font-weight="500" fill="${dark ? '#aeaeb2' : '#636366'}" text-anchor="middle">${ini}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// The Friends Dome: a draggable sphere of a person's chosen friends. Fills its parent, which needs a height.
export default function FriendsDome({ members }) {
  const dark = useThemeName() === 'dark';
  const images = useMemo(
    () => members.map((m) => ({ src: m.avatarUrl || tile(m.name, dark), alt: m.name })),
    [members, dark],
  );
  return (
    <DomeGallery
      images={images}
      fit={0.9}
      grayscale={false}
      segments={30}
      imageBorderRadius="22px"
      openedImageBorderRadius="22px"
      openedImageWidth="360px"
      openedImageHeight="360px"
      overlayBlurColor={dark ? '#1c1c1e' : '#f2f2f7'}
    />
  );
}
