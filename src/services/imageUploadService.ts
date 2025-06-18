import axios from "axios";

const API_URL = "https://api.imgbb.com/1/upload";
const API_KEY = "***REMOVED***";

interface ImgBBResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: number;
    expiration: number;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    medium: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

interface UploadResult {
  url: string;
  displayUrl: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  deleteUrl: string;
  width: number;
  height: number;
  size: number;
  id: string;
}

export const uploadImageToImgBB = async (
  imageFile: File | Buffer | Blob, 
  imageName: string = ""
): Promise<UploadResult> => {
  try {
    console.log(`📤 Uploading image "${imageName}" to ImgBB...`);
    
    const formData = new FormData();
    formData.append("key", API_KEY);
    
    // Handle different input types
    if (imageFile instanceof Buffer) {
      // Convert Buffer to Blob for FormData
      const blob = new Blob([imageFile], { type: 'image/jpeg' });
      formData.append("image", blob, imageName || 'quiz-image.jpg');
    } else {
      formData.append("image", imageFile as File | Blob);
    }
    
    if (imageName) {
      formData.append("name", imageName);
    }

    // Send POST request
    const response = await axios.post<ImgBBResponse>(API_URL, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000, // 30 second timeout
    });

    if (!response.data.success) {
      throw new Error('ImgBB upload failed: ' + JSON.stringify(response.data));
    }

    const d = response.data.data as any;
    const result: UploadResult = {
      url: d.url ?? d.display_url,
      displayUrl: d.display_url ?? d.url,
      thumbnailUrl: d.thumb?.url ?? d.display_url ?? d.url,
      mediumUrl: d.medium?.url,
      deleteUrl: d.delete_url,
      width: d.width,
      height: d.height,
      size: d.size,
      id: d.id
    };

    console.log(`✅ Image uploaded successfully: ${result.displayUrl}`);
    return result;
    
  } catch (error: any) {
    console.error("ImgBB upload failed:", error.response?.data || error.message);
    throw new Error(`Failed to upload image to ImgBB: ${error.message}`);
  }
};

// For backward compatibility
const imageUploadService = {
  uploadImage: uploadImageToImgBB,
  uploadImageToImgBB
};

export default imageUploadService; 