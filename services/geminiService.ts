
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ImageState, Ethnicity, FitProfile, AspectRatio, PoseStyle, Product, ModelPose, BodyShape, Gender } from "../types";

export const createFitProfile = async (images: ImageState[]): Promise<FitProfile> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Analyze this batch of reference photos for a specific trouser design. Synthesize a "Master Blueprint" defining architectural constants and physics engine data. Focus strictly on construction and fit architecture. Return JSON.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: prompt },
        ...images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }))
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          specs: {
            type: Type.OBJECT,
            properties: {
              silhouette: { type: Type.STRING },
              waistline: { type: Type.STRING },
              texture: { type: Type.STRING },
              drape: { type: Type.STRING },
            },
            required: ['silhouette', 'waistline', 'texture', 'drape'],
          },
        },
        required: ['description', 'specs'],
      },
    }
  });
  return JSON.parse(response.text!) as FitProfile;
};

export const generateDescription = async (product: Partial<Product>): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    You are the Lead Copywriter for Zimbabalooba. 
    Generate a short, high-end fashion product description for: "${product.name}". 
    Include details about its unique silhouette, fit, and architectural style. 
    Keep it poetic but informative. 
    Context: Price ${product.price}, SKU ${product.sku || 'N/A'}.
    No intros, just the description text.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  });
  return response.text || "";
};

export const generateFashionPrompt = async (
  profile: FitProfile,
  patternImage: ImageState,
  ethnicity: Ethnicity,
  gender: Gender,
  bodyShape: BodyShape,
  patternScaleFactor: number,
  colorBrightnessFactor: number,
  locationStyle: PoseStyle,
  modelPose: ModelPose,
  refinementInstruction?: string,
  hasMask?: boolean,
  manualLocation?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let locationPrompt = "";
  switch (locationStyle) {
    case "Outdoor": 
      locationPrompt = "in an epic outdoor vista, perhaps a desert dune or mountain pass, in golden hour natural sunlight. Cinematic atmosphere."; 
      break;
    case "Shop Display": 
      locationPrompt = "in a pristine, minimalist fashion studio. Clean, off-white studio wall with subtle texture, and a light natural wooden floor. High-end e-commerce catalog style. Professional lighting: bright, soft, and completely even with minimal soft shadows. Clean boutique aesthetic."; 
      break;
    case "Urban": 
      locationPrompt = "in a sleek metropolitan downtown area, glass skyscrapers in the background, sharp urban shadows, cool modern vibe."; 
      break;
    case "Everyday":
      locationPrompt = "in a natural, relatable lifestyle setting like a bright minimalist apartment or a sun-drenched cafe. Warm, soft ambient light. Casual and authentic atmosphere.";
      break;
    case "Custom":
      locationPrompt = manualLocation ? `in the following setting: ${manualLocation}.` : "in a professional studio setting.";
      break;
  }

  let posePrompt = "";
  switch (modelPose) {
    case "Relaxed Standing": posePrompt = "The model is standing naturally with a relaxed posture, hands casually at sides or one hand partially in a pocket. Front-on perspective."; break;
    case "Walking Motion": posePrompt = "The model is captured mid-stride, showcasing the fluid drape and stacking of the fabric around the ankles. Dynamic but poised."; break;
    case "Seated Casual": posePrompt = "The model is sitting on a minimalist concrete block or simple chair, highlighting the volume in the seat and thigh area."; break;
    case "Side Profile": posePrompt = "A sharp side-on view to emphasize the architectural taper and clean silhouette profile."; break;
    case "Back Architecture": posePrompt = "A rear-view shot focusing on the high-rise waistband and the way the fabric pools at the hem."; break;
  }

  let bodyPrompt = "";
  switch (bodyShape) {
    case "Slim": bodyPrompt = "slender build"; break;
    case "Athletic": bodyPrompt = "athletic build"; break;
    case "Chubby": bodyPrompt = "soft rounded archetype"; break;
    case "Overweight": bodyPrompt = "larger figure archetype"; break;
    case "Muscular": bodyPrompt = "muscular physique"; break;
    case "Curvy": bodyPrompt = "curvy hourglass figure"; break;
  }

  const isRefinement = !!refinementInstruction;

  const metaPrompt = `
    ACT AS THE ZIMBABALOOBA BRAND DIRECTOR.
    
    TASK: ${isRefinement ? 'SMART REFINEMENT / "FIX" OPERATION' : 'NEW VISION SYNTHESIS'}
    ${isRefinement ? `REFINEMENT DIRECTIVE: "${refinementInstruction}"` : ''}

    BRAND ARCHITECTURE:
    - WAIST: Heavy gathered elasticated waistband with an INVISIBLE INTERNAL DRAWSTRING. NO thick rope cords.
    - HEM: Twin oval Zimbabalooba brand labels on lower leg hems. Sharp, clear, precisely placed.
    - NO THIGH PATCHES.
    - FABRIC: High-quality ${profile.specs.texture}. Accurate pattern reproduction from reference.
    - SILHOUETTE: ${profile.specs.silhouette}. Architectural volume stacking at ankles.
    
    MODEL & SETTING:
    - Model: ${gender} of ${ethnicity} ethnicity, ${bodyPrompt}.
    - Pose: ${posePrompt}.
    - Environment: ${locationPrompt}.
    ${locationStyle === "Shop Display" ? "CRITICAL: Frame the shot from the waist down to the feet. Head and upper torso are cropped out. The focus is entirely on the trousers and shoes (simple slippers or barefoot). Minimalist e-commerce catalog shot." : ""}
    - Quality: High-fidelity fashion photography, 8k resolution, photorealistic textures, professional studio grade.

    Provide a concise, highly descriptive visual prompt.
  `;

  const result = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: metaPrompt },
        { inlineData: { data: patternImage.base64, mimeType: patternImage.mimeType } }
      ]
    }
  });
  return result.text || "";
};

export const synthesizeFashionImage = async (
  prompt: string, 
  aspectRatio: AspectRatio,
  sourceImage?: string,
  maskImage?: string,
  referenceImage?: ImageState
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  
  // Clean the prompt to remove potential markdown wrappers that can confuse the image model
  const cleanPrompt = prompt.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  parts.push({ text: cleanPrompt });

  // Add reference image to provide visual context for pattern and fit
  if (referenceImage && !sourceImage) {
    parts.push({ 
      inlineData: { 
        data: referenceImage.base64, 
        mimeType: referenceImage.mimeType 
      } 
    });
  }
  
  if (sourceImage) {
    parts.push({ 
      inlineData: { 
        data: sourceImage.includes('base64,') ? sourceImage.split('base64,')[1] : sourceImage, 
        mimeType: 'image/png' 
      } 
    });
  }
  
  if (maskImage) {
    parts.push({ 
      inlineData: { 
        data: maskImage.includes('base64,') ? maskImage.split('base64,')[1] : maskImage, 
        mimeType: 'image/png' 
      } 
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio } }
  });

  const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!imgPart) {
     const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
     if (textPart) {
       console.warn("Model response:", textPart.text);
       throw new Error(`Engine returned text: ${textPart.text.substring(0, 100)}...`);
     }
     throw new Error("Engine failed to generate an image part. This may be due to safety filters or an invalid prompt.");
  }
  
  return `data:image/png;base64,${imgPart.inlineData.data}`;
};
