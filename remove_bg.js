const { Jimp } = require('jimp');

async function removeOuterWhiteBackground(imagePath, outputPath) {
    try {
        const image = await Jimp.read(imagePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const targetColor = { r: 255, g: 255, b: 255 }; // White
        
        const colorDistance = (c1, c2) => {
            return Math.sqrt(
                Math.pow(c1.r - c2.r, 2) +
                Math.pow(c1.g - c2.g, 2) +
                Math.pow(c1.b - c2.b, 2)
            );
        };
        
        const tolerance = 70;
        const visited = new Uint8Array(width * height);
        const stack = [];
        
        const checkAndEnqueue = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            const idx = y * width + x;
            if (visited[idx]) return;
            visited[idx] = 1;
            
            const pixelIdx = (y * width + x) * 4;
            const r = image.bitmap.data[pixelIdx + 0];
            const g = image.bitmap.data[pixelIdx + 1];
            const b = image.bitmap.data[pixelIdx + 2];
            const a = image.bitmap.data[pixelIdx + 3];
            
            if (colorDistance({ r, g, b }, targetColor) <= tolerance && a > 0) {
                stack.push({ x, y });
                image.bitmap.data[pixelIdx + 3] = 0; // make transparent
            }
        };

        // Seed from the edges
        for (let x = 0; x < width; x++) {
            checkAndEnqueue(x, 0);
            checkAndEnqueue(x, height - 1);
        }
        for (let y = 0; y < height; y++) {
            checkAndEnqueue(0, y);
            checkAndEnqueue(width - 1, y);
        }

        // Flood fill using stack (DFS is faster than BFS array shift)
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            checkAndEnqueue(x - 1, y);
            checkAndEnqueue(x + 1, y);
            checkAndEnqueue(x, y - 1);
            checkAndEnqueue(x, y + 1);
        }
        
        image.write(outputPath, (err) => {
            if (err) console.error(err);
            else console.log('Outer background removed successfully.');
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

removeOuterWhiteBackground('public/logo.png', 'public/logo_transparent.png');
