import { api } from './http';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  loginInvite: (data) => api.post('/auth/login-invite', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data),
};

export const workspaceApi = {
  list: () => api.get('/workspaces'),
  create: (data) => api.post('/workspaces', data),
  get: (id) => api.get(`/workspaces/${id}`),
  update: (id, data) => api.put(`/workspaces/${id}`, data),
  remove: (id) => api.delete(`/workspaces/${id}`),
  updateMember: (id, data) => api.post(`/workspaces/${id}/members`, data),
  removeMember: (id, data) => api.delete(`/workspaces/${id}/members`, { data }),
  transfer: (id, data) => api.post(`/workspaces/${id}/transfer`, data),
  createInvite: (id, data) => api.post(`/workspaces/${id}/invites`, data),
  listInvites: (id) => api.get(`/workspaces/${id}/invites`),
  revokeInvite: (id, inviteId) => api.delete(`/workspaces/${id}/invites/${inviteId}`),
  auditLogs: (id, params) => api.get(`/workspaces/${id}/audit-logs`, { params }),
};

export const folderApi = {
  listByWorkspace: (wsId, params) => api.get(`/folders/ws/${wsId}`, { params }),
  tree: (wsId) => api.get(`/folders/ws/${wsId}/tree`),
  create: (wsId, data) => api.post(`/folders/ws/${wsId}`, data),
  update: (id, data) => api.put(`/folders/${id}`, data),
  remove: (id) => api.delete(`/folders/${id}`),
  moveNote: (data) => api.post('/folders/move-note', data),
};

export const noteApi = {
  listByWorkspace: (wsId, params) => api.get(`/notes/ws/${wsId}`, { params }),
  recent: (wsId, params) => api.get(`/notes/ws/${wsId}/recent`, { params }),
  listByFolder: (folderId) => api.get(`/notes/folder/${folderId}`),
  get: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  remove: (id) => api.delete(`/notes/${id}`),
  saveVersion: (id, data) => api.post(`/notes/${id}/versions`, data),
  listVersions: (id) => api.get(`/notes/${id}/versions`),
  rollback: (id, data) => api.post(`/notes/${id}/rollback`, data),
  share: (id, data) => api.post(`/notes/${id}/share`, data),
};

export const commentApi = {
  listByNote: (noteId, params) => api.get(`/comments/note/${noteId}`, { params }),
  create: (data) => api.post('/comments', data),
  update: (id, data) => api.put(`/comments/${id}`, data),
  resolve: (id) => api.post(`/comments/${id}/resolve`),
  remove: (id) => api.delete(`/comments/${id}`),
};

export const searchApi = {
  search: (params) => api.get('/search', { params }),
  history: (wsId) => api.get(`/search/history/${wsId}`),
  clearHistory: (wsId) => api.delete(`/search/history/${wsId}`),
  hot: (wsId) => api.get(`/search/hot/${wsId}`),
};

export const tagApi = {
  list: (wsId) => api.get(`/tags/${wsId}`),
  create: (data) => api.post('/tags', data),
  remove: (id) => api.delete(`/tags/${id}`),
};

export const templateApi = {
  list: () => api.get('/templates'),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  remove: (id) => api.delete(`/templates/${id}`),
};

export const notificationApi = {
  list: (params) => api.get('/notifications', { params }),
  read: (id) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
};

export const ioApi = {
  exportMd: (id) => `/api/io/notes/${id}/export/md`,
  exportHtml: (id) => `/api/io/notes/${id}/export/html`,
  exportPdf: (id) => `/api/io/notes/${id}/export/pdf`,
  importMd: (data) => api.post('/io/import/md', data),
  importFile: (form) => api.post('/io/import/file', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const userApi = {
  list: (params) => api.get('/users', { params }),
};
