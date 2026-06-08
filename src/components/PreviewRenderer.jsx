import React from 'react';

/**
 * PreviewRenderer - Dynamically renders a preview image from metadata
 * This ensures consistent, high-quality rendering across the app
 */
const PreviewRenderer = ({ 
  previewImageMeta, 
  className = '',
  onClick = null,
  alt = 'Preview'
}) => {
  if (!previewImageMeta?.selectedBackground || !previewImageMeta?.foregroundImages?.length) {
    return null;
  }

  const { selectedBackground, foregroundImages } = previewImageMeta;

  return (
    <div 
      className={`relative ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Background Layer */}
      <img
        src={selectedBackground}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        draggable="false"
      />
      
      {/* Foreground Images - rendered in order (last on top) */}
      {foregroundImages.map((img, index) => (
        <img
          key={img.id || index}
          src={img.image}
          alt={`${alt} layer ${index + 1}`}
          className="absolute select-none pointer-events-none"
          draggable="false"
          style={{
            left: `${img.position.x}%`,
            top: `${img.position.y}%`,
            width: `${img.size}%`,
            height: 'auto',
            maxWidth: 'none',
            maxHeight: 'none',
            transform: 'translate(-50%, 0)'
          }}
        />
      ))}
    </div>
  );
};

export default PreviewRenderer;

// Made with Bob
