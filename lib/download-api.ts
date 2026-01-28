import { getAuthHeaders } from './api-utils';

// API base URL - uses environment variable for production, falls back to localhost for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

export interface DownloadTask {
    id: string;
    user_id: string;
    analysis_id: string;
    product_name?: string;
    total_details_count: number;
    current_details_count: number;
    file_type: string;
    is_downloaded: boolean;
    status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
    created_at: string;
    updated_at: string;
}

export const downloadApi = {
    /**
     * List download tasks for the current user.
     */
    async listDownloadTasks(limit = 50, offset = 0): Promise<DownloadTask[]> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/v1/downloads?limit=${limit}&offset=${offset}`, {
            method: "GET",
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch downloads: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Download the file content for a completed task.
     * Handles authentication headers and blob conversion.
     */
    async downloadFile(taskId: string): Promise<void> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/v1/downloads/${taskId}/file`, {
            method: "GET",
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        // Get filename from header if possible, or default
        const disposition = response.headers.get('content-disposition');
        let filename = 'download';
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        } else {
            // Fallback filename logic if header parsing fails (though backend sets it)
            filename = `pha_analysis_export_${taskId}`;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
};
