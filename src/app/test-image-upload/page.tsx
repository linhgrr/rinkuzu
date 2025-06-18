'use client';

import { useState } from 'react';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function TestImageUploadPage() {
  const [questionImage, setQuestionImage] = useState<string>();
  const [optionImages, setOptionImages] = useState<(string | undefined)[]>([
    undefined, undefined, undefined, undefined
  ]);

  const updateOptionImage = (index: number, imageUrl: string) => {
    const updated = [...optionImages];
    updated[index] = imageUrl;
    setOptionImages(updated);
  };

  const removeOptionImage = (index: number) => {
    const updated = [...optionImages];
    updated[index] = undefined;
    setOptionImages(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Image Upload Test
          </h1>
          <p className="text-gray-600 mt-2">
            Test drag & drop, click to upload, and paste (Ctrl+V) functionality
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Question Image Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionImageUpload
              currentImage={questionImage}
              onImageUploaded={setQuestionImage}
              onImageRemoved={() => setQuestionImage(undefined)}
            />
            {questionImage && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  ✅ Question image uploaded: {questionImage}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Option Images Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Option A', 'Option B', 'Option C', 'Option D'].map((option, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  {option}
                </h4>
                <OptionImageUpload
                  currentImage={optionImages[index]}
                  onImageUploaded={(imageUrl) => updateOptionImage(index, imageUrl)}
                  onImageRemoved={() => removeOptionImage(index)}
                />
                {optionImages[index] && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                    ✅ Image uploaded: {optionImages[index]}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">How to test:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>Click to upload:</strong> Click on the upload area and select an image file</li>
            <li>• <strong>Drag & drop:</strong> Drag an image file from your computer and drop it on the upload area</li>
            <li>• <strong>Paste:</strong> Copy an image (Ctrl+C) and then click on the upload area and paste (Ctrl+V)</li>
            <li>• <strong>Remove:</strong> Hover over an uploaded image and click the X button to remove it</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 