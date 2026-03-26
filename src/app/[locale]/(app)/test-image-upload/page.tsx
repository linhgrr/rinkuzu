'use client';

import { useState } from 'react';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function TestImageUploadPage() {
  const [questionImage, setQuestionImage] = useState<string>();
  const [optionImages, setOptionImages] = useState<(string | undefined)[]>([
    undefined, undefined, undefined, undefined
  ]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const updateQuestionImage = (imageUrl: string) => {
    addLog(`📸 Question image updated: ${imageUrl}`);
    setQuestionImage(imageUrl);
  };

  const removeQuestionImage = () => {
    addLog(`🗑️ Question image removed`);
    setQuestionImage(undefined);
  };

  const updateOptionImage = (index: number, imageUrl: string) => {
    addLog(`📸 Option ${index + 1} image updated: ${imageUrl}`);
    const updated = [...optionImages];
    updated[index] = imageUrl;
    setOptionImages(updated);
  };

  const removeOptionImage = (index: number) => {
    addLog(`🗑️ Option ${index + 1} image removed`);
    const updated = [...optionImages];
    updated[index] = undefined;
    setOptionImages(updated);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportState = () => {
    const state = {
      questionImage,
      optionImages,
      summary: {
        hasQuestionImage: !!questionImage,
        optionImagesCount: optionImages.filter(Boolean).length,
        totalImages: (questionImage ? 1 : 0) + optionImages.filter(Boolean).length
      }
    };
    console.log('📋 Current state:', state);
    addLog(`📋 State exported - Q: ${!!questionImage}, Options: ${optionImages.filter(Boolean).length}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Image Upload Test & Debug
          </h1>
          <p className="text-gray-600 mt-2">
            Test drag & drop, click to upload, and paste (Ctrl+V) functionality with real-time logging
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Interface */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Question Image Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionImageUpload
                  currentImage={questionImage}
                  onImageUploaded={updateQuestionImage}
                  onImageRemoved={removeQuestionImage}
                />
                {questionImage && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      ✅ Question image uploaded: 
                      <br />
                      <code className="text-xs break-all">{questionImage}</code>
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
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 break-all">
                        ✅ Image: {optionImages[index]}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">How to test:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Click to upload:</strong> Click on the upload area and select an image file</li>
                <li>• <strong>Drag & drop:</strong> Drag an image file from your computer and drop it on the upload area</li>
                <li>• <strong>Paste:</strong> Copy an image (Ctrl+C) and then click on the upload area and paste (Ctrl+V)</li>
                <li>• <strong>Remove:</strong> Hover over an uploaded image and click the X button to remove it</li>
              </ul>
            </div>
          </div>

          {/* Debug Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Debug Panel</CardTitle>
                  <div className="space-x-2">
                    <Button onClick={exportState} size="sm" variant="outline">
                      Export State
                    </Button>
                    <Button onClick={clearLogs} size="sm" variant="outline">
                      Clear Logs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Current State */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Current State:</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>Question Image: {questionImage ? '✅ Yes' : '❌ No'}</div>
                    <div>Option Images: {optionImages.filter(Boolean).length}/4</div>
                    <div>Total Images: {(questionImage ? 1 : 0) + optionImages.filter(Boolean).length}</div>
                  </div>
                </div>

                {/* Activity Logs */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Activity Logs:</h4>
                  <div className="h-64 overflow-y-auto bg-gray-50 rounded p-2 text-xs font-mono">
                    {logs.length === 0 ? (
                      <div className="text-gray-500 italic">No activity yet...</div>
                    ) : (
                      logs.map((log, index) => (
                        <div key={index} className="mb-1 text-gray-700">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ImgBB Test */}
            <Card>
              <CardHeader>
                <CardTitle>ImgBB Service Test</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 space-y-2">
                  <div>API Key: {process.env.NODE_ENV === 'development' ? 'db3e6e11...' : 'Hidden'}</div>
                  <div>Endpoint: https://api.imgbb.com/1/upload</div>
                  <div>Timeout: 30 seconds</div>
                  <div>Max Size: 10MB</div>
                  <div>Formats: PNG, JPG, GIF</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 