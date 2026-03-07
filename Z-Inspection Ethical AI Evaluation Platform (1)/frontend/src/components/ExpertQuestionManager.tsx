import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Edit2, Trash2, X, RefreshCw, Save } from 'lucide-react';

interface QuestionOption {
    key: string;
    label: { en: string; tr?: string };
    answerScore?: number;
}

interface Question {
    _id: string;
    code: string;
    questionnaireKey: string;
    principleLabel: { en: string; tr?: string };
    principleKey: string; // Ensure we read/write principleKey
    text: { en: string; tr?: string };
    answerType: string;
    options: QuestionOption[];
    order: number;
    required: boolean;
}

export function ExpertQuestionManager() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [questionnaireKey, setQuestionnaireKey] = useState('ethical-expert-v1');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [formData, setFormData] = useState<Partial<Question>>({});

    // Options State for Modal
    const [editingOptions, setEditingOptions] = useState<QuestionOption[]>([]);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const res = await fetch(api(`/api/evaluations/questions?questionnaireKey=${questionnaireKey}`));
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            } else {
                console.error('Failed to fetch questions');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [questionnaireKey]);

    const handleOpenModal = (q?: Question) => {
        if (q) {
            setEditingQuestion(q);
            setFormData(q);
            setEditingOptions(q.options || []);
        } else {
            setEditingQuestion(null);
            setFormData({
                questionnaireKey,
                answerType: 'single_choice',
                required: true,
                principleLabel: { en: '' },
                text: { en: '' },
                options: []
            });
            setEditingOptions([]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingQuestion(null);
        setFormData({});
        setEditingOptions([]);
    };

    const handleOptionChange = (index: number, field: string, value: any, lang?: string) => {
        const newOptions = [...editingOptions];
        if (lang) {
            // It's a localized label field
            newOptions[index].label = {
                ...newOptions[index].label,
                [lang]: value
            };
        } else {
            (newOptions[index] as any)[field] = value;
        }
        setEditingOptions(newOptions);
        setFormData({ ...formData, options: newOptions });
    };

    const addOption = () => {
        const newOptions = [...editingOptions, { key: `opt_${Date.now()}`, label: { en: '', tr: '' }, answerScore: 0 }];
        setEditingOptions(newOptions);
        setFormData({ ...formData, options: newOptions });
    };

    const applyTemplate = (type: '2' | '3' | '4') => {
        let newOptions: QuestionOption[] = [];
        const ts = Date.now();
        if (type === '2') {
            newOptions = [
                { key: `yes_${ts}`, label: { en: 'Yes' }, answerScore: 1 },
                { key: `no_${ts}`, label: { en: 'No' }, answerScore: 0 }
            ];
        } else if (type === '3') {
            newOptions = [
                { key: `yes_${ts}`, label: { en: 'Yes' }, answerScore: 1 },
                { key: `sometimes_${ts}`, label: { en: 'Sometimes' }, answerScore: 0.5 },
                { key: `no_${ts}`, label: { en: 'No' }, answerScore: 0 }
            ];
        } else if (type === '4') {
            newOptions = [
                { key: `yes_${ts}`, label: { en: 'Yes' }, answerScore: 1 },
                { key: `mostly_${ts}`, label: { en: 'Mostly' }, answerScore: 0.7 },
                { key: `rarely_${ts}`, label: { en: 'Rarely' }, answerScore: 0.3 },
                { key: `no_${ts}`, label: { en: 'No' }, answerScore: 0 }
            ];
        }
        setEditingOptions(newOptions);
        setFormData({ ...formData, options: newOptions });
    };

    const removeOption = (index: number) => {
        const newOptions = editingOptions.filter((_, i) => i !== index);
        setEditingOptions(newOptions);
        setFormData({ ...formData, options: newOptions });
    };

    const saveQuestion = async () => {
        try {
            // Validate Code
            if (!formData.code || formData.code.trim() === '') {
                alert('Code cannot be empty.');
                return;
            }

            const cleanCode = formData.code.trim().toUpperCase();

            // Allow only uppercase letters followed by numbers (e.g. A1, H12, P3)
            if (!/^[A-Z]+\d+$/.test(cleanCode)) {
                alert('Code format is invalid. It must start with uppercase letter(s) followed by number(s) (e.g., A1, H12, P3).');
                return;
            }

            // Check for uniqueness
            const isDuplicate = questions.some(q => q.code === cleanCode && q._id !== editingQuestion?._id);
            if (isDuplicate) {
                alert(`The code "${cleanCode}" already exists in this questionnaire. Codes must be unique.`);
                return;
            }


            // Default principleKey if not provided explicitly (often mapped from principleLabel)
            const payloadToSave = {
                ...formData,
                code: cleanCode,
                principleKey: formData.principleKey || formData.principleLabel?.en.toLowerCase().replace(/\s+/g, '_') || 'general',
            };

            if (editingQuestion) {
                // Update
                const res = await fetch(api(`/api/evaluations/questions/${editingQuestion._id}`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadToSave)
                });
                if (res.ok) {
                    handleCloseModal();
                    fetchQuestions();
                } else {
                    const err = await res.json();
                    alert(`Error updating question: ${err.error}`);
                }
            } else {
                // Create
                const res = await fetch(api('/api/evaluations/questions'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadToSave)
                });
                if (res.ok) {
                    handleCloseModal();
                    fetchQuestions();
                } else {
                    const err = await res.json();
                    alert(`Error creating question: ${err.error}`);
                }
            }
        } catch (err) {
            console.error(err);
            alert('Network error saving question');
        }
    };

    const deleteQuestion = async (id: string, code: string) => {
        if (window.confirm(`Are you sure you want to delete question ${code}?`)) {
            try {
                const res = await fetch(api(`/api/evaluations/questions/${id}`), {
                    method: 'DELETE'
                });
                if (res.ok) {
                    fetchQuestions();
                } else {
                    const err = await res.json();
                    alert(`Error deleting question: ${err.error}`);
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Expert Questions</h2>
                    <p className="text-gray-500 text-sm mt-1">Manage standard evaluation questions</p>
                </div>
                <div className="flex space-x-3 items-center">
                    <div className="flex items-center space-x-2 bg-white px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm">
                        <span className="text-sm font-medium text-gray-700">Questionnaire Key:</span>
                        <select
                            value={questionnaireKey}
                            onChange={(e) => setQuestionnaireKey(e.target.value)}
                            className="text-sm border-none focus:ring-0 text-blue-600 font-semibold p-0 w-48 cursor-pointer bg-transparent"
                        >
                            <option value="general-v1">General (general-v1)</option>
                            <option value="ethical-expert-v1">Ethical Expert (ethical-expert-v1)</option>
                            <option value="medical-expert-v1">Medical Expert (medical-expert-v1)</option>
                            <option value="technical-expert-v1">Technical Expert (technical-expert-v1)</option>
                            <option value="legal-expert-v1">Legal Expert (legal-expert-v1)</option>
                            <option value="education-expert-v1">Education Expert (education-expert-v1)</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchQuestions}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 bg-white border border-gray-200 rounded-lg transition-colors shadow-sm"
                        title="Refresh Questions"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Add Question</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-[5]">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order / Code</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principle</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question Text</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {questions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No questions found for questionnaire key "{questionnaireKey}".
                                    </td>
                                </tr>
                            ) : (
                                questions.map((q) => (
                                    <tr key={q._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">Ord: {q.order}</div>
                                            <div className="text-xs text-gray-500">{q.code}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                                {q.principleLabel?.en || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 line-clamp-2" title={q.text?.en}>{q.text?.en}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{q.answerType}</div>
                                            <div className="text-xs text-gray-400">{q.options?.length || 0} options</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button onClick={() => handleOpenModal(q)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => deleteQuestion(q._id, q.code)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-xl shrink-0">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingQuestion ? 'Edit Question' : 'Add New Question'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code || ''}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g. H1, T12"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                                    <input
                                        type="number"
                                        value={formData.order || ''}
                                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Auto-assigned if empty"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Principle Label *</label>
                                    <select
                                        required
                                        value={formData.principleLabel?.en || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            principleLabel: { ...formData.principleLabel, en: e.target.value }
                                        })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="" disabled>Select a principle...</option>
                                        <option value="HUMAN AGENCY & OVERSIGHT">HUMAN AGENCY & OVERSIGHT</option>
                                        <option value="TECHNICAL ROBUSTNESS & SAFETY">TECHNICAL ROBUSTNESS & SAFETY</option>
                                        <option value="PRIVACY & DATA GOVERNANCE">PRIVACY & DATA GOVERNANCE</option>
                                        <option value="TRANSPARENCY">TRANSPARENCY</option>
                                        <option value="DIVERSITY, NON-DISCRIMINATION & FAIRNESS">DIVERSITY, NON-DISCRIMINATION & FAIRNESS</option>
                                        <option value="SOCIETAL & ENVIRONMENTAL WELLBEING">SOCIETAL & ENVIRONMENTAL WELLBEING</option>
                                        <option value="ACCOUNTABILITY">ACCOUNTABILITY</option>
                                        <option value="N/A (General/Other)">N/A (General/Other)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text *</label>
                                <textarea
                                    required
                                    rows={2}
                                    value={formData.text?.en || ''}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        text: { ...formData.text, en: e.target.value }
                                    })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 items-center">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Answer Type *</label>
                                    <select
                                        value={formData.answerType || 'single_choice'}
                                        onChange={(e) => setFormData({ ...formData, answerType: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="single_choice">Single Choice (Radio)</option>
                                        <option value="open_text">Open Text</option>
                                        <option value="numeric">Numeric</option>
                                    </select>
                                </div>
                                <div className="flex items-center mt-6">
                                    <input
                                        type="checkbox"
                                        id="required_checkbox"
                                        checked={formData.required !== false}
                                        onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="required_checkbox" className="ml-2 block text-sm text-gray-900">
                                        Required Question
                                    </label>
                                </div>
                            </div>

                            {/* Options Section */}
                            {(formData.answerType === 'single_choice') && (
                                <div className="mt-6 border-t border-gray-200 pt-4">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-3 gap-2">
                                        <h4 className="text-sm font-bold text-gray-900">Answer Options</h4>
                                        <div className="flex flex-wrap items-center">
                                            <span className="text-xs text-gray-500 font-medium mr-2">Quick Fill:</span>
                                            <button type="button" onClick={() => applyTemplate('2')} className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded transition-colors shadow-sm mr-2">2 Options</button>
                                            <button type="button" onClick={() => applyTemplate('3')} className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded transition-colors shadow-sm mr-2">3 Options</button>
                                            <button type="button" onClick={() => applyTemplate('4')} className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded transition-colors shadow-sm mr-2">4 Options</button>
                                            <div className="w-px h-4 bg-gray-300 mx-2 hidden sm:block"></div>
                                            <button
                                                type="button"
                                                onClick={addOption}
                                                className="text-xs font-medium text-blue-700 hover:bg-blue-100 flex items-center bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded transition-colors shadow-sm ml-2"
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Custom
                                            </button>
                                        </div>
                                    </div>

                                    {editingOptions.length === 0 ? (
                                        <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                                            No options added yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {editingOptions.map((opt, idx) => (
                                                <div key={idx} className="flex flex-col space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-lg relative group">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOption(idx)}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>

                                                    <div className="grid grid-cols-12 gap-3 pr-6">
                                                        <div className="col-span-3">
                                                            <label className="block text-xs text-gray-500 mb-1">Option Key</label>
                                                            <input
                                                                type="text"
                                                                value={opt.key}
                                                                onChange={(e) => handleOptionChange(idx, 'key', e.target.value)}
                                                                className="w-full border border-gray-300 rounded p-1.5 text-xs"
                                                                placeholder="e.g. yes, opt_1"
                                                            />
                                                        </div>
                                                        <div className="col-span-7">
                                                            <div className="flex space-x-2">
                                                                <div className="flex-1">
                                                                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                                                                    <input
                                                                        type="text"
                                                                        value={opt.label.en}
                                                                        onChange={(e) => handleOptionChange(idx, 'label', e.target.value, 'en')}
                                                                        className="w-full border border-gray-300 rounded p-1.5 text-xs"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs text-gray-500 mb-1" title="0.0 (Risky) to 1.0 (Safe)">Score (0-1)</label>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                max="1"
                                                                value={opt.answerScore !== undefined ? opt.answerScore : ''}
                                                                onChange={(e) => handleOptionChange(idx, 'answerScore', parseFloat(e.target.value) || 0)}
                                                                className="w-full border border-gray-300 rounded p-1.5 text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-xl shrink-0">
                            <button
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveQuestion}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center shadow-sm"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {editingQuestion ? 'Save Changes' : 'Create Question'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
