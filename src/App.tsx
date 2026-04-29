import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import Uploader from './components/Uploader';
import SettingsPanel from './components/SettingsPanel';
import ImageList from './components/ImageList';
import type { AppSettings, ImageItemData } from './types';
import { processImage } from './utils/imageProcessor';
import { DownloadCloud, Play } from 'lucide-react';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>({
    aspectRatio: '1:1',
    customRatio: { width: 1, height: 1 },
    mode: 'padding',
    paddingColor: '#ffffff',
  });

  const [images, setImages] = useState<ImageItemData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    const newImages: ImageItemData[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const updateImageState = useCallback((id: string, updates: Partial<ImageItemData>) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
  }, []);

  const handleProcessAll = async () => {
    setIsProcessing(true);
    
    // Process one by one or in parallel. Let's do parallel for speed, but state updates might be chatty.
    // We'll map to promises.
    const pendingImages = images.filter(img => img.status === 'pending' || img.status === 'error');
    
    await Promise.all(pendingImages.map(async (img) => {
      updateImageState(img.id, { status: 'processing', progress: 0, errorMsg: undefined });
      
      try {
        const dataUrl = await processImage(img.file, settings, (prog) => {
          updateImageState(img.id, { progress: prog });
        });
        
        updateImageState(img.id, { 
          status: 'done', 
          progress: 100, 
          resultDataUrl: dataUrl 
        });
      } catch (err) {
        updateImageState(img.id, { 
          status: 'error', 
          progress: 0, 
          errorMsg: (err as Error).message || 'Processing failed' 
        });
      }
    }));
    
    setIsProcessing(false);
  };

  const handleDownloadSingle = useCallback((id: string) => {
    const img = images.find(i => i.id === id);
    if (img && img.resultDataUrl) {
      const a = document.createElement('a');
      a.href = img.resultDataUrl;
      // create a nice filename
      const originalName = img.file.name;
      const ext = originalName.split('.').pop();
      const base = originalName.slice(0, -(ext?.length || 0) - 1) || 'image';
      a.download = `${base}_resized.${ext || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [images]);

  const handleDownloadAll = async () => {
    const completedImages = images.filter(img => img.status === 'done' && img.resultDataUrl);
    if (completedImages.length === 0) return;

    const zip = new JSZip();
    
    completedImages.forEach(img => {
      const originalName = img.file.name;
      const ext = originalName.split('.').pop() || 'jpg';
      const base = originalName.slice(0, -(ext.length) - 1) || 'image';
      const fileName = `${base}_resized.${ext}`;
      
      // Extract base64 data
      const dataUrl = img.resultDataUrl!;
      const base64Data = dataUrl.split(',')[1];
      
      zip.file(fileName, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resized_images.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allDone = images.length > 0 && images.every(img => img.status === 'done');
  const hasPending = images.some(img => img.status === 'pending' || img.status === 'error');

  return (
    <div className="app-container">
      <Header />
      
      <main className="main-content">
        <div className="left-column">
          <Uploader onFilesSelected={handleFilesSelected} />
          <SettingsPanel 
            settings={settings} 
            onChange={setSettings} 
            disabled={isProcessing}
          />
        </div>
        
        <div className="right-column">
          <div className="actions-header glass-panel">
            <h2>Queue ({images.length})</h2>
            <div className="actions-buttons">
              {hasPending && (
                <button 
                  onClick={handleProcessAll} 
                  disabled={isProcessing || images.length === 0}
                  className="process-btn"
                >
                  <Play size={18} />
                  Start Processing
                </button>
              )}
              {allDone && (
                <button 
                  onClick={handleDownloadAll} 
                  className="download-all-btn animate-fade-in"
                >
                  <DownloadCloud size={18} />
                  Download All (ZIP)
                </button>
              )}
            </div>
          </div>
          
          <ImageList 
            images={images} 
            onDownload={handleDownloadSingle} 
          />
          
          {images.length === 0 && (
            <div className="empty-state">
              <p>Upload images to see them here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
