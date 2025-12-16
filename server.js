import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import { Buffer } from "buffer";
import mongoose from 'mongoose'; // ADDED

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- MONGODB CONNECTION & TRACKING ---

// 1. Connect (Fail-Safe)
const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.warn("⚠️ MONGODB_URI not set. Usage tracking disabled.");
        return;
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
    }
};
connectDB();

// 2. Schema
const usageSchema = new mongoose.Schema({
    domain: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    lastRequest: { type: Date, default: Date.now }
});

// Prevent Overwrite Error on Hot Reload
const StoreUsage = mongoose.models.StoreUsage || mongoose.model('StoreUsage', usageSchema);

// 3. Tracking Helper (Fire-and-Forget)
const trackStoreUsage = async (req) => {
    if (mongoose.connection.readyState !== 1) return;

    try {
        let domain = 'unknown_store';

        // 1. Explicit Site URL (from App.tsx)
        if (req.body && req.body.site_url) {
            domain = req.body.site_url;
        }
        // 2. Fallback to Origin
        else {
            const raw = req.get('origin') || req.get('referer');
            if (raw) {
                try { domain = new URL(raw).hostname.replace('www.', ''); }
                catch (e) { domain = raw; }
            }
        }

        domain = domain.replace('www.', '');

        // Atomic Increment
        await StoreUsage.findOneAndUpdate(
            { domain: domain },
            { $inc: { count: 1 }, $set: { lastRequest: new Date() } },
            { upsert: true, new: true }
        );
        console.log(`📊 Usage Tracked: +1 for ${domain}`);
    } catch (error) {
        console.error("⚠️ Usage Tracking Error:", error.message);
    }
};

// Middleware
app.use(cors({
    origin: '*', // Allow all origins (Lovable, localhost, Store)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'] // Explicitly allow our custom key
}));
app.use(express.json());

// Serve static files from the build directory
app.use(express.static(path.join(process.cwd(), 'dist')));

// Serve public files (like widget.js)
app.use(express.static(path.join(process.cwd(), 'public')));

// File Upload Config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// --- API Logic (Inlined from externalApiService.ts) ---

const getApiClient = () => {
    const apiKey = process.env.MODEL_API_KEY;
    if (!apiKey) {
        console.warn("WARNING: MODEL_API_KEY is not set. Using placeholder.");
        return new GoogleGenAI({ apiKey: "YOUR_API_KEY_HERE" });
    }
    return new GoogleGenAI({ apiKey });
};

const bufferToBase64 = (buffer) => {
    return buffer.toString('base64');
};

