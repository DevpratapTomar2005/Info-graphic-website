import express from 'express';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
dotenv.config();    
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.static(join(__dirname, 'public')));


let browser = null;

async function initBrowser() {
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        console.log('Browser initialized');
    } catch (error) {
        console.error('Failed to initialize browser:', error);
    }
}


process.on('exit', async () => {
    if (browser) await browser.close();
});

process.on('SIGINT', async () => {
    if (browser) await browser.close();
    process.exit();
});


app.post('/api/screenshot', async (req, res) => {
    try {
        const { 
            url,
            width = 1200,
            height = 800,
            format = 'png',
            quality = 90,
            fullPage = true,
            delay = 2000
        } = req.body;

        // Validate URL
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is required' 
            });
        }

     
        if (!browser) {
            await initBrowser();
        }

        if (!browser) {
            throw new Error('Failed to initialize browser');
        }

        const page = await browser.newPage();
        
        try {
          
            await page.setViewport({ 
                width: parseInt(width), 
                height: parseInt(height),
                deviceScaleFactor: 1
            });
            
          
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            
            await page.goto(url, { 
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 60000 
            });
            
          
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, parseInt(delay)));
            }

         
            await page.evaluate(() => {
                return Promise.all(Array.from(document.images)
                    .filter(img => !img.complete)
                    .map(img => new Promise(resolve => {
                        img.addEventListener('load', resolve);
                        img.addEventListener('error', resolve);
                    })));
            });
            
      
            const screenshotOptions = {
                fullPage: fullPage === true || fullPage === 'true',
                type: format,
                omitBackground: false
            };
            
      
            if (format === 'jpeg' || format === 'jpg') {
                screenshotOptions.quality = parseInt(quality);
            }
            
           
            const screenshotBuffer = await page.screenshot(screenshotOptions);
            
          
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `screenshot-${timestamp}.${format}`;
            
            res.setHeader('Content-Type', `image/${format}`);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', screenshotBuffer.length);
            
            
            res.send(screenshotBuffer);
            
        } finally {
            await page.close();
        }
        
    } catch (error) {
        console.error('Screenshot error:', error);
        
    
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to capture screenshot',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initBrowser();
});

export default app;