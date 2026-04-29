import { Image as ImageIcon } from 'lucide-react';
import './Header.css';

export default function Header() {
  return (
    <header className="app-header">
      <div className="logo-container">
        <div className="logo-icon">
          <ImageIcon size={24} color="#fff" />
        </div>
        <span className="logo-text">ResizerPro</span>
      </div>
      <h1 className="app-title">Smart Image Resizer</h1>
    </header>
  );
}
