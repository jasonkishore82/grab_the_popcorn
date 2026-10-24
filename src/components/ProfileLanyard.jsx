import Lanyard from './Lanyard.jsx';

// Hanging ID card for a user's profile: their picture on the front.
// Not used on any page yet. Give it a parent with an explicit width and height.
export default function ProfileLanyard({ person, ...props }) {
  return <Lanyard frontImage={person?.avatar || undefined} {...props} />;
}
