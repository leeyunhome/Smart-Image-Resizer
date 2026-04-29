import type { ImageItemData } from '../types';
import { Download, AlertCircle, Loader } from 'lucide-react';
import './ImageList.css';

interface ImageListProps {
  images: ImageItemData[];
  onDownload: (id: string) => void;
}

export default function ImageList({ images, onDownload }: ImageListProps) {
  if (images.length === 0) return null;

  return (
    <div className="image-list">
      {images.map(img => (
        <ImageItem key={img.id} item={img} onDownload={() => onDownload(img.id)} />
      ))}
    </div>
  );
}

interface ImageItemProps {
  item: ImageItemData;
  onDownload: () => void;
}

function ImageItem({ item, onDownload }: ImageItemProps) {
  return (
    <div className="image-item glass-panel animate-fade-in">
      <div className="thumbnail-container">
        <img src={item.previewUrl} alt="thumbnail" className="thumbnail" />
      </div>
      
      <div className="item-details">
        <div className="item-header">
          <span className="file-name" title={item.file.name}>{item.file.name}</span>
          <span className="status-text">
            {item.status === 'processing' && 'Processing...'}
            {item.status === 'done' && 'Done'}
            {item.status === 'error' && 'Error'}
            {item.status === 'pending' && 'Pending'}
          </span>
        </div>
        
        <div className="progress-container">
          <div 
            className="progress-bar" 
            style={{ 
              width: `${item.progress}%`,
              background: item.status === 'error' ? 'var(--danger-color)' : 'var(--success-color)'
            }} 
          />
        </div>
      </div>

      <div className="item-actions">
        {item.status === 'done' && (
          <button className="download-btn" onClick={onDownload} title="Download Image">
            <Download size={18} />
          </button>
        )}
        {item.status === 'error' && (
          <div className="error-icon" title={item.errorMsg}>
            <AlertCircle size={20} color="var(--danger-color)" />
          </div>
        )}
        {item.status === 'processing' && (
          <Loader size={20} className="spinner" />
        )}
      </div>
    </div>
  );
}
