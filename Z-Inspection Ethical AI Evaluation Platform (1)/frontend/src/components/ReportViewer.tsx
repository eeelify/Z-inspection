/**
 * Minimal Report Viewer Component
 * Opens PDF reports in an embedded viewer or new tab
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { api } from '../api';

interface ReportViewerProps {
  reportId: string;
  currentUser: any;
  onBack: () => void;
}

export function ReportViewer({ reportId, currentUser, onBack }: ReportViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        // Get report file URL
        const fileUrl = api(`/api/reports/${reportId}/file`);
        setReportUrl(fileUrl);
        setError(null);
      } catch (err: any) {
        console.error('Error loading report:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  const handleDownload = () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <ArrowLeft className="inline h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Report Viewer</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border" style={{ minHeight: '800px' }}>
          {reportUrl && (
            <iframe
              src={reportUrl}
              className="w-full"
              style={{ height: 'calc(100vh - 200px)', minHeight: '800px', border: 'none' }}
              title="Report Viewer"
            />
          )}
        </div>
      </div>
    </div>
  );
}

