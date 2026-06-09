import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Save, Upload, Image as ImageIcon, Plus } from 'lucide-react';

// Helper function to generate solid color background
const generateSolidColorBackground = (color, width = 1200, height = 900) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

// Helper function to generate SVG background with color
const generateSvgBackground = async (color, width = 1200, height = 900) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch the SVG as text
      const response = await fetch('/tshirt.svg');
      const svgText = await response.text();
      
      // Replace white color (#fff or #ffffff) with the selected color
      // This preserves transparency while changing the t-shirt color
      const modifiedSvg = svgText
        .replace(/fill="#fff"/gi, `fill="${color}"`)
        .replace(/fill="#ffffff"/gi, `fill="${color}"`)
        .replace(/\.a\{fill:#fff\}/gi, `.a{fill:${color}}`);
      
      // Create a blob from the modified SVG
      const blob = new Blob([modifiedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      // Load the modified SVG as an image
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Calculate aspect ratio to fit SVG without stretching
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > canvasAspect) {
          // Image is wider than canvas
          drawWidth = width;
          drawHeight = width / imgAspect;
          offsetX = 0;
          offsetY = (height - drawHeight) / 2;
        } else {
          // Image is taller than canvas
          drawHeight = height;
          drawWidth = height * imgAspect;
          offsetX = (width - drawWidth) / 2;
          offsetY = 0;
        }
        
        // Draw the SVG centered and fitted (transparency is preserved)
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load modified t-shirt SVG'));
      };
      
      img.src = url;
    } catch (error) {
      reject(new Error('Failed to fetch or process t-shirt SVG: ' + error.message));
    }
  });
};
// Helper function to compress a base64 image
const compressBase64Image = (base64String, maxWidth = 600, maxHeight = 600, quality = 0.8) => {
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
      
      // Use PNG for better quality with transparency support
      const compressed = canvas.toDataURL('image/png', quality);
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
  initialBackgroundType,
  initialBackgroundColor,
  initialCustomBackgroundImage,
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
  const [imagesLoaded, setImagesLoaded] = useState({});
  
  // Background customization state - initialize from props or defaults
  const [backgroundType, setBackgroundType] = useState(initialBackgroundType || 'solid');
  const [backgroundColor, setBackgroundColor] = useState(initialBackgroundColor || '#FFFFFF');
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [customBackgroundImage, setCustomBackgroundImage] = useState(null);
  
  const canvasRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ size: 0, x: 0, y: 0, handle: null });
  const imageRefs = useRef({});
  
  // Get currently selected image
  const selectedImage = foregroundImages.find(img => img.id === selectedImageId);
  
  // Helper function to calculate the actual rendered height percentage of an image
  const getImageHeightPercent = (imageId) => {
    const imgElement = imageRefs.current[imageId];
    const canvasElement = canvasRef.current;
    
    if (!imgElement || !canvasElement) {
      // Fallback to aspect ratio if available, otherwise use default
      const img = foregroundImages.find(i => i.id === imageId);
      return img?.size * (img?.aspectRatio || 0.75);
    }
    
    const canvasRect = canvasElement.getBoundingClientRect();
    const imgRect = imgElement.getBoundingClientRect();
    
    // Calculate height as percentage of canvas height
    return (imgRect.height / canvasRect.height) * 100;
  };

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
      setBackgroundType(initialBackgroundType || 'solid');
      setBackgroundColor(initialBackgroundColor || '#FFFFFF');
      setCustomBackgroundImage(initialCustomBackgroundImage || null);
      setPreviewImage(null);
    }
  }, [isOpen, initialBackground, initialForegroundImages, initialBackgroundType, initialBackgroundColor, initialCustomBackgroundImage]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressedBase64 = await compressImage(file);
      
      // Load the image to get its dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = compressedBase64;
      });
      
      const aspectRatio = img.height / img.width;
      
      const newImage = {
        id: Date.now(),
        image: compressedBase64,
        position: { x: 50, y: 28 },
        size: 45,
        aspectRatio: aspectRatio
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
    e.preventDefault(); // Prevent default drag behavior
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
    e.preventDefault(); // Prevent default drag behavior
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
    e.preventDefault();
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
    if (!selectedBackground) {
      console.error('Missing selectedBackground');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Save only the metadata - no need to pre-composite
      // The preview will be rendered dynamically from this metadata
      await onSave({
        selectedBackground,
        foregroundImages,
        backgroundType,
        backgroundColor,
        customBackgroundImage
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

  const handleBackgroundChange = async (type, color) => {
    setIsGeneratingBackground(true);
    try {
      let newBackground;
      if (type === 'solid') {
        newBackground = generateSolidColorBackground(color);
      } else {
        newBackground = await generateSvgBackground(color);
      }
      setSelectedBackground(newBackground);
    } catch (err) {
      console.error('Background generation error:', err);
      alert('Failed to generate background. Please try again.');
    } finally {
      setIsGeneratingBackground(false);
    }
  };

  const handleBackgroundTypeChange = async (type) => {
    setBackgroundType(type);
    if (type === 'image' && customBackgroundImage) {
      // Use the custom image as background
      setSelectedBackground(customBackgroundImage);
    } else {
      await handleBackgroundChange(type, backgroundColor);
    }
  };

  const handleColorChange = async (color) => {
    setBackgroundColor(color);
    await handleBackgroundChange(backgroundType, color);
  };

  const handleCustomBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsGeneratingBackground(true);
    try {
      const compressedBase64 = await compressImage(file);
      setCustomBackgroundImage(compressedBase64);
      setSelectedBackground(compressedBase64);
      setBackgroundType('image');
    } catch (err) {
      console.error('Background upload error:', err);
      alert('Failed to upload background image. Please try again.');
    } finally {
      setIsGeneratingBackground(false);
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
                    ref={(el) => { imageRefs.current[img.id] = el; }}
                    src={img.image}
                    alt="item"
                    className="absolute select-none"
                    draggable="false"
                    onLoad={() => {
                      setImagesLoaded(prev => ({ ...prev, [img.id]: true }));
                    }}
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
                
                {/* Resize Handles - Show for selected image when not dragging */}
                {selectedImage && !isDragging && (
                  <>
                    {/* Top-left handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('tl', e)}
                      onTouchStart={(e) => handleResizeTouchStart('tl', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% - ${selectedImage.size / 2}%)`,
                        top: `${selectedImage.position.y}%`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none',
                        pointerEvents: 'auto'
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
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none',
                        pointerEvents: 'auto'
                      }}
                    />
                    {/* Bottom-left handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('bl', e)}
                      onTouchStart={(e) => handleResizeTouchStart('bl', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% - ${selectedImage.size / 2}%)`,
                        top: `calc(${selectedImage.position.y}% + ${getImageHeightPercent(selectedImage.id)}%)`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none',
                        pointerEvents: 'auto'
                      }}
                    />
                    {/* Bottom-right handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('br', e)}
                      onTouchStart={(e) => handleResizeTouchStart('br', e)}
                      className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize z-50 hover:scale-125 transition-transform"
                      style={{
                        left: `calc(${selectedImage.position.x}% + ${selectedImage.size / 2}%)`,
                        top: `calc(${selectedImage.position.y}% + ${getImageHeightPercent(selectedImage.id)}%)`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none',
                        pointerEvents: 'auto'
                      }}
                    />
                    {/* Delete button for selected image - Bottom right, just inside resize handle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(selectedImage.id);
                      }}
                      className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors z-50"
                      style={{
                        left: `calc(${selectedImage.position.x}% + ${selectedImage.size / 2}%)`,
                        top: `calc(${selectedImage.position.y}% + ${getImageHeightPercent(selectedImage.id)}%)`,
                        transform: 'translate(-120%, -120%)'
                      }}
                      title="Delete image"
                    >
                      <X className="w-3 h-3" />
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
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              {/* Background Type Selector */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Background Type</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBackgroundTypeChange('solid')}
                    disabled={isGeneratingBackground}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                      backgroundType === 'solid'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Solid Color
                  </button>
                  <button
                    onClick={() => handleBackgroundTypeChange('svg')}
                    disabled={isGeneratingBackground}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                      backgroundType === 'svg'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    T-Shirt SVG
                  </button>
                  <button
                    onClick={() => handleBackgroundTypeChange('image')}
                    disabled={isGeneratingBackground}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                      backgroundType === 'image'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Custom Image
                  </button>
                </div>
              </div>

              {/* Color Picker - Only show for solid and svg types */}
              {backgroundType !== 'image' && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    {backgroundType === 'solid' ? 'Background Color' : 'T-Shirt Color'}
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      disabled={isGeneratingBackground}
                      className="w-16 h-10 rounded border border-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                          setBackgroundColor(value);
                          if (value.length === 7) {
                            handleColorChange(value);
                          }
                        }
                      }}
                      disabled={isGeneratingBackground}
                      placeholder="#FFFFFF"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
                    />
                  </div>
                  {isGeneratingBackground && (
                    <p className="text-xs text-gray-500 mt-2">Generating background...</p>
                  )}
                </div>
              )}

              {/* Custom Background Image Upload - Only show for image type */}
              {backgroundType === 'image' && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Upload Background Image</p>
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {customBackgroundImage ? 'Change Background Image' : 'Choose Background Image'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg, image/png"
                      className="hidden"
                      onChange={handleCustomBackgroundUpload}
                      disabled={isGeneratingBackground}
                    />
                  </label>
                  {customBackgroundImage && (
                    <p className="text-xs text-green-600 mt-2">✓ Background image uploaded</p>
                  )}
                </div>
              )}

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
            disabled={!selectedBackground || isProcessing}
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
