'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth';
import styles from './page.module.css';
import { downloadApi, DownloadTask } from '@/lib/download-api';

export default function DownloadCenterPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [tasks, setTasks] = useState<DownloadTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        try {
            const data = await downloadApi.listDownloadTasks();
            setTasks(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load downloads');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }

        if (user) {
            fetchTasks();
        }
    }, [user, authLoading, router, fetchTasks]);

    // Poll for updates if any task is active
    useEffect(() => {
        const hasActiveTasks = tasks.some(t => t.status === 'PENDING' || t.status === 'GENERATING');
        let interval: NodeJS.Timeout;

        if (hasActiveTasks) {
            interval = setInterval(fetchTasks, 3000);
        }

        return () => clearInterval(interval);
    }, [tasks, fetchTasks]);

    const handleDownload = async (taskId: string) => {
        try {
            await downloadApi.downloadFile(taskId);
            // Refresh list after short delay to update is_downloaded status
            setTimeout(fetchTasks, 1000);
        } catch (err: any) {
            console.error('Download failed:', err);
            alert('Failed to download file. Please try again.');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED': return <span className={styles.badgeSuccess}>Completed</span>;
            case 'FAILED': return <span className={styles.badgeError}>Failed</span>;
            default: return <span className={styles.badgeWarning}>{status}</span>;
        }
    };

    if (authLoading) return <div className={styles.loadingContainer}>Loading...</div>;

    return (
        <div className={styles.container}>
            <Header showUserMenu={true} />

            <main className={styles.main}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Download Center</h1>
                    <button className={styles.refreshButton} onClick={fetchTasks}>Refresh</button>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                {loading ? (
                    <div className={styles.loading}>Loading tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className={styles.empty}>No downloads found.</div>
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Product</th>
                                    <th>Type</th>
                                    <th>Details</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map(task => (
                                    <tr key={task.id} className={!task.is_downloaded && task.status === 'COMPLETED' ? styles.unread : ''}>
                                        <td>{new Date(task.created_at).toLocaleString()}</td>
                                        <td>{task.product_name || '-'}</td>
                                        <td>{task.file_type.toUpperCase()}</td>
                                        <td>{task.total_details_count || '-'}</td>
                                        <td>{getStatusBadge(task.status)}</td>
                                        <td className={styles.actionCell}>
                                            {task.status === 'COMPLETED' ? (
                                                <button
                                                    className={styles.downloadButton}
                                                    onClick={() => handleDownload(task.id)}
                                                >
                                                    <span className={styles.buttonText}>Download</span>
                                                    {!task.is_downloaded && <span className={styles.redDot} />}
                                                </button>
                                            ) : task.status === 'GENERATING' ? (
                                                <div className={styles.progressWrapper}>
                                                    <div className={styles.progressBar}>
                                                        <div
                                                            className={styles.progressFill}
                                                            style={{ width: `${Math.min(100, (task.current_details_count / (task.total_details_count || 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={styles.progressText}>
                                                        {Math.round(Math.min(100, (task.current_details_count / (task.total_details_count || 1)) * 100))}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className={styles.disabledAction}>-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
