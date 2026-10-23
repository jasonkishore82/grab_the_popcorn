import DomeGallery from './DomeGallery.jsx';

// "Friends Dome": a draggable 3D dome of friends' pictures.
// Not used on any page yet. Give it a parent with an explicit width and height.
export default function FriendsDome({ friends = [], ...props }) {
  const images = friends
    .filter(f => f.avatar)
    .map(f => ({ src: f.avatar, alt: f.name || f.handle }));
  return <DomeGallery images={images.length ? images : undefined} {...props} />;
}
