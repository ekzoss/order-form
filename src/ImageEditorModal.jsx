import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Save, Upload, Image as ImageIcon } from 'lucide-react';
// Helper function to compress a base64 image
const compressBase64Image = (base64String, maxWidth = 800, maxHeight = 1000, quality = 0.7) => {
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


const ImageEditorModal = ({
  isOpen,
  onClose,
  side,
  initialDesignImage,
  initialBackground,
  initialPosition,
  initialSize,
  tshirtBackgrounds,
  onSave,
  compositeImageWithTshirt,
  compressImage
}) => {
  const [designImage, setDesignImage] = useState(initialDesignImage);
  const [selectedBackground, setSelectedBackground] = useState(initialBackground);
  const [position, setPosition] = useState(initialPosition || { x: 50, y: 28 });
  const [size, setSize] = useState(initialSize || 45);
  const [previewImage, setPreviewImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Reset state when modal opens with new props
  useEffect(() => {
    if (isOpen) {
      setDesignImage(initialDesignImage);
      setSelectedBackground(initialBackground);
      setPosition(initialPosition || { x: 50, y: 28 });
      setSize(initialSize || 45);
      setPreviewImage(null);
    }
  }, [isOpen, side, initialDesignImage, initialBackground, initialPosition, initialSize]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressedBase64 = await compressImage(file);
      setDesignImage(compressedBase64);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image. Please try a smaller image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMouseDown = (e) => {
    if (!designImage) return;
    
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
    if (!isDragging || !designImage) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const deltaX = currentX - dragStartRef.current.x;
    const deltaY = currentY - dragStartRef.current.y;
    
    // Convert pixel delta to percentage
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
    if (!designImage) return;
    
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
    if (!isDragging || !designImage) return;
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

  const handleSave = async () => {
    console.log('ImageEditorModal handleSave called');
    console.log('designImage:', designImage?.substring(0, 50));
    console.log('selectedBackground:', selectedBackground?.substring(0, 50));
    console.log('position:', position);
    console.log('size:', size);
    
    if (!designImage || !selectedBackground) {
      console.error('Missing designImage or selectedBackground');
      return;
    }
    
    setIsProcessing(true);
    try {
      console.log('Generating composite...');
      // Generate the final composite image only when saving
      const finalComposite = await compositeImageWithTshirt(
        designImage,
        selectedBackground,
        position,
        size
      );
      
      console.log('Composite generated, original length:', finalComposite?.length);
      
      // Compress the composite image to fit within Firestore limits (1MB)
      console.log('Compressing composite image...');
      const compressedComposite = await compressBase64Image(finalComposite, 800, 1000, 0.7);
      console.log('Compressed composite length:', compressedComposite?.length);
      
      console.log('Calling onSave...');
      
      // Call onSave and wait for it to complete
      await onSave({
        designImage,
        selectedBackground,
        position,
        size,
        previewImage: compressedComposite
      });
      
      console.log('onSave completed successfully');
      
      // Only close if save was successful
      onClose();
    } catch (err) {
      console.error('Save error in ImageEditorModal:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Modify {side === 'frontImage' ? 'Front' : 'Back'} Image
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Upload Image */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">1. Upload Design Image</h3>
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200 w-full max-w-xs">
              <Upload className="w-4 h-4" />
              <span>Choose Image</span>
              <input
                type="file"
                accept="image/jpeg, image/png"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* Step 2: Position & Resize */}
          {designImage && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">2. Position & Resize Design</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 mb-3">
                  Click and drag (or touch and drag) the design to position it. Use the slider below to resize.
                </p>
                
                {/* Interactive Preview with Static Background */}
                <div
                  ref={canvasRef}
                  className={`w-full aspect-[4/5] rounded border-2 ${
                    isDragging ? 'border-indigo-500 cursor-grabbing' : 'border-gray-300 cursor-grab'
                  } overflow-hidden mb-4 relative`}
                  style={{ touchAction: 'none' }}
                >
                  {/* Static Background Image */}
                  <img
                    src={selectedBackground}
                    alt="Background"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    draggable="false"
                  />
                  
                  {/* Draggable Design Image Overlay */}
                  <img
                    src={designImage}
                    alt="Design"
                    className="absolute pointer-events-none select-none"
                    draggable="false"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      width: `${size}%`,
                      height: 'auto',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      transform: 'translate(-50%, 0)',
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
                    min="10"
                    max="150"
                    step="1"
                    value={size}
                    onChange={(e) => setSize(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    disabled={isProcessing}
                  />
                  <span className="text-xs text-gray-500 w-12 text-right">{size}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Change Background */}
          {designImage && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">3. Change Background</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {/* Solid Color Backgrounds - Quarter Size, Single Row */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Solid Colors</p>
                    <div className="flex flex-wrap gap-2">
                      {tshirtBackgrounds.filter(bg => bg.color).map(bg => (
                        <div
                          key={bg.id}
                          onClick={() => setSelectedBackground(bg.url)}
                          className={`relative cursor-pointer rounded border-2 overflow-hidden w-12 h-12 ${
                            selectedBackground === bg.url
                              ? 'border-indigo-600 ring-2 ring-indigo-200'
                              : 'border-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom/Graphical Backgrounds - Half Size Grid */}
                  {tshirtBackgrounds.filter(bg => !bg.color).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Custom Backgrounds</p>
                      <div className="grid grid-cols-6 gap-2">
                        {tshirtBackgrounds.filter(bg => !bg.color).map(bg => (
                          <div
                            key={bg.id}
                            onClick={() => setSelectedBackground(bg.url)}
                            className={`relative cursor-pointer rounded border-2 overflow-hidden aspect-square ${
                              selectedBackground === bg.url
                                ? 'border-indigo-600 ring-2 ring-indigo-200'
                                : 'border-gray-300 hover:border-indigo-400'
                            }`}
                          >
                            <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                <p className="text-xs text-gray-500 mt-3">
                  Selected: {tshirtBackgrounds.find(bg => bg.url === selectedBackground)?.name || 'Custom'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCancel}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!designImage || isProcessing}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isProcessing ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorModal;

// Made with Bob
