export const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true });
        ctx.drawImage(img, 0, 0, width, height);

        const isPNG = file.type === 'image/png';
        const format = isPNG ? 'image/png' : 'image/jpeg';
        const quality = isPNG ? 0.95 : 0.8;

        resolve(canvas.toDataURL(format, quality));
      };
    };
  });
};

export const compositeImageWithTshirt = (
  itemImage,
  tshirtBackgroundUrl,
  position = { x: 50, y: 28 },
  sizePercent = 45
) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false
    });

    const tshirtImg = new window.Image();
    tshirtImg.crossOrigin = 'anonymous';
    tshirtImg.src = tshirtBackgroundUrl;

    tshirtImg.onload = () => {
      ctx.drawImage(tshirtImg, 0, 0, canvas.width, canvas.height);

      const itemImg = new window.Image();
      itemImg.crossOrigin = 'anonymous';
      itemImg.src = itemImage;

      itemImg.onload = () => {
        const maxItemWidth = canvas.width * (sizePercent / 100);
        let itemWidth = maxItemWidth;
        const itemHeight = (itemImg.height / itemImg.width) * itemWidth;

        const x = (canvas.width * (position.x / 100)) - (itemWidth / 2);
        const y = canvas.height * (position.y / 100);

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(itemImg, x, y, itemWidth, itemHeight);
        ctx.restore();

        try {
          resolve(canvas.toDataURL('image/png', 1.0));
        } catch (err) {
          reject(new Error(`Failed to export composite image: ${err.message}`));
        }
      };

      itemImg.onerror = (err) => reject(new Error(`Failed to load item image: ${err}`));
    };

    tshirtImg.onerror = (err) => reject(new Error(`Failed to load t-shirt template: ${err}`));
  });
};

// Made with Bob
