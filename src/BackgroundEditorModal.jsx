import React, { useState, useRef } from 'react';
import { X, Save } from 'lucide-react';

// Helper function to compress a base64 image
const compressBase64Image = (base64String, maxWidth = 800, maxHeight = 1000, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.src = base64String;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const widthRatio = maxWidth / width;
        const heightRatio = maxHeight / height;
        const ratio = Math.min(widthRatio, heightRatio);
        
        width = width * ratio;
        height = height * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.drawImage(img, 0, 0, width, height);
      
      // Use JPEG with quality setting to reduce size
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    
    img.onerror = (err) => {
      reject(new Error('Failed to load image for compression: ' + err));
    };
  });
};

const BackgroundEditorModal = ({ isOpen, onClose, onSave, initialImage, imageName }) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (!initialImage) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    dragStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      startPosX: position.x,
      startPosY: position.y
    };
    
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !initialImage) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const deltaX = currentX - dragStartRef.current.x;
    const deltaY = currentY - dragStartRef.current.y;
    
    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, dragStartRef.current.startPosX + deltaXPercent));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.startPosY + deltaYPercent));
    
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (!initialImage) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    
    dragStartRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      startPosX: position.x,
      startPosY: position.y
    };
    
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !initialImage) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    const deltaX = currentX - dragStartRef.current.x;
    const deltaY = currentY - dragStartRef.current.y;
    
    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, dragStartRef.current.startPosX + deltaXPercent));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.startPosY + deltaYPercent));
    
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const generateFinalBackground = async () => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d', { alpha: true });
      
      const img = new window.Image();
      img.src = initialImage;
      
      img.onload = () => {
        // Calculate dimensions based on size percentage
        const scaleFactor = size / 100;
        let imgWidth = img.width * scaleFactor;
        let imgHeight = img.height * scaleFactor;
        
        // Maintain aspect ratio
        const aspectRatio = img.width / img.height;
        if (imgWidth > canvas.width || imgHeight > canvas.height) {
          if (imgWidth / canvas.width > imgHeight / canvas.height) {
            imgWidth = canvas.width * scaleFactor;
            imgHeight = imgWidth / aspectRatio;
          } else {
            imgHeight = canvas.height * scaleFactor;
            imgWidth = imgHeight * aspectRatio;
          }
        }
        
        // Calculate position (x, y are center points)
        const x = (canvas.width * (position.x / 100)) - (imgWidth / 2);
        const y = (canvas.height * (position.y / 100)) - (imgHeight / 2);
        
        // Fill with white background first
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image
        ctx.drawImage(img, x, y, imgWidth, imgHeight);
        
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        } catch (err) {
          reject(new Error('Failed to export background image: ' + err.message));
        }
      };
      
      img.onerror = (err) => {
        reject(new Error('Failed to load image: ' + err));
      };
    });
  };

  const handleSave = async () => {
    if (!initialImage) return;
    
    setIsProcessing(true);
    try {
      console.log('Generating final background...');
      const finalBackground = await generateFinalBackground();
      
      console.log('Compressing background...');
      const compressedBackground = await compressBase64Image(finalBackground, 800, 1000, 0.8);
      
      console.log('Calling onSave...');
      await onSave({
        url: compressedBackground,
        name: imageName,
        position,
        size
      });
      
      console.log('Background saved successfully');
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save background. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Position Background Image</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Position & Resize Background</h3>
            <p className="text-xs text-gray-600 mb-3">
              Click and drag (or touch and drag) to position the image. Use the slider below to resize.
            </p>
            
            {/* Interactive Preview */}
            <div
              ref={canvasRef}
              className={`w-full aspect-[4/5] rounded border-2 ${
                isDragging ? 'border-indigo-500 cursor-grabbing' : 'border-gray-300 cursor-grab'
              } overflow-hidden mb-4 relative bg-white`}
              style={{ touchAction: 'none' }}
            >
              {/* Background Image */}
              <img
                src={initialImage}
                alt="Background"
                className="absolute pointer-events-none select-none"
                draggable="false"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `translate(-50%, -50%) scale(${size / 100})`,
                  objectFit: 'contain',
                  pointerEvents: 'auto',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
              />
              
              {/* Invisible overlay for drag handling */}
              <div
                className="absolute inset-0"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            </div>

            {/* Size Slider */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-600 whitespace-nowrap">Size:</label>
              <input
                type="range"
                min="50"
                max="300"
                step="1"
                value={size}
                onChange={(e) => setSize(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={isProcessing}
              />
              <span className="text-xs text-gray-600 w-12 text-right">{size}%</span>
            </div>
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing || !initialImage}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isProcessing ? 'Saving...' : 'Save Background'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackgroundEditorModal;

// Made with Bob