const generateVirtualTryOn = async (userImageBuffer, userMimeType, productImageUrl) => {
    try {
        const ai = getApiClient();

        // Fetch product image
        const productResp = await fetch(productImageUrl);
        if (!productResp.ok) throw new Error("Failed to fetch product image from URL");
        const productArrayBuffer = await productResp.arrayBuffer();
        const productBase64 = Buffer.from(productArrayBuffer).toString('base64');
        const productMimeType = productResp.headers.get('content-type') || 'image/jpeg';

        const model = 'gemini-2.5-flash-image';
        const prompt = `
      You are a PIXEL-PERFECT TEXTURE TRANSFER ENGINE.
      **CRITICAL MISSION**: Map the clothing from the Product Image onto the User Image with 100% VISUAL FIDELITY.
      
      **OPERATIONAL RULES (READ CAREFULLY):**
      
      1. **DEEP TEXTURE SCAN (TAKE YOUR TIME)**:
         - **STOP AND LOOK**: Analyze the Product Image for 5 virtual seconds.
         - **TRACE THE SEAMS**: Identify every stitching line (costura), hem, and fold.
         - **COUNT THE BUTTONS**: If there are 3 buttons, output 3 buttons.
      
      2. **FULL LOOK PROTOCOL (UPPER + LOWER)**:
         - If the image contains a FULL OUTFIT (e.g., Shirt + Pants):
           - You MUST transfer BOTH pieces with equal fidelity.
           - **DO NOT** merge the shirt into the pants. Keep the waistline distinct.
           - **BELT BUCKLES**: Focus intensely on the belt area. If there is a buckle, preserve its metallic shine and exact shape. Do NOT blur the buckle.
      
      3. **THE "SEAM STRESS TEST"**:
         - The output MUST preserve the exact stitching pattern of the original.
         - If the jacket has a double-stitch on the shoulder, the output MUST have a double-stitch.
         - **DO NOT** smooth out seams. They define the structure.
      
      4. **THE "NO CREATIVITY" RULE**:
         - You are NOT an artist. You are a COPIER.
         - Do NOT invent details. Do NOT improve the design.
         - If the product image is blurry, the output texture should reflect that. Do not "hallucinate" high-res details that don't exist.
      
      5. **TEXTURE PRESERVATION (PRIORITY #1)**:
         - The fabric, pattern, and material of the clothing MUST be identical to the source.
         - **DO NOT** change a zipper into a seam.
         - **DO NOT** add pockets if they are not clearly visible in the source.
         - **DO NOT** change the collar style.
      
      6. **FIRST-TRY SUCCESS**:
         - Do not output a "draft". Output the FINAL, polished result immediately.
         - Ensure lighting matches the user's environment, but strictly preserve the clothing's base color.
      
      **OUTPUT**:
      - A photorealistic image where the user is wearing the EXACT item shown in the Product Image.
      - Return ONLY the image.
    `;

        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: userMimeType,
                            data: bufferToBase64(userImageBuffer)
                        }
                    },
                    {
                        inlineData: {
                            mimeType: productMimeType,
                            data: productBase64
                        }
                    }
                ]
            }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image generated by the external API.");

    } catch (error) {
        const apiKey = process.env.MODEL_API_KEY || '';
        let errStr = String(error);
        if (apiKey && apiKey.length > 0) {
            errStr = errStr.replace(new RegExp(apiKey, 'g'), 'YOUR_API_KEY_HERE');
        }
        console.error("External API Error:", errStr);
        throw new Error("External processing failed.");
    }
};

const generateAvatar = async (features, faceImageBuffer, faceMimeType) => {
    try {
        const ai = getApiClient();
        const model = 'gemini-2.5-flash-image';

        // Extract features including new measurements
        const { height, weight, age, bodyType, skinTone, gender, bust, waist, hips } = features;

        let prompt = `
            Generate a photorealistic, high-resolution full-body studio photo of a person with the following characteristics:
            - **Gender**: ${gender || 'Female'}
            - **Age**: ${age} years old
            - **Height**: ${height} cm
            - **Weight**: ${weight} kg
            - **Body Type**: ${bodyType}
            - **Skin Tone**: ${skinTone}
            ${bust ? `- **Chest/Bust**: ${bust} cm` : ''}
            ${waist ? `- **Waist**: ${waist} cm` : ''}
            ${hips ? `- **Hips**: ${hips} cm` : ''}
            
            **CLOTHING**: The person MUST be wearing simple, tight-fitting clothing (e.g. a plain ${gender === 'Male' ? 't-shirt and shorts' : 'tank top and leggings'}) in a neutral color (white or grey) to allow for easy virtual try-on overlay later.
            
            **POSE**: Standing straight, arms slightly away from the body (A-pose or neutral standing pose), looking directly at the camera.
            **LIGHTING**: Professional studio lighting, soft shadows, neutral background.
            **QUALITY**: 8k, highly detailed, realistic skin texture.
        `;

        const parts = [{ text: prompt }];

        if (faceImageBuffer) {
            prompt += `
            IMPORTANT: Use the facial features (eyes, nose, mouth, structure) from the provided Face Reference Image. 
            Blend these facial features naturally onto the generated body.
            `;
            parts[0] = { text: prompt };
            parts.push({
                inlineData: {
                    mimeType: faceMimeType,
                    data: bufferToBase64(faceImageBuffer)
                }
            });
        }

        prompt += `\nReturn ONLY the generated image.`;
        parts[0] = { text: prompt };

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts }
        });

        const partsResp = response.candidates?.[0]?.content?.parts;
        if (partsResp) {
            for (const part of partsResp) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No avatar generated.");

    } catch (error) {
        console.error("Avatar Generation Error:", error);
        throw new Error("Failed to generate avatar.");
    }
};

// --- Routes ---

