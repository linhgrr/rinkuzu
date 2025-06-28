import React from 'react'
import { UploadProgress } from '@/services/largeFileUploadService'

interface LargeFileUploadProgressProps {
  progress: UploadProgress
  isVisible: boolean
}

export function LargeFileUploadProgress({ progress, isVisible }: LargeFileUploadProgressProps) {
  if (!isVisible) return null

  const getStatusColor = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return 'text-blue-600'
      case 'processing':
        return 'text-yellow-600'
      case 'completed':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'processing':
        return (
          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const calculateProgressPercentage = () => {
    if (progress.totalChunks === 0) return 0
    return Math.round((progress.currentChunk / progress.totalChunks) * 100)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`${getStatusColor(progress.status)}`}>
            {getStatusIcon(progress.status)}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Processing Large File
            </h3>
            <p className="text-sm text-gray-600">
              {progress.fileName && `File: ${progress.fileName}`}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {progress.totalChunks > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progress.currentChunk}/{progress.totalChunks} chunks</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${calculateProgressPercentage()}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {calculateProgressPercentage()}% complete
            </div>
          </div>
        )}

        {/* File Progress */}
        {progress.totalFiles > 1 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>File Progress</span>
              <span>{progress.currentFile}/{progress.totalFiles}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-green-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((progress.currentFile / progress.totalFiles) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="text-center">
          <p className={`text-sm font-medium ${getStatusColor(progress.status)}`}>
            {progress.message}
          </p>
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          {progress.fileName && (
            <div className="flex justify-between">
              <span>Current File:</span>
              <span className="truncate ml-2">{progress.fileName}</span>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-blue-800">
              <p className="font-medium">Processing large files...</p>
              <p>Please don't close this window. The process will continue automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 