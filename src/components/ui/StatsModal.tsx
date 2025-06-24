'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import Pagination from './Pagination';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'categories' | 'creators' | 'activity';
  apiEndpoint: string;
  children?: React.ReactNode;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function StatsModal({ 
  isOpen, 
  onClose, 
  title, 
  type, 
  apiEndpoint,
  children 
}: StatsModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async (page: number = 1, search: string = '', resetData: boolean = true) => {
    try {
      setLoading(true);
      if (resetData) setError('');

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(sortBy && { sortBy }),
        sortOrder
      });

      const response = await fetch(`${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}${params}`);
      const result = await response.json();

      if (result.success) {
        const newData = result.data[getDataKey()] || result.data.activities || [];
        
        if (resetData || page === 1) {
          setData(newData);
        } else {
          setData(prev => [...prev, ...newData]);
        }
        
        setPagination(result.data.pagination);
        setError('');
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (error) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, pagination.limit, sortBy, sortOrder]);

  const getDataKey = () => {
    switch (type) {
      case 'categories': return 'categories';
      case 'creators': return 'creators';
      case 'activity': return 'activities';
      default: return 'data';
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData(1, searchTerm);
    }
  }, [isOpen, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    fetchData(newPage, searchTerm);
  };

  const handleLoadMore = () => {
    if (pagination.hasNext) {
      fetchData(pagination.page + 1, searchTerm, false);
    }
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderCategoryItem = (category: any, index: number) => (
    <div key={category._id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-500">#{index + 1 + (pagination.page - 1) * pagination.limit}</span>
        <div 
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <div>
          <h4 className="font-medium text-gray-900">{category.name}</h4>
          <p className="text-sm text-gray-600">{category.description}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">{category.totalQuizzes || category.quizCount} quiz</div>
        <div className="text-xs text-gray-500">
          {category.publishedQuizzes} đã xuất bản • {category.totalQuestions} câu hỏi
        </div>
        <div className="text-xs text-gray-400">
          {category.isActive ? (
            <span className="text-green-600">Hoạt động</span>
          ) : (
            <span className="text-red-600">Không hoạt động</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderCreatorItem = (creator: any, index: number) => (
    <div key={creator._id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-500">#{index + 1 + (pagination.page - 1) * pagination.limit}</span>
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {creator.email[0].toUpperCase()}
          </span>
        </div>
        <div>
          <h4 className="font-medium text-gray-900">{creator.email}</h4>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>Tham gia: {formatDate(creator.joinedAt)}</span>
            {creator.role === 'admin' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Admin</span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">{creator.quizCount} quiz</div>
        <div className="text-xs text-gray-500">
          {creator.totalQuestions} câu hỏi • {Math.round(creator.successRate || 0)}% thành công
        </div>
        <div className="text-xs text-gray-400">
          <span className="text-green-600">{creator.publishedQuizzes} xuất bản</span> • 
          <span className="text-yellow-600 ml-1">{creator.pendingQuizzes} chờ duyệt</span>
        </div>
      </div>
    </div>
  );

  const renderActivityItem = (activity: any, index: number) => {
    const { type: activityType, data: activityData, date } = activity;
    
    return (
      <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          activityType === 'user' ? 'bg-blue-100 text-blue-600' :
          activityType === 'quiz' ? 'bg-green-100 text-green-600' :
          'bg-purple-100 text-purple-600'
        }`}>
          {activityType === 'user' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
          {activityType === 'quiz' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {activityType === 'attempt' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          )}
        </div>
        
        <div className="flex-1">
          {activityType === 'user' && (
            <div>
              <h4 className="font-medium text-gray-900">Người dùng mới: {activityData.email}</h4>
              <p className="text-sm text-gray-600">Đã đăng ký tài khoản</p>
            </div>
          )}
          {activityType === 'quiz' && (
            <div>
              <h4 className="font-medium text-gray-900">{activityData.title}</h4>
              <p className="text-sm text-gray-600">
                Bởi {activityData.author?.email} • {activityData.category?.name} • {activityData.questionCount} câu hỏi
              </p>
            </div>
          )}
          {activityType === 'attempt' && (
            <div>
              <h4 className="font-medium text-gray-900">{activityData.quiz?.title}</h4>
              <p className="text-sm text-gray-600">
                {activityData.user?.email || 'Ẩn danh'} • Điểm: {activityData.score}% • {activityData.answeredQuestions} câu trả lời
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400">{formatDate(date)}</p>
        </div>

        {activityType === 'quiz' && (
          <span className={`px-2 py-1 rounded text-xs ${
            activityData.status === 'published' ? 'bg-green-100 text-green-800' :
            activityData.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {activityData.status}
          </span>
        )}
        
        {activityType === 'attempt' && (
          <div className="text-right">
            <div className={`text-sm font-medium ${
              activityData.score >= 80 ? 'text-green-600' :
              activityData.score >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {activityData.score}%
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading && data.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
          <Button 
            onClick={() => fetchData(1, searchTerm)} 
            className="mt-2"
            size="sm"
          >
            Thử lại
          </Button>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Không có dữ liệu</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.map((item, index) => {
          switch (type) {
            case 'categories': return renderCategoryItem(item, index);
            case 'creators': return renderCreatorItem(item, index);
            case 'activity': return renderActivityItem(item, index);
            default: return null;
          }
        })}
      </div>
    );
  };

  const getSortOptions = () => {
    switch (type) {
      case 'categories':
        return [
          { value: 'quizCount', label: 'Số quiz' },
          { value: 'name', label: 'Tên' },
          { value: 'createdAt', label: 'Ngày tạo' }
        ];
      case 'creators':
        return [
          { value: 'quizCount', label: 'Số quiz' },
          { value: 'totalQuestions', label: 'Tổng câu hỏi' },
          { value: 'joinedAt', label: 'Ngày tham gia' }
        ];
      default:
        return [];
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600">
            Hiển thị {data.length} trong tổng số {pagination.total} mục
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <form onSubmit={handleSearch} className="flex space-x-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              Tìm kiếm
            </Button>
          </form>

          {/* Sort Options */}
          {getSortOptions().length > 0 && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Sắp xếp theo:</span>
              <div className="flex space-x-2">
                {getSortOptions().map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      sortBy === option.value
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                    {sortBy === option.value && (
                      <span className="ml-1">
                        {sortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {children}

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {renderContent()}
        </div>

        {/* Loading More */}
        {loading && data.length > 0 && (
          <div className="text-center py-4">
            <div className="inline-flex items-center text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Đang tải thêm...
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex justify-between items-center">
          <div className="flex space-x-2">
            {type === 'activity' && pagination.hasNext && (
              <Button
                onClick={handleLoadMore}
                variant="outline"
                disabled={loading}
                size="sm"
              >
                Tải thêm
              </Button>
            )}
          </div>
          
          {type !== 'activity' && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </Modal>
  );
} 