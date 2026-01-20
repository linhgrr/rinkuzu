'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    HiOutlineCloudUpload,
    HiOutlineDocumentText,
    HiOutlineX,
    HiCheckCircle,
    HiOutlineArrowLeft
} from '@/components/icons';
import { useRouter } from 'next/navigation';

export default function AdaptiveLearningUpload() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const tCommon = useTranslations('common');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            handleUpload(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
        },
        maxFiles: 1,
    });

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        // Simulate upload progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            setUploadProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    router.push('/adaptive-learning/processing');
                }, 800);
            }
        }, 50);
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="text-gray-500 hover:text-gray-900 -ml-4 mb-4"
                >
                    <HiOutlineArrowLeft className="w-5 h-5 mr-2" /> {tCommon('back')}
                </Button>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('uploadTitle')}</h1>
                <p className="text-gray-500 mt-2 text-lg">
                    {t('uploadDescription')}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Area */}
                <div className="lg:col-span-2">
                    <div
                        {...getRootProps()}
                        className={`relative group bg-white rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                ${isDragActive
                                ? 'border-indigo-500 bg-indigo-50/30'
                                : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50'
                            } ${isUploading ? 'pointer-events-none' : ''}`}
                    >
                        <input {...getInputProps()} />

                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            {!isUploading ? (
                                <>
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 ${isDragActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:text-indigo-500 group-hover:bg-indigo-50'
                                        }`}>
                                        <HiOutlineCloudUpload className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                                        {isDragActive ? t('dropPdfHere') : t('dragDropPdf')}
                                    </h3>
                                    <p className="text-gray-500 mb-6 max-w-sm">
                                        {t('uploadBrowseHint')}
                                    </p>
                                    <Button variant="outline" className="rounded-full px-8 border-gray-300 font-medium">
                                        {t('browseFiles')}
                                    </Button>
                                </>
                            ) : (
                                <div className="w-full max-w-sm">
                                    <div className="w-20 h-20 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 animate-pulse">
                                        <HiOutlineDocumentText className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t('uploadingFile')}</h3>
                                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-lg">
                        <h3 className="font-bold text-lg mb-4">{t('howItWorksTitle')}</h3>
                        <ol className="space-y-4 text-sm text-indigo-100">
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
                                <span>{t('howItWorksStep1')}</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
                                <span>{t('howItWorksStep2')}</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
                                <span>{t('howItWorksStep3')}</span>
                            </li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">{t('recentUploads')}</h3>
                        <div className="space-y-3">
                            <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                                <div className="bg-red-50 text-red-500 p-2 rounded-lg">
                                    <HiOutlineDocumentText className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 text-sm truncate">{t('recentUploadFileName')}</div>
                                    <div className="text-xs text-gray-500">{t('timeAgoDays', { count: 2 })}</div>
                                </div>
                                <HiCheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
