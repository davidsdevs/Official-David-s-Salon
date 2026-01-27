/**
 * Database Backup & Restore Page
 * System Admin tool for backing up and restoring the entire Firestore database
 */

import { useState, useRef } from 'react';
import { 
  Download, Upload, Database, Shield, AlertTriangle, 
  CheckCircle, Clock, HardDrive, Lock, Unlock, FileJson,
  RefreshCw, Trash2, Info
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import {
  exportDatabase,
  downloadBackup,
  readBackupFile,
  restoreDatabase,
  getBackupStats
} from '../../services/databaseBackupService';

const DatabaseBackupRestore = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [backupData, setBackupData] = useState(null);
  const [backupStats, setBackupStats] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const fileInputRef = useRef(null);

  const passwordMatch = password === confirmPassword;
  const passwordValid = password.length >= 8;

  // Export and download backup
  const handleExportBackup = async () => {
    if (password && (!passwordValid || !passwordMatch)) {
      toast.error('Password must be at least 8 characters and match confirmation');
      return;
    }

    try {
      setExporting(true);
      toast.loading('Exporting database...', { id: 'export' });

      // Export database
      const exportResult = await exportDatabase();
      
      if (!exportResult.success) {
        toast.error(exportResult.error || 'Failed to export database', { id: 'export' });
        return;
      }

      // Download backup file
      const downloadResult = await downloadBackup(
        exportResult.backup,
        password || null
      );

      if (!downloadResult.success) {
        toast.error(downloadResult.error || 'Failed to download backup', { id: 'export' });
        return;
      }

      toast.success(
        `Backup downloaded! ${exportResult.totalDocuments} documents exported.`,
        { id: 'export', duration: 5000 }
      );

      // Clear password fields
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export database', { id: 'export' });
    } finally {
      setExporting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      toast.loading('Reading backup file...', { id: 'read' });

      const result = await readBackupFile(file, restorePassword);

      if (!result.success) {
        toast.error(result.error || 'Failed to read backup file', { id: 'read' });
        setBackupData(null);
        setBackupStats(null);
        return;
      }

      setBackupData(result.backup);
      const stats = getBackupStats(result.backup);
      setBackupStats(stats);

      toast.success('Backup file loaded successfully!', { id: 'read' });
    } catch (error) {
      console.error('File read error:', error);
      toast.error('Failed to read backup file', { id: 'read' });
      setBackupData(null);
      setBackupStats(null);
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Restore database
  const handleRestoreDatabase = async () => {
    if (!backupData) {
      toast.error('No backup file loaded');
      return;
    }

    try {
      setRestoring(true);
      setShowConfirmRestore(false);
      toast.loading('Restoring database...', { id: 'restore' });

      const result = await restoreDatabase(backupData, {
        clearExisting,
        onProgress: (progress) => {
          setRestoreProgress(progress);
        }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to restore database', { id: 'restore' });
        return;
      }

      toast.success(
        `Database restored! ${result.totalRestored} documents restored.`,
        { id: 'restore', duration: 5000 }
      );

      // Clear backup data
      setBackupData(null);
      setBackupStats(null);
      setRestorePassword('');
      setClearExisting(false);
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore database', { id: 'restore' });
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Database Backup & Restore</h1>
        <p className="text-gray-600 mt-1">
          Export your entire database to a file or restore from a previous backup
        </p>
      </div>

      {/* Warning Banner */}
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Backup files contain ALL your database data</li>
              <li>Use a strong password to encrypt sensitive data</li>
              <li>Store backup files securely</li>
              <li>Restoring will overwrite existing data if "Clear Existing" is checked</li>
              <li>Always test restores in a development environment first</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Export Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Download className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Export Database</h2>
            <p className="text-sm text-gray-600">Download a complete backup of your database</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Encryption Password (Optional)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for unencrypted"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Minimum 8 characters. Keep this password safe!
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="pl-10"
                />
              </div>
              {password && !passwordMatch && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
              {password && !passwordValid && (
                <p className="text-xs text-red-600 mt-1">Password too short</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleExportBackup}
            disabled={exporting || (password && (!passwordValid || !passwordMatch))}
            className="w-full md:w-auto"
          >
            {exporting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export & Download Backup
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Restore Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <Upload className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Restore Database</h2>
            <p className="text-sm text-gray-600">Upload and restore from a backup file</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Backup File
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <FileJson className="w-4 h-4 mr-2" />
                Choose File
              </Button>
              {backupData && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Backup file loaded
                </span>
              )}
            </div>
          </div>

          {/* Decryption Password */}
          {backupData === null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Decryption Password (if encrypted)
              </label>
              <div className="relative">
                <Unlock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Enter password if backup is encrypted"
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Backup Stats */}
          {backupStats && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Backup Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Export Date
                  </div>
                  <div className="font-medium text-gray-900">
                    {new Date(backupStats.exportDate).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    Total Documents
                  </div>
                  <div className="font-medium text-gray-900">
                    {backupStats.totalDocuments.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    Collections
                  </div>
                  <div className="font-medium text-gray-900">
                    {backupStats.collections.length}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 flex items-center gap-1">
                    <FileJson className="w-3 h-3" />
                    File Size
                  </div>
                  <div className="font-medium text-gray-900">
                    {(backupStats.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>

              {/* Collections List */}
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">Collections:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {backupStats.collections.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center justify-between bg-white rounded px-2 py-1"
                    >
                      <span className="text-gray-700">{col.name}</span>
                      <span className="text-gray-500">{col.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Restore Options */}
          {backupData && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <input
                  type="checkbox"
                  id="clearExisting"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="clearExisting" className="text-sm">
                  <span className="font-semibold text-red-900">Clear existing data before restore</span>
                  <p className="text-red-700 mt-1">
                    Warning: This will delete all current data in each collection before restoring.
                    Uncheck to merge with existing data (may cause duplicates).
                  </p>
                </label>
              </div>

              <Button
                onClick={() => setShowConfirmRestore(true)}
                disabled={restoring}
                className="w-full md:w-auto bg-green-600 hover:bg-green-700"
              >
                {restoring ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Restore Database
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Restore Progress */}
          {restoreProgress && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-blue-900">
                  Restoring {restoreProgress.collection}...
                </span>
              </div>
              <div className="text-xs text-blue-700">
                Collection {restoreProgress.current} of {restoreProgress.total} • {restoreProgress.documents} documents
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Info Section */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Export:</strong> Downloads all Firestore collections as a JSON file</li>
              <li><strong>Encryption:</strong> Optional password protection using AES encryption</li>
              <li><strong>Restore:</strong> Uploads and restores data back to Firestore</li>
              <li><strong>Merge Mode:</strong> Adds to existing data without clearing</li>
              <li><strong>Replace Mode:</strong> Clears collections before restoring</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Confirm Restore Modal */}
      {showConfirmRestore && (
        <ConfirmModal
          isOpen={showConfirmRestore}
          onClose={() => setShowConfirmRestore(false)}
          onConfirm={handleRestoreDatabase}
          title="Confirm Database Restore"
          message={
            clearExisting
              ? "This will DELETE ALL existing data and restore from the backup. This action cannot be undone. Are you sure?"
              : "This will restore data from the backup and merge with existing data. Duplicate documents may be created. Continue?"
          }
          confirmText="Restore Database"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      )}
    </div>
  );
};

export default DatabaseBackupRestore;
