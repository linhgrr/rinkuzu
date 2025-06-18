'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { IQuiz } from '@/types';
import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';
import { QuestionImage, OptionImage } from '@/components/ui/ImageDisplay';

interface EditQuizPageProps {
  params: { id: string };
}

interface Question {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export default function EditQuizPage({ params }: EditQuizPageProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [quiz, setQuiz] = useState<IQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);

  if (!session) {
    router.push('/login');
    return null;
  }

  useEffect(() => {
    fetchQuiz();
  }, [params.id]);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/quizzes/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setQuiz(data.data);
        setTitle(data.data.title);
        setDescription(data.data.description || '');
        setEditableQuestions(data.data.questions as Question[]);
      } else {
        setError(data.error || 'Quiz not found');
      }
    } catch (error) {
      setError('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const updateQuestionField = (index: number, field: keyof Question, value: any) => {
    const updated = [...editableQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditableQuestions(updated);
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    const updated = [...editableQuestions];
    updated[qIdx].options[optIdx] = value;
    setEditableQuestions(updated);
  };

  const updateQuestionImage = (qIdx: number, url: string) => updateQuestionField(qIdx,'questionImage',url);
  const removeQuestionImage = (qIdx: number) => updateQuestionField(qIdx,'questionImage',undefined);

  const updateOptionImage = (qIdx:number,optIdx:number,url:string)=>{
    const updated=[...editableQuestions];
    if(!updated[qIdx].optionImages){updated[qIdx].optionImages=new Array(updated[qIdx].options.length).fill(undefined);} 
    updated[qIdx].optionImages![optIdx]=url;
    setEditableQuestions(updated);
  };
  const removeOptionImage=(qIdx:number,optIdx:number)=>{
    const updated=[...editableQuestions];
    if(updated[qIdx].optionImages) updated[qIdx].optionImages![optIdx]=undefined;
    setEditableQuestions(updated);
  };

  const addQuestion=()=>{
    setEditableQuestions([...editableQuestions,{question:'',options:['','','',''],type:'single',correctIndex:0,correctIndexes:[]}]);
  };
  const removeQuestion=(idx:number)=> setEditableQuestions(editableQuestions.filter((_,i)=>i!==idx));

  const toggleQuestionType=(idx:number,type:'single'|'multiple')=>{
    const updated=[...editableQuestions];
    updated[idx]={...updated[idx],type,correctIndex:type==='single'? (updated[idx].correctIndex??0):undefined,correctIndexes:type==='multiple'? (updated[idx].correctIndexes||[]):undefined};
    setEditableQuestions(updated);
  };

  const setSingleCorrect=(qIdx:number,optIdx:number)=>{
    updateQuestionField(qIdx,'correctIndex',optIdx);
  };

  const toggleMultipleCorrect=(qIdx:number,optIdx:number,checked:boolean)=>{
    const updated=[...editableQuestions];
    const arr=updated[qIdx].correctIndexes||[];
    updated[qIdx].correctIndexes=checked? [...arr,optIdx].sort(): arr.filter(i=>i!==optIdx);
    setEditableQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const formattedQuestions = editableQuestions.map((q: Question)=>{
        const base:any={question:q.question,options:q.options,type:q.type,
          ...(q.questionImage?{questionImage:q.questionImage}:{}),
          ...(q.optionImages&&q.optionImages.some(Boolean)?{optionImages:q.optionImages}:{})};
        return q.type==='single'? {...base,correctIndex:q.correctIndex??0}:{...base,correctIndexes:q.correctIndexes||[]};
      });

      const response = await fetch(`/api/quizzes/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          questions: formattedQuestions,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Quiz updated successfully!');
        setQuiz(data.data);
        setTimeout(() => {
          router.push('/pending');
        }, 2000);
      } else {
        setError(data.error || 'Failed to update quiz');
      }
    } catch (error) {
      setError('An error occurred while updating the quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/quizzes/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        router.push('/pending');
      } else {
        setError(data.error || 'Failed to delete quiz');
      }
    } catch (error) {
      setError('An error occurred while deleting the quiz');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/pending">
              <Button>Back to My Quizzes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz) return null;

  // Check if user can edit
  const isAdmin = (session.user as any)?.role === 'admin';
  const isAuthor = typeof quiz.author === 'string' 
    ? quiz.author === (session.user as any).id
    : (quiz.author as any)?._id === (session.user as any).id;
  
  if (!isAdmin && !isAuthor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">You don't have permission to edit this quiz.</p>
            <Link href="/pending">
              <Button>Back to My Quizzes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if quiz can be edited
  const canEdit = quiz.status === 'pending' || quiz.status === 'rejected' || isAdmin;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                RinKuzu
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/pending">
                <Button variant="outline">My Quizzes</Button>
              </Link>
              {isAdmin && (
                <Link href="/admin/queue">
                  <Button variant="outline">Admin Queue</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Quiz</h1>
          <p className="mt-2 text-gray-600">
            Make changes to your quiz information
          </p>
        </div>

        {/* Quiz Status */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quiz Status</h3>
                <p className="text-sm text-gray-600">Current approval status</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                quiz.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                quiz.status === 'published' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
              </span>
            </div>
          </CardContent>
        </Card>

        {!canEdit && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <div className="text-blue-600">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Read Only</h3>
                  <p className="text-sm text-gray-600">
                    This quiz cannot be edited because it's already published. Only admins can edit published quizzes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Quiz Information</CardTitle>
            <CardDescription>
              Update the basic information about your quiz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">{success}</div>
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Quiz Title *
                </label>
                <div className="mt-1">
                  <Input
                    id="title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a descriptive title for your quiz"
                    maxLength={200}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description (Optional)
                </label>
                <div className="mt-1">
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide additional context about the quiz"
                    maxLength={1000}
                    disabled={!canEdit}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>

              {/* Quiz Questions Info */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Content</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">
                    <p><strong>Questions:</strong> {quiz.questions.length}</p>
                    <p><strong>Created:</strong> {new Date(quiz.createdAt).toLocaleDateString()}</p>
                    {quiz.status === 'published' && (
                      <p><strong>Slug:</strong> {quiz.slug}</p>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Note: Questions cannot be edited after creation. Create a new quiz to change questions.
                </p>
              </div>

              {/* Questions Edit */}
              {canEdit && (
                <Card className="mt-8">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Questions ({editableQuestions.length})</CardTitle>
                        <CardDescription>Edit questions below</CardDescription>
                      </div>
                      <Button onClick={addQuestion} size="sm">Add Question</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {editableQuestions.map((q,index)=>(
                      <div key={index} className="border p-4 rounded-lg space-y-4">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium">Question {index+1}</h4>
                          <Button variant="ghost" size="sm" onClick={()=>removeQuestion(index)} className="text-red-600">Remove</Button>
                        </div>
                        <textarea value={q.question} onChange={e=>updateQuestionField(index,'question',e.target.value)} className="w-full border rounded p-2" rows={2}/>
                        <QuestionImageUpload currentImage={q.questionImage} onImageUploaded={url=>updateQuestionImage(index,url)} onImageRemoved={()=>removeQuestionImage(index)} />
                        <div>
                          <label className="text-sm font-medium mb-1">Question Type</label>
                          <div className="flex space-x-4 mt-1">
                            <label className="flex items-center">
                              <input type="radio" checked={q.type==='single'} onChange={()=>toggleQuestionType(index,'single')} /> <span className="ml-2 text-sm">Single</span>
                            </label>
                            <label className="flex items-center">
                              <input type="radio" checked={q.type==='multiple'} onChange={()=>toggleQuestionType(index,'multiple')} /> <span className="ml-2 text-sm">Multiple</span>
                            </label>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {q.options.map((opt,optIdx)=>(
                            <div key={optIdx} className="flex items-center space-x-2">
                              {q.type==='single'? (
                                <input type="radio" name={`correct-${index}`} checked={q.correctIndex===optIdx} onChange={()=>setSingleCorrect(index,optIdx)} />
                              ):(
                                <input type="checkbox" checked={q.correctIndexes?.includes(optIdx)} onChange={e=>toggleMultipleCorrect(index,optIdx,e.target.checked)} />
                              )}
                              <Input value={opt} onChange={e=>updateOption(index,optIdx,e.target.value)} className="flex-1" />
                              <OptionImageUpload currentImage={q.optionImages?.[optIdx]} onImageUploaded={url=>updateOptionImage(index,optIdx,url)} onImageRemoved={()=>removeOptionImage(index,optIdx)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                <div className="flex space-x-4">
                  <Link href="/pending">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  {canEdit && (
                    <Button
                      type="submit"
                      loading={saving}
                      disabled={!title.trim()}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                </div>
                
                {canEdit && (isAuthor || isAdmin) && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    loading={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete Quiz'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {quiz.status === 'published' && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quiz Link</CardTitle>
              <CardDescription>
                Share this link with your students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/${quiz.slug}`}
                </code>
                <Button
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/quiz/${quiz.slug}`;
                    navigator.clipboard.writeText(url);
                    alert('Quiz link copied to clipboard!');
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
} 