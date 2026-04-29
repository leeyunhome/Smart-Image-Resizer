import type { AppSettings } from '../types';

function getTargetDimensions(originalWidth: number, originalHeight: number, settings: AppSettings) {
  let targetRatio: number;
  
  if (settings.aspectRatio === 'custom') {
    targetRatio = settings.customRatio.width / settings.customRatio.height;
  } else {
    const [w, h] = settings.aspectRatio.split(':').map(Number);
    targetRatio = w / h;
  }

  // To maintain high quality, we'll base the new dimensions on the original ones
  // For Crop: The target bounding box is determined by the smallest dimension that fulfills the ratio
  // For Padding: The target bounding box is determined by the largest dimension that fulfills the ratio

  let targetWidth: number;
  let targetHeight: number;

  const originalRatio = originalWidth / originalHeight;

  if (settings.mode === 'crop') {
    if (originalRatio > targetRatio) {
      // Original is wider than target: fit to height
      targetWidth = Math.round(originalHeight * targetRatio);
      targetHeight = originalHeight;
    } else {
      // Original is taller than target: fit to width
      targetWidth = originalWidth;
      targetHeight = Math.round(originalWidth / targetRatio);
    }
  } else { // padding
    if (originalRatio > targetRatio) {
      // Original is wider than target: pad top/bottom, so height increases
      targetWidth = originalWidth;
      targetHeight = Math.round(originalWidth / targetRatio);
    } else {
      // Original is taller than target: pad left/right, so width increases
      targetWidth = Math.round(originalHeight * targetRatio);
      targetHeight = originalHeight;
    }
  }

  return { targetWidth, targetHeight };
}

export function processImage(file: File, settings: AppSettings, onProgress: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Simulate progress for UI (since canvas draw is sync and very fast)
      let progress = 10;
      onProgress(progress);
      
      const interval = setInterval(() => {
        progress += 15;
        if (progress > 90) progress = 90;
        onProgress(progress);
      }, 50);

      try {
        const { targetWidth, targetHeight } = getTargetDimensions(img.width, img.height, settings);
        
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        if (settings.mode === 'padding') {
          // Fill background
          ctx.fillStyle = settings.paddingColor;
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          
          // Draw image centered
          const x = (targetWidth - img.width) / 2;
          const y = (targetHeight - img.height) / 2;
          ctx.drawImage(img, x, y);
        } else {
          // Crop mode
          // Source coordinates
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          
          const targetRatio = targetWidth / targetHeight;
          const originalRatio = img.width / img.height;
          
          if (originalRatio > targetRatio) {
            // Crop sides
            sw = img.height * targetRatio;
            sx = (img.width - sw) / 2;
          } else {
            // Crop top/bottom
            sh = img.width / targetRatio;
            sy = (img.height - sh) / 2;
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        }

        // Finalize
        setTimeout(() => {
          clearInterval(interval);
          onProgress(100);
          
          // Use JPEG or WebP for smaller size, but PNG preserves quality best if there are transparent parts.
          // Since user uses "white" or color padding, jpeg is fine and faster. Let's use image/jpeg.
          // But to be safe and preserve possible alpha in 'crop', image/png is better.
          const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.95);
          resolve(dataUrl);
        }, 500); // give it a small delay so user can see progress bar

      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}
