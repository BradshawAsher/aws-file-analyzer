import axios from 'axios';

const configuredBaseUrl = process.env.REACT_APP_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || 'https://localhost:5000')
  .replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default apiClient;
