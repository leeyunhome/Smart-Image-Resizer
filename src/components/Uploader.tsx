import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import './Uploader.css';

interface UploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export default function Uploader({ onFilesSelected }: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      if (filesArray.length > 0) {
        onFilesSelected(filesArray);
      }
    }
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      if (filesArray.length > 0) {
        onFilesSelected(filesArray);
      }
    }
  }, [onFilesSelected]);

  return (
    <div 
      className={`uploader-container glass-panel ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <UploadCloud size={48} className="upload-icon" />
      <h3>Drag & Drop your images here</h3>
      <p>or</p>
      <label className="upload-button">
        Browse Files
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={handleFileInput} 
          style={{ display: 'none' }} 
        />
      </label>
    </div>
  );
}
