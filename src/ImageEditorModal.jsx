import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Save, Upload, Image as ImageIcon, Plus } from 'lucide-react';
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
  initialForegroundImages,
  initialBackground,
  tshirtBackgrounds,
  onSave,
  compositeImageWithTshirt,
  compressImage
}) => {
  // Support multiple foreground images
  const [foregroundImages, setForegroundImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(initialBackground);
  const [previewImage, setPreviewImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ size: 0, x: 0, y: 0, handle: null });
  
  // Get currently selected image
  const selectedImage = foregroundImages.find(img => img.id === selectedImageId);

  // Reset state when modal opens with new props
  useEffect(() => {
    if (isOpen) {
      if (initialForegroundImages && initialForegroundImages.length > 0) {
        setForegroundImages(initialForegroundImages);
        setSelectedImageId(initialForegroundImages[0].id);
      } else {
        setForegroundImages([]);
        setSelectedImageId(null);
      }
      setSelectedBackground(initialBackground);
      setPreviewImage(null);
    }
  }, [isOpen, initialBackground, initialForegroundImages]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressedBase64 = await compressImage(file);
      const newImage = {
        id: Date.now(),
        image: compressedBase64,
        position: { x: 50, y: 28 },
        size: 45
      };
      setForegroundImages(prev => [...prev, newImage]);
      setSelectedImageId(newImage.id);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image. Please try a smaller image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveImage = (imageId) => {
    setForegroundImages(prev => prev.filter(img => img.id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId(foregroundImages.find(img => img.id !== imageId)?.id || null);
    }
  };

  const updateSelectedImage = (updates) => {
    setForegroundImages(prev => prev.map(img =>
      img.id === selectedImageId ? { ...img, ...updates } : img
    ));
  };

  const handleImageMouseDown = (imageId, e) => {
    if (!selectedImage) return;
    e.stopPropagation();
    
    setSelectedImageId(imageId);
    
    // Move this image to the top of the layer order
    setForegroundImages(prev => {
      const imageIndex = prev.findIndex(img => img.id === imageId);
      if (imageIndex === -1) return prev;
      const newImages = [...prev];
      const [movedImage] = newImages.splice(imageIndex, 1);
      newImages.push(movedImage);
      return newImages;
    });
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const img = foregroundImages.find(i => i.id === imageId);
    
    dragStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      startPosX: img.position.x,
      startPosY: img.position.y
    };
    
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (isDragging && selectedImage) {
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
      
      updateSelectedImage({ position: { x: newX, y: newY } });
    } else if (isResizing && selectedImage) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      const deltaX = currentX - resizeStartRef.current.x;
      const deltaY = currentY - resizeStartRef.current.y;
      
      // Calculate distance from center for more consistent resizing
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Determine direction based on which handle is being used
      const handle = resizeStartRef.current.handle;
      let direction;
      
      if (handle === 'tl') {
        // Top-left: drag left/up to grow, right/down to shrink
        direction = (deltaX + deltaY) < 0 ? 1 : -1;
      } else if (handle === 'tr') {
        // Top-right: drag right/up to grow, left/down to shrink
        direction = (deltaX - deltaY) > 0 ? 1 : -1;
      } else if (handle === 'bl') {
        // Bottom-left: drag left/down to grow, right/up to shrink
        direction = (deltaX - deltaY) < 0 ? 1 : -1;
      } else if (handle === 'br') {
        // Bottom-right: drag right/down to grow, left/up to shrink
        direction = (deltaX + deltaY) > 0 ? 1 : -1;
      }
      
      const sizeChange = (distance * direction / rect.width) * 100;
      
      const newSize = Math.max(10, Math.min(150, resizeStartRef.current.size + sizeChange));
      updateSelectedImage({ size: newSize });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeMouseDown = (handle, e) => {
    if (!selectedImage) return;
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    resizeStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      size: selectedImage.size,
      handle: handle
    };
    
    setIsResizing(true);
  };

  const handleImageTouchStart = (imageId, e) => {
    if (!selectedImage) return;
    e.stopPropagation();
    
    setSelectedImageId(imageId);
    
    // Move this image to the top of the layer order
    setForegroundImages(prev => {
      const imageIndex = prev.findIndex(img => img.id === imageId);
      if (imageIndex === -1) return prev;
      const newImages = [...prev];
      const [movedImage] = newImages.splice(imageIndex, 1);
      newImages.push(movedImage);
      return newImages;
    });
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const img = foregroundImages.find(i => i.id === imageId);
    
    dragStartRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      startPosX: img.position.x,
      startPosY: img.position.y
    };
    
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (isDragging && selectedImage) {
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
      
      updateSelectedImage({ position: { x: newX, y: newY } });
    } else if (isResizing && selectedImage) {
      e.preventDefault();
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;
      
      const deltaX = currentX - resizeStartRef.current.x;
      const deltaY = currentY - resizeStartRef.current.y;
      
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Determine direction based on which handle is being used
      const handle = resizeStartRef.current.handle;
      let direction;
      
      if (handle === 'tl') {
        // Top-left: drag left/up to grow, right/down to shrink
        direction = (deltaX + deltaY) < 0 ? 1 : -1;
      } else if (handle === 'tr') {
        // Top-right: drag right/up to grow, left/down to shrink
        direction = (deltaX - deltaY) > 0 ? 1 : -1;
      } else if (handle === 'bl') {
        // Bottom-left: drag left/down to grow, right/up to shrink
        direction = (deltaX - deltaY) < 0 ? 1 : -1;
      } else if (handle === 'br') {
        // Bottom-right: drag right/down to grow, left/up to shrink
        direction = (deltaX + deltaY) > 0 ? 1 : -1;
      }
      
      const sizeChange = (distance * direction / rect.width) * 100;
      
      const newSize = Math.max(10, Math.min(150, resizeStartRef.current.size + sizeChange));
      updateSelectedImage({ size: newSize });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeTouchStart = (handle, e) => {
    if (!selectedImage) return;
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    
    resizeStartRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      size: selectedImage.size,
      handle: handle
    };
    
    setIsResizing(true);
  };

  const handleSave = async () => {
    if (foregroundImages.length === 0 || !selectedBackground) {
      console.error('Missing foreground images or selectedBackground');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Generate the final composite image with all foreground images
      const finalComposite = await compositeImageWithTshirt(
        foregroundImages,
        selectedBackground
      );
      
      // Compress the composite image to fit within Firestore limits (1MB)
      const compressedComposite = await compressBase64Image(finalComposite, 800, 1000, 0.7);
      
      await onSave({
        selectedBackground,
        foregroundImages,
        previewImage: compressedComposite
      });
      
      // Only close if save was successful
      onClose();
    } catch (err) {
      console.error('Save error in ImageEditorModal:', err);
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
            Modify Preview Image
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
          {/* Canvas Preview */}
          <div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              {/* Interactive Preview with Static Background */}
              <div
                ref={canvasRef}
                className="w-full aspect-[4/3] rounded border-2 border-gray-300 overflow-hidden relative"
                style={{ touchAction: 'none' }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Static Background Image */}
                <img
                  src={selectedBackground}
                  alt="Background"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                  draggable="false"
                />
                
                {/* Render all foreground images - last added on top */}
                {foregroundImages.map((img, index) => (
                  <img
                    key={img.id}
                    src={img.image}
                    alt="item"
                    className="absolute select-none"
                    draggable="false"
                    onMouseDown={(e) => handleImageMouseDown(img.id, e)}
                    onTouchStart={(e) => handleImageTouchStart(img.id, e)}
                    style={{
                      left: `${img.position.x}%`,
                      top: `${img.position.y}%`,
                      width: `${img.size}%`,
                      height: 'auto',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      transform: 'translate(-50%, 0)',
                      cursor: isDragging && selectedImageId === img.id ? 'grabbing' : 'grab',
                      pointerEvents: 'auto',
                      zIndex: 10 + index
                    }}
                  />
                ))}
                
                {/* Resize Handles - Only show for selected image when not dragging */}
                {selectedImage && !isDragging && !isResizing && (
                  <>
                    {/* Top-left handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('tl', e)}
                      onTouchStart={(e) => handleResizeTouchStart('tl', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% - ${selectedImage.size / 2}%)`,
                        top: `${selectedImage.position.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                    {/* Top-right handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('tr', e)}
                      onTouchStart={(e) => handleResizeTouchStart('tr', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% + ${selectedImage.size / 2}%)`,
                        top: `${selectedImage.position.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                    {/* Bottom-left handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('bl', e)}
                      onTouchStart={(e) => handleResizeTouchStart('bl', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% - ${selectedImage.size / 2}%)`,
                        top: `calc(${selectedImage.position.y}% + ${selectedImage.size * 0.75}%)`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                    {/* Bottom-right handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('br', e)}
                      onTouchStart={(e) => handleResizeTouchStart('br', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% + ${selectedImage.size / 2}%)`,
                        top: `calc(${selectedImage.position.y}% + ${selectedImage.size * 0.75}%)`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                    {/* Delete button for selected image */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(selectedImage.id);
                      }}
                      className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors z-50"
                      style={{
                        left: `calc(${selectedImage.position.x}% + ${selectedImage.size / 2}%)`,
                        top: `${selectedImage.position.y}%`,
                        transform: 'translate(0%, -100%)'
                      }}
                      title="Delete image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                
                {/* Add Image Button - Bottom Right */}
                <label className="absolute bottom-4 right-4 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full cursor-pointer flex items-center justify-center shadow-lg transition-colors z-40">
                  <Plus className="w-6 h-6" />
                  <input
                    type="file"
                    accept="image/jpeg, image/png"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isProcessing}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Background Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Background</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              {/* Solid Color Backgrounds */}
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
            disabled={foregroundImages.length === 0 || isProcessing}
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
