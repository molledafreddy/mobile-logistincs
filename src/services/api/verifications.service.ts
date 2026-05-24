import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { apiClient } from './client';
import type { ComplianceStatus, Verification, VerificationDocument, VerificationTier } from '../../types';

interface AddDocumentPayload {
  type: string;
  url: string;
  name: string;
}

export const VerificationsService = {
  async getCompliance(companyId: string): Promise<ComplianceStatus> {
    const { data } = await apiClient.get<ComplianceStatus>(
      `/verifications/compliance/${companyId}`
    );
    return data;
  },

  async getTiers(): Promise<VerificationTier[]> {
    const { data } = await apiClient.get<VerificationTier[]>('/verifications/tiers');
    return data;
  },

  async getCompanyVerifications(companyId: string): Promise<Verification[]> {
    const { data } = await apiClient.get<Verification[]>(
      `/verifications/company/${companyId}`
    );
    return data;
  },

  async getVerification(id: string): Promise<Verification> {
    const { data } = await apiClient.get<Verification>(`/verifications/${id}`);
    return data;
  },

  async createVerification(companyId: string, tierId: string): Promise<Verification> {
    const { data } = await apiClient.post<Verification>('/verifications', {
      companyId,
      tierId,
    });
    return data;
  },

  async getDocuments(verificationId: string): Promise<VerificationDocument[]> {
    const { data } = await apiClient.get<VerificationDocument[]>(
      `/verifications/${verificationId}/documents`
    );
    return data;
  },

  async addDocument(verificationId: string, payload: AddDocumentPayload): Promise<VerificationDocument> {
    const { data } = await apiClient.post<VerificationDocument>(
      `/verifications/${verificationId}/documents`,
      payload
    );
    return data;
  },

  async uploadFile(uri: string, docType: string): Promise<{ url: string; key: string }> {
    const filename = `doc_${docType}_${Date.now()}.jpg`;

    const { data: { url: uploadUrl, key } } = await apiClient.post<{ url: string; key: string }>(
      '/files/upload-url',
      { folder: 'verifications', filename, contentType: 'image/jpeg' }
    );

    await uploadAsync(uploadUrl, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': 'image/jpeg' },
    });

    const { data: downloadUrl } = await apiClient.get<string>('/files/download-url', {
      params: { key },
    });

    return { url: downloadUrl, key };
  },
};