app.post('/api/generate-avatar', upload.single('face_image'), async (req, res) => {
    try {
        const features = req.body;
        const faceImage = req.file;

        if (!features.age || !features.height || !features.weight) {
            return res.status(400).json({ success: false, error: 'Missing physical characteristics' });
        }

        const avatarImage = await generateAvatar(
            features,
            faceImage ? faceImage.buffer : null,
            faceImage ? faceImage.mimetype : null
        );

        // Track Usage (Async)
        trackStoreUsage(req);

        res.json({ success: true, image: avatarImage });

    } catch (error) {
        console.error("Server Error (Avatar):", error.message);
        res.status(500).json({ success: false, error: 'Avatar generation failed.' });
    }
});

app.post('/api/generate', upload.single('user_image'), async (req, res) => {
    try {
        const userImage = req.file;
        const productImageUrl = req.body.product_image_url;

        if (!userImage) return res.status(400).json({ success: false, error: 'User image is required' });
        if (!productImageUrl) return res.status(400).json({ success: false, error: 'Product image URL is required' });

        const generatedImageBase64 = await generateVirtualTryOn(
            userImage.buffer,
            userImage.mimetype,
            productImageUrl
        );

        // Track Usage (Async)
        trackStoreUsage(req);

        res.json({ success: true, image: generatedImageBase64 });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ success: false, error: 'Processing failed. Please try again.' });
    }
});

// --- Endpoint: Size Estimation ---
app.post('/api/estimate-size', upload.none(), async (req, res) => {
    try {
        const { height, weight, age, bodyType, gender, bust, waist, hips, product_image_url, product_description } = req.body;

        console.log('Size Estimation Request:', { height, weight, gender, product_image_url, hasDescription: !!product_description });

        if (!product_image_url) {
            return res.status(400).json({ success: false, error: 'Product image URL is required' });
        }

        // Fetch product image
        const imageResponse = await fetch(product_image_url);
        if (!imageResponse.ok) throw new Error("Failed to fetch product image");
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageArrayBuffer).toString('base64');
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

        const prompt = `
      You are an expert fashion tailor and size advisor.
      Analyze the clothing item in the image, the store description, and the user's body measurements to recommend the best size.
      
      User Profile:
      - Gender: ${gender}
      - Height: ${height} cm
      - Weight: ${weight} kg
      - Bust/Chest: ${bust || 'Not provided'} cm
      - Waist: ${waist || 'Not provided'} cm
      - Hips: ${hips || 'Not provided'} cm
      - Body Type: ${bodyType}
      - Age: ${age}

      Store Description (May contain size charts or fit info):
      "${product_description || 'No description provided.'}"

      Task:
      1. Identify the type of clothing in the image.
      2. Analyze the Store Description for specific measurements (e.g., "Model wears size S", "Small fit", "Waist 60cm = Size P").
      3. IF the description has specific sizing rules, USE THEM.
      4. ELSE, use standard international sizing (S, M, L, XL, XXL) and Brazilian sizing (P, M, G, GG).
      5. Recommend the best size.
      6. Provide a short reason.

      Output Format (JSON only):
      {
        "size": "M",
        "br_size": "M",
        "details": "Based on the store's size chart found in the description...",
        "fit_note": "The description says this runs small."
      }
    `;

        const ai = getApiClient();
        const model = 'gemini-1.5-flash'; // Use Flash for speed

        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: imageBase64
                        }
                    }
                ]
            }
        });

        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('AI Size Recommendation:', responseText);

        if (!responseText) throw new Error("No recommendation generated");

        // Clean up markdown code blocks if present
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const recommendation = JSON.parse(jsonStr);

        res.json({ success: true, recommendation });

    } catch (error) {
        console.error('AI Size Estimation Failed:', error.message);
        console.log('Switching to Mathematical Fallback...');

        // --- FALLBACK LOGIC (Measurement Based) ---
        const { height, weight, gender, bust, waist, hips, bodyType } = req.body;

        let size = 'M';
        let br_size = 'M';
        let details = '';

        const chestVal = parseFloat(bust) || 0;
        const waistVal = parseFloat(waist) || 0;
        const hipsVal = parseFloat(hips) || 0;
        const heightVal = parseFloat(height) || 0;

        // Sizing Tables (Approximate in cm)
        // Men: S(88-96), M(96-104), L(104-112), XL(112+)
        // Women: S(82-88), M(88-96), L(96-104), XL(104+)

        if (chestVal > 0) {
            // Logic based primarily on Chest/Bust
            if (gender === 'Male') {
                if (chestVal < 94) { size = 'S'; br_size = 'P'; }
                else if (chestVal < 102) { size = 'M'; br_size = 'M'; }
                else if (chestVal < 110) { size = 'L'; br_size = 'G'; }
                else { size = 'XL'; br_size = 'GG'; }
            } else {
                // Female
                if (chestVal < 86) { size = 'S'; br_size = 'P'; }
                else if (chestVal < 94) { size = 'M'; br_size = 'M'; }
                else if (chestVal < 102) { size = 'L'; br_size = 'G'; }
                else { size = 'XL'; br_size = 'GG'; }
            }
            details = `Baseado no seu tórax/busto de ${chestVal}cm.`;
        }
        else {
            // Fallback if no measurements provided (use BMI as last resort or default to M)
            if (parseFloat(weight) > 90) { size = 'L'; br_size = 'G'; }
            else if (parseFloat(weight) < 55) { size = 'S'; br_size = 'P'; }
            details = "Estimativa aproximada (adicione medidas de tórax para precisão).";
        }

        // Adjust for Height (Tall people often need size up for length)
        if (heightVal > 185 && (size === 'S' || size === 'M')) {
            size = 'L'; br_size = 'G';
            details += ` Ajustado para sua altura (${heightVal}cm).`;
        }

        // Adjust for Body Type
        if (bodyType === 'Inverted Triangle' || bodyType === 'Rectangle') {
            // Broader shoulders might need more room
            if (size === 'M' && chestVal > 100) { size = 'L'; br_size = 'G'; }
        }

        // Adjust for Hips (Female only)
        if (gender === 'Female' && hipsVal > 0) {
            const sizes = ['S', 'M', 'L', 'XL'];
            let hipsSize = 'M';
            if (hipsVal < 94) hipsSize = 'S';
            else if (hipsVal < 102) hipsSize = 'M';
            else if (hipsVal < 110) hipsSize = 'L';
            else hipsSize = 'XL';

            // If hips require a larger size than chest, warn the user
            // We find the index of the sizes to compare
            const currentSizeIndex = sizes.indexOf(size);
            const hipsSizeIndex = sizes.indexOf(hipsSize);

            if (hipsSizeIndex > currentSizeIndex) {
                const hipsBr = hipsSize === 'S' ? 'P' : hipsSize === 'M' ? 'M' : hipsSize === 'L' ? 'G' : 'GG';
                details += ` Atenção: Seu quadril (${hipsVal}cm) sugere tamanho ${hipsBr}.`;
            }
        }

        const fallbackRecommendation = {
            size: size,
            br_size: br_size,
            details: details,
            fit_note: `Corte ideal para corpo ${bodyType || 'padrão'}.`
        };

        res.json({ success: true, recommendation: fallbackRecommendation, source: 'fallback' });
    }
});

