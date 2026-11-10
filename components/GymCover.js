import { LogoMark } from './Logo';

// Slika teretane, ili lepa zamena dok slika ne postoji
export default function GymCover({ gym, className = '' }) {
  if (gym.image_url) return <img src={gym.image_url} alt="" className={`gym-cover-img ${className}`} />;
  return (
    <div className={`gym-cover-empty ${className}`}>
      <LogoMark size={40} />
      <span>{gym.name}</span>
    </div>
  );
}
