
export interface ImageState {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export type Gender = "Male" | "Female" | "Unisex";

export enum Ethnicity {
  SOUTH_ASIAN = 'South Asian',
  EAST_ASIAN = 'East Asian',
  BLACK_AFRICAN = 'Black / African Descent',
  LATINO_HISPANIC = 'Latino / Hispanic',
  MIDDLE_EASTERN = 'Middle Eastern',
  CAUCASIAN = 'Caucasian',
  MIXED_RACE = 'Mixed Race',
  PACIFIC_ISLANDER = 'Pacific Islander'
}

export type BodyShape = "Slim" | "Athletic" | "Chubby" | "Overweight" | "Muscular" | "Curvy";

export type PoseStyle = "Outdoor" | "Urban" | "Shop Display" | "Everyday" | "Custom";

export type ModelPose = "Relaxed Standing" | "Walking Motion" | "Seated Casual" | "Side Profile" | "Back Architecture";

export interface FitProfile {
  description: string;
  specs: {
    silhouette: string;
    waistline: string;
    texture: string;
    drape: string;
  };
}

export interface EngineResult {
  generatedPrompt: string;
  imageUrl: string;
}

export interface GeneratedArtifact extends EngineResult {
  id: string;
  timestamp: number;
}

export interface Product {
  handleId: string;
  name: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  price: string;
  size?: string;
  dateUploaded: number;
  collection?: string;
  sku?: string;
}

export interface GenerationStatus {
  step: 'idle' | 'profiling' | 'production' | 'rendering' | 'completed' | 'error';
  message: string;
}