// --- ADMIN ROUTE (Stats) ---
app.get('/api/admin/stats', async (req, res) => {
    // Security Check
    const adminKey = req.headers['x-admin-key'];
    const SECRET = process.env.ADMIN_SECRET || 'modelux_secret_2025'; // Fallback key

    if (adminKey !== SECRET) {
        return res.status(401).json({ success: false, error: 'Unauthorized Access' });
    }

    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, error: 'DB Disconnected' });
        }

        // Fetch all stores, sorted by usage (High to Low)
        const stats = await StoreUsage.find().sort({ count: -1 });

        res.json({
            success: true,
            stores: stats, // MATCHING LOVABLE EXPECTATION (stores instead of data)
            total_generations: stats.reduce((acc, curr) => acc + curr.count, 0),
            total_stores: stats.length
        });

    } catch (error) {
        console.error("Admin Stats Error:", error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// Catch-all handler for any request that doesn't match the above
// Using regex to avoid Express 5 PathError with wildcards
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    const apiKey = process.env.MODEL_API_KEY;
    if (!apiKey) {
        console.warn("WARNING: MODEL_API_KEY is not set.");
    } else {
        const maskedKey = apiKey.length > 4
            ? apiKey.substring(0, 4) + "*".repeat(apiKey.length - 4)
            : "****";
        console.log(`API Key loaded: ${maskedKey}`);
    }
});
